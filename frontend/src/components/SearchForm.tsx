import type {
  ChangeEvent,
  Dispatch,
  DragEvent,
  FormEvent,
  SetStateAction,
} from "react";
import { useState } from "react";

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

const fieldClass =
  "border-navy-600 bg-white text-navy-950 shadow-sm ring-primary/30 placeholder:text-slate-400 focus-visible:border-primary focus-visible:ring-primary";

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

      <div className="flex flex-col gap-4 md:flex-row md:items-end">
        <div className="flex-1">
          <Label htmlFor="target-name" className="mb-1.5 block text-slate-300">
            Target name
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
            Target type
          </Label>
          <Select
            value={targetType}
            onValueChange={(v) => onTargetTypeChange(v as TargetType)}
          >
            <SelectTrigger
              id="target-type"
              className={`h-auto min-h-[42px] py-2.5 ${fieldClass}`}
            >
              <SelectValue placeholder="Target type" />
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
          disabled={submitting || !canSubmit}
          className="h-[42px] shrink-0 px-6 font-semibold shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Generate
        </Button>
      </div>
    </form>
  );
}
