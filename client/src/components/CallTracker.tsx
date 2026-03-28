import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { trpc } from "@/lib/trpc";

interface CallTrackerProps {
  callId: string;
  hospitalName: string;
}

function StatusDot({ status }: { status: string }) {
  if (status === "ended") return null;

  const colorMap: Record<string, string> = {
    queued: "bg-gray-400",
    ringing: "bg-amber-400",
    "in-progress": "bg-green-400",
  };

  return (
    <span className="relative inline-flex h-3 w-3 mr-2">
      <span
        className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${colorMap[status] ?? "bg-gray-400"}`}
      />
      <span
        className={`relative inline-flex rounded-full h-3 w-3 ${colorMap[status] ?? "bg-gray-400"}`}
      />
    </span>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s} seconds`;
}

export default function CallTracker({ callId, hospitalName }: CallTrackerProps) {
  const [isPolling, setIsPolling] = useState(true);
  const [elapsed, setElapsed] = useState(0);

  const statusQuery = trpc.emergency.callStatus.useQuery(
    { callId },
    { refetchInterval: isPolling ? 3000 : false }
  );

  const data = statusQuery.data;
  const status = data?.status;

  // Stop polling when call ends
  useEffect(() => {
    if (status === "ended") {
      setIsPolling(false);
    }
  }, [status]);

  // Live duration timer while in-progress
  useEffect(() => {
    if (status !== "in-progress") return;
    setElapsed(0);
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [status]);

  function statusLabel(s: string): string {
    switch (s) {
      case "queued":
        return "Connecting...";
      case "ringing":
        return "Ringing hospital...";
      case "in-progress":
        return "Call in progress";
      case "ended":
        return "Call completed";
      default:
        return s;
    }
  }

  function OutcomeIcon({ positive }: { positive: boolean }) {
    return positive ? (
      <svg className="w-4 h-4 text-green-400 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-red-400 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card text-foreground p-5 space-y-4 w-full max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Call Status</p>
          <h3 className="text-lg font-semibold">{hospitalName}</h3>
        </div>

        {/* Status indicator */}
        <div className="flex items-center text-sm font-medium">
          {status === "ended" ? (
            data?.outcome?.outcome === "rejected" ? (
              <svg className="w-5 h-5 text-red-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-green-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )
          ) : (
            <StatusDot status={status ?? "queued"} />
          )}
          <span className="text-muted-foreground">{statusLabel(status ?? "queued")}</span>
        </div>
      </div>

      {/* Live duration while in-progress */}
      {status === "in-progress" && (
        <p className="text-sm text-muted-foreground tabular-nums">
          Duration: {formatDuration(elapsed)}
        </p>
      )}

      <AnimatePresence>
        {status === "ended" && data && (
          <motion.div
            key="ended-details"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            {/* Duration */}
            {data.duration != null && (
              <p className="text-sm text-muted-foreground">
                Duration: {formatDuration(data.duration)}
              </p>
            )}

            {/* Transcript */}
            {data.messages && data.messages.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-widest">Transcript</p>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {data.messages.map((msg, i) => {
                    const isAssistant = msg.role === "assistant" || msg.role === "bot";
                    return (
                      <div
                        key={i}
                        className={`flex ${isAssistant ? "justify-start" : "justify-end"}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                            isAssistant
                              ? "bg-slate-700 text-foreground"
                              : "bg-slate-600 text-foreground"
                          }`}
                        >
                          <p className="text-[10px] text-muted-foreground mb-0.5 capitalize">
                            {msg.role}
                          </p>
                          <p>{msg.message}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Outcome badges */}
            {data.outcome && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-widest">Outcome</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { label: "Hospital Confirmed", value: data.outcome.hospitalConfirmed },
                    { label: "ER Available", value: data.outcome.erAvailable },
                    { label: "Equipment Ready", value: data.outcome.equipmentReady },
                  ].map(({ label, value }) => (
                    <div
                      key={label}
                      className={`flex items-center rounded-lg px-3 py-2 text-sm font-medium border ${
                        value
                          ? "border-green-700 bg-green-950 text-green-300"
                          : "border-red-700 bg-red-950 text-red-300"
                      }`}
                    >
                      <OutcomeIcon positive={value} />
                      <span>{label}: {value ? "Yes" : "No"}</span>
                    </div>
                  ))}
                </div>

                {/* Overall outcome badge */}
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide ${
                      data.outcome.outcome === "accepted"
                        ? "bg-green-900 text-green-300"
                        : data.outcome.outcome === "rejected"
                        ? "bg-red-900 text-red-300"
                        : "bg-slate-700 text-muted-foreground"
                    }`}
                  >
                    {data.outcome.outcome}
                  </span>
                </div>
              </div>
            )}

            {/* Special instructions */}
            {data.outcome?.specialInstructions && data.outcome.specialInstructions.length > 0 && (
              <div className="rounded-lg border border-amber-600 bg-amber-950 px-4 py-3 space-y-1">
                <p className="text-xs font-semibold text-amber-400 uppercase tracking-widest">
                  Special Instructions
                </p>
                <ul className="list-disc list-inside space-y-1">
                  {data.outcome.specialInstructions.map((instr, i) => (
                    <li key={i} className="text-sm text-amber-200">
                      {instr}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
