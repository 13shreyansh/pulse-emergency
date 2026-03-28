import axios from "axios";
import { ENV } from "../_core/env";
import type { HospitalResult, ScrapingResult } from "../../shared/pulse-types";

const TINYFISH_BASE = "https://agent.tinyfish.ai";

interface TinyFishRunResponse {
  run_id: string;
  status: string;
  result?: Record<string, unknown>;
  error?: string;
}

async function scrapeHospitalWebsite(hospital: HospitalResult): Promise<ScrapingResult> {
  if (!hospital.websiteUri) {
    return {
      hospitalName: hospital.name,
      websiteUrl: "",
      success: false,
      error: "No website URL available",
      scrapedAt: new Date().toISOString(),
    };
  }

  try {
    const response = await axios.post(
      `${TINYFISH_BASE}/api/v1/run`,
      {
        url: hospital.websiteUri,
        goal: `You are scraping a hospital website for emergency department information. Extract the following data if available:
1. ER wait time (current estimated wait time)
2. Resuscitation bay availability (yes/no/unknown)
3. Defibrillator availability (yes/no/unknown)
4. Trauma bay availability (yes/no/unknown)
5. Bed availability (number or status)
6. Emergency department phone number
7. Any relevant emergency service information

Return the data as a JSON object with keys: er_wait_time, resuscitation_bay_available, defibrillator_available, trauma_bay_available, bed_availability, emergency_phone, notes`,
      },
      {
        headers: {
          Authorization: `Bearer ${ENV.tinyfishApiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 45000,
      }
    );

    const data = response.data as TinyFishRunResponse;

    if (data.status === "COMPLETED" && data.result) {
      const result = data.result as Record<string, any>;
      return {
        hospitalName: hospital.name,
        websiteUrl: hospital.websiteUri,
        erWaitTime: result.er_wait_time || undefined,
        resuscitationBayAvailable: parseBool(result.resuscitation_bay_available),
        defibrillatorAvailable: parseBool(result.defibrillator_available),
        traumaBayAvailable: parseBool(result.trauma_bay_available),
        bedAvailability: result.bed_availability || undefined,
        rawData: JSON.stringify(result),
        scrapedAt: new Date().toISOString(),
        success: true,
      };
    }

    return {
      hospitalName: hospital.name,
      websiteUrl: hospital.websiteUri,
      success: false,
      error: data.error || "Scraping did not complete",
      scrapedAt: new Date().toISOString(),
    };
  } catch (error: any) {
    return {
      hospitalName: hospital.name,
      websiteUrl: hospital.websiteUri || "",
      success: false,
      error: error.message || "Scraping failed",
      scrapedAt: new Date().toISOString(),
    };
  }
}

function parseBool(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === "unknown") return undefined;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    return value.toLowerCase() === "yes" || value.toLowerCase() === "true";
  }
  return undefined;
}

/**
 * Fan-out: scrape up to 5 hospital websites concurrently using TinyFish agents.
 */
export async function scrapeHospitalsConcurrently(
  hospitals: HospitalResult[],
  maxConcurrent: number = 5
): Promise<ScrapingResult[]> {
  const targets = hospitals.slice(0, maxConcurrent).filter(h => h.websiteUri);

  if (targets.length === 0) {
    return hospitals.map(h => ({
      hospitalName: h.name,
      websiteUrl: h.websiteUri || "",
      success: false,
      error: "No website to scrape",
      scrapedAt: new Date().toISOString(),
    }));
  }

  const results = await Promise.allSettled(
    targets.map(hospital => scrapeHospitalWebsite(hospital))
  );

  return results.map((result, i) => {
    if (result.status === "fulfilled") return result.value;
    return {
      hospitalName: targets[i].name,
      websiteUrl: targets[i].websiteUri || "",
      success: false,
      error: result.reason?.message || "Promise rejected",
      scrapedAt: new Date().toISOString(),
    };
  });
}

/**
 * Select the best hospital based on scraping results and distance.
 */
export function selectBestHospital(
  hospitals: HospitalResult[],
  scrapingResults: ScrapingResult[],
  emergencyType: string
): { hospital: HospitalResult; scrapingData?: ScrapingResult } {
  // Score each hospital
  const scored = hospitals.map(hospital => {
    const scrapeData = scrapingResults.find(s => s.hospitalName === hospital.name);
    let score = 100 - (hospital.distanceKm * 5); // closer = better

    if (scrapeData?.success) {
      if (scrapeData.resuscitationBayAvailable) score += 30;
      if (scrapeData.defibrillatorAvailable) score += 20;
      if (scrapeData.traumaBayAvailable) score += 15;
      if (scrapeData.erWaitTime) {
        const waitMinutes = parseInt(scrapeData.erWaitTime);
        if (!isNaN(waitMinutes) && waitMinutes < 30) score += 25;
      }
    }

    return { hospital, scrapingData: scrapeData, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  return { hospital: best.hospital, scrapingData: best.scrapingData };
}
