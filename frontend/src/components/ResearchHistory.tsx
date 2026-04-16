import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";

/** Matches main brief/email panels but tuned for dark history cards */
const historyMarkdownShell =
  "markdown-body text-sm leading-relaxed text-slate-200 [&_p]:mb-3 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_strong]:text-slate-100 [&_em]:italic [&_h1]:mb-2 [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-white [&_h2]:mb-2 [&_h2]:mt-3 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-slate-100 [&_h3]:mb-2 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-slate-100 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_code]:rounded [&_code]:bg-slate-900 [&_code]:px-1 [&_code]:text-[0.8125rem] [&_code]:text-slate-200 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-slate-900 [&_pre]:p-3 [&_pre]:text-[0.8125rem] [&_pre]:text-slate-200 [&_blockquote]:border-l-4 [&_blockquote]:border-slate-500 [&_blockquote]:pl-3 [&_blockquote]:text-slate-300 [&_a]:text-primary [&_a]:underline";

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

export function ResearchHistory({
  groups,
  error,
  loading,
}: ResearchHistoryProps) {
  const [openEfforts, setOpenEfforts] = useState<Set<string>>(new Set());
  const [openEntryIds, setOpenEntryIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (groups.length === 0) {
      setOpenEfforts(new Set());
      return;
    }
    setOpenEfforts(new Set([groups[0].outreach_effort]));
  }, [groups]);

  function setEffortOpen(name: string, open: boolean) {
    setOpenEfforts((prev) => {
      const next = new Set(prev);
      if (open) {
        next.add(name);
      } else {
        next.delete(name);
      }
      return next;
    });
  }

  function setEntryOpen(id: string, open: boolean) {
    setOpenEntryIds((prev) => {
      const next = new Set(prev);
      if (open) {
        next.add(id);
      } else {
        next.delete(id);
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
      <section className="mt-10">
        <Alert
          variant="destructive"
          className="border-red-500/30 bg-red-950/30 text-red-100"
        >
          <AlertDescription>
            Research History could not be loaded: {error}
          </AlertDescription>
        </Alert>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="mt-10">
        <h2 className="mb-4 text-lg font-semibold text-white">Research History</h2>
        <Card className="border-navy-700/80 bg-navy-900/40 p-6 shadow-card">
          <div className="space-y-3">
            <Skeleton className="h-5 w-1/3 bg-slate-600/50" />
            <Skeleton className="h-4 w-full bg-slate-600/50" />
            <Skeleton className="h-4 w-full bg-slate-600/50" />
            <Skeleton className="h-4 w-4/5 bg-slate-600/50" />
          </div>
        </Card>
      </section>
    );
  }

  if (groups.length === 0) {
    return (
      <section className="mt-10 rounded-xl border border-navy-700/80 bg-navy-900/40 px-6 py-10 text-center text-sm text-slate-500 shadow-card">
        No Research History Yet
      </section>
    );
  }

  return (
    <section className="mt-10">
      <h2 className="mb-4 text-lg font-semibold text-white">Research History</h2>
      <div className="flex flex-col gap-2">
        {groups.map((g) => (
          <Collapsible
            key={g.outreach_effort}
            open={openEfforts.has(g.outreach_effort)}
            onOpenChange={(open) => setEffortOpen(g.outreach_effort, open)}
          >
            <div className="overflow-hidden rounded-xl border border-navy-700/80 bg-navy-900/50 shadow-card">
              <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-semibold text-slate-100 transition hover:bg-navy-800/60">
                <span>{g.outreach_effort}</span>
                <span className="text-slate-500" aria-hidden>
                  {openEfforts.has(g.outreach_effort) ? "▼" : "▶"}
                </span>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ul className="border-t border-navy-700/60">
                  {g.entries.map((entry) => (
                    <li
                      key={entry.id}
                      className="border-b border-navy-800/80 last:border-b-0"
                    >
                      <Collapsible
                        open={openEntryIds.has(entry.id)}
                        onOpenChange={(open) => setEntryOpen(entry.id, open)}
                      >
                        <CollapsibleTrigger className="flex w-full flex-col gap-0.5 px-4 py-3 text-left text-sm text-slate-200 transition hover:bg-navy-950/50 md:flex-row md:items-center md:justify-between">
                          <span className="font-medium text-white">
                            {entry.target_name}
                          </span>
                          <span className="text-xs text-slate-400 md:text-sm">
                            {entry.target_type} · {formatDate(entry.timestamp)}
                          </span>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="border-t border-navy-800/60 bg-navy-950/40 px-4 py-4">
                            <div className="mb-4 flex flex-wrap gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => copyText(entry.brief)}
                                className="border-slate-600 bg-slate-800/80 text-slate-100 hover:bg-slate-700"
                              >
                                Copy Brief
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => copyText(entry.email)}
                                className="border-slate-600 bg-slate-800/80 text-slate-100 hover:bg-slate-700"
                              >
                                Copy Email
                              </Button>
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
                                <div className="max-h-48 overflow-y-auto rounded border border-navy-700 bg-navy-900/80 p-3">
                                  <div className={historyMarkdownShell}>
                                    <ReactMarkdown>{entry.brief}</ReactMarkdown>
                                  </div>
                                </div>
                              </div>
                              <div>
                                <p className="mb-1 font-semibold uppercase tracking-wide text-slate-500">
                                  Email
                                </p>
                                <div className="max-h-48 overflow-y-auto rounded border border-navy-700 bg-navy-900/80 p-3">
                                  <div className={historyMarkdownShell}>
                                    <ReactMarkdown>{entry.email}</ReactMarkdown>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </li>
                  ))}
                </ul>
              </CollapsibleContent>
            </div>
          </Collapsible>
        ))}
      </div>
    </section>
  );
}
