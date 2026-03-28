import { useEffect, useRef } from "react";

export interface DispatchStatus {
  sessionId: string;
  step: string;
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

interface StatusFeedProps {
  logs: DispatchStatus[];
  currentStep: string;
}

type StepVisualState = {
  dotClassName: string;
  icon: string;
};

const relativeTimeFormatter = new Intl.RelativeTimeFormat("en", {
  numeric: "auto",
});

function getStepVisualState(step: string): StepVisualState {
  const normalizedStep = step.trim().toLowerCase();

  if (
    normalizedStep.startsWith("complete") ||
    normalizedStep.startsWith("selected")
  ) {
    return {
      dotClassName: "bg-emerald-500 text-emerald-950",
      icon: "✓",
    };
  }

  if (
    normalizedStep.startsWith("started") ||
    normalizedStep.startsWith("search")
  ) {
    return {
      dotClassName: "bg-amber-400 text-amber-950",
      icon: "⟳",
    };
  }

  if (normalizedStep.startsWith("error")) {
    return {
      dotClassName: "bg-rose-500 text-rose-950",
      icon: "✕",
    };
  }

  return {
    dotClassName: "bg-sky-500 text-sky-950",
    icon: "●",
  };
}

function formatRelativeTimestamp(timestamp: string, now: number): string {
  const parsedTimestamp = new Date(timestamp).getTime();

  if (Number.isNaN(parsedTimestamp)) {
    return timestamp;
  }

  const diffSeconds = Math.round((parsedTimestamp - now) / 1000);
  const absDiffSeconds = Math.abs(diffSeconds);

  if (absDiffSeconds < 60) {
    return relativeTimeFormatter.format(diffSeconds, "second");
  }

  const diffMinutes = Math.round(diffSeconds / 60);
  if (Math.abs(diffMinutes) < 60) {
    return relativeTimeFormatter.format(diffMinutes, "minute");
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return relativeTimeFormatter.format(diffHours, "hour");
  }

  const diffDays = Math.round(diffHours / 24);
  return relativeTimeFormatter.format(diffDays, "day");
}

export default function StatusFeed({
  logs,
  currentStep,
}: StatusFeedProps) {
  const endOfFeedRef = useRef<HTMLDivElement | null>(null);
  const now = Date.now();

  useEffect(() => {
    endOfFeedRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [logs]);

  return (
    <div className="relative h-full overflow-y-auto rounded-xl bg-slate-950/80 p-4 text-white shadow-lg ring-1 ring-white/10">
      <div
        aria-hidden="true"
        className="absolute bottom-4 left-8 top-4 w-px bg-white/10"
      />

      <div className="relative space-y-4">
        {logs.map((log, index) => {
          const { dotClassName, icon } = getStepVisualState(log.step);
          const isActiveStep = log.step === currentStep;

          return (
            <div
              key={`${log.sessionId}-${log.timestamp}-${index}`}
              className="relative flex gap-3 pl-1"
            >
              <div className="relative z-10 flex w-7 shrink-0 justify-center">
                <div
                  className={[
                    "flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold leading-none",
                    dotClassName,
                    isActiveStep ? "animate-pulse" : "",
                  ].join(" ")}
                  title={log.step}
                >
                  {icon}
                </div>
              </div>

              <div className="min-w-0 flex-1 pb-1">
                <div className="flex items-start justify-between gap-4">
                  <p className="min-w-0 flex-1 text-sm leading-6 text-white">
                    {log.message}
                  </p>
                  <time
                    className="shrink-0 text-xs text-slate-400"
                    dateTime={log.timestamp}
                  >
                    {formatRelativeTimestamp(log.timestamp, now)}
                  </time>
                </div>
              </div>
            </div>
          );
        })}

        <div ref={endOfFeedRef} />
      </div>
    </div>
  );
}
