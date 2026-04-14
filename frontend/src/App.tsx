import { useCallback, useEffect, useRef, useState } from "react";
import { BriefDisplay } from "./components/BriefDisplay";
import { EmailDisplay } from "./components/EmailDisplay";
import { LoadingSpinner } from "./components/LoadingSpinner";
import {
  ResearchHistory,
  type HistoryGroup,
} from "./components/ResearchHistory";
import { SearchForm, type TargetType } from "./components/SearchForm";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

type ResearchResponse = {
  brief: string;
  email: string;
};

function parseErrorDetail(payload: unknown): string {
  if (
    payload &&
    typeof payload === "object" &&
    "detail" in payload &&
    payload.detail !== undefined
  ) {
    const d = (payload as { detail: unknown }).detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d)) {
      return d
        .map((item) =>
          item && typeof item === "object" && "msg" in item
            ? String((item as { msg: unknown }).msg)
            : String(item)
        )
        .join(" ");
    }
  }
  return "Something went wrong. Please try again.";
}

export default function App() {
  const [outreachEffort, setOutreachEffort] = useState("");
  const [outreachContext, setOutreachContext] = useState("");
  const [targetName, setTargetName] = useState("");
  const [targetType, setTargetType] =
    useState<TargetType>("Institutional Investor");
  const [loading, setLoading] = useState(false);
  const [brief, setBrief] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [historyGroups, setHistoryGroups] = useState<HistoryGroup[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const historyFirstLoad = useRef(true);

  const loadHistory = useCallback(async () => {
    setHistoryError(null);
    if (historyFirstLoad.current) {
      setHistoryLoading(true);
    }
    try {
      const res = await fetch(`${API_BASE}/history`);
      const data: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        setHistoryError(parseErrorDetail(data));
        setHistoryGroups([]);
        return;
      }
      if (
        data &&
        typeof data === "object" &&
        "groups" in data &&
        Array.isArray((data as { groups: unknown }).groups)
      ) {
        setHistoryGroups((data as { groups: HistoryGroup[] }).groups);
      } else {
        setHistoryGroups([]);
      }
    } catch {
      setHistoryError("Unable to load history. Is the backend running?");
      setHistoryGroups([]);
    } finally {
      setHistoryLoading(false);
      historyFirstLoad.current = false;
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  async function handleGenerate() {
    setError(null);
    setBrief(null);
    setEmail(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/research`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outreach_effort: outreachEffort.trim(),
          outreach_context: outreachContext,
          target_name: targetName.trim(),
          target_type: targetType,
        }),
      });

      const data: unknown = await res.json().catch(() => null);

      if (!res.ok) {
        setError(parseErrorDetail(data));
        return;
      }

      const parsed = data as ResearchResponse;
      if (!parsed.brief || !parsed.email) {
        setError("Unexpected response from server.");
        return;
      }

      setBrief(parsed.brief);
      setEmail(parsed.email);
      await loadHistory();
    } catch {
      setError(
        "Unable to reach the API. Is the backend running on http://localhost:8000?"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-full bg-gradient-to-b from-navy-950 via-navy-950 to-navy-900">
      <header className="border-b border-navy-800/80 bg-navy-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-8 sm:px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-gold-muted">
            Business Development
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Research Studio
          </h1>
          <p className="max-w-2xl text-sm text-slate-400">
            Generate institutional-grade briefs and tailored outreach in one flow.
            Results are logged to your team sheet automatically.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <SearchForm
          outreachEffort={outreachEffort}
          outreachContext={outreachContext}
          targetName={targetName}
          targetType={targetType}
          onOutreachEffortChange={setOutreachEffort}
          onOutreachContextChange={setOutreachContext}
          onTargetNameChange={setTargetName}
          onTargetTypeChange={setTargetType}
          onSubmit={handleGenerate}
          submitting={loading}
        />

        <div className="mt-8">
          {loading && (
            <LoadingSpinner
              message={`Researching ${targetName.trim() || "your target"}...`}
            />
          )}

          {!loading && error && (
            <div
              className="rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm text-red-100 shadow-card"
              role="alert"
            >
              {error}
            </div>
          )}

          {!loading && !error && brief && email && (
            <div className="grid gap-6 lg:grid-cols-2">
              <BriefDisplay content={brief} />
              <EmailDisplay content={email} />
            </div>
          )}

          {!loading && !error && (!brief || !email) && (
            <div className="rounded-xl border border-dashed border-navy-700 bg-navy-900/30 px-6 py-12 text-center text-sm text-slate-500">
              Enter an outreach effort, target, and click Generate to see the intelligence
              brief and outreach email side by side.
            </div>
          )}
        </div>

        <ResearchHistory
          groups={historyGroups}
          error={historyError}
          loading={historyLoading}
        />
      </main>
    </div>
  );
}
