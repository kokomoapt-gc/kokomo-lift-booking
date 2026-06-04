import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock DB and external services
vi.mock("./db", () => ({
  createBooking: vi.fn().mockResolvedValue({ insertId: 1 }),
  getAllBookings: vi.fn().mockResolvedValue([]),
  getBookingById: vi.fn(),
  getBookingsByRequestedDate: vi.fn().mockResolvedValue([]),
  getBookingsByConfirmedDate: vi.fn().mockResolvedValue([]),
  updateBookingStatus: vi.fn().mockResolvedValue({}),
}));

vi.mock("./email", () => ({
  sendOwnerNotification: vi.fn().mockResolvedValue({}),
  sendCustomerConfirmation: vi.fn().mockResolvedValue({}),
}));

vi.mock("./googleCalendar", () => ({
  createCalendarEvent: vi.fn().mockResolvedValue("mock-event-id"),
}));

vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

import {
  createBooking,
  getAllBookings,
  getBookingById,
  getBookingsByRequestedDate,
  getBookingsByConfirmedDate,
  updateBookingStatus,
} from "./db";

function makeCtx(role: "admin" | "user" | null = null): TrpcContext {
  return {
    user: role
      ? {
          id: 1,
          openId: "test-user",
          email: "test@example.com",
          name: "Test User",
          loginMethod: "manus",
          role,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        }
      : null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

const validBookingInput = {
  customerName: "Jane Smith",
  customerPhone: "0412345678",
  customerEmail: "jane@example.com",
  roomNumber: "12A",
  settlementConfirmed: true,
  settlementDate: "2026-05-15",
  requestedDate: "2026-06-09", // Monday
  requestedStartTime: "10:00",
  requestedDurationMinutes: 60,
  notes: "Please be careful with the piano.",
};

describe("bookings.submit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getBookingsByRequestedDate).mockResolvedValue([]);
    vi.mocked(getBookingsByConfirmedDate).mockResolvedValue([]);
  });

  it("accepts a valid weekday booking", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    const result = await caller.bookings.submit(validBookingInput);
    expect(result.success).toBe(true);
    expect(createBooking).toHaveBeenCalledOnce();
  });

  it("rejects an overlapping active request", async () => {
    vi.mocked(getBookingsByRequestedDate).mockResolvedValue([{
      id: 8,
      ...validBookingInput,
      status: "pending",
      confirmedDate: null,
      confirmedStartTime: null,
      calendarEventId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);

    const caller = appRouter.createCaller(makeCtx(null));
    await expect(
      caller.bookings.submit({ ...validBookingInput, requestedStartTime: "10:30" })
    ).rejects.toThrow("overlaps");
  });

  it("rejects a weekend date", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    await expect(
      caller.bookings.submit({ ...validBookingInput, requestedDate: "2026-06-07" }) // Saturday
    ).rejects.toThrow("Monday to Friday");
  });

  it("rejects start time before 09:00", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    await expect(
      caller.bookings.submit({ ...validBookingInput, requestedStartTime: "08:00" })
    ).rejects.toThrow();
  });

  it("rejects booking that would end after 16:00", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    await expect(
      caller.bookings.submit({ ...validBookingInput, requestedStartTime: "14:00", requestedDurationMinutes: 150 })
    ).rejects.toThrow();
  });

  it("rejects duration over 150 minutes", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    await expect(
      caller.bookings.submit({ ...validBookingInput, requestedDurationMinutes: 180 })
    ).rejects.toThrow();
  });
});

describe("bookings.list", () => {
  it("returns bookings for admin", async () => {
    vi.mocked(getAllBookings).mockResolvedValue([]);
    const caller = appRouter.createCaller(makeCtx("admin"));
    const result = await caller.bookings.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("throws FORBIDDEN for non-admin", async () => {
    const caller = appRouter.createCaller(makeCtx("user"));
    await expect(caller.bookings.list()).rejects.toThrow("Admin access required");
  });
});

describe("bookings.confirm", () => {
  it("confirms a pending booking and creates calendar event", async () => {
    vi.mocked(getBookingById).mockResolvedValue({
      id: 1,
      customerName: "Jane Smith",
      customerPhone: "0412345678",
      customerEmail: "jane@example.com",
      roomNumber: "12A",
      requestedDate: "2026-06-09",
      requestedStartTime: "10:00",
      requestedDurationMinutes: 60,
      notes: null,
      status: "pending",
      confirmedDate: null,
      confirmedStartTime: null,
      calendarEventId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      settlementConfirmed: true,
      settlementDate: "2026-05-15",
    });
    vi.mocked(getBookingsByConfirmedDate).mockResolvedValue([]);

    const caller = appRouter.createCaller(makeCtx("admin"));
    const result = await caller.bookings.confirm({
      id: 1,
      confirmedDate: "2026-06-09",
      confirmedStartTime: "10:00",
    });
    expect(result.success).toBe(true);
    expect(updateBookingStatus).toHaveBeenCalledWith(1, "confirmed", "2026-06-09", "10:00", "mock-event-id");
  });

  it("throws NOT_FOUND for missing booking", async () => {
    vi.mocked(getBookingById).mockResolvedValue(null);
    const caller = appRouter.createCaller(makeCtx("admin"));
    await expect(
      caller.bookings.confirm({ id: 999, confirmedDate: "2026-06-09", confirmedStartTime: "10:00" })
    ).rejects.toThrow("not found");
  });
});

describe("bookings.reject", () => {
  it("rejects a pending booking", async () => {
    vi.mocked(getBookingById).mockResolvedValue({
      id: 2,
      customerName: "Bob",
      customerPhone: "0400000000",
      customerEmail: "bob@example.com",
      roomNumber: "3B",
      requestedDate: "2026-06-10",
      requestedStartTime: "09:00",
      requestedDurationMinutes: 90,
      notes: null,
      status: "pending",
      confirmedDate: null,
      confirmedStartTime: null,
      calendarEventId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      settlementConfirmed: true,
      settlementDate: "2026-05-15",
    });

    const caller = appRouter.createCaller(makeCtx("admin"));
    const result = await caller.bookings.reject({ id: 2 });
    expect(result.success).toBe(true);
    expect(updateBookingStatus).toHaveBeenCalledWith(2, "rejected");
  });
});

describe("bookings.cancel", () => {
  it("cancels a matching booking by email", async () => {
    vi.mocked(getBookingById).mockResolvedValue({
      id: 3,
      customerName: "Jane Smith",
      customerPhone: "0412345678",
      customerEmail: "jane@example.com",
      roomNumber: "12A",
      requestedDate: "2026-06-09",
      requestedStartTime: "10:00",
      requestedDurationMinutes: 60,
      notes: null,
      status: "pending",
      confirmedDate: null,
      confirmedStartTime: null,
      calendarEventId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      settlementConfirmed: true,
      settlementDate: "2026-05-15",
    });

    const caller = appRouter.createCaller(makeCtx(null));
    const result = await caller.bookings.cancel({ id: 3, customerEmail: "jane@example.com" });
    expect(result.success).toBe(true);
    expect(updateBookingStatus).toHaveBeenCalledWith(3, "cancelled");
  });
});
