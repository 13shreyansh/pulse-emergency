import { useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import PanicButton from "@/components/PanicButton";
import CprMetronome from "@/components/CprMetronome";
import StatusFeed from "@/components/StatusFeed";
import CallTracker from "@/components/CallTracker";
import HospitalComparisonTable from "@/components/HospitalComparisonTable";
import TinyFishBadge from "@/components/TinyFishBadge";
import { trpc } from "@/lib/trpc";
import type {
  ClassificationResult,
  CprGuidance,
  HospitalResult,
  DispatchStatus,
  ScrapingResult,
} from "../../../shared/pulse-types";

type Phase = "idle" | "recording" | "processing" | "dispatched" | "error";

function addLog(
  logs: DispatchStatus[],
  setLogs: React.Dispatch<React.SetStateAction<DispatchStatus[]>>,
  sessionId: string,
  step: string,
  message: string,
  metadata?: Record<string, unknown>
) {
  const entry: DispatchStatus = {
    sessionId,
    step,
    message,
    timestamp: new Date().toISOString(),
    metadata,
  };
  setLogs((prev) => [...prev, entry]);
}

const severityColor: Record<string, string> = {
  critical: "bg-primary text-white",
  high: "bg-yellow-500 text-black",
  moderate: "bg-green-600 text-white",
};

export default function Home() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [classification, setClassification] =
    useState<ClassificationResult | null>(null);
  const [cprGuidance, setCprGuidance] = useState<CprGuidance | null>(null);
  const [hospitals, setHospitals] = useState<HospitalResult[] | null>(null);
  const [selectedHospital, setSelectedHospital] = useState<any | null>(null);
  const [callResult, setCallResult] = useState<any | null>(null);
  const [scrapingResults, setScrapingResults] = useState<ScrapingResult[] | null>(null);
  const [logs, setLogs] = useState<DispatchStatus[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cprActive, setCprActive] = useState(false);

  // Auto-retry state
  const [rankedHospitals, setRankedHospitals] = useState<HospitalResult[]>([]);
  const [attemptIndex, setAttemptIndex] = useState(0);
  const [emergencyDetailsForRetry, setEmergencyDetailsForRetry] = useState<any | null>(null);
  const [previousAttempts, setPreviousAttempts] = useState<
    Array<{ hospitalName: string; callId: string; outcome: string }>
  >([]);

  const startSessionMut = trpc.emergency.startSession.useMutation();
  const transcribeMut = trpc.emergency.transcribe.useMutation();
  const classifyMut = trpc.emergency.classify.useMutation();
  const searchHospitalsMut = trpc.emergency.searchHospitals.useMutation();
  const scrapeAndSelectMut = trpc.emergency.scrapeAndSelect.useMutation();
  const dispatchMut = trpc.emergency.dispatch.useMutation();

  const getLocation = (): Promise<{ latitude: number; longitude: number }> =>
    new Promise((resolve) => {
      const fallback = { latitude: 1.3521, longitude: 103.8198 };
      let resolved = false;
      const done = (coords: { latitude: number; longitude: number }) => {
        if (!resolved) { resolved = true; resolve(coords); }
      };
      setTimeout(() => done(fallback), 3000);
      if (!navigator.geolocation) {
        done(fallback);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => done({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        () => done(fallback),
        { timeout: 3000 }
      );
    });

  // Dispatch to a specific hospital by index in the ranked list
  const dispatchToHospital = useCallback(
    async (hospitalIndex: number, hospitalList: HospitalResult[], details: any, sid: string) => {
      const hospital = hospitalList[hospitalIndex];
      if (!hospital) {
        addLog(logs, setLogs, sid, "dispatch", "No more hospitals available to try.");
        return;
      }

      setSelectedHospital(hospital);
      setAttemptIndex(hospitalIndex);

      addLog(
        logs,
        setLogs,
        sid,
        "dispatch",
        hospitalIndex === 0
          ? `Dispatching emergency call to ${hospital.name}...`
          : `Retrying — calling ${hospital.name} (attempt ${hospitalIndex + 1})...`
      );

      const dispatchRes = await dispatchMut.mutateAsync({
        sessionId: sid,
        emergencyDetails: {
          ...details,
          hospitalName: hospital.name,
          distance: hospital.distanceKm != null ? `${hospital.distanceKm.toFixed(1)} km` : undefined,
        },
      });

      setCallResult(dispatchRes);
      addLog(
        logs,
        setLogs,
        sid,
        "dispatch",
        `Call dispatched to ${hospital.name} — status: ${dispatchRes.status}`,
        { callId: dispatchRes.callId }
      );

      setPhase("dispatched");
    },
    [dispatchMut, logs]
  );

  // Handle rejection — try next hospital
  const handleCallRejected = useCallback(() => {
    if (!sessionId || !emergencyDetailsForRetry) return;

    const nextIndex = attemptIndex + 1;

    // Save previous attempt
    setPreviousAttempts((prev) => [
      ...prev,
      {
        hospitalName: selectedHospital?.name ?? "Unknown",
        callId: callResult?.callId ?? "",
        outcome: "rejected",
      },
    ]);

    if (nextIndex >= rankedHospitals.length) {
      addLog(logs, setLogs, sessionId, "dispatch", "All hospitals have been tried. No hospital accepted the patient.");
      return;
    }

    addLog(
      logs,
      setLogs,
      sessionId,
      "retry",
      `${selectedHospital?.name} declined — auto-dialing next hospital...`
    );

    // Dispatch to next hospital
    dispatchToHospital(nextIndex, rankedHospitals, emergencyDetailsForRetry, sessionId);
  }, [
    sessionId,
    emergencyDetailsForRetry,
    attemptIndex,
    rankedHospitals,
    selectedHospital,
    callResult,
    logs,
    dispatchToHospital,
  ]);

  const runPipeline = useCallback(
    async (audioBase64: string, mimeType: string) => {
      setPhase("processing");
      setError(null);
      setPreviousAttempts([]);

      try {
        // Step 1: Start session
        const sessionRes = await startSessionMut.mutateAsync();
        const sid = sessionRes.sessionId;
        setSessionId(sid);
        addLog(logs, setLogs, sid, "session", "Emergency session started");

        // Step 2: Transcribe
        addLog(logs, setLogs, sid, "transcribe", "Transcribing audio...");
        const transcribeRes = await transcribeMut.mutateAsync({
          sessionId: sid,
          audioBase64,
          mimeType,
        });
        setTranscript(transcribeRes.transcript);
        addLog(logs, setLogs, sid, "transcribe", `Transcript: "${transcribeRes.transcript}"`);

        // Step 3: Classify
        addLog(logs, setLogs, sid, "classify", "Classifying emergency...");
        const classifyRes = await classifyMut.mutateAsync({
          sessionId: sid,
          transcript: transcribeRes.transcript,
        });
        setClassification(classifyRes.classification);
        setCprGuidance(classifyRes.cprGuidance);
        addLog(
          logs,
          setLogs,
          sid,
          "classify",
          `${classifyRes.classification.emergencyType} — ${classifyRes.classification.severity}`,
          { classification: classifyRes.classification as unknown as Record<string, unknown> }
        );

        // Step 4: Show CPR if needed
        if (classifyRes.cprGuidance?.needed) {
          setCprActive(true);
        }

        // Step 5: Get location
        addLog(logs, setLogs, sid, "location", "Getting your location...");
        const coords = await getLocation();
        addLog(
          logs,
          setLogs,
          sid,
          "location",
          `Location acquired: ${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`
        );

        // Step 6: Search hospitals
        addLog(logs, setLogs, sid, "hospitals", "Searching nearby hospitals...");
        const hospitalsRes = await searchHospitalsMut.mutateAsync({
          sessionId: sid,
          latitude: coords.latitude,
          longitude: coords.longitude,
          hospitalType: classifyRes.classification.hospitalType,
        });
        setHospitals(hospitalsRes.hospitals);
        addLog(
          logs,
          setLogs,
          sid,
          "hospitals",
          `Found ${hospitalsRes.hospitals.length} hospitals`
        );

        // Step 7: Scrape and select — show realistic per-hospital progress
        const hospitalCount = Math.min(hospitalsRes.hospitals.length, 5);
        addLog(logs, setLogs, sid, "scraping_started", `Deploying ${hospitalCount} TinyFish web agents...`);

        // Show staggered per-hospital scraping progress (fire-and-forget, visual only)
        const scrapePromise = scrapeAndSelectMut.mutateAsync({
          sessionId: sid,
          hospitals: hospitalsRes.hospitals,
          emergencyType: classifyRes.classification.emergencyType,
        });

        // Simulate realistic per-hospital progress while backend scrapes
        for (let i = 0; i < hospitalCount; i++) {
          const h = hospitalsRes.hospitals[i];
          await new Promise((r) => setTimeout(r, 1500 + Math.random() * 2000));
          addLog(logs, setLogs, sid, "scraping_progress", `Agent ${i + 1}: Analyzing ${h.name}...`);
        }

        const scrapeRes = await scrapePromise;
        addLog(logs, setLogs, sid, "scraping_complete", `All agents returned — ${scrapeRes.allResults?.filter((r: ScrapingResult) => r.success).length ?? 0} hospitals verified`);

        setSelectedHospital(scrapeRes.selectedHospital);
        if (scrapeRes.allResults) {
          setScrapingResults(scrapeRes.allResults as ScrapingResult[]);
        }
        addLog(
          logs,
          setLogs,
          sid,
          "hospital_selected",
          `Best match: ${scrapeRes.selectedHospital?.name ?? "unknown"} (${scrapeRes.selectedHospital?.distanceKm?.toFixed(1) ?? "?"} km, ER wait: ${scrapeRes.scrapingData?.erWaitTime ?? "N/A"})`,
          { hospital: scrapeRes.selectedHospital as unknown as Record<string, unknown> }
        );

        // Store ranked hospitals and emergency details for auto-retry
        setRankedHospitals(hospitalsRes.hospitals);
        const details = {
          emergencyType: classifyRes.classification.emergencyType,
          severity: classifyRes.classification.severity,
          summary: classifyRes.classification.summary,
          cprStatus: classifyRes.cprGuidance?.needed ? "active" : "not_needed",
          patientCondition: transcribeRes.transcript,
          latitude: coords.latitude,
          longitude: coords.longitude,
        };
        setEmergencyDetailsForRetry(details);

        // Step 8: Dispatch to first (best) hospital
        await dispatchToHospital(0, hospitalsRes.hospitals, details, sid);
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : "An unexpected error occurred";
        setError(msg);
        setPhase("error");
        setLogs((prev) => [
          ...prev,
          {
            sessionId: sessionId ?? "unknown",
            step: "error",
            message: msg,
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [startSessionMut, transcribeMut, classifyMut, searchHospitalsMut, scrapeAndSelectMut, dispatchToHospital]
  );

  const runDemoPipeline = useCallback(
    async (demoTranscript: string) => {
      setPhase("processing");
      setError(null);
      setPreviousAttempts([]);

      try {
        // Step 1: Start session
        const sessionRes = await startSessionMut.mutateAsync();
        const sid = sessionRes.sessionId;
        setSessionId(sid);
        addLog(logs, setLogs, sid, "session", "Emergency session started");

        // Step 2: Use provided transcript (skip transcribe)
        setTranscript(demoTranscript);
        addLog(logs, setLogs, sid, "transcribe", `Transcript: "${demoTranscript}"`);

        // Step 3: Classify
        addLog(logs, setLogs, sid, "classify", "Classifying emergency...");
        const classifyRes = await classifyMut.mutateAsync({
          sessionId: sid,
          transcript: demoTranscript,
        });
        setClassification(classifyRes.classification);
        setCprGuidance(classifyRes.cprGuidance);
        addLog(
          logs,
          setLogs,
          sid,
          "classify",
          `${classifyRes.classification.emergencyType} — ${classifyRes.classification.severity}`,
          { classification: classifyRes.classification as unknown as Record<string, unknown> }
        );

        // Step 4: Show CPR if needed
        if (classifyRes.cprGuidance?.needed) {
          setCprActive(true);
        }

        // Step 5: Get location
        addLog(logs, setLogs, sid, "location", "Getting your location...");
        const coords = await getLocation();
        addLog(
          logs,
          setLogs,
          sid,
          "location",
          `Location acquired: ${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`
        );

        // Step 6: Search hospitals
        addLog(logs, setLogs, sid, "hospitals", "Searching nearby hospitals...");
        const hospitalsRes = await searchHospitalsMut.mutateAsync({
          sessionId: sid,
          latitude: coords.latitude,
          longitude: coords.longitude,
          hospitalType: classifyRes.classification.hospitalType,
        });
        setHospitals(hospitalsRes.hospitals);
        addLog(
          logs,
          setLogs,
          sid,
          "hospitals",
          `Found ${hospitalsRes.hospitals.length} hospitals`
        );

        // Step 7: Scrape and select — show realistic per-hospital progress
        const hospitalCount = Math.min(hospitalsRes.hospitals.length, 5);
        addLog(logs, setLogs, sid, "scraping_started", `Deploying ${hospitalCount} TinyFish web agents...`);

        const scrapePromise = scrapeAndSelectMut.mutateAsync({
          sessionId: sid,
          hospitals: hospitalsRes.hospitals,
          emergencyType: classifyRes.classification.emergencyType,
        });

        for (let i = 0; i < hospitalCount; i++) {
          const h = hospitalsRes.hospitals[i];
          await new Promise((r) => setTimeout(r, 1500 + Math.random() * 2000));
          addLog(logs, setLogs, sid, "scraping_progress", `Agent ${i + 1}: Analyzing ${h.name}...`);
        }

        const scrapeRes = await scrapePromise;
        addLog(logs, setLogs, sid, "scraping_complete", `All agents returned — ${scrapeRes.allResults?.filter((r: ScrapingResult) => r.success).length ?? 0} hospitals verified`);

        setSelectedHospital(scrapeRes.selectedHospital);
        if (scrapeRes.allResults) {
          setScrapingResults(scrapeRes.allResults as ScrapingResult[]);
        }
        addLog(
          logs,
          setLogs,
          sid,
          "hospital_selected",
          `Best match: ${scrapeRes.selectedHospital?.name ?? "unknown"} (${scrapeRes.selectedHospital?.distanceKm?.toFixed(1) ?? "?"} km, ER wait: ${scrapeRes.scrapingData?.erWaitTime ?? "N/A"})`,
          { hospital: scrapeRes.selectedHospital as unknown as Record<string, unknown> }
        );

        // Store ranked hospitals and emergency details for auto-retry
        setRankedHospitals(hospitalsRes.hospitals);
        const details = {
          emergencyType: classifyRes.classification.emergencyType,
          severity: classifyRes.classification.severity,
          summary: classifyRes.classification.summary,
          cprStatus: classifyRes.cprGuidance?.needed ? "active" : "not_needed",
          patientCondition: demoTranscript,
          latitude: coords.latitude,
          longitude: coords.longitude,
        };
        setEmergencyDetailsForRetry(details);

        // Step 8: Dispatch to first (best) hospital
        await dispatchToHospital(0, hospitalsRes.hospitals, details, sid);
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : "An unexpected error occurred";
        setError(msg);
        setPhase("error");
        setLogs((prev) => [
          ...prev,
          {
            sessionId: sessionId ?? "unknown",
            step: "error",
            message: msg,
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [startSessionMut, classifyMut, searchHospitalsMut, scrapeAndSelectMut, dispatchToHospital]
  );

  const handleRecordingComplete = useCallback(
    (audioBase64: string, mimeType: string) => {
      runPipeline(audioBase64, mimeType);
    },
    [runPipeline]
  );

  const handleRetry = () => {
    setPhase("idle");
    setSessionId(null);
    setTranscript(null);
    setClassification(null);
    setCprGuidance(null);
    setHospitals(null);
    setSelectedHospital(null);
    setCallResult(null);
    setScrapingResults(null);
    setLogs([]);
    setError(null);
    setCprActive(false);
    setRankedHospitals([]);
    setAttemptIndex(0);
    setEmergencyDetailsForRetry(null);
    setPreviousAttempts([]);
  };

  const currentStep =
    phase === "idle"
      ? "idle"
      : phase === "recording"
      ? "recording"
      : phase === "processing"
      ? logs[logs.length - 1]?.step ?? "processing"
      : phase === "dispatched"
      ? "dispatched"
      : "error";

  return (
    <div className="min-h-screen bg-background text-white flex flex-col items-center px-4 py-6 pb-[env(safe-area-inset-bottom)]">
      {/* Header */}
      <header className="w-full max-w-md text-center mb-8">
        <h1 className="text-3xl sm:text-4xl font-black tracking-widest text-primary">
          PULSE
        </h1>
        <p className="text-xs text-muted-foreground tracking-widest uppercase mt-1">
          Emergency Dispatch
        </p>
      </header>

      {/* Main content area */}
      <main className="w-full max-w-md flex-1 flex flex-col items-center gap-6 overflow-y-auto">
        <AnimatePresence mode="wait">
          {/* IDLE / RECORDING: show PanicButton */}
          {(phase === "idle" || phase === "recording") && (
            <motion.div
              key="panic"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col items-center gap-4 w-full"
            >
              <PanicButton
                onRecordingComplete={handleRecordingComplete}
                disabled={phase === "recording"}
                status={phase === "recording" ? "recording" : "idle"}
              />
              {phase === "idle" && (
                <p className="text-muted-foreground text-sm text-center">
                  Hold the button and describe the emergency
                </p>
              )}
            </motion.div>
          )}

          {/* PROCESSING / DISPATCHED: show results */}
          {(phase === "processing" || phase === "dispatched") && (
            <motion.div
              key="pipeline"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="w-full flex flex-col gap-4"
            >
              {/* Transcript */}
              {transcript && (
                <div className="bg-card rounded-xl p-4 border border-border touch-manipulation">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                    Transcript
                  </p>
                  <p className="text-white text-sm leading-relaxed">
                    "{transcript}"
                  </p>
                </div>
              )}

              {/* Classification */}
              {classification && (
                <div className="bg-card rounded-xl p-4 border border-border flex flex-col gap-3 touch-manipulation">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded ${
                        severityColor[classification.severity] ??
                        "bg-muted text-white"
                      }`}
                    >
                      {classification.severity}
                    </span>
                    <span className="text-white font-semibold text-sm">
                      {classification.emergencyType.replace(/_/g, " ")}
                    </span>
                    <span className="text-muted-foreground text-xs ml-auto">
                      {Math.round(classification.confidence * 100)}% confidence
                    </span>
                  </div>
                  <p className="text-foreground/80 text-sm">{classification.summary}</p>
                  {classification.keySymptoms.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {classification.keySymptoms.map((s) => (
                        <span
                          key={s}
                          className="text-xs bg-muted text-foreground/80 rounded-full px-2 py-0.5"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                  {classification.specialInstructions.length > 0 && (
                    <ul className="text-xs text-pulse-yellow list-disc list-inside space-y-0.5">
                      {classification.specialInstructions.map((i) => (
                        <li key={i}>{i}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* CPR Metronome */}
              {cprGuidance?.needed && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="w-full"
                >
                  <CprMetronome
                    active={cprActive}
                    onStop={() => setCprActive(false)}
                  />
                </motion.div>
              )}

              {/* Selected Hospital */}
              {selectedHospital && (
                <div className="bg-card rounded-xl p-4 border border-pulse-green/30 flex flex-col gap-1 touch-manipulation">
                  <p className="text-xs text-pulse-green uppercase tracking-wider mb-1">
                    {attemptIndex > 0 ? `Retrying — Attempt ${attemptIndex + 1}` : "Dispatching To"}
                  </p>
                  <p className="text-white font-bold text-base">
                    {selectedHospital.name}
                  </p>
                  <p className="text-muted-foreground text-xs">{selectedHospital.address}</p>
                  {selectedHospital.distanceKm !== undefined && (
                    <p className="text-muted-foreground text-xs">
                      {selectedHospital.distanceKm.toFixed(1)} km away
                    </p>
                  )}
                  {selectedHospital.scrapingData?.erWaitTime && (
                    <p className="text-pulse-yellow text-xs">
                      ER wait: {selectedHospital.scrapingData.erWaitTime}
                    </p>
                  )}
                </div>
              )}

              {/* Previous Attempts Summary */}
              {previousAttempts.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-card rounded-xl p-4 border border-red-900/50"
                >
                  <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">
                    Previous Attempts
                  </p>
                  <div className="space-y-1">
                    {previousAttempts.map((attempt, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <span className="text-muted-foreground">
                          {attempt.hospitalName} — <span className="text-red-400">declined</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Live Call Tracker */}
              {phase === "dispatched" && callResult && (
                <motion.div
                  key={`call-${callResult.callId}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <CallTracker
                    callId={callResult.callId}
                    hospitalName={selectedHospital?.name ?? "Hospital"}
                    attemptNumber={attemptIndex + 1}
                    totalHospitals={rankedHospitals.length}
                    onRejected={
                      attemptIndex + 1 < rankedHospitals.length
                        ? handleCallRejected
                        : undefined
                    }
                  />
                </motion.div>
              )}

              {/* Hospital Comparison Table */}
              {scrapingResults && scrapingResults.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <HospitalComparisonTable
                    results={scrapingResults}
                    selectedHospitalName={selectedHospital?.name}
                  />
                </motion.div>
              )}

              {/* Processing indicator */}
              {phase === "processing" && (
                <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm py-2">
                  <span className="animate-pulse">●</span>
                  <span>Processing…</span>
                </div>
              )}
            </motion.div>
          )}

          {/* ERROR */}
          {phase === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="w-full flex flex-col items-center gap-4"
            >
              <div className="bg-destructive/20 border border-destructive/50 rounded-xl p-5 w-full text-center touch-manipulation">
                <p className="text-destructive font-bold text-lg mb-2">
                  Something went wrong
                </p>
                <p className="text-foreground/80 text-sm">{error}</p>
              </div>
              <button
                onClick={handleRetry}
                className="bg-primary hover:bg-red-500 active:bg-red-700 text-white font-bold py-4 px-10 rounded-2xl text-lg tracking-widest transition-colors w-full sm:w-auto"
              >
                RETRY
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Status Feed — visible after phase transitions past idle */}
      <AnimatePresence>
        {logs.length > 0 && (
          <motion.div
            key="statusfeed"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-md mt-6"
          >
            <StatusFeed logs={logs} currentStep={currentStep} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* TinyFish Branding */}
      <footer className="w-full max-w-md mt-8 mb-2">
        <TinyFishBadge />
      </footer>
    </div>
  );
}
