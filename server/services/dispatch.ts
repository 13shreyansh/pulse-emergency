import axios from "axios";
import { ENV } from "../_core/env";

interface EmergencyDetails {
  summary: string;
  emergencyType: string;
  severity: string;
  cprStatus: string;
  eta?: string;
  patientCondition?: string;
  hospitalName?: string;
}

interface DispatchResult {
  callId: string;
  status: string;
}

export async function dispatchCall(
  targetPhone: string,
  details: EmergencyDetails
): Promise<DispatchResult> {
  const firstMessage = [
    `This is an automated emergency dispatch from Project Pulse.`,
    `Emergency type: ${details.emergencyType}. Severity: ${details.severity}.`,
    details.summary,
    details.patientCondition ? `Patient condition: ${details.patientCondition}.` : "",
    `Bystander CPR status: ${details.cprStatus}.`,
    details.eta ? `Estimated arrival: ${details.eta}.` : "",
    `Please prepare your emergency department immediately.`,
  ].filter(Boolean).join(" ");

  const payload = {
    phoneNumberId: ENV.vapiPhoneNumberId,
    customer: { number: targetPhone },
    assistant: {
      firstMessage,
      model: {
        provider: "openai",
        model: "gpt-4o",
        messages: [
          {
            role: "system" as const,
            content: `You are an emergency medical dispatch AI calling a hospital to notify them of an incoming critical patient. Be concise, professional, and urgent. You have already delivered the initial emergency details. Now:
1. Confirm the hospital can receive the patient
2. Ask what preparations they are making
3. Ask for the direct ER line if available
4. Confirm the expected arrival time
Keep the call under 60 seconds. Lives depend on speed.`,
          },
        ],
      },
      voice: {
        provider: "11labs" as const,
        voiceId: "sarah",
      },
      endCallMessage: "Thank you. Emergency services are en route. Preparing for patient arrival.",
      maxDurationSeconds: 120,
    },
  };

  const response = await axios.post("https://api.vapi.ai/call", payload, {
    headers: {
      Authorization: `Bearer ${ENV.vapiApiKey}`,
      "Content-Type": "application/json",
    },
    timeout: 15000,
  });

  return {
    callId: response.data.id,
    status: response.data.status || "queued",
  };
}

export async function getCallStatus(callId: string): Promise<{
  id: string;
  status: string;
  endedReason?: string;
  duration?: number;
}> {
  const response = await axios.get(`https://api.vapi.ai/call/${callId}`, {
    headers: {
      Authorization: `Bearer ${ENV.vapiApiKey}`,
    },
    timeout: 10000,
  });

  return {
    id: response.data.id,
    status: response.data.status,
    endedReason: response.data.endedReason,
    duration: response.data.duration,
  };
}
