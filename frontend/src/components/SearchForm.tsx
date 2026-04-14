import type {
  ChangeEvent,
  Dispatch,
  DragEvent,
  FormEvent,
  SetStateAction,
} from "react";
import { useState } from "react";

export type TargetType = "Institutional Investor" | "Target Company";

const MAX_CONTEXT_CHARS = 32000;

type SearchFormProps = {
  outreachEffort: string;
  outreachContext: string;
  targetName: string;
  targetType: TargetType;
  onOutreachEffortChange: (value: string) => void;
  onOutreachContextChange: Dispatch<SetStateAction<string>>;
  onTargetNameChange: (value: string) => void;
  onTargetTypeChange: (value: TargetType) => void;
  onSubmit: () => void;
  /** When true, only the Generate button is disabled — fields stay editable during long runs */
  submitting: boolean;
};

function appendImportedContext(
  prev: string,
  text: string,
  fileName: string
): string {
  const header = `\n\n--- Imported from: ${fileName} ---\n\n`;
  const base = prev.trim();
  let combined = base ? base + header + text : text;
  if (combined.length > MAX_CONTEXT_CHARS) {
    combined =
      combined.slice(0, MAX_CONTEXT_CHARS) +
      "\n\n[Truncated to fit maximum length]";
  }
  return combined;
}

export function SearchForm({
  outreachEffort,
  outreachContext,
  targetName,
  targetType,
  onOutreachEffortChange,
  onOutreachContextChange,
  onTargetNameChange,
  onTargetTypeChange,
  onSubmit,
  submitting,
}: SearchFormProps) {
  const [dragOver, setDragOver] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!submitting && targetName.trim() && outreachEffort.trim()) {
      onSubmit();
    }
  }

  async function processContextFile(file: File) {
    setExtractError(null);
    setExtracting(true);
    try {
      const { extractDocumentText } = await import(
        "../utils/extractDocumentText"
      );
      const text = await extractDocumentText(file);
      onOutreachContextChange((prev) =>
        appendImportedContext(prev, text, file.name)
      );
    } catch (err) {
      setExtractError(
        err instanceof Error ? err.message : "Could not read file."
      );
    } finally {
      setExtracting(false);
    }
  }

  function handleContextFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    void processContextFile(file);
  }

  function handleDragEnter(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes("Files")) {
      setDragOver(true);
    }
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    const next = e.relatedTarget as Node | null;
    if (next && e.currentTarget.contains(next)) return;
    setDragOver(false);
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes("Files")) {
      e.dataTransfer.dropEffect = "copy";
      setDragOver(true);
    }
  }

  async function handleDrop(e: DragEvent<HTMLElement>) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await processContextFile(file);
  }

  const canSubmit = Boolean(targetName.trim() && outreachEffort.trim());

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-navy-700/80 bg-navy-900/60 p-6 shadow-card-lg backdrop-blur"
    >
      <div className="mb-4">
        <label
          htmlFor="outreach-effort"
          className="mb-1.5 block text-sm font-medium text-slate-300"
        >
          Outreach Effort
        </label>
        <input
          id="outreach-effort"
          type="text"
          value={outreachEffort}
          onChange={(e) => onOutreachEffortChange(e.target.value)}
          placeholder="Name this outreach effort e.g. Fund III Raise, Project Apollo, Series B Outreach"
          autoComplete="off"
          name="outreach-effort"
          className="w-full rounded-lg border border-navy-600 bg-white px-3 py-2.5 text-sm text-navy-950 shadow-sm outline-none ring-accent/30 placeholder:text-slate-400 focus:border-accent focus:ring-2"
        />
      </div>

      <div className="mb-4">
        <label
          htmlFor="outreach-context"
          className="mb-1.5 block text-sm font-medium text-slate-300"
        >
          Outreach Effort Context
        </label>

        <div
          className={`relative overflow-hidden rounded-xl border-2 border-dashed transition-all duration-150 ${
            dragOver
              ? "border-accent bg-accent/5 shadow-[inset_0_0_0_1px_rgba(79,124,172,0.35)]"
              : "border-navy-500/80 bg-navy-950/30"
          } ${extracting ? "opacity-90" : ""}`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {/* Drop hint strip — always visible, distinct from textarea */}
          <div className="flex items-center gap-2 border-b border-navy-600/60 bg-navy-900/80 px-3 py-2">
            <span className="text-lg leading-none" aria-hidden>
              {dragOver ? "↓" : "📄"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-slate-200">
                {dragOver
                  ? "Release to import file"
                  : "Drop files here or type in the area below"}
              </p>
              <p className="truncate text-[11px] text-slate-500">
                .pdf · .docx · .txt · .md
              </p>
            </div>
            <label className="shrink-0 cursor-pointer rounded-lg border border-navy-500 bg-navy-800/90 px-3 py-1.5 text-xs font-semibold text-slate-100 shadow-sm transition hover:border-accent hover:bg-navy-700">
              Browse files
              <input
                type="file"
                accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                className="sr-only"
                onChange={handleContextFile}
                disabled={extracting}
                aria-label="Browse for PDF, Word, or text file"
              />
            </label>
          </div>

          <textarea
            id="outreach-context"
            value={outreachContext}
            onChange={(e) => onOutreachContextChange(e.target.value)}
            placeholder="Write campaign context, fund details, goals, and angles. Or drop a file anywhere in this box — extracted text appears here."
            name="outreach-context"
            rows={7}
            disabled={extracting}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (e.dataTransfer.types.includes("Files")) {
                e.dataTransfer.dropEffect = "copy";
              }
            }}
            onDrop={handleDrop}
            className="min-h-[168px] w-full resize-y border-0 bg-white px-3 py-3 text-sm leading-relaxed text-navy-950 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-accent disabled:cursor-wait disabled:bg-slate-50"
          />

          {dragOver ? (
            <div
              className="pointer-events-none absolute inset-0 z-[1] flex flex-col items-center justify-center gap-2 rounded-xl bg-accent/10 backdrop-blur-[1px]"
              aria-hidden
            >
              <span className="rounded-full bg-accent/20 px-4 py-2 text-sm font-semibold text-white shadow-sm ring-1 ring-accent/40">
                Release to import
              </span>
            </div>
          ) : null}

          {extracting ? (
            <div className="absolute inset-0 z-[2] flex items-center justify-center rounded-xl bg-navy-950/40 backdrop-blur-[2px]">
              <p className="rounded-lg bg-navy-900/95 px-4 py-2 text-sm font-medium text-slate-100 shadow-lg ring-1 ring-navy-600">
                Extracting text…
              </p>
            </div>
          ) : null}
        </div>

        {extractError ? (
          <p className="mt-2 text-xs text-red-300" role="alert">
            {extractError}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-end">
        <div className="flex-1">
          <label
            htmlFor="target-name"
            className="mb-1.5 block text-sm font-medium text-slate-300"
          >
            Target name
          </label>
          <input
            id="target-name"
            type="text"
            value={targetName}
            onChange={(e) => onTargetNameChange(e.target.value)}
            placeholder="e.g., CalPERS or Acme Corp"
            autoComplete="off"
            name="target-name"
            className="w-full rounded-lg border border-navy-600 bg-white px-3 py-2.5 text-sm text-navy-950 shadow-sm outline-none ring-accent/30 placeholder:text-slate-400 focus:border-accent focus:ring-2"
          />
        </div>
        <div className="w-full md:w-64">
          <label
            htmlFor="target-type"
            className="mb-1.5 block text-sm font-medium text-slate-300"
          >
            Target type
          </label>
          <select
            id="target-type"
            value={targetType}
            onChange={(e) =>
              onTargetTypeChange(e.target.value as TargetType)
            }
            className="w-full rounded-lg border border-navy-600 bg-white px-3 py-2.5 text-sm text-navy-950 shadow-sm outline-none ring-accent/30 focus:border-accent focus:ring-2"
          >
            <option value="Institutional Investor">Institutional Investor</option>
            <option value="Target Company">Target Company</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={submitting || !canSubmit}
          className="inline-flex h-[42px] shrink-0 items-center justify-center rounded-lg bg-accent px-6 text-sm font-semibold text-white shadow-md transition hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          Generate
        </button>
      </div>
    </form>
  );
}
