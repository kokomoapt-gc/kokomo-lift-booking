import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createBooking,
  getAllBookings,
  getBookingById,
  getBookingsByConfirmedDate,
  getBookingsByRequestedDate,
  updateBookingStatus,
} from "../db";
import { sendCustomerConfirmation, sendOwnerNotification } from "../email";
import { createCalendarEvent } from "../googleCalendar";
import { notifyOwner } from "../_core/notification";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";

// ─── Validation helpers ──────────────────────────────────────────────────────

/** Returns true if the date string (YYYY-MM-DD) is a weekday (Mon–Fri) */
function isWeekday(dateStr: string): boolean {
  const d = new Date(dateStr + "T12:00:00Z"); // noon UTC to avoid DST issues
  const day = d.getUTCDay(); // 0=Sun, 6=Sat
  return day >= 1 && day <= 5;
}

/** Returns true if HH:MM is within 09:00–16:00 and end time ≤ 16:00 */
function isValidTimeSlot(startTime: string, durationMinutes: number): boolean {
  const [h, m] = startTime.split(":").map(Number);
  const startMins = h * 60 + m;
  const endMins = startMins + durationMinutes;
  const earliest = 9 * 60;   // 09:00
  const latest = 16 * 60;    // 16:00
  return startMins >= earliest && endMins <= latest;
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function hasTimeOverlap(
  firstStartTime: string,
  firstDurationMinutes: number,
  secondStartTime: string,
  secondDurationMinutes: number,
): boolean {
  const firstStart = timeToMinutes(firstStartTime);
  const firstEnd = firstStart + firstDurationMinutes;
  const secondStart = timeToMinutes(secondStartTime);
  const secondEnd = secondStart + secondDurationMinutes;
  return firstStart < secondEnd && secondStart < firstEnd;
}

function getInsertId(result: unknown): number | undefined {
  const directInsertId = (result as { insertId?: number | string } | undefined)?.insertId;
  const nestedInsertId = Array.isArray(result)
    ? (result[0] as { insertId?: number | string } | undefined)?.insertId
    : undefined;
  return Number(directInsertId ?? nestedInsertId ?? 0) || undefined;
}

// ─── Shared booking schema ───────────────────────────────────────────────────

const bookingInputSchema = z.object({
  customerName: z.string().min(1).max(255),
  customerPhone: z.string().min(1).max(50),
  customerEmail: z.string().email().max(320),
  roomNumber: z.string().min(1).max(50),
  settlementConfirmed: z.boolean().refine(val => val === true, {
    message: "Settlement must be confirmed before booking.",
  }),
  settlementDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid settlement date format"),
  requestedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  requestedStartTime: z.string().regex(/^\d{2}:\d{2}$/),
  requestedDurationMinutes: z.number().int().min(30).max(150),
  notes: z.string().max(2000).optional(),
});

// ─── Router ──────────────────────────────────────────────────────────────────

export const bookingsRouter = router({
  /** Public: submit a new booking request */
  submit: publicProcedure
    .input(bookingInputSchema)
    .mutation(async ({ input }) => {
      // Server-side time validation
      if (!isWeekday(input.requestedDate)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Bookings are only available Monday to Friday." });
      }
      if (!isValidTimeSlot(input.requestedStartTime, input.requestedDurationMinutes)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Booking must be between 09:00 and 16:00, and cannot exceed 2.5 hours." });
      }

      const sameDayBookings = [
        ...await getBookingsByRequestedDate(input.requestedDate),
        ...await getBookingsByConfirmedDate(input.requestedDate),
      ];
      const seenBookingIds = new Set<number>();
      const conflictingBooking = sameDayBookings.find(booking => {
        if (seenBookingIds.has(booking.id)) return false;
        seenBookingIds.add(booking.id);
        if (booking.status === "rejected" || booking.status === "cancelled") return false;
        const comparisonStartTime = booking.status === "confirmed" && booking.confirmedStartTime
          ? booking.confirmedStartTime
          : booking.requestedStartTime;
        return hasTimeOverlap(
          input.requestedStartTime,
          input.requestedDurationMinutes,
          comparisonStartTime,
          booking.requestedDurationMinutes,
        );
      });

      if (conflictingBooking) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "That time overlaps with another active booking request. Please choose a different time.",
        });
      }

      const result = await createBooking({
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        customerEmail: input.customerEmail,
        roomNumber: input.roomNumber,
        settlementConfirmed: input.settlementConfirmed,
        settlementDate: input.settlementDate,
        requestedDate: input.requestedDate,
        requestedStartTime: input.requestedStartTime,
        requestedDurationMinutes: input.requestedDurationMinutes,
        notes: input.notes ?? null,
        status: "pending",
      });
      const insertId = getInsertId(result);

      // Notify owner via email (non-blocking)
      sendOwnerNotification({
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        customerEmail: input.customerEmail,
        roomNumber: input.roomNumber,
        requestedDate: input.requestedDate,
        requestedStartTime: input.requestedStartTime,
        requestedDurationMinutes: input.requestedDurationMinutes,
        notes: input.notes,
      }).catch(err => console.error("[Email] Owner notification failed:", err));

      // In-app notification for owner
      notifyOwner({
        title: `New Booking – Room ${input.roomNumber}`,
        content: `${input.customerName} has requested a booking on ${input.requestedDate} at ${input.requestedStartTime}.`,
      }).catch(() => {});

      return { success: true, bookingId: insertId };
    }),

  /** Admin: list all bookings */
  list: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required." });
    }
    return getAllBookings();
  }),

  /** Admin: confirm a booking */
  confirm: protectedProcedure
    .input(z.object({
      id: z.number().int().positive(),
      confirmedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      confirmedStartTime: z.string().regex(/^\d{2}:\d{2}$/),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required." });
      }

      const booking = await getBookingById(input.id);
      if (!booking) throw new TRPCError({ code: "NOT_FOUND", message: "Booking not found." });
      if (booking.status !== "pending") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only pending bookings can be confirmed." });
      }

      // Validate confirmed time slot
      if (!isWeekday(input.confirmedDate)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Confirmed date must be a weekday." });
      }
      if (!isValidTimeSlot(input.confirmedStartTime, booking.requestedDurationMinutes)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Confirmed time must be between 09:00 and 16:00." });
      }

      const confirmedSameDay = await getBookingsByConfirmedDate(input.confirmedDate);
      const conflictingBooking = confirmedSameDay.find(otherBooking => {
        if (otherBooking.id === booking.id || otherBooking.status !== "confirmed") return false;
        if (!otherBooking.confirmedStartTime) return false;
        return hasTimeOverlap(
          input.confirmedStartTime,
          booking.requestedDurationMinutes,
          otherBooking.confirmedStartTime,
          otherBooking.requestedDurationMinutes,
        );
      });

      if (conflictingBooking) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `This confirmed time overlaps with booking #${conflictingBooking.id}.`,
        });
      }

      // Create Google Calendar event
      let calendarEventId: string | undefined;
      try {
        const eventId = await createCalendarEvent({
          customerName: booking.customerName,
          customerPhone: booking.customerPhone,
          customerEmail: booking.customerEmail,
          roomNumber: booking.roomNumber,
          confirmedDate: input.confirmedDate,
          confirmedStartTime: input.confirmedStartTime,
          requestedDurationMinutes: booking.requestedDurationMinutes,
          notes: booking.notes,
        });
        calendarEventId = eventId ?? undefined;
      } catch (err) {
        console.error("[GoogleCalendar] Event creation failed:", err);
      }

      await updateBookingStatus(input.id, "confirmed", input.confirmedDate, input.confirmedStartTime, calendarEventId);

      // Send confirmation email to customer (non-blocking)
      sendCustomerConfirmation({
        customerName: booking.customerName,
        customerEmail: booking.customerEmail,
        roomNumber: booking.roomNumber,
        confirmedDate: input.confirmedDate,
        confirmedStartTime: input.confirmedStartTime,
        requestedDurationMinutes: booking.requestedDurationMinutes,
        notes: booking.notes,
      }).catch(err => console.error("[Email] Customer confirmation failed:", err));

      return { success: true, calendarEventId };
    }),

  /** Admin: reject a booking */
  reject: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required." });
      }
      const booking = await getBookingById(input.id);
      if (!booking) throw new TRPCError({ code: "NOT_FOUND", message: "Booking not found." });
      await updateBookingStatus(input.id, "rejected");
      return { success: true };
    }),

  /** Public: cancel a pending or confirmed booking using reference and email */
  cancel: publicProcedure
    .input(z.object({
      id: z.number().int().positive(),
      customerEmail: z.string().email().max(320),
    }))
    .mutation(async ({ input }) => {
      const booking = await getBookingById(input.id);
      if (!booking) throw new TRPCError({ code: "NOT_FOUND", message: "Booking not found." });
      if (booking.customerEmail.toLowerCase() !== input.customerEmail.toLowerCase()) {
        throw new TRPCError({ code: "FORBIDDEN", message: "The email address does not match this booking." });
      }
      if (booking.status === "rejected" || booking.status === "cancelled") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This booking is already closed." });
      }
      await updateBookingStatus(input.id, "cancelled");
      return { success: true };
    }),
});
