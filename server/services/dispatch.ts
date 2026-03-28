import axios from "axios";
import { ENV } from "../_core/env";

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface EmergencyDetails {
  summary: string;
  emergencyType: string;
  severity: string;
  cprStatus: string;
  eta?: string;
  patientCondition?: string;
  hospitalName?: string;
  distance?: string;
  latitude?: number;
  longitude?: number;
}

interface DispatchResult {
  callId: string;
  status: string;
}

export interface CallOutcome {
  hospitalConfirmed: boolean;    // Did hospital confirm they are the right department?
  erAvailable: boolean;          // Did hospital say ER is accepting patients?
  equipmentReady: boolean;       // Did hospital confirm equipment/team available?
  specialInstructions: string[]; // Any instructions from hospital to relay to bystander
  outcome: "accepted" | "rejected" | "unknown";
}

// ─── dispatchCall ─────────────────────────────────────────────────────────────

export async function dispatchCall(
  phoneNumber: string,
  details: EmergencyDetails
): Promise<DispatchResult> {
  const hospitalName = details.hospitalName ?? "your facility";
  const distance = details.distance ?? "nearby";

  const systemPrompt = `You are Pulse, an AI emergency dispatch coordinator. You are calling the emergency department of a hospital to notify them of an incoming patient. You must conduct a structured, professional, back-and-forth conversation — do NOT dump all information at once. Follow this exact sequence:

STEP 1 — Identity Confirmation:
You have already asked: "Hello, this is Pulse Emergency Dispatch. Am I speaking with the emergency department at ${hospitalName}?"
Wait for their response. If they confirm yes or indicate they are the ED, proceed to STEP 2.
If they say no or seem confused, politely clarify or ask to be transferred to the emergency department. If they cannot help, say: "Understood, we will try the next nearest facility. Thank you for your time." and end the call.

STEP 2 — Patient Briefing + ER Availability:
Say exactly: "We have a ${details.emergencyType} patient approximately ${distance} from your location. A bystander called in reporting: ${details.summary}. Is your emergency room currently accepting patients?"
Wait for their response.
If they say yes or are accepting, proceed to STEP 3.
If they say no, are full, on divert, or unavailable, say: "Understood, we will try the next nearest facility. Thank you for your time." and end the call.

STEP 3 — Equipment & Team Confirmation:
Say exactly: "The bystander reports ${details.cprStatus}. Can you confirm you have the necessary equipment and team available?"
Wait for their response.
If they confirm yes, proceed to STEP 4.
If they cannot confirm readiness, say: "Understood, we will try the next nearest facility. Thank you for your time." and end the call.

STEP 4 — Ambulance & Location:
Say exactly: "Thank you. We are dispatching an ambulance now. The patient's exact GPS location has been sent to this number via text message with a Google Maps link. Can you confirm you'll have a team ready at the ER entrance?"
Wait for their response.

STEP 5 — Relay Request:
Say exactly: "The patient's estimated arrival is approximately 8 minutes. Is there anything you need us to relay to the bystander on scene?"
Wait for their response. Listen carefully and note any instructions they give.

STEP 6 — Close:
Acknowledge their instructions (if any) and close politely. For example: "Understood, I'll relay that immediately. Ambulance is en route and location details have been texted. Thank you for your quick response. Goodbye." or if no instructions: "Perfect. Ambulance is en route. Location details have been sent via text. Thank you and goodbye."

IMPORTANT RULES:
- Speak calmly and clearly at all times. This is an emergency.
- Do NOT rush. Wait for the human to finish speaking before responding.
- Do NOT repeat the entire briefing if they ask a follow-up — answer concisely.
- If at any point the hospital says they cannot accept the patient, end the call gracefully with the divert message above.
- Keep all responses concise and professional.`;

  const firstMessage = `Hello, this is Pulse Emergency Dispatch. Am I speaking with the emergency department at ${hospitalName}?`;

  const response = await axios.post(
    "https://api.vapi.ai/call/phone",
    {
      phoneNumberId: ENV.vapiPhoneNumberId,
      customer: {
        number: phoneNumber,
      },
      assistant: {
        name: "Pulse Dispatch",
        firstMessage,
        model: {
          provider: "openai",
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: systemPrompt,
            },
          ],
          temperature: 0.3,
        },
        voice: {
          provider: "11labs",
          voiceId: "sarah",
          speed: 0.9,
        },
        maxDurationSeconds: 90,
        endCallMessage:
          "This is Pulse Emergency Dispatch. The call has ended. Goodbye.",
        endCallPhrases: [
          "goodbye",
          "thank you goodbye",
          "end call",
          "hang up",
        ],
        recordingEnabled: true,
        transcriber: {
          provider: "deepgram",
          model: "nova-2",
          language: "en",
        },
      },
    },
    {
      headers: {
        Authorization: `Bearer ${ENV.vapiApiKey}`,
        "Content-Type": "application/json",
      },
    }
  );

  return {
    callId: response.data.id,
    status: response.data.status,
  };
}

// ─── getCallStatus ────────────────────────────────────────────────────────────

export async function getCallStatus(callId: string): Promise<{
  id: string;
  status: string; // "queued" | "ringing" | "in-progress" | "forwarding" | "ended"
  endedReason?: string;
  duration?: number;
  transcript?: string;
  summary?: string;
  messages?: Array<{ role: string; message: string; time: number }>;
}> {
  const response = await axios.get(`https://api.vapi.ai/call/${callId}`, {
    headers: {
      Authorization: `Bearer ${ENV.vapiApiKey}`,
    },
  });

  const data = response.data;

  return {
    id: data.id,
    status: data.status,
    endedReason: data.endedReason,
    duration: data.duration,
    transcript: data.transcript,
    summary: data.summary,
    messages: data.messages,
  };
}

// ─── parseCallOutcome ─────────────────────────────────────────────────────────

export function parseCallOutcome(transcript: string): CallOutcome {
  if (!transcript || transcript.trim().length === 0) {
    return {
      hospitalConfirmed: false,
      erAvailable: false,
      equipmentReady: false,
      specialInstructions: [],
      outcome: "unknown",
    };
  }

  const lower = transcript.toLowerCase();

  // Positive signal keywords
  const positiveSignals = ["yes", "accepting", "ready", "available", "come", "send", "confirmed", "affirmative", "correct", "sure", "absolutely"];
  // Negative signal keywords
  const negativeSignals = ["no", "full", "divert", "cannot", "unavailable", "not accepting", "at capacity", "sorry", "unable", "negative"];

  const hasPositive = (text: string) =>
    positiveSignals.some((kw) => text.includes(kw));
  const hasNegative = (text: string) =>
    negativeSignals.some((kw) => text.includes(kw));

  // Split transcript into lines/sentences for per-turn analysis
  const sentences = transcript
    .split(/[.\n!?]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  // hospitalConfirmed: hospital acknowledged they are the ED
  // Look for affirmative response near identity-related words
  const identityContext = sentences
    .filter((s) =>
      /emergency|department|speaking|yes|correct|this is|we are/.test(
        s.toLowerCase()
      )
    )
    .join(" ")
    .toLowerCase();
  const hospitalConfirmed =
    hasPositive(identityContext) && !hasNegative(identityContext);

  // erAvailable: hospital said ER is accepting
  const availabilityContext = sentences
    .filter((s) =>
      /accepting|available|room|capacity|er |emergency room/.test(
        s.toLowerCase()
      )
    )
    .join(" ")
    .toLowerCase();
  const erAvailable =
    hasPositive(availabilityContext) && !hasNegative(availabilityContext);

  // equipmentReady: hospital confirmed equipment/team
  const equipmentContext = sentences
    .filter((s) =>
      /equipment|team|staff|ready|prepared|resource/.test(s.toLowerCase())
    )
    .join(" ")
    .toLowerCase();
  const equipmentReady =
    hasPositive(equipmentContext) && !hasNegative(equipmentContext);

  // specialInstructions: sentences following relay/tell/instruct keywords
  const specialInstructions: string[] = [];
  const relayPattern = /(?:relay|tell|instruct|inform|advise|let them know)[^\.\n]*[\.!\n]?/gi;
  const relayMatches = transcript.match(relayPattern) ?? [];

  for (const match of relayMatches) {
    // Strip the trigger word and keep the instruction part
    const instruction = match
      .replace(/^(relay|tell|instruct|inform|advise|let them know)\s*/i, "")
      .trim();
    if (instruction.length > 3) {
      specialInstructions.push(instruction);
    }
  }

  // Also capture the sentence immediately following a relay-trigger sentence
  for (let i = 0; i < sentences.length - 1; i++) {
    const s = sentences[i].toLowerCase();
    if (/relay|tell the bystander|instruct|let them know/.test(s)) {
      const next = sentences[i + 1].trim();
      if (next.length > 3 && !specialInstructions.includes(next)) {
        specialInstructions.push(next);
      }
    }
  }

  // Determine overall outcome
  const hasExplicitDivert = /divert|not accept|cannot accept|full|at capacity|try (the )?next/.test(lower);
  const hasAcceptance = erAvailable && equipmentReady;

  let outcome: "accepted" | "rejected" | "unknown";
  if (hasExplicitDivert || hasNegative(lower)) {
    outcome = "rejected";
  } else if (hasAcceptance) {
    outcome = "accepted";
  } else {
    outcome = "unknown";
  }

  return {
    hospitalConfirmed,
    erAvailable,
    equipmentReady,
    specialInstructions,
    outcome,
  };
}
