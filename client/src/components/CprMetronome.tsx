import React, { useEffect, useRef, useState } from "react";

interface CprMetronomeProps {
  active: boolean;
  onStop: () => void;
}

const BPM_INTERVAL_MS = 600;
const BEEP_FREQUENCY_HZ = 880;
const BEEP_DURATION_MS = 50;
const FLASH_DURATION_MS = 120;

/**
 * CPR metronome with visual and audible beat guidance for hands-only compressions.
 */
export default function CprMetronome({
  active,
  onStop,
}: CprMetronomeProps) {
  const [compressionCount, setCompressionCount] = useState(0);
  const [isFlashing, setIsFlashing] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<number | null>(null);
  const flashTimeoutRef = useRef<number | null>(null);

  /**
   * Plays a short metronome beep using the built-in Web Audio API.
   */
  const playBeep = async () => {
    if (typeof window === "undefined") {
      return;
    }

    const AudioContextConstructor =
      window.AudioContext ||
      (window as typeof window & {
        webkitAudioContext?: typeof AudioContext;
      }).webkitAudioContext;

    if (!AudioContextConstructor) {
      return;
    }

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextConstructor();
    }

    const audioContext = audioContextRef.current;

    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const now = audioContext.currentTime;

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(BEEP_FREQUENCY_HZ, now);

    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.exponentialRampToValueAtTime(0.22, now + 0.005);
    gainNode.gain.exponentialRampToValueAtTime(
      0.0001,
      now + BEEP_DURATION_MS / 1000,
    );

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.start(now);
    oscillator.stop(now + BEEP_DURATION_MS / 1000);
  };

  useEffect(() => {
    if (!active) {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      if (flashTimeoutRef.current !== null) {
        window.clearTimeout(flashTimeoutRef.current);
        flashTimeoutRef.current = null;
      }

      setIsFlashing(false);
      setCompressionCount(0);
      return;
    }

    const runBeat = () => {
      setCompressionCount((currentCount) => currentCount + 1);
      setIsFlashing(true);
      void playBeep();

      if (flashTimeoutRef.current !== null) {
        window.clearTimeout(flashTimeoutRef.current);
      }

      flashTimeoutRef.current = window.setTimeout(() => {
        setIsFlashing(false);
      }, FLASH_DURATION_MS);
    };

    runBeat();
    intervalRef.current = window.setInterval(runBeat, BPM_INTERVAL_MS);

    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      if (flashTimeoutRef.current !== null) {
        window.clearTimeout(flashTimeoutRef.current);
        flashTimeoutRef.current = null;
      }
    };
  }, [active]);

  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        void audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, []);

  const circleClasses = active
    ? isFlashing
      ? "scale-110 bg-red-500 shadow-[0_0_45px_rgba(239,68,68,0.9)]"
      : "scale-100 bg-red-700 shadow-[0_0_20px_rgba(239,68,68,0.45)]"
    : "scale-100 bg-red-950 shadow-[0_0_12px_rgba(127,29,29,0.35)]";

  return (
    <div className="flex w-full max-w-xl flex-col items-center gap-6 rounded-2xl bg-background px-6 py-8 text-center text-white select-none">
      <div
        className={`flex h-[120px] w-[120px] sm:h-[150px] sm:w-[150px] items-center justify-center rounded-full border-4 border-red-200/80 transition-all duration-100 ease-out ${circleClasses}`}
      >
        <span
          className={`text-4xl font-black tracking-[0.35em] transition-colors duration-100 ${
            isFlashing ? "text-white" : "text-red-100"
          }`}
        >
          PUSH
        </span>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-red-300">
          Compressions
        </p>
        <p className="text-4xl sm:text-5xl font-black text-white">{compressionCount}</p>
      </div>

      <p className="max-w-md text-sm leading-6 text-red-50">
        Push hard and fast in the center of the chest. At least 2 inches deep.
        Let chest fully recoil between compressions. 100-120 compressions per
        minute.
      </p>

      <button
        type="button"
        onClick={onStop}
        className="rounded-full border border-red-500 px-6 py-3 text-sm font-bold tracking-[0.25em] text-white transition-colors hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 focus:ring-offset-black"
      >
        STOP
      </button>
    </div>
  );
}
