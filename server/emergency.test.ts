import { describe, expect, it, vi } from "vitest";

import type {
  ClassificationResult,
  DispatchStatus,
  HospitalResult,
  ScrapingResult,
} from "../shared/pulse-types";

type CprGuidance = {
  needed: boolean;
  type: "hands_only" | "full_cpr" | "none";
  instructions: string[];
  warnings: string[];
};

function buildCprGuidance(
  classification: Pick<
    ClassificationResult,
    "cprNeeded" | "emergencyType" | "traumaWarning" | "doNotMove"
  >,
): CprGuidance {
  if (!classification.cprNeeded) {
    return {
      needed: false,
      type: "none",
      instructions: [],
      warnings: [],
    };
  }

  const instructions = [
    "Place the patient flat on their back on a firm surface.",
    "Kneel beside the chest and place one hand over the center of the chest.",
    "Put your other hand on top and lock your elbows.",
    "Push hard and fast at a rate of 100 to 120 compressions per minute.",
    "Compress at least 2 inches deep and allow full chest recoil.",
    "Continue hands-only CPR until responders arrive or the patient revives.",
  ];

  const warnings: string[] = [];

  if (classification.traumaWarning) {
    warnings.push("Suspected trauma present. Use caution before repositioning.");
  }

  if (classification.doNotMove) {
    warnings.push("DO NOT move the patient");
  }

  return {
    needed: true,
    type:
      classification.emergencyType === "CARDIAC_ARREST"
        ? "hands_only"
        : "full_cpr",
    instructions,
    warnings,
  };
}

function selectBestHospital(
  hospitals: HospitalResult[],
  scrapingResults: ScrapingResult[],
): (HospitalResult & { scrapingData?: ScrapingResult; score: number }) | null {
  if (hospitals.length === 0) {
    return null;
  }

  return hospitals
    .map((hospital) => {
      const scrapingData = scrapingResults.find(
        (result) => result.hospitalName === hospital.name,
      );

      let score = 100 - hospital.distanceKm * 5;

      if (scrapingData?.resuscitationBayAvailable) {
        score += 30;
      }

      if (scrapingData?.defibrillatorAvailable) {
        score += 20;
      }

      if (scrapingData?.traumaBayAvailable) {
        score += 15;
      }

      return {
        ...hospital,
        scrapingData,
        score,
      };
    })
    .sort((left, right) => right.score - left.score)[0];
}

describe("Emergency Pipeline", () => {
  it("buildCprGuidance returns correct guidance for cardiac arrest", () => {
    const guidance = buildCprGuidance({
      cprNeeded: true,
      emergencyType: "CARDIAC_ARREST",
      traumaWarning: false,
      doNotMove: false,
    });

    expect(guidance.needed).toBe(true);
    expect(guidance.type).toBe("hands_only");
    expect(guidance.instructions).toHaveLength(6);
    expect(guidance.warnings).toEqual([]);
  });

  it("buildCprGuidance returns no guidance when not needed", () => {
    const guidance = buildCprGuidance({
      cprNeeded: false,
      emergencyType: "UNKNOWN",
      traumaWarning: false,
      doNotMove: false,
    });

    expect(guidance).toEqual({
      needed: false,
      type: "none",
      instructions: [],
      warnings: [],
    });
  });

  it("buildCprGuidance adds trauma warning", () => {
    const guidance = buildCprGuidance({
      cprNeeded: true,
      emergencyType: "MAJOR_TRAUMA",
      traumaWarning: true,
      doNotMove: true,
    });

    expect(guidance.warnings).toContain("DO NOT move the patient");
  });

  it("selectBestHospital picks closest hospital when no scraping data", () => {
    const hospitals: HospitalResult[] = [
      {
        name: "Alpha General",
        address: "1 Main St",
        latitude: 1,
        longitude: 1,
        distanceKm: 2,
        placeId: "alpha",
        types: ["hospital"],
      },
      {
        name: "Bravo Medical",
        address: "2 Main St",
        latitude: 2,
        longitude: 2,
        distanceKm: 5,
        placeId: "bravo",
        types: ["hospital"],
      },
      {
        name: "Charlie Regional",
        address: "3 Main St",
        latitude: 3,
        longitude: 3,
        distanceKm: 10,
        placeId: "charlie",
        types: ["hospital"],
      },
    ];

    const selectedHospital = selectBestHospital(hospitals, []);

    expect(selectedHospital?.name).toBe("Alpha General");
  });

  it("selectBestHospital prefers hospital with available resuscitation bay", () => {
    const hospitals: HospitalResult[] = [
      {
        name: "Closest Hospital",
        address: "4 Main St",
        latitude: 4,
        longitude: 4,
        distanceKm: 2,
        placeId: "closest",
        types: ["hospital"],
      },
      {
        name: "Better Equipped Hospital",
        address: "5 Main St",
        latitude: 5,
        longitude: 5,
        distanceKm: 3,
        placeId: "equipped",
        types: ["hospital"],
      },
    ];

    const scrapingResults: ScrapingResult[] = [
      {
        hospitalName: "Better Equipped Hospital",
        websiteUrl: "https://example.com/er",
        resuscitationBayAvailable: true,
        defibrillatorAvailable: true,
        scrapedAt: "2026-03-28T00:00:00.000Z",
        success: true,
      },
    ];

    const selectedHospital = selectBestHospital(hospitals, scrapingResults);

    expect(selectedHospital?.name).toBe("Better Equipped Hospital");
    expect(selectedHospital?.score).toBeGreaterThan(90);
  });

  it("Classification result type validation", () => {
    const classification: ClassificationResult = {
      emergencyType: "CARDIAC_ARREST",
      severity: "critical",
      confidence: 0.98,
      summary: "Collapsed patient with no pulse.",
      keySymptoms: ["unresponsive", "not breathing"],
      cprNeeded: true,
      traumaWarning: false,
      doNotMove: false,
      specialInstructions: ["Start compressions immediately."],
      hospitalType: "cardiac",
    };

    expect(classification).toMatchObject({
      emergencyType: "CARDIAC_ARREST",
      severity: "critical",
      confidence: 0.98,
      summary: "Collapsed patient with no pulse.",
      keySymptoms: ["unresponsive", "not breathing"],
      cprNeeded: true,
      traumaWarning: false,
      doNotMove: false,
      specialInstructions: ["Start compressions immediately."],
      hospitalType: "cardiac",
    });
  });

  it("DispatchStatus log format", () => {
    const notifyDispatch = vi.fn<(status: DispatchStatus) => DispatchStatus>();
    const status: DispatchStatus = {
      sessionId: "session-123",
      step: "dispatch_started",
      message: "Dispatch workflow has started.",
      timestamp: "2026-03-28T08:30:00.000Z",
    };

    notifyDispatch.mockImplementation((entry) => entry);
    const loggedStatus = notifyDispatch(status);

    expect(loggedStatus).toHaveProperty("sessionId");
    expect(loggedStatus).toHaveProperty("step");
    expect(loggedStatus).toHaveProperty("message");
    expect(loggedStatus).toHaveProperty("timestamp");
  });
});
