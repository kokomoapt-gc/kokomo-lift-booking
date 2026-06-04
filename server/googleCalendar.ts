/**
 * Google Calendar integration using a Service Account.
 * Required env vars:
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL  – service account email
 *   GOOGLE_SERVICE_ACCOUNT_KEY    – private key (PEM, newlines as \n)
 *   GOOGLE_CALENDAR_ID            – target calendar ID (kokomoapt@gmail.com)
 */
import { google } from "googleapis";

function getCalendarClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.replace(/\\n/g, "\n");
  const calendarId = process.env.GOOGLE_CALENDAR_ID || "kokomoapt@gmail.com";

  if (!email || !key) {
    console.warn("[GoogleCalendar] Service account credentials not set – calendar events will be skipped.");
    return null;
  }

  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/calendar"],
    subject: calendarId, // impersonate the calendar owner
  });

  return { calendar: google.calendar({ version: "v3", auth }), calendarId };
}

export async function createCalendarEvent(booking: {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  roomNumber: string;
  confirmedDate: string;      // YYYY-MM-DD
  confirmedStartTime: string; // HH:MM
  requestedDurationMinutes: number;
  notes?: string | null;
}): Promise<string | null> {
  const client = getCalendarClient();
  if (!client) return null;

  const { calendar, calendarId } = client;

  // Build ISO datetime strings
  const startDateTime = `${booking.confirmedDate}T${booking.confirmedStartTime}:00`;
  const [h, m] = booking.confirmedStartTime.split(":").map(Number);
  const endMinutes = h * 60 + m + booking.requestedDurationMinutes;
  const endH = Math.floor(endMinutes / 60).toString().padStart(2, "0");
  const endM = (endMinutes % 60).toString().padStart(2, "0");
  const endDateTime = `${booking.confirmedDate}T${endH}:${endM}:00`;

  const description = [
    `Customer: ${booking.customerName}`,
    `Phone: ${booking.customerPhone}`,
    `Email: ${booking.customerEmail}`,
    `Room: ${booking.roomNumber}`,
    booking.notes ? `Notes: ${booking.notes}` : null,
  ].filter(Boolean).join("\n");

  try {
    const response = await calendar.events.insert({
      calendarId,
      requestBody: {
        summary: `Removalist – Room ${booking.roomNumber} – ${booking.customerName}`,
        description,
        start: { dateTime: startDateTime, timeZone: "Australia/Sydney" },
        end: { dateTime: endDateTime, timeZone: "Australia/Sydney" },
        attendees: [{ email: booking.customerEmail, displayName: booking.customerName }],
        reminders: {
          useDefault: false,
          overrides: [
            { method: "email", minutes: 24 * 60 },
            { method: "popup", minutes: 60 },
          ],
        },
      },
    });
    return response.data.id ?? null;
  } catch (err) {
    console.error("[GoogleCalendar] Failed to create event:", err);
    return null;
  }
}
