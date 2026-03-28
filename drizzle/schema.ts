import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json, bigint } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
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

/**
 * Emergency sessions track each dispatch from start to finish.
 */
export const emergencySessions = mysqlTable("emergency_sessions", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: varchar("sessionId", { length: 64 }).notNull().unique(),
  status: mysqlEnum("status", [
    "recording",
    "classifying",
    "searching",
    "scraping",
    "dispatching",
    "completed",
    "failed",
  ]).default("recording").notNull(),
  transcript: text("transcript"),
  emergencyType: varchar("emergencyType", { length: 64 }),
  severity: mysqlEnum("severity", ["critical", "high", "moderate"]),
  classification: json("classification"),
  latitude: text("latitude"),
  longitude: text("longitude"),
  hospitalsFound: json("hospitalsFound"),
  selectedHospitalName: text("selectedHospitalName"),
  selectedHospitalPhone: varchar("selectedHospitalPhone", { length: 32 }),
  scrapingResults: json("scrapingResults"),
  vapiCallId: varchar("vapiCallId", { length: 128 }),
  callStatus: varchar("callStatus", { length: 32 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
  totalDurationMs: bigint("totalDurationMs", { mode: "number" }),
});

export type EmergencySession = typeof emergencySessions.$inferSelect;
export type InsertEmergencySession = typeof emergencySessions.$inferInsert;

/**
 * Dispatch log entries for the live status feed.
 */
export const dispatchLogs = mysqlTable("dispatch_logs", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: varchar("sessionId", { length: 64 }).notNull(),
  step: mysqlEnum("step", [
    "voice_captured",
    "transcription_complete",
    "classification_complete",
    "hospital_search_complete",
    "scraping_started",
    "scraping_complete",
    "hospital_selected",
    "call_initiated",
    "call_connected",
    "call_completed",
    "cpr_guidance_started",
    "sms_sent",
    "sms_failed",
    "error",
  ]).notNull(),
  message: text("message").notNull(),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DispatchLog = typeof dispatchLogs.$inferSelect;
export type InsertDispatchLog = typeof dispatchLogs.$inferInsert;