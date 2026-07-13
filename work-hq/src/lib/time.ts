export function daysSince(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export function relativeAge(iso: string): string {
  const d = daysSince(iso);
  if (d <= 0) return "today";
  if (d === 1) return "1 day ago";
  if (d < 30) return `${d} days ago`;
  const w = Math.floor(d / 7);
  if (w < 8) return `${w} weeks ago`;
  return `${Math.floor(d / 30)} months ago`;
}

export function stalenessLevel(
  iso: string,
  warnAfterDays = 2,
  staleAfterDays = 7,
): "fresh" | "warning" | "stale" {
  const d = daysSince(iso);
  if (d >= staleAfterDays) return "stale";
  if (d >= warnAfterDays) return "warning";
  return "fresh";
}
