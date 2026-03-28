export type EmergencyType =
  | "CARDIAC_ARREST"
  | "MAJOR_TRAUMA"
  | "OBSTETRIC_EMERGENCY"
  | "RESPIRATORY_DISTRESS"
  | "STROKE"
  | "SEVERE_BLEEDING"
  | "UNKNOWN";

export type Severity = "critical" | "high" | "moderate";

export interface ClassificationResult {
  emergencyType: EmergencyType;
  severity: Severity;
  confidence: number;
  summary: string;
  keySymptoms: string[];
  cprNeeded: boolean;
  traumaWarning: boolean;
  doNotMove: boolean;
  specialInstructions: string[];
  hospitalType: string;
}

export interface HospitalResult {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  websiteUri?: string;
  phoneNumber?: string;
  placeId: string;
  types: string[];
}

export interface ScrapingResult {
  hospitalName: string;
  websiteUrl: string;
  erWaitTime?: string;
  resuscitationBayAvailable?: boolean;
  defibrillatorAvailable?: boolean;
  traumaBayAvailable?: boolean;
  bedAvailability?: string;
  rawData?: string;
  scrapedAt: string;
  success: boolean;
  error?: string;
}

export interface DispatchStatus {
  sessionId: string;
  step: string;
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface EmergencySessionState {
  sessionId: string;
  status: string;
  transcript?: string;
  classification?: ClassificationResult;
  hospitals?: HospitalResult[];
  scrapingResults?: ScrapingResult[];
  selectedHospital?: HospitalResult & { scrapingData?: ScrapingResult };
  callId?: string;
  callStatus?: string;
  logs: DispatchStatus[];
  cprGuidance?: CprGuidance;
}

export interface CprGuidance {
  needed: boolean;
  type: "hands_only" | "full_cpr" | "none";
  instructions: string[];
  warnings: string[];
}
