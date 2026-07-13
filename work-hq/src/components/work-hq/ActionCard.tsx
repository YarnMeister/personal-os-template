import { useState, type ReactNode } from "react";
import { Check, ChevronRight, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * ActionCard — the onboarding handoff surface (story 012).
 *
 * Replaces the raw `<pre>`-first Collect & Copy blocks: it leads with a
 * human-readable summary of what the user's assistant will do, exposes a single
 * prominent Copy button, and tucks the raw markdown payload behind a collapsed
 * "View raw prompt" disclosure so markdown is never the primary UI.
 *
 * The clipboard payload (`copyPayload`) is placed on the clipboard byte-for-byte
 * unchanged — this component is a display wrapper only (file-contracts.md §4).
 *
 * Visual language matches HandoffDock (rounded-2xl, border-primary/25,
 * bg-primary/5, primary glow) using theme tokens exclusively.
 */
export function ActionCard({
  title,
  meta,
  stepList,
  copyPayload,
  statusLine,
  copyLabel = "Collect & Copy",
  hint,
  className,
}: {
  /** Card heading, e.g. "Bootstrap prompt ready". */
  title: string;
  /** Optional mono sub-line (char count, kind label, etc.). */
  meta?: ReactNode;
  /** Human-readable, ordered summary of what the assistant will do. */
  stepList: string[];
  /** The exact markdown placed on the clipboard — never mutated for display. */
  copyPayload: string;
  /** Optional polling/status slot rendered above the raw-prompt disclosure. */
  statusLine?: ReactNode;
  /** Copy-button label in its idle state. */
  copyLabel?: string;
  /** Optional footer note shown under the disclosure. */
  hint?: ReactNode;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const onCopy = () => {
    void navigator.clipboard.writeText(copyPayload);
    setCopied(true);
    // ~1.8 s copied-state feedback — matches the replaced dock components.
    setTimeout(() => setCopied(false), 1800);
  };

  const [firstLine, ...restLines] = copyPayload.split("\n");

  return (
    <div
      className={cn(
        "rounded-2xl border border-primary/25 bg-primary/5 p-5 shadow-[0_0_40px_-20px_var(--primary)]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 className="text-sm font-semibold text-foreground">{title}</h4>
          {meta ? (
            <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
              {meta}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onCopy}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-full px-5 py-2 text-sm font-semibold shadow-[0_0_24px_-6px_var(--primary)] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            copied
              ? "bg-fresh text-primary-foreground"
              : "bg-primary text-primary-foreground hover:brightness-110",
          )}
        >
          {copied ? (
            <>
              <Check className="size-4" /> Copied
            </>
          ) : (
            <>
              <Copy className="size-4" /> {copyLabel}
            </>
          )}
          <kbd className="ml-1 rounded bg-white/20 px-1 font-mono text-[10px]">
            ⌘C
          </kbd>
        </button>
      </div>

      {/* Human-readable step list — always visible above the Copy button. */}
      <div className="mt-4">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          What your assistant will do
        </p>
        <ol className="mt-2 space-y-2">
          {stepList.map((step, i) => (
            <li
              key={i}
              className="flex items-start gap-3 text-sm text-foreground"
            >
              <span
                aria-hidden="true"
                className="flex size-5 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 font-mono text-[10px] font-semibold text-primary"
              >
                {i + 1}
              </span>
              <span className="leading-snug text-pretty">{step}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Optional polling / detection status slot. */}
      {statusLine ? <div className="mt-4">{statusLine}</div> : null}

      {/* Raw markdown payload — collapsed by default (native, keyboard-operable). */}
      <details className="group mt-4">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
          <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" />
          View raw prompt
        </summary>
        <pre className="relative mt-3 max-h-56 overflow-auto rounded-lg border border-border/60 bg-background/60 p-4 font-mono text-[11px] leading-relaxed text-muted-foreground">
          <code className="text-primary">{firstLine}</code>
          {restLines.length ? "\n" + restLines.join("\n") : ""}
        </pre>
      </details>

      {hint ? (
        <p className="mt-3 text-center text-[10px] text-muted-foreground">
          {copied ? "✓ On your clipboard. " : ""}
          {hint}
        </p>
      ) : null}
    </div>
  );
}
