import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  as?: "input" | "textarea";
  rows?: number;
  className?: string;
};

export function AutosaveField({
  label,
  value,
  onChange,
  placeholder,
  as = "input",
  rows = 3,
  className,
}: Props) {
  const [saving, setSaving] = useState(false);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setSaving(true);
    const t = setTimeout(() => setSaving(false), 600);
    return () => clearTimeout(t);
  }, [value]);

  const base =
    "w-full rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 transition";

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            {label}
          </label>
          <span
            className={cn(
              "flex items-center gap-1.5 text-[10px] font-mono transition-opacity",
              saving ? "text-warning opacity-100" : "text-fresh opacity-70",
            )}
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                saving ? "bg-warning animate-pulse" : "bg-fresh",
              )}
            />
            {saving ? "Saving…" : "Saved"}
          </span>
        </div>
      )}
      {as === "textarea" ? (
        <textarea
          rows={rows}
          className={base}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      ) : (
        <input
          className={base}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}
