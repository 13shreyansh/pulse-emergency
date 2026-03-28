import { z } from "zod";
import { nanoid } from "nanoid";
import { publicProcedure, router } from "../_core/trpc";
import { classifyEmergency, transcribeAudio } from "../services/classify";
import { searchNearbyHospitals } from "../services/hospitals";
import { scrapeHospitalsConcurrently, selectBestHospital } from "../services/scraper";
import { dispatchCall, getCallStatus } from "../services/dispatch";
import { createSession, getSession, updateSession, addLog, getLogs } from "../services/db-helpers";
import { ENV } from "../_core/env";
import type { ClassificationResult, HospitalResult, ScrapingResult, CprGuidance } from "../../shared/pulse-types";

function buildCprGuidance(classification: ClassificationResult): CprGuidance {
  if (!classification.cprNeeded) {
    return { needed: false, type: "none", instructions: [], warnings: [] };
  }

  const instructions = [
    "Place the heel of one hand on the center of the chest.",
    "Place your other hand on top, interlocking fingers.",
    "Push hard and fast — at least 2 inches deep.",
    "Allow full chest recoil between compressions.",
    "Maintain a rate of 100-120 compressions per minute.",
    "Do NOT stop until emergency services arrive.",
  ];

  const warnings: string[] = [];
  if (classification.traumaWarning || classification.doNotMove) {
    warnings.push("DO NOT move the patient — suspected spinal or trauma injury.");
  }
  if (classification.emergencyType === "SEVERE_BLEEDING") {
    warnings.push("Apply direct pressure to the wound with a clean cloth.");
  }

  return {
    needed: true,
    type: "hands_only",
    instructions,
    warnings,
  };
}

export const emergencyRouter = router({
  startSession: publicProcedure
    .input(z.object({
      latitude: z.string().optional(),
      longitude: z.string().optional(),
    }).optional())
    .mutation(async ({ input }) => {
      const sessionId = `pulse-${nanoid(12)}`;
      await createSession(sessionId, input?.latitude, input?.longitude);
      await addLog(sessionId, "voice_captured", "Emergency session started. Awaiting voice input.");
      return { sessionId };
    }),

  transcribe: publicProcedure
    .input(z.object({
      sessionId: z.string(),
      audioBase64: z.string(),
      mimeType: z.string().default("audio/webm"),
    }))
    .mutation(async ({ input }) => {
      const { sessionId, audioBase64, mimeType } = input;
      await updateSession(sessionId, { status: "classifying" });
      await addLog(sessionId, "voice_captured", "Voice recording received. Transcribing...");

      const audioBuffer = Buffer.from(audioBase64, "base64");
      const transcript = await transcribeAudio(audioBuffer, mimeType);

      await updateSession(sessionId, { transcript });
      await addLog(sessionId, "transcription_complete", `Transcription: "${transcript.substring(0, 100)}..."`, { transcript });

      return { transcript };
    }),

  classify: publicProcedure
    .input(z.object({
      sessionId: z.string(),
      transcript: z.string(),
    }))
    .mutation(async ({ input }) => {
      const { sessionId, transcript } = input;
      await updateSession(sessionId, { status: "classifying" });
      await addLog(sessionId, "voice_captured", "Analyzing emergency...");

      const classification = await classifyEmergency(transcript);
      const cprGuidance = buildCprGuidance(classification);

      await updateSession(sessionId, {
        emergencyType: classification.emergencyType,
        severity: classification.severity,
        classification: classification as any,
      });
      await addLog(sessionId, "classification_complete",
        `Emergency classified: ${classification.emergencyType} (${classification.severity}). Confidence: ${Math.round(classification.confidence * 100)}%`,
        { classification }
      );

      if (cprGuidance.needed) {
        await addLog(sessionId, "cpr_guidance_started", "CPR guidance activated — hands-only CPR recommended.", { cprGuidance });
      }

      return { classification, cprGuidance };
    }),

  searchHospitals: publicProcedure
    .input(z.object({
      sessionId: z.string(),
      latitude: z.number(),
      longitude: z.number(),
      hospitalType: z.string().default("hospital"),
    }))
    .mutation(async ({ input }) => {
      const { sessionId, latitude, longitude, hospitalType } = input;
      await updateSession(sessionId, { status: "searching", latitude: String(latitude), longitude: String(longitude) });
      await addLog(sessionId, "voice_captured", `Searching for ${hospitalType}s within 15km radius...`);

      const hospitals = await searchNearbyHospitals(latitude, longitude, hospitalType, 15);

      await updateSession(sessionId, { hospitalsFound: hospitals as any });
      await addLog(sessionId, "hospital_search_complete",
        `Found ${hospitals.length} hospitals. Nearest: ${hospitals[0]?.name} (${hospitals[0]?.distanceKm}km)`,
        { hospitalCount: hospitals.length, nearest: hospitals[0]?.name }
      );

      return { hospitals };
    }),

  scrapeAndSelect: publicProcedure
    .input(z.object({
      sessionId: z.string(),
      hospitals: z.array(z.object({
        name: z.string(),
        address: z.string(),
        latitude: z.number(),
        longitude: z.number(),
        distanceKm: z.number(),
        websiteUri: z.string().optional(),
        phoneNumber: z.string().optional(),
        placeId: z.string(),
        types: z.array(z.string()),
      })),
      emergencyType: z.string().default("hospital"),
    }))
    .mutation(async ({ input }) => {
      const { sessionId, hospitals, emergencyType } = input;
      await updateSession(sessionId, { status: "scraping" });
      await addLog(sessionId, "scraping_started",
        `Deploying ${Math.min(hospitals.length, 5)} TinyFish web agents to scrape hospital data...`
      );

      const scrapingResults = await scrapeHospitalsConcurrently(hospitals as HospitalResult[], 5);

      await updateSession(sessionId, { scrapingResults: scrapingResults as any });
      const successCount = scrapingResults.filter(r => r.success).length;
      await addLog(sessionId, "scraping_complete",
        `Scraping complete. ${successCount}/${scrapingResults.length} hospitals returned data.`,
        { successCount, total: scrapingResults.length }
      );

      const { hospital: bestHospital, scrapingData } = selectBestHospital(
        hospitals as HospitalResult[],
        scrapingResults,
        emergencyType
      );

      await updateSession(sessionId, {
        selectedHospitalName: bestHospital.name,
        selectedHospitalPhone: bestHospital.phoneNumber || undefined,
      });
      await addLog(sessionId, "hospital_selected",
        `Selected: ${bestHospital.name} (${bestHospital.distanceKm}km away)${scrapingData?.erWaitTime ? ` — ER wait: ${scrapingData.erWaitTime}` : ""}`,
        { hospital: bestHospital, scrapingData }
      );

      return { selectedHospital: bestHospital, scrapingData, allResults: scrapingResults };
    }),

  dispatch: publicProcedure
    .input(z.object({
      sessionId: z.string(),
      targetPhone: z.string().optional(),
      emergencyDetails: z.object({
        summary: z.string(),
        emergencyType: z.string(),
        severity: z.string(),
        cprStatus: z.string(),
        eta: z.string().optional(),
        patientCondition: z.string().optional(),
        hospitalName: z.string().optional(),
      }),
    }))
    .mutation(async ({ input }) => {
      const { sessionId, emergencyDetails } = input;
      const phone = input.targetPhone || ENV.demoTargetPhone;

      await updateSession(sessionId, { status: "dispatching" });
      await addLog(sessionId, "call_initiated",
        `Initiating autonomous call to ${emergencyDetails.hospitalName || "hospital"} at ${phone}...`
      );

      const result = await dispatchCall(phone, emergencyDetails);

      await updateSession(sessionId, {
        vapiCallId: result.callId,
        callStatus: result.status,
      });
      await addLog(sessionId, "call_connected",
        `Call dispatched (ID: ${result.callId}). Status: ${result.status}. AI agent is communicating with hospital.`,
        { callId: result.callId, status: result.status }
      );

      return result;
    }),

  getSession: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ input }) => {
      const session = await getSession(input.sessionId);
      const logs = await getLogs(input.sessionId);
      return { session, logs };
    }),

  getLogs: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ input }) => {
      return getLogs(input.sessionId);
    }),

  getCallStatus: publicProcedure
    .input(z.object({ callId: z.string() }))
    .query(async ({ input }) => {
      return getCallStatus(input.callId);
    }),

  // Demo mode: run the full pipeline with simulated data
  runDemo: publicProcedure
    .input(z.object({
      latitude: z.number().default(1.3521),
      longitude: z.number().default(103.8198),
      transcript: z.string().default("Help! Someone just collapsed at the food court. He was eating and suddenly grabbed his chest and fell. He's not breathing. I don't think he has a pulse. Please send help quickly!"),
    }))
    .mutation(async ({ input }) => {
      const sessionId = `pulse-demo-${nanoid(8)}`;
      await createSession(sessionId, String(input.latitude), String(input.longitude));
      return { sessionId, transcript: input.transcript };
    }),
});
