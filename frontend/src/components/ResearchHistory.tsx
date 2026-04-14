import { useEffect, useState } from "react";

export type HistoryEntry = {
  id: string;
  target_name: string;
  target_type: string;
  timestamp: string;
  brief: string;
  email: string;
  outreach_context?: string;
};

export type HistoryGroup = {
  outreach_effort: string;
  entries: HistoryEntry[];
};

type ResearchHistoryProps = {
  groups: HistoryGroup[];
  error: string | null;
  loading: boolean;
};

function formatDate(ts: string): string {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function ResearchHistory({ groups, error, loading }: ResearchHistoryProps) {
  const [openEfforts, setOpenEfforts] = useState<Set<string>>(new Set());
  const [openEntryIds, setOpenEntryIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (groups.length === 0) {
      setOpenEfforts(new Set());
      return;
    }
    setOpenEfforts(new Set([groups[0].outreach_effort]));
  }, [groups]);

  function toggleEffort(name: string) {
    setOpenEfforts((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }

  function toggleEntry(id: string) {
    setOpenEntryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  }

  if (error) {
    return (
      <section className="mt-10 rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-100">
        Research history could not be loaded: {error}
      </section>
    );
  }

  if (loading) {
    return (
      <section className="mt-10 text-sm text-slate-500">
        <h2 className="mb-4 text-lg font-semibold text-white">Research History</h2>
        <p>Loading history…</p>
      </section>
    );
  }

  if (groups.length === 0) {
    return (
      <section className="mt-10 rounded-xl border border-navy-700/80 bg-navy-900/40 px-6 py-10 text-center text-sm text-slate-500 shadow-card">
        No research history yet
      </section>
    );
  }

  return (
    <section className="mt-10">
      <h2 className="mb-4 text-lg font-semibold text-white">Research History</h2>
      <div className="flex flex-col gap-2">
        {groups.map((g) => {
          const isOpen = openEfforts.has(g.outreach_effort);
          return (
            <div
              key={g.outreach_effort}
              className="overflow-hidden rounded-xl border border-navy-700/80 bg-navy-900/50 shadow-card"
            >
              <button
                type="button"
                onClick={() => toggleEffort(g.outreach_effort)}
                className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-semibold text-slate-100 transition hover:bg-navy-800/60"
                aria-expanded={isOpen}
              >
                <span>{g.outreach_effort}</span>
                <span className="text-slate-500" aria-hidden>
                  {isOpen ? "▼" : "▶"}
                </span>
              </button>
              {isOpen && (
                <ul className="border-t border-navy-700/60">
                  {g.entries.map((entry) => {
                    const expanded = openEntryIds.has(entry.id);
                    return (
                      <li
                        key={entry.id}
                        className="border-b border-navy-800/80 last:border-b-0"
                      >
                        <button
                          type="button"
                          onClick={() => toggleEntry(entry.id)}
                          className="flex w-full flex-col gap-0.5 px-4 py-3 text-left text-sm text-slate-200 transition hover:bg-navy-950/50 md:flex-row md:items-center md:justify-between"
                          aria-expanded={expanded}
                        >
                          <span className="font-medium text-white">
                            {entry.target_name}
                          </span>
                          <span className="text-xs text-slate-400 md:text-sm">
                            {entry.target_type} · {formatDate(entry.timestamp)}
                          </span>
                        </button>
                        {expanded && (
                          <div className="border-t border-navy-800/60 bg-navy-950/40 px-4 py-4">
                            <div className="mb-4 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => copyText(entry.brief)}
                                className="rounded-md border border-slate-600 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-100 hover:bg-slate-700"
                              >
                                Copy Brief
                              </button>
                              <button
                                type="button"
                                onClick={() => copyText(entry.email)}
                                className="rounded-md border border-slate-600 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-100 hover:bg-slate-700"
                              >
                                Copy Email
                              </button>
                            </div>
                            <div className="space-y-3 text-xs text-slate-400">
                              {entry.outreach_context?.trim() ? (
                                <div>
                                  <p className="mb-1 font-semibold uppercase tracking-wide text-slate-500">
                                    Outreach Effort Context
                                  </p>
                                  <div className="max-h-32 overflow-y-auto whitespace-pre-wrap rounded border border-navy-700 bg-navy-900/80 p-3 text-sm text-slate-300">
                                    {entry.outreach_context}
                                  </div>
                                </div>
                              ) : null}
                              <div>
                                <p className="mb-1 font-semibold uppercase tracking-wide text-slate-500">
                                  Brief
                                </p>
                                <div className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded border border-navy-700 bg-navy-900/80 p-3 text-sm text-slate-200">
                                  {entry.brief}
                                </div>
                              </div>
                              <div>
                                <p className="mb-1 font-semibold uppercase tracking-wide text-slate-500">
                                  Email
                                </p>
                                <div className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded border border-navy-700 bg-navy-900/80 p-3 text-sm text-slate-200">
                                  {entry.email}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
