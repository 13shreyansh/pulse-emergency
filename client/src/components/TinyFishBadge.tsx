export default function TinyFishBadge() {
  return (
    <div className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-pulse-blue/20 bg-pulse-blue/5">
      <svg
        className="w-4 h-4 text-pulse-blue"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M13 10V3L4 14h7v7l9-11h-7z"
        />
      </svg>
      <span className="text-xs font-semibold tracking-widest uppercase text-pulse-blue">
        Powered by TinyFish
      </span>
      <span className="text-[9px] text-muted-foreground tracking-wider uppercase">
        Web Agents
      </span>
    </div>
  );
}
