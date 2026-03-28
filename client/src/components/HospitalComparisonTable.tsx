import type { ScrapingResult } from "../../../shared/pulse-types";

interface HospitalComparisonTableProps {
  results: ScrapingResult[];
  selectedHospitalName?: string;
}

function BoolBadge({ value }: { value: boolean | undefined }) {
  if (value === undefined || value === null) {
    return (
      <span className="text-xs text-muted-foreground">—</span>
    );
  }
  return value ? (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-400">
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
      Yes
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-400">
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
      </svg>
      No
    </span>
  );
}

export default function HospitalComparisonTable({
  results,
  selectedHospitalName,
}: HospitalComparisonTableProps) {
  if (!results || results.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3 w-full">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-0.5">
            Hospital Readiness Data
          </p>
          <p className="text-[10px] text-pulse-blue">
            Analyzed by TinyFish Web Agents
          </p>
        </div>
        <span className="text-[10px] bg-pulse-blue/20 text-pulse-blue border border-pulse-blue/30 rounded-full px-2 py-0.5 font-medium uppercase tracking-wider">
          Real-Time
        </span>
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="pb-2 pr-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">Hospital</th>
              <th className="pb-2 px-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">ER Wait</th>
              <th className="pb-2 px-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">Resus Bay</th>
              <th className="pb-2 px-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">Defib</th>
              <th className="pb-2 px-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">Trauma Bay</th>
              <th className="pb-2 pl-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => {
              const isSelected = r.hospitalName === selectedHospitalName;
              return (
                <tr
                  key={r.hospitalName}
                  className={`border-b border-border/50 ${isSelected ? "bg-pulse-green/10" : ""}`}
                >
                  <td className="py-2.5 pr-3">
                    <div className="flex items-center gap-2">
                      {isSelected && (
                        <span className="w-1.5 h-1.5 rounded-full bg-pulse-green shrink-0" />
                      )}
                      <span className={`text-sm ${isSelected ? "text-white font-semibold" : "text-foreground/80"}`}>
                        {r.hospitalName}
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    {r.success && r.erWaitTime ? (
                      <span className="text-xs text-pulse-yellow font-medium">{r.erWaitTime}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    <BoolBadge value={r.success ? r.resuscitationBayAvailable : undefined} />
                  </td>
                  <td className="py-2.5 px-3">
                    <BoolBadge value={r.success ? r.defibrillatorAvailable : undefined} />
                  </td>
                  <td className="py-2.5 px-3">
                    <BoolBadge value={r.success ? r.traumaBayAvailable : undefined} />
                  </td>
                  <td className="py-2.5 pl-3">
                    {r.success ? (
                      <span className="text-[10px] bg-green-950 text-green-400 border border-green-800 rounded-full px-2 py-0.5 font-medium uppercase">
                        Verified
                      </span>
                    ) : (
                      <span className="text-[10px] bg-yellow-950 text-yellow-400 border border-yellow-800 rounded-full px-2 py-0.5 font-medium uppercase">
                        Pending
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-2">
        {results.map((r) => {
          const isSelected = r.hospitalName === selectedHospitalName;
          return (
            <div
              key={r.hospitalName}
              className={`rounded-lg border p-3 space-y-2 ${
                isSelected
                  ? "border-pulse-green/50 bg-pulse-green/10"
                  : "border-border/50 bg-background"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isSelected && (
                    <span className="w-1.5 h-1.5 rounded-full bg-pulse-green shrink-0" />
                  )}
                  <span className={`text-sm ${isSelected ? "text-white font-semibold" : "text-foreground/80"}`}>
                    {r.hospitalName}
                  </span>
                </div>
                {r.success ? (
                  <span className="text-[10px] bg-green-950 text-green-400 border border-green-800 rounded-full px-2 py-0.5 font-medium uppercase">
                    Verified
                  </span>
                ) : (
                  <span className="text-[10px] bg-yellow-950 text-yellow-400 border border-yellow-800 rounded-full px-2 py-0.5 font-medium uppercase">
                    Pending
                  </span>
                )}
              </div>
              {r.success && (
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ER Wait:</span>
                    <span className="text-pulse-yellow font-medium">{r.erWaitTime || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Resus Bay:</span>
                    <BoolBadge value={r.resuscitationBayAvailable} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Defib:</span>
                    <BoolBadge value={r.defibrillatorAvailable} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Trauma Bay:</span>
                    <BoolBadge value={r.traumaBayAvailable} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
