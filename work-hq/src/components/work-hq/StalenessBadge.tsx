import { cn } from "@/lib/utils";
import { relativeAge, stalenessLevel } from "@/lib/time";

export function StalenessBadge({
  updatedAt,
  label = "Updated",
  warnAfterDays,
  staleAfterDays,
  className,
}: {
  updatedAt: string;
  label?: string;
  warnAfterDays?: number;
  staleAfterDays?: number;
  className?: string;
}) {
  const level = stalenessLevel(updatedAt, warnAfterDays, staleAfterDays);
  const styles = {
    fresh: "border-fresh/25 bg-fresh/10 text-fresh",
    warning: "border-warning/30 bg-warning/10 text-warning",
    stale: "border-stale/30 bg-stale/10 text-stale",
  }[level];
  const dot = { fresh: "bg-fresh", warning: "bg-warning", stale: "bg-stale" }[
    level
  ];
  const text =
    level === "stale"
      ? `Stale · ${relativeAge(updatedAt)}`
      : level === "warning"
        ? `${label} ${relativeAge(updatedAt)}`
        : `Fresh · ${relativeAge(updatedAt)}`;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-tight",
        styles,
        className,
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          dot,
          level !== "fresh" && "animate-pulse",
        )}
      />
      {text}
    </span>
  );
}
