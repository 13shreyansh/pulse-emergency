import React, { useCallback, useEffect, useRef, useState } from "react";

interface PanicButtonProps {
  onRecordingComplete: (audioBase64: string, mimeType: string) => void;
  disabled?: boolean;
  status?: "idle" | "recording" | "processing";
}

const MAX_RECORDING_MS = 15000;

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onloadend = () => {
      const result = reader.result;

      if (typeof result !== "string") {
        reject(new Error("Failed to convert audio blob to base64."));
        return;
      }

      const [, base64 = ""] = result.split(",");
      resolve(base64);
    };

    reader.onerror = () => {
      reject(new Error("Failed to read recorded audio."));
    };

    reader.readAsDataURL(blob);
  });
}

export default function PanicButton({
  onRecordingComplete,
  disabled = false,
  status = "idle",
}: PanicButtonProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef<string>("audio/webm");
  const isStartingRef = useRef(false);
  const stopTimeoutRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  const isProcessing = status === "processing";
  const effectiveStatus: "idle" | "recording" | "processing" = isProcessing
    ? "processing"
    : isRecording || status === "recording"
      ? "recording"
      : "idle";

  const clearTimers = useCallback(() => {
    if (stopTimeoutRef.current !== null) {
      window.clearTimeout(stopTimeoutRef.current);
      stopTimeoutRef.current = null;
    }

    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;

    if (!recorder || recorder.state === "inactive") {
      return;
    }

    clearTimers();
    recorder.stop();
  }, [clearTimers]);

  const handleRecordingStop = useCallback(async () => {
    setIsRecording(false);
    clearTimers();

    const mimeType = mimeTypeRef.current;
    const audioBlob = new Blob(chunksRef.current, { type: mimeType });

    mediaRecorderRef.current = null;
    chunksRef.current = [];
    cleanupStream();

    if (audioBlob.size === 0) {
      setDurationSeconds(0);
      return;
    }

    const base64Audio = await blobToBase64(audioBlob);
    setDurationSeconds(0);
    onRecordingComplete(base64Audio, audioBlob.type || mimeType);
  }, [cleanupStream, clearTimers, onRecordingComplete]);

  const startRecording = useCallback(async () => {
    if (disabled || isProcessing || isRecording || isStartingRef.current) {
      return;
    }

    isStartingRef.current = true;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);

      streamRef.current = stream;
      mediaRecorderRef.current = mediaRecorder;
      mimeTypeRef.current = mediaRecorder.mimeType || "audio/webm";
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        void handleRecordingStop();
      };

      startTimeRef.current = Date.now();
      setDurationSeconds(0);
      setIsRecording(true);

      intervalRef.current = window.setInterval(() => {
        const elapsedMs = Date.now() - startTimeRef.current;
        setDurationSeconds(Math.min(15, Math.floor(elapsedMs / 1000)));
      }, 100);

      stopTimeoutRef.current = window.setTimeout(() => {
        stopRecording();
      }, MAX_RECORDING_MS);

      mediaRecorder.start();
    } finally {
      isStartingRef.current = false;
    }
  }, [disabled, handleRecordingStop, isProcessing, isRecording, stopRecording]);

  useEffect(() => {
    if (!isRecording) {
      return;
    }

    const handleRelease = () => {
      stopRecording();
    };

    window.addEventListener("mouseup", handleRelease);
    window.addEventListener("touchend", handleRelease);
    window.addEventListener("touchcancel", handleRelease);

    return () => {
      window.removeEventListener("mouseup", handleRelease);
      window.removeEventListener("touchend", handleRelease);
      window.removeEventListener("touchcancel", handleRelease);
    };
  }, [isRecording, stopRecording]);

  useEffect(() => {
    return () => {
      clearTimers();

      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.stop();
      }

      cleanupStream();
    };
  }, [cleanupStream, clearTimers]);

  const handlePressStart = useCallback(() => {
    void startRecording();
  }, [startRecording]);

  const buttonAnimationClass =
    effectiveStatus === "recording"
      ? "animate-[panic-fast-pulse_0.6s_ease-in-out_infinite]"
      : effectiveStatus === "idle"
        ? "animate-[panic-slow-pulse_2s_ease-in-out_infinite]"
        : "";

  const buttonText =
    effectiveStatus === "processing"
      ? "ANALYZING..."
      : effectiveStatus === "recording"
        ? "LISTENING..."
        : "TAP AND SPEAK";

  return (
    <div className="flex items-center justify-center bg-background px-4 text-white">
      <style>
        {`
          @keyframes panic-slow-pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.04); }
          }

          @keyframes panic-fast-pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.08); }
          }

          @keyframes panic-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>

      <div className="flex flex-col items-center justify-center gap-6 text-center select-none">
        <button
          type="button"
          disabled={disabled || isProcessing}
          onMouseDown={handlePressStart}
          onTouchStart={handlePressStart}
          className={`flex h-[180px] w-[180px] sm:h-[220px] sm:w-[220px] touch-manipulation items-center justify-center rounded-full bg-red-600 transition-opacity duration-200 ${buttonAnimationClass} ${(disabled || isProcessing) ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
          style={{
            boxShadow:
              effectiveStatus === "processing"
                ? "0 0 24px rgba(220, 38, 38, 0.45)"
                : effectiveStatus === "recording"
                  ? "0 0 48px rgba(220, 38, 38, 0.95)"
                  : "0 0 36px rgba(220, 38, 38, 0.75)",
            minWidth: "48px",
            minHeight: "48px",
          }}
          aria-label={buttonText}
        >
          {effectiveStatus === "processing" ? (
            <span
              className="h-12 w-12 rounded-full border-4 border-white/30 border-t-white"
              style={{ animation: "panic-spin 0.8s linear infinite" }}
            />
          ) : null}
        </button>

        <div className="flex min-h-[56px] flex-col items-center justify-center">
          <span className="text-xl font-semibold tracking-wide">{buttonText}</span>
          {effectiveStatus === "recording" ? (
            <span className="mt-2 text-lg tabular-nums">{durationSeconds}s / 15s</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
