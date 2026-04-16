import type {
  ChangeEvent,
  Dispatch,
  DragEvent,
  FormEvent,
  SetStateAction,
} from "react";
import { useEffect, useRef, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type TargetType = "Institutional Investor" | "Target Company";

export type ResearchMode = "single" | "bulk";

const MAX_CONTEXT_CHARS = 32000;

/** Short placeholder — full guidance is in the helper line below */
const TARGET_LIST_PLACEHOLDER = "CalPERS\nBlackRock\nVanguard";

type SearchFormProps = {
  mode: ResearchMode;
  onModeChange: (mode: ResearchMode) => void;
  targetList: string;
  onTargetListChange: (value: string) => void;
  onBulkSubmit: () => void;
  bulkSubmitting: boolean;
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

const fieldClass =
  "border-navy-600 bg-white text-navy-950 shadow-sm ring-primary/30 placeholder:text-slate-400 focus-visible:border-primary focus-visible:ring-primary";

function parseTargetLines(text: string): string[] {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function SearchForm({
  mode,
  onModeChange,
  targetList,
  onTargetListChange,
  onBulkSubmit,
  bulkSubmitting,
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
  const targetListRef = useRef<HTMLTextAreaElement>(null);

  /** Grow the bulk target list with content; cap height so long lists scroll inside. */
  useEffect(() => {
    if (mode !== "bulk") return;
    const el = targetListRef.current;
    if (!el) return;
    el.style.height = "auto";
    const maxPx = Math.min(
      typeof window !== "undefined" ? window.innerHeight * 0.45 : 400,
      448
    );
    el.style.height = `${Math.min(el.scrollHeight, maxPx)}px`;
  }, [mode, targetList]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (mode === "single") {
      if (!submitting && targetName.trim() && outreachEffort.trim()) {
        onSubmit();
      }
      return;
    }
    if (!bulkSubmitting && outreachEffort.trim() && parseTargetLines(targetList).length > 0) {
      onBulkSubmit();
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

  const canSubmitSingle = Boolean(targetName.trim() && outreachEffort.trim());
  const canSubmitBulk = Boolean(
    outreachEffort.trim() && parseTargetLines(targetList).length > 0
  );
  const bulkTargetCount = parseTargetLines(targetList).length;

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-navy-700/80 bg-navy-900/60 p-6 shadow-card-lg backdrop-blur"
    >
      <div className="mb-6">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
          Research Mode
        </p>
        <div className="grid max-w-lg grid-cols-2 gap-0 rounded-lg border border-navy-600/90 bg-navy-950/50 p-1">
          <button
            type="button"
            onClick={() => onModeChange("single")}
            className={cn(
              "rounded-md px-3 py-2.5 text-sm font-medium transition",
              mode === "single"
                ? "bg-primary text-white shadow-sm"
                : "text-slate-400 hover:bg-navy-800/80 hover:text-slate-200"
            )}
          >
            Single Target
          </button>
          <button
            type="button"
            onClick={() => onModeChange("bulk")}
            className={cn(
              "rounded-md px-3 py-2.5 text-sm font-medium transition",
              mode === "bulk"
                ? "bg-primary text-white shadow-sm"
                : "text-slate-400 hover:bg-navy-800/80 hover:text-slate-200"
            )}
          >
            Bulk Research
          </button>
        </div>
      </div>

      <div className="mb-4">
        <Label
          htmlFor="outreach-effort"
          className="mb-1.5 block text-slate-300"
        >
          Outreach Effort
        </Label>
        <Input
          id="outreach-effort"
          type="text"
          value={outreachEffort}
          onChange={(e) => onOutreachEffortChange(e.target.value)}
          placeholder="Name this outreach effort e.g. Fund III Raise, Project Apollo, Series B Outreach"
          autoComplete="off"
          name="outreach-effort"
          className={`h-auto min-h-[42px] py-2.5 ${fieldClass}`}
        />
      </div>

      <div className="mb-4">
        <Label
          htmlFor="outreach-context"
          className="mb-1.5 block text-slate-300"
        >
          Outreach Effort Context
        </Label>

        <div
          className={`relative overflow-hidden rounded-xl border-2 border-dashed transition-all duration-150 ${
            dragOver
              ? "border-primary bg-primary/5 shadow-[inset_0_0_0_1px_rgb(79_124_172/0.35)]"
              : "border-navy-500/80 bg-navy-950/30"
          } ${extracting ? "opacity-90" : ""}`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
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
            <label className="shrink-0 cursor-pointer rounded-lg border border-navy-500 bg-navy-800/90 px-3 py-1.5 text-xs font-semibold text-slate-100 shadow-sm transition hover:border-primary hover:bg-navy-700">
              Browse Files
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

          <Textarea
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
            className="min-h-[168px] w-full resize-y rounded-none border-0 bg-white px-3 py-3 text-sm leading-relaxed text-navy-950 shadow-none ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 disabled:cursor-wait disabled:bg-slate-50"
          />

          {dragOver ? (
            <div
              className="pointer-events-none absolute inset-0 z-[1] flex flex-col items-center justify-center gap-2 rounded-xl bg-primary/10 backdrop-blur-[1px]"
              aria-hidden
            >
              <span className="rounded-full bg-primary/20 px-4 py-2 text-sm font-semibold text-white shadow-sm ring-1 ring-primary/40">
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
          <Alert
            variant="destructive"
            className="mt-2 border-red-500/40 bg-red-950/40 text-red-100 [&>svg]:text-red-100"
          >
            <AlertDescription>{extractError}</AlertDescription>
          </Alert>
        ) : null}
      </div>

      {mode === "single" ? (
        <div className="flex flex-col gap-4 md:flex-row md:items-end">
          <div className="min-w-0 flex-1">
            <Label htmlFor="target-name" className="mb-1.5 block text-slate-300">
              Target Name
            </Label>
            <Input
              id="target-name"
              type="text"
              value={targetName}
              onChange={(e) => onTargetNameChange(e.target.value)}
              placeholder="e.g., CalPERS or Acme Corp"
              autoComplete="off"
              name="target-name"
              className={`h-auto min-h-[42px] py-2.5 ${fieldClass}`}
            />
          </div>
          <div className="w-full md:w-64">
            <Label htmlFor="target-type" className="mb-1.5 block text-slate-300">
              Target Type
            </Label>
            <Select
              value={targetType}
              onValueChange={(v) => onTargetTypeChange(v as TargetType)}
            >
              <SelectTrigger
                id="target-type"
                className={`h-auto min-h-[42px] py-2.5 ${fieldClass}`}
              >
                <SelectValue placeholder="Target Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Institutional Investor">
                  Institutional Investor
                </SelectItem>
                <SelectItem value="Target Company">Target Company</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            type="submit"
            disabled={submitting || !canSubmitSingle}
            className="h-[42px] shrink-0 px-6 font-semibold shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Generate
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <div>
            <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
              <Label
                htmlFor="target-list"
                className="text-slate-300"
              >
                Target List
              </Label>
              {bulkTargetCount > 0 ? (
                <span className="text-xs font-medium tabular-nums text-slate-500">
                  {bulkTargetCount}{" "}
                  {bulkTargetCount === 1 ? "target" : "targets"}
                </span>
              ) : null}
            </div>
            <p className="mb-2 text-xs leading-relaxed text-slate-500">
              Paste from a spreadsheet or type one organization per line. Empty
              lines are ignored.
            </p>
            <div className="overflow-hidden rounded-lg border border-navy-600 bg-white shadow-inner ring-1 ring-black/5">
              <Textarea
                ref={targetListRef}
                id="target-list"
                value={targetList}
                onChange={(e) => onTargetListChange(e.target.value)}
                placeholder={TARGET_LIST_PLACEHOLDER}
                name="target-list"
                rows={3}
                spellCheck={false}
                className={cn(
                  "min-h-[3.25rem] max-h-[min(45vh,28rem)] w-full resize-y overflow-y-auto border-0 bg-transparent px-3 py-2.5",
                  "font-mono text-[13px] leading-normal text-navy-950",
                  "placeholder:font-sans placeholder:text-slate-400",
                  "outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50"
                )}
              />
            </div>
          </div>

          <div className="flex flex-col gap-4 border-t border-navy-700/60 pt-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="w-full sm:max-w-xs">
              <Label htmlFor="target-type" className="mb-1.5 block text-slate-300">
                Target Type
              </Label>
              <p className="mb-2 text-xs text-slate-500 sm:hidden">
                Applies to every line in the list above.
              </p>
              <p className="mb-2 hidden text-xs text-slate-500 sm:block">
                Applies to all targets in the list.
              </p>
              <Select
                value={targetType}
                onValueChange={(v) => onTargetTypeChange(v as TargetType)}
              >
                <SelectTrigger
                  id="target-type"
                  className={`h-auto min-h-[42px] py-2.5 ${fieldClass}`}
                >
                  <SelectValue placeholder="Target Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Institutional Investor">
                    Institutional Investor
                  </SelectItem>
                  <SelectItem value="Target Company">Target Company</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              type="submit"
              disabled={bulkSubmitting || !canSubmitBulk}
              className="h-[42px] w-full shrink-0 px-6 font-semibold shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:w-auto"
            >
              Run Bulk Research
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}
