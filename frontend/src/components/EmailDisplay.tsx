import { useState } from "react";
import ReactMarkdown from "react-markdown";

type EmailDisplayProps = {
  content: string;
};

const markdownShell =
  "markdown-body text-sm leading-relaxed text-slate-800 [&_p]:mb-3 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_em]:italic [&_h1]:mb-2 [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-navy-950 [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-navy-950 [&_h3]:mb-2 [&_h3]:text-sm [&_h3]:font-semibold [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:text-[0.8125rem] [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-slate-100 [&_pre]:p-3 [&_pre]:text-[0.8125rem] [&_blockquote]:border-l-4 [&_blockquote]:border-slate-300 [&_blockquote]:pl-3 [&_blockquote]:text-slate-700";

export function EmailDisplay({ content }: EmailDisplayProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="flex h-full min-h-[320px] flex-col rounded-xl border border-navy-700/80 bg-white shadow-card-lg">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <h2 className="text-base font-semibold text-navy-950">Outreach email</h2>
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-navy-900 transition hover:bg-slate-100"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="flex-1 overflow-auto px-5 py-4">
        <div className={markdownShell}>
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      </div>
    </section>
  );
}
