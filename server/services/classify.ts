import OpenAI from "openai";
import { ENV } from "../_core/env";
import type { ClassificationResult } from "../../shared/pulse-types";

const openai = new OpenAI({ apiKey: ENV.openaiApiKey });

const SYSTEM_PROMPT = `You are an emergency medical dispatcher AI. Analyze the caller's transcript and classify the emergency.

You MUST respond with valid JSON matching this exact schema:
{
  "emergencyType": one of ["CARDIAC_ARREST", "MAJOR_TRAUMA", "OBSTETRIC_EMERGENCY", "RESPIRATORY_DISTRESS", "STROKE", "SEVERE_BLEEDING", "UNKNOWN"],
  "severity": one of ["critical", "high", "moderate"],
  "confidence": number 0-1,
  "summary": "brief clinical summary",
  "keySymptoms": ["symptom1", "symptom2"],
  "cprNeeded": boolean,
  "traumaWarning": boolean (true if patient should NOT be moved),
  "doNotMove": boolean,
  "specialInstructions": ["instruction1"],
  "hospitalType": one of ["cardiac_center", "trauma_center", "maternity_hospital", "hospital"]
}

Classification rules:
- CARDIAC_ARREST: unresponsive, not breathing, no pulse, chest pain with collapse
- MAJOR_TRAUMA: car accident, fall from height, penetrating injury, crush injury
- OBSTETRIC_EMERGENCY: labor complications, heavy bleeding during pregnancy, eclampsia
- RESPIRATORY_DISTRESS: severe breathing difficulty, choking, asthma attack, anaphylaxis
- STROKE: sudden facial drooping, arm weakness, speech difficulty, sudden severe headache
- SEVERE_BLEEDING: uncontrolled bleeding, arterial bleeding, major laceration
- UNKNOWN: cannot determine from transcript

Medical guardrails:
- For CARDIAC_ARREST: always set cprNeeded=true
- For MAJOR_TRAUMA: always set doNotMove=true, traumaWarning=true
- For OBSTETRIC_EMERGENCY: hospitalType must be "maternity_hospital"
- For STROKE: time-critical, severity always "critical"`;

export async function classifyEmergency(transcript: string): Promise<ClassificationResult> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Emergency transcript:\n\n"${transcript}"` },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
    max_tokens: 500,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("No classification response from OpenAI");

  const result = JSON.parse(content) as ClassificationResult;
  return result;
}

export async function transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<string> {
  const ext = mimeType.includes("webm") ? "webm" : mimeType.includes("wav") ? "wav" : "mp3";
  const file = new File([new Uint8Array(audioBuffer)], `recording.${ext}`, { type: mimeType });

  const response = await openai.audio.transcriptions.create({
    model: "whisper-1",
    file,
    language: "en",
  });

  return response.text;
}
