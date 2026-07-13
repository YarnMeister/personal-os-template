import { useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { buildHandoff, type HandoffSpec } from "@/lib/handoff";

export function HandoffDock({
  spec,
  title = "Handoff Ready",
  filename,
  hint = "Paste this into your AI assistant chat to update your OS state files.",
  className,
}: {
  spec: HandoffSpec;
  title?: string;
  filename?: string;
  hint?: string;
  className?: string;
}) {
  const { markdown, bytes } = useMemo(() => buildHandoff(spec), [spec]);
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* noop */
    }
  };

  const label =
    filename ?? `${spec.kind}-${new Date().toISOString().slice(0, 10)}.md`;

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
          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
            ~{markdown.length.toLocaleString()} chars · {bytes.toLocaleString()}{" "}
            B · {label}
          </p>
        </div>
        <Button
          onClick={onCopy}
          className={cn(
            "rounded-full px-5 font-semibold shadow-[0_0_24px_-6px_var(--primary)] transition-all",
            copied && "bg-fresh text-primary-foreground hover:bg-fresh/90",
          )}
        >
          {copied ? (
            <>
              <Check className="mr-1" /> Copied
            </>
          ) : (
            <>
              <Copy className="mr-1" /> Collect &amp; Copy
            </>
          )}
          <kbd className="ml-2 rounded bg-white/20 px-1 font-mono text-[10px]">
            ⌘C
          </kbd>
        </Button>
      </div>

      <pre className="relative mt-4 max-h-56 overflow-auto rounded-lg border border-border/60 bg-background/60 p-4 font-mono text-[11px] leading-relaxed text-muted-foreground">
        <code className="text-primary">{markdown.split("\n")[0]}</code>
        {"\n"}
        {markdown.split("\n").slice(1).join("\n")}
      </pre>

      <p className="mt-3 text-center text-[10px] text-muted-foreground">
        {copied ? "✓ On your clipboard. " : ""}
        {hint}
      </p>
    </div>
  );
}
