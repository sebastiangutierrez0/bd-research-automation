import * as pdfjsLib from "pdfjs-dist";
// Vite resolves the worker as a separate chunk URL (required for PDF text extraction).
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

const MAX_EXTRACT_CHARS = 500_000;

let pdfWorkerConfigured = false;

function ensurePdfWorker(): void {
  if (pdfWorkerConfigured) return;
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  pdfWorkerConfigured = true;
}

async function extractPdfText(file: File): Promise<string> {
  ensurePdfWorker();
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const parts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const line = textContent.items
      .map((item) => {
        if (item && typeof item === "object" && "str" in item) {
          return String((item as { str: string }).str);
        }
        return "";
      })
      .join(" ");
    parts.push(line);
  }
  return parts.join("\n").trim();
}

async function extractDocxText(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return (result.value ?? "").trim();
}

/**
 * Pull plain text from .txt/.md, .docx, or .pdf in the browser.
 * Legacy .doc is not supported (use .docx).
 */
export async function extractDocumentText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();

  if (
    name.endsWith(".txt") ||
    name.endsWith(".md") ||
    type === "text/plain" ||
    type === "text/markdown"
  ) {
    const text = await file.text();
    return text.slice(0, MAX_EXTRACT_CHARS);
  }

  if (
    name.endsWith(".docx") ||
    type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const t = await extractDocxText(file);
    return t.slice(0, MAX_EXTRACT_CHARS);
  }

  if (name.endsWith(".doc") && !name.endsWith(".docx")) {
    throw new Error(
      "Legacy .doc files are not supported. Save as .docx or export a PDF, then try again."
    );
  }

  if (name.endsWith(".pdf") || type === "application/pdf") {
    const t = await extractPdfText(file);
    if (!t) {
      throw new Error(
        "No text could be read from this PDF. It may be scanned images only — try a text-based PDF or paste the text manually."
      );
    }
    return t.slice(0, MAX_EXTRACT_CHARS);
  }

  throw new Error(
    "Unsupported file type. Use a .pdf, .docx, .txt, or .md file."
  );
}
