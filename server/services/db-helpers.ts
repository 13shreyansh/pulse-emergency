import { eq, desc } from "drizzle-orm";
import { getDb } from "../db";
import { emergencySessions, dispatchLogs } from "../../drizzle/schema";
import type { InsertEmergencySession, InsertDispatchLog } from "../../drizzle/schema";

export async function createSession(sessionId: string, lat?: string, lng?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(emergencySessions).values({
    sessionId,
    status: "recording",
    latitude: lat,
    longitude: lng,
  });
  return sessionId;
}

export async function getSession(sessionId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(emergencySessions).where(eq(emergencySessions.sessionId, sessionId)).limit(1);
  return rows[0] || null;
}

export async function updateSession(sessionId: string, data: Partial<InsertEmergencySession>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(emergencySessions).set(data).where(eq(emergencySessions.sessionId, sessionId));
}

export async function addLog(
  sessionId: string,
  step: InsertDispatchLog["step"],
  message: string,
  metadata?: Record<string, unknown>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(dispatchLogs).values({ sessionId, step, message, metadata: metadata ?? null });
}

export async function getLogs(sessionId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(dispatchLogs).where(eq(dispatchLogs.sessionId, sessionId)).orderBy(dispatchLogs.createdAt);
}
