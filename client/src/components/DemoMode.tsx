import React from "react";

interface DemoModeProps {
  onRunDemo: (transcript: string) => void;
  disabled?: boolean;
}

const DEMO_TRANSCRIPT =
  "Help! Someone just collapsed at the food court. He was eating and suddenly grabbed his chest and fell. He's not breathing. I don't think he has a pulse. Please send help quickly!";

export default function DemoMode({
  onRunDemo,
  disabled = false,
}: DemoModeProps) {
  const handleRunDemo = () => {
    if (disabled) {
      return;
    }

    onRunDemo(DEMO_TRANSCRIPT);
  };

  return (
    <div className="bg-gray-900 border border-amber-700 rounded-xl p-4">
      <div className="mb-3">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-amber-400">
          DEMO MODE
        </p>
        <p className="mt-1 text-sm text-gray-300">
          Simulates a cardiac arrest emergency in Singapore
        </p>
      </div>

      <button
        type="button"
        onClick={handleRunDemo}
        disabled={disabled}
        className={`w-full rounded-lg bg-amber-400 py-4 text-base font-bold uppercase tracking-[0.2em] text-black transition-colors ${
          disabled
            ? "cursor-not-allowed opacity-60"
            : "hover:bg-amber-300 active:bg-amber-500"
        }`}
      >
        RUN DEMO
      </button>

      <p className="mt-3 text-xs italic leading-5 text-gray-500">
        {DEMO_TRANSCRIPT}
      </p>
    </div>
  );
}
