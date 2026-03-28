import { useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import PanicButton from "@/components/PanicButton";
import CprMetronome from "@/components/CprMetronome";
import StatusFeed from "@/components/StatusFeed";
import { trpc } from "@/lib/trpc";
import type {
  ClassificationResult,
  CprGuidance,
  HospitalResult,
  DispatchStatus,
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
  critical: "bg-red-600 text-white",
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
  const [logs, setLogs] = useState<DispatchStatus[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cprActive, setCprActive] = useState(false);

  const startSessionMut = trpc.emergency.startSession.useMutation();
  const transcribeMut = trpc.emergency.transcribe.useMutation();
  const classifyMut = trpc.emergency.classify.useMutation();
  const searchHospitalsMut = trpc.emergency.searchHospitals.useMutation();
  const scrapeAndSelectMut = trpc.emergency.scrapeAndSelect.useMutation();
  const dispatchMut = trpc.emergency.dispatch.useMutation();

  const getLocation = (): Promise<{ latitude: number; longitude: number }> =>
    new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve({ latitude: 1.3521, longitude: 103.8198 });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          }),
        () => resolve({ latitude: 1.3521, longitude: 103.8198 }),
        { timeout: 5000 }
      );
    });

  const runPipeline = useCallback(
    async (audioBase64: string, mimeType: string) => {
      setPhase("processing");
      setError(null);

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

        // Step 7: Scrape and select
        addLog(logs, setLogs, sid, "scrape", "Analysing hospital readiness...");
        const scrapeRes = await scrapeAndSelectMut.mutateAsync({
          sessionId: sid,
          hospitals: hospitalsRes.hospitals,
          emergencyType: classifyRes.classification.emergencyType,
        });
        setSelectedHospital(scrapeRes.selectedHospital);
        addLog(
          logs,
          setLogs,
          sid,
          "scrape",
          `Selected: ${scrapeRes.selectedHospital?.name ?? "unknown"}`,
          { hospital: scrapeRes.selectedHospital as unknown as Record<string, unknown> }
        );

        // Step 8: Dispatch
        addLog(logs, setLogs, sid, "dispatch", "Dispatching emergency call...");
        const dispatchRes = await dispatchMut.mutateAsync({
          sessionId: sid,
          emergencyDetails: {
            emergencyType: classifyRes.classification.emergencyType,
            severity: classifyRes.classification.severity,
            summary: classifyRes.classification.summary,
            cprStatus: cprGuidance?.needed ? "active" : "not_needed",
            patientCondition: transcribeRes.transcript,
            hospitalName: scrapeRes.selectedHospital?.name,
          },
        });
        setCallResult(dispatchRes);
        addLog(
          logs,
          setLogs,
          sid,
          "dispatch",
          `Call dispatched — status: ${dispatchRes.status}`,
          { callId: dispatchRes.callId }
        );

        setPhase("dispatched");
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
    [startSessionMut, transcribeMut, classifyMut, searchHospitalsMut, scrapeAndSelectMut, dispatchMut]
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
    setLogs([]);
    setError(null);
    setCprActive(false);
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
    <div className="min-h-screen bg-black text-white flex flex-col items-center px-4 py-6">
      {/* Header */}
      <header className="w-full max-w-md text-center mb-8">
        <h1 className="text-4xl font-black tracking-widest text-red-500">
          PULSE
        </h1>
        <p className="text-xs text-gray-400 tracking-widest uppercase mt-1">
          Emergency Dispatch
        </p>
      </header>

      {/* Main content area */}
      <main className="w-full max-w-md flex-1 flex flex-col items-center gap-6">
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
                <p className="text-gray-500 text-sm text-center">
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
                <div className="bg-gray-900 rounded-xl p-4 border border-gray-700">
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">
                    Transcript
                  </p>
                  <p className="text-white text-sm leading-relaxed">
                    "{transcript}"
                  </p>
                </div>
              )}

              {/* Classification */}
              {classification && (
                <div className="bg-gray-900 rounded-xl p-4 border border-gray-700 flex flex-col gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded ${
                        severityColor[classification.severity] ??
                        "bg-gray-600 text-white"
                      }`}
                    >
                      {classification.severity}
                    </span>
                    <span className="text-white font-semibold text-sm">
                      {classification.emergencyType.replace(/_/g, " ")}
                    </span>
                    <span className="text-gray-400 text-xs ml-auto">
                      {Math.round(classification.confidence * 100)}% confidence
                    </span>
                  </div>
                  <p className="text-gray-300 text-sm">{classification.summary}</p>
                  {classification.keySymptoms.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {classification.keySymptoms.map((s) => (
                        <span
                          key={s}
                          className="text-xs bg-gray-800 text-gray-300 rounded-full px-2 py-0.5"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                  {classification.specialInstructions.length > 0 && (
                    <ul className="text-xs text-yellow-400 list-disc list-inside space-y-0.5">
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
                <div className="bg-gray-900 rounded-xl p-4 border border-green-800 flex flex-col gap-1">
                  <p className="text-xs text-green-400 uppercase tracking-wider mb-1">
                    Dispatching To
                  </p>
                  <p className="text-white font-bold text-base">
                    {selectedHospital.name}
                  </p>
                  <p className="text-gray-400 text-xs">{selectedHospital.address}</p>
                  {selectedHospital.distanceKm !== undefined && (
                    <p className="text-gray-400 text-xs">
                      {selectedHospital.distanceKm.toFixed(1)} km away
                    </p>
                  )}
                  {selectedHospital.scrapingData?.erWaitTime && (
                    <p className="text-yellow-400 text-xs">
                      ER wait: {selectedHospital.scrapingData.erWaitTime}
                    </p>
                  )}
                </div>
              )}

              {/* Dispatched confirmation */}
              {phase === "dispatched" && callResult && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-green-900 border border-green-600 rounded-xl p-5 text-center flex flex-col gap-2"
                >
                  <p className="text-green-300 text-2xl font-black tracking-widest">
                    CALL DISPATCHED
                  </p>
                  {selectedHospital?.name && (
                    <p className="text-white text-sm">
                      {selectedHospital.name}
                    </p>
                  )}
                  <p className="text-green-400 text-xs uppercase tracking-wider">
                    Status: {callResult.status}
                  </p>
                </motion.div>
              )}

              {/* Processing indicator */}
              {phase === "processing" && (
                <div className="flex items-center justify-center gap-2 text-gray-400 text-sm py-2">
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
              <div className="bg-red-950 border border-red-700 rounded-xl p-5 w-full text-center">
                <p className="text-red-400 font-bold text-lg mb-2">
                  Something went wrong
                </p>
                <p className="text-gray-300 text-sm">{error}</p>
              </div>
              <button
                onClick={handleRetry}
                className="bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-bold py-4 px-10 rounded-2xl text-lg tracking-widest transition-colors"
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
    </div>
  );
}
