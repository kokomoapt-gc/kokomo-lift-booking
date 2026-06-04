import { boolean, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const bookings = mysqlTable("bookings", {
  id: int("id").autoincrement().primaryKey(),
  // Customer details
  customerName: varchar("customerName", { length: 255 }).notNull(),
  customerPhone: varchar("customerPhone", { length: 50 }).notNull(),
  customerEmail: varchar("customerEmail", { length: 320 }).notNull(),
  roomNumber: varchar("roomNumber", { length: 50 }).notNull(),
  // Requested time (UTC ms)
  requestedDate: varchar("requestedDate", { length: 20 }).notNull(), // YYYY-MM-DD
  requestedStartTime: varchar("requestedStartTime", { length: 10 }).notNull(), // HH:MM
  requestedDurationMinutes: int("requestedDurationMinutes").notNull(), // max 150
  notes: text("notes"),
  // Settlement confirmation
  settlementConfirmed: boolean("settlementConfirmed").default(false).notNull(),
  settlementDate: varchar("settlementDate", { length: 20 }), // YYYY-MM-DD
  // Status management
  status: mysqlEnum("status", ["pending", "confirmed", "rejected", "cancelled"]).default("pending").notNull(),
  // Confirmed time set by owner (UTC ms)
  confirmedDate: varchar("confirmedDate", { length: 20 }),
  confirmedStartTime: varchar("confirmedStartTime", { length: 10 }),
  // Google Calendar event ID after creation
  calendarEventId: varchar("calendarEventId", { length: 255 }),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Booking = typeof bookings.$inferSelect;
export type InsertBooking = typeof bookings.$inferInsert;
