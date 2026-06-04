import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { bookings, InsertBooking, InsertUser, users } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  const databaseUrl = ENV.databaseUrl;
  if (!_db && databaseUrl) {
    try {
      _db = drizzle(databaseUrl);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Booking helpers ────────────────────────────────────────────────────────

export async function createBooking(data: InsertBooking) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(bookings).values(data);
  return result;
}

export async function getAllBookings() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(bookings).orderBy(bookings.createdAt);
}

export async function getBookingsByRequestedDate(date: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(bookings).where(eq(bookings.requestedDate, date));
}

export async function getBookingsByConfirmedDate(date: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(bookings).where(eq(bookings.confirmedDate, date));
}

export async function getBookingById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
  return result[0] ?? null;
}

export async function updateBookingStatus(
  id: number,
  status: "confirmed" | "rejected" | "cancelled",
  confirmedDate?: string,
  confirmedStartTime?: string,
  calendarEventId?: string,
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(bookings).set({
    status,
    ...(confirmedDate ? { confirmedDate } : {}),
    ...(confirmedStartTime ? { confirmedStartTime } : {}),
    ...(calendarEventId ? { calendarEventId } : {}),
  }).where(eq(bookings.id, id));
}
