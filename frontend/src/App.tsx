import { useCallback, useEffect, useRef, useState } from "react";
import { BriefDisplay } from "./components/BriefDisplay";
import { BulkResearchProgress, type BulkRow } from "./components/BulkResearchProgress";
import { EmailDisplay } from "./components/EmailDisplay";
import { LoadingSpinner } from "./components/LoadingSpinner";
import {
  ResearchHistory,
  type HistoryGroup,
} from "./components/ResearchHistory";
import {
  SearchForm,
  type ResearchMode,
  type TargetType,
} from "./components/SearchForm";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { consumeSseStream } from "./utils/consumeSseStream";

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
  const [researchMode, setResearchMode] = useState<ResearchMode>("single");
  const [targetList, setTargetList] = useState("");

  const [outreachEffort, setOutreachEffort] = useState("");
  const [outreachContext, setOutreachContext] = useState("");
  const [targetName, setTargetName] = useState("");
  const [targetType, setTargetType] =
    useState<TargetType>("Institutional Investor");
  const [loading, setLoading] = useState(false);
  const [brief, setBrief] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkCurrentTarget, setBulkCurrentTarget] = useState("");
  const [bulkTotal, setBulkTotal] = useState(0);
  const [bulkCompletedSoFar, setBulkCompletedSoFar] = useState(0);
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([]);
  const [bulkSuccessMessage, setBulkSuccessMessage] = useState<string | null>(
    null
  );
  const [bulkError, setBulkError] = useState<string | null>(null);

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

  function handleModeChange(mode: ResearchMode) {
    setResearchMode(mode);
    setError(null);
    setBulkError(null);
    if (mode === "single") {
      setBulkSuccessMessage(null);
      setBulkRows([]);
    }
  }

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

  async function handleBulkSubmit() {
    const targets = targetList
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (targets.length === 0 || !outreachEffort.trim()) return;

    setError(null);
    setBulkError(null);
    setBulkSuccessMessage(null);
    setBulkRows([]);
    setBulkCompletedSoFar(0);
    setBulkTotal(targets.length);
    setBulkCurrentTarget(targets[0] ?? "");
    setBrief(null);
    setEmail(null);
    setBulkRunning(true);

    try {
      const res = await fetch(`${API_BASE}/bulk-research`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targets,
          target_type: targetType,
          outreach_effort: outreachEffort.trim(),
          outreach_context: outreachContext,
        }),
      });

      if (!res.ok) {
        const data: unknown = await res.json().catch(() => null);
        setBulkError(parseErrorDetail(data));
        return;
      }

      await consumeSseStream(res, (event, data) => {
        if (event === "progress" && data && typeof data === "object") {
          const p = data as {
            target_name?: string;
            total?: number;
            completed_so_far?: number;
          };
          if (typeof p.target_name === "string") {
            setBulkCurrentTarget(p.target_name);
          }
          if (typeof p.total === "number") {
            setBulkTotal(p.total);
          }
          if (typeof p.completed_so_far === "number") {
            setBulkCompletedSoFar(p.completed_so_far);
          }
        }
        if (event === "result" && data && typeof data === "object") {
          const r = data as { target_name?: string };
          if (typeof r.target_name === "string") {
            const name = r.target_name;
            setBulkRows((prev) => [...prev, { name, ok: true }]);
          }
          void loadHistory();
        }
        if (event === "error" && data && typeof data === "object") {
          const err = data as { target_name?: string };
          if (typeof err.target_name === "string") {
            const name = err.target_name;
            setBulkRows((prev) => [...prev, { name, ok: false }]);
          }
        }
        if (event === "done" && data && typeof data === "object") {
          const d = data as { total_targets?: number };
          const n =
            typeof d.total_targets === "number" ? d.total_targets : targets.length;
          setBulkCompletedSoFar(n);
          setBulkSuccessMessage(
            `Bulk Research Complete — ${n} briefs and emails generated`
          );
          setBulkCurrentTarget("");
        }
      });
    } catch {
      setBulkError(
        "Unable to reach the API. Is the backend running on http://localhost:8000?"
      );
    } finally {
      setBulkRunning(false);
    }
  }

  const showBulkProgress = researchMode === "bulk" && (bulkRunning || bulkSuccessMessage);

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
          mode={researchMode}
          onModeChange={handleModeChange}
          targetList={targetList}
          onTargetListChange={setTargetList}
          onBulkSubmit={handleBulkSubmit}
          bulkSubmitting={bulkRunning}
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

        {showBulkProgress ? (
          <BulkResearchProgress
            currentTarget={bulkCurrentTarget}
            total={bulkTotal}
            completedSoFar={bulkCompletedSoFar}
            rows={bulkRows}
            successMessage={bulkSuccessMessage}
          />
        ) : null}

        {bulkError ? (
          <div className="mt-4">
            <Alert
              variant="destructive"
              className="border-red-500/40 bg-red-950/40 text-red-100 shadow-card"
            >
              <AlertDescription>{bulkError}</AlertDescription>
            </Alert>
          </div>
        ) : null}

        <div className="mt-8">
          {researchMode === "single" && loading && (
            <LoadingSpinner
              message={`Researching ${targetName.trim() || "your target"}...`}
            />
          )}

          {researchMode === "single" && !loading && error && (
            <Alert
              variant="destructive"
              className="border-red-500/40 bg-red-950/40 text-red-100 shadow-card"
            >
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {researchMode === "single" && !loading && !error && brief && email && (
            <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
              <BriefDisplay content={brief} />
              <EmailDisplay content={email} />
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
