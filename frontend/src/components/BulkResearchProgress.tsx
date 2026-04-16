import { Check, Loader2 } from "lucide-react";

export type BulkRow = { name: string; ok: boolean };

type BulkResearchProgressProps = {
  currentTarget: string;
  total: number;
  completedSoFar: number;
  rows: BulkRow[];
  successMessage: string | null;
};

export function BulkResearchProgress({
  currentTarget,
  total,
  completedSoFar,
  rows,
  successMessage,
}: BulkResearchProgressProps) {
  const pct =
    total > 0
      ? Math.min(100, Math.round((rows.length / total) * 100))
      : 0;

  const running = !successMessage && total > 0;

  return (
    <div className="mt-6 overflow-hidden rounded-xl border border-navy-600/80 bg-navy-950/50 shadow-card">
      <div className="border-b border-navy-700/60 bg-navy-900/40 px-4 py-3">
        <div className="flex items-center gap-2">
          {running ? (
            <Loader2
              className="h-4 w-4 shrink-0 animate-spin text-primary"
              aria-hidden
            />
          ) : null}
          <h3 className="text-sm font-semibold text-slate-200">
            Bulk Run Progress
          </h3>
        </div>
      </div>

      <div className="p-4">
        {!successMessage ? (
          <p className="text-sm text-slate-300">
            <span className="font-medium text-white">
              {currentTarget || "…"}
            </span>
            <span className="text-slate-500"> — </span>
            {completedSoFar} of {total} targets complete
          </p>
        ) : null}

        <div
          className={`h-2.5 w-full overflow-hidden rounded-full bg-navy-800/80 ${successMessage ? "mt-0" : "mt-3"}`}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>

        {rows.length > 0 ? (
          <ul className="mt-4 max-h-48 space-y-2 overflow-y-auto text-sm text-slate-300">
            {rows.map((row, idx) => (
              <li key={`${row.name}-${idx}`} className="flex items-center gap-2">
                {row.ok ? (
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600/90 text-white"
                    aria-hidden
                  >
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                ) : (
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-600/80 text-xs font-bold text-white"
                    aria-hidden
                  >
                    !
                  </span>
                )}
                <span className={row.ok ? "text-slate-200" : "text-red-300"}>
                  {row.name}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        {successMessage ? (
          <p className="mt-4 text-sm font-medium text-emerald-300/95">
            {successMessage}
          </p>
        ) : null}
      </div>
    </div>
  );
}
