import twilio from "twilio";
import { ENV } from "../_core/env";

/**
 * Send an SMS with the patient's GPS location to the hospital phone number.
 * Uses Twilio API Key auth (not Account SID + Auth Token).
 */
export async function sendLocationSms(
  toPhone: string,
  details: {
    hospitalName: string;
    emergencyType: string;
    latitude: number;
    longitude: number;
  }
): Promise<{ messageSid: string }> {
  const client = twilio(ENV.twilioApiKeySid, ENV.twilioApiKeySecret, {
    accountSid: ENV.twilioAccountSid,
  });

  const mapsLink = `https://www.google.com/maps?q=${details.latitude},${details.longitude}`;

  const body = [
    `🚨 PULSE EMERGENCY DISPATCH`,
    ``,
    `Emergency: ${details.emergencyType.replace(/_/g, " ")}`,
    `Hospital: ${details.hospitalName}`,
    ``,
    `📍 Patient GPS Location:`,
    `Lat: ${details.latitude}, Lng: ${details.longitude}`,
    ``,
    `Google Maps: ${mapsLink}`,
    ``,
    `Ambulance has been dispatched. Please have ER team ready at entrance.`,
  ].join("\n");

  const message = await client.messages.create({
    body,
    from: ENV.twilioPhoneNumber,
    to: toPhone,
  });

  return { messageSid: message.sid };
}
