import { eq, desc } from "drizzle-orm";
import { getDb } from "../db";
import { emergencySessions, dispatchLogs } from "../../drizzle/schema";
import type { InsertEmergencySession, InsertDispatchLog } from "../../drizzle/schema";

// ── In-memory fallback when DATABASE_URL is not set ──
// This allows the full pipeline to work without a database (demo mode, hackathon, etc.)
const memSessions = new Map<string, Record<string, unknown>>();
const memLogs = new Map<string, Array<Record<string, unknown>>>();

export async function createSession(sessionId: string, lat?: string, lng?: string) {
  const db = await getDb();
  if (db) {
    await db.insert(emergencySessions).values({
      sessionId,
      status: "recording",
      latitude: lat,
      longitude: lng,
    });
  } else {
    memSessions.set(sessionId, {
      sessionId,
      status: "recording",
      latitude: lat,
      longitude: lng,
      createdAt: new Date(),
    });
    memLogs.set(sessionId, []);
  }
  return sessionId;
}

export async function getSession(sessionId: string) {
  const db = await getDb();
  if (db) {
    const rows = await db.select().from(emergencySessions).where(eq(emergencySessions.sessionId, sessionId)).limit(1);
    return rows[0] || null;
  }
  return memSessions.get(sessionId) || null;
}

export async function updateSession(sessionId: string, data: Partial<InsertEmergencySession>) {
  const db = await getDb();
  if (db) {
    await db.update(emergencySessions).set(data).where(eq(emergencySessions.sessionId, sessionId));
  } else {
    const existing = memSessions.get(sessionId);
    if (existing) {
      memSessions.set(sessionId, { ...existing, ...data });
    }
  }
}

export async function addLog(
  sessionId: string,
  step: InsertDispatchLog["step"],
  message: string,
  metadata?: Record<string, unknown>
) {
  const db = await getDb();
  if (db) {
    await db.insert(dispatchLogs).values({ sessionId, step, message, metadata: metadata ?? null });
  } else {
    const logs = memLogs.get(sessionId) || [];
    logs.push({ sessionId, step, message, metadata: metadata ?? null, createdAt: new Date() });
    memLogs.set(sessionId, logs);
  }
}

export async function getLogs(sessionId: string) {
  const db = await getDb();
  if (db) {
    return db.select().from(dispatchLogs).where(eq(dispatchLogs.sessionId, sessionId)).orderBy(dispatchLogs.createdAt);
  }
  return memLogs.get(sessionId) || [];
}
