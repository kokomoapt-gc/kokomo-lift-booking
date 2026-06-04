/**
 * Email sending via Nodemailer using Gmail SMTP.
 * Credentials are injected via environment variables:
 *   EMAIL_USER  – Gmail address (sender)
 *   EMAIL_PASS  – Gmail App Password (not the account password)
 */
import nodemailer from "nodemailer";

function getTransporter() {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  if (!user || !pass) {
    console.warn("[Email] EMAIL_USER or EMAIL_PASS not set – emails will be skipped.");
    return null;
  }
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
}

export async function sendOwnerNotification(booking: {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  roomNumber: string;
  requestedDate: string;
  requestedStartTime: string;
  requestedDurationMinutes: number;
  notes?: string | null;
}) {
  const transporter = getTransporter();
  if (!transporter) return;

  const ownerEmail = process.env.EMAIL_USER!;
  const durationHours = (booking.requestedDurationMinutes / 60).toFixed(1);

  await transporter.sendMail({
    from: `"Booking System" <${ownerEmail}>`,
    to: ownerEmail,
    subject: `📋 New Booking Request – Room ${booking.roomNumber} – ${booking.requestedDate}`,
    html: `
      <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #2c2c2c;">
        <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 32px; border-radius: 8px 8px 0 0;">
          <h1 style="color: #d4af37; margin: 0; font-size: 22px; letter-spacing: 2px; text-transform: uppercase;">New Booking Request</h1>
          <p style="color: #a0a0b0; margin: 8px 0 0; font-size: 14px;">A new appointment request has been submitted</p>
        </div>
        <div style="background: #f9f7f4; padding: 32px; border-radius: 0 0 8px 8px; border: 1px solid #e8e0d5;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 10px 0; border-bottom: 1px solid #e8e0d5; color: #888; font-size: 13px; width: 40%;">Customer Name</td><td style="padding: 10px 0; border-bottom: 1px solid #e8e0d5; font-weight: 600;">${booking.customerName}</td></tr>
            <tr><td style="padding: 10px 0; border-bottom: 1px solid #e8e0d5; color: #888; font-size: 13px;">Phone</td><td style="padding: 10px 0; border-bottom: 1px solid #e8e0d5;">${booking.customerPhone}</td></tr>
            <tr><td style="padding: 10px 0; border-bottom: 1px solid #e8e0d5; color: #888; font-size: 13px;">Email</td><td style="padding: 10px 0; border-bottom: 1px solid #e8e0d5;">${booking.customerEmail}</td></tr>
            <tr><td style="padding: 10px 0; border-bottom: 1px solid #e8e0d5; color: #888; font-size: 13px;">Room Number</td><td style="padding: 10px 0; border-bottom: 1px solid #e8e0d5;">${booking.roomNumber}</td></tr>
            <tr><td style="padding: 10px 0; border-bottom: 1px solid #e8e0d5; color: #888; font-size: 13px;">Requested Date</td><td style="padding: 10px 0; border-bottom: 1px solid #e8e0d5;">${booking.requestedDate}</td></tr>
            <tr><td style="padding: 10px 0; border-bottom: 1px solid #e8e0d5; color: #888; font-size: 13px;">Start Time</td><td style="padding: 10px 0; border-bottom: 1px solid #e8e0d5;">${booking.requestedStartTime}</td></tr>
            <tr><td style="padding: 10px 0; border-bottom: 1px solid #e8e0d5; color: #888; font-size: 13px;">Duration</td><td style="padding: 10px 0; border-bottom: 1px solid #e8e0d5;">${durationHours} hours (${booking.requestedDurationMinutes} min)</td></tr>
            ${booking.notes ? `<tr><td style="padding: 10px 0; color: #888; font-size: 13px;">Notes</td><td style="padding: 10px 0;">${booking.notes}</td></tr>` : ""}
          </table>
          <div style="margin-top: 24px; padding: 16px; background: #fff8e7; border-left: 4px solid #d4af37; border-radius: 4px;">
            <p style="margin: 0; font-size: 14px; color: #7a6a3a;">Please log in to your admin dashboard to confirm or reject this booking.</p>
          </div>
        </div>
      </div>
    `,
  });
}

export async function sendCustomerConfirmation(booking: {
  customerName: string;
  customerEmail: string;
  roomNumber: string;
  confirmedDate: string;
  confirmedStartTime: string;
  requestedDurationMinutes: number;
  notes?: string | null;
}) {
  const transporter = getTransporter();
  if (!transporter) return;

  const ownerEmail = process.env.EMAIL_USER!;
  const durationHours = (booking.requestedDurationMinutes / 60).toFixed(1);

  // Calculate end time
  const [h, m] = booking.confirmedStartTime.split(":").map(Number);
  const endMinutes = h * 60 + m + booking.requestedDurationMinutes;
  const endH = Math.floor(endMinutes / 60).toString().padStart(2, "0");
  const endM = (endMinutes % 60).toString().padStart(2, "0");
  const endTime = `${endH}:${endM}`;

  await transporter.sendMail({
    from: `"Booking System" <${ownerEmail}>`,
    to: booking.customerEmail,
    subject: `✅ Booking Confirmed – Room ${booking.roomNumber} – ${booking.confirmedDate}`,
    html: `
      <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #2c2c2c;">
        <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 32px; border-radius: 8px 8px 0 0;">
          <h1 style="color: #d4af37; margin: 0; font-size: 22px; letter-spacing: 2px; text-transform: uppercase;">Booking Confirmed</h1>
          <p style="color: #a0a0b0; margin: 8px 0 0; font-size: 14px;">Your appointment has been confirmed</p>
        </div>
        <div style="background: #f9f7f4; padding: 32px; border-radius: 0 0 8px 8px; border: 1px solid #e8e0d5;">
          <p style="font-size: 16px; margin-bottom: 24px;">Dear <strong>${booking.customerName}</strong>,</p>
          <p style="color: #555; line-height: 1.7;">Your booking request for <strong>Room ${booking.roomNumber}</strong> has been confirmed. Please find the details below:</p>
          <div style="background: #fff; border: 1px solid #e8e0d5; border-radius: 8px; padding: 24px; margin: 24px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 10px 0; border-bottom: 1px solid #f0ebe4; color: #888; font-size: 13px; width: 40%;">Date</td><td style="padding: 10px 0; border-bottom: 1px solid #f0ebe4; font-weight: 600;">${booking.confirmedDate}</td></tr>
              <tr><td style="padding: 10px 0; border-bottom: 1px solid #f0ebe4; color: #888; font-size: 13px;">Time</td><td style="padding: 10px 0; border-bottom: 1px solid #f0ebe4; font-weight: 600;">${booking.confirmedStartTime} – ${endTime}</td></tr>
              <tr><td style="padding: 10px 0; border-bottom: 1px solid #f0ebe4; color: #888; font-size: 13px;">Duration</td><td style="padding: 10px 0; border-bottom: 1px solid #f0ebe4;">${durationHours} hours</td></tr>
              <tr><td style="padding: 10px 0; color: #888; font-size: 13px;">Room</td><td style="padding: 10px 0;">${booking.roomNumber}</td></tr>
            </table>
          </div>
          ${booking.notes ? `<p style="color: #555; font-size: 14px;"><strong>Notes:</strong> ${booking.notes}</p>` : ""}
          <p style="color: #555; line-height: 1.7; font-size: 14px;">If you need to make any changes, please contact us as soon as possible.</p>
          <p style="color: #888; font-size: 13px; margin-top: 32px; border-top: 1px solid #e8e0d5; padding-top: 16px;">This is an automated confirmation email. Please do not reply to this message.</p>
        </div>
      </div>
    `,
  });
}
