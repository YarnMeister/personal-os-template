import { createFileRoute, Link } from "@tanstack/react-router";
import { mock } from "@/lib/mock";
import { daysSince, relativeAge, stalenessLevel } from "@/lib/time";
import { cn } from "@/lib/utils";
import { AlertTriangle, Flame } from "lucide-react";
import { loadOnboarding, type OnboardingState } from "@/server/load-onboarding";

export const Route = createFileRoute("/_app/health")({
  head: () => ({ meta: [{ title: "Health · Work HQ" }] }),
  // Reads docs/data/local/onboarding-state.json on every navigation.
  loader: async () => loadOnboarding(),
  component: HealthPage,
});

function HealthPage() {
  const onboardingState = Route.useLoaderData();
  return (
    <div className="flex h-full flex-col">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-border/70 px-8">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            System state
          </p>
          <h1 className="text-lg font-medium">Health</h1>
        </div>
        <span className="font-mono text-[10px] text-muted-foreground">
          Snapshot · {new Date().toLocaleDateString()}
        </span>
      </header>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto grid max-w-6xl grid-cols-12 gap-4">
          {/* Staleness meters */}
          <Card className="col-span-12 md:col-span-8">
            <CardTitle>File staleness</CardTitle>
            <div className="mt-6 space-y-5">
              {mock.files.map((f) => {
                const level = stalenessLevel(
                  f.updatedAt,
                  f.name === "priorities.md" ? 2 : 5,
                  f.name === "priorities.md" ? 5 : 14,
                );
                const color =
                  level === "stale"
                    ? "bg-stale"
                    : level === "warning"
                      ? "bg-warning"
                      : "bg-fresh";
                const pct = Math.min(100, daysSince(f.updatedAt) * 10 + 8);
                return (
                  <div key={f.name} className="flex items-center gap-4">
                    <span className="w-32 font-mono text-xs text-foreground">
                      {f.name}
                    </span>
                    <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          color,
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span
                      className={cn(
                        "w-24 text-right font-mono text-[10px]",
                        level === "stale" && "text-stale",
                        level === "warning" && "text-warning",
                        level === "fresh" && "text-fresh",
                      )}
                    >
                      {relativeAge(f.updatedAt)}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Streak */}
          <Card className="col-span-12 md:col-span-4 bg-primary text-primary-foreground border-primary">
            <p className="font-mono text-[10px] font-bold uppercase tracking-widest opacity-70">
              Harvest streak
            </p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-6xl font-medium tracking-tight">
                {mock.streak}
              </span>
              <span className="text-sm opacity-80">days</span>
            </div>
            <div className="mt-6 flex items-end gap-0.5 h-16">
              {mock.ritualHistory.map((h, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex-1 rounded-sm transition-all",
                    h.wrapUp ? "bg-white/80" : "bg-white/15",
                  )}
                  style={{
                    height: `${h.wrapUp ? 45 + ((i * 13) % 55) : 15}%`,
                  }}
                />
              ))}
            </div>
            <p className="mt-3 flex items-center gap-1 text-[10px] opacity-80">
              <Flame className="size-3" /> 30-day wrap-up frequency
            </p>
          </Card>

          {/* File size gauges */}
          <Card className="col-span-12 md:col-span-6">
            <CardTitle>File size · bounds</CardTitle>
            <div className="mt-6 grid grid-cols-2 gap-4">
              {mock.files.map((f) => {
                const pct = (f.sizeBytes / f.maxBytes) * 100;
                return (
                  <div
                    key={f.name}
                    className="rounded-lg border border-border/70 bg-muted/30 p-4"
                  >
                    <p className="font-mono text-[10px] text-muted-foreground">
                      {f.name}
                    </p>
                    <p className="mt-1 text-xl font-medium">
                      {(f.sizeBytes / 1024).toFixed(1)}
                      <span className="text-xs font-normal text-muted-foreground">
                        /{(f.maxBytes / 1024).toFixed(0)} KB
                      </span>
                    </p>
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full",
                          pct > 80 ? "bg-warning" : "bg-primary",
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Contract drift */}
          <Card className="col-span-12 md:col-span-6">
            <div className="flex items-center justify-between">
              <CardTitle>Contract drift</CardTitle>
              <span className="rounded border border-warning/30 bg-warning/10 px-2 py-0.5 font-mono text-[10px] text-warning">
                {mock.contractDrift.length} flags
              </span>
            </div>
            <ul className="mt-6 space-y-3">
              {mock.contractDrift.map((c, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 rounded-lg border border-border/70 bg-muted/30 p-3"
                >
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
                  <div className="min-w-0">
                    <p className="font-mono text-[10px] text-muted-foreground">
                      {c.file}
                    </p>
                    <p className="text-sm text-foreground/90">{c.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          {/* Onboarding + Priority churn */}
          <Card className="col-span-12 md:col-span-4">
            <CardTitle>Onboarding</CardTitle>
            <OnboardingTile state={onboardingState} />
          </Card>

          <Card className="col-span-12 md:col-span-8">
            <CardTitle>90-day priority churn</CardTitle>
            <div className="mt-6 flex h-24 items-end gap-1">
              {Array.from({ length: 30 }, (_, i) => {
                const v = 30 + Math.sin(i * 0.6) * 25 + ((i * 7) % 20);
                return (
                  <div
                    key={i}
                    className="flex-1 rounded-t-sm bg-primary/40"
                    style={{ height: `${v}%` }}
                  />
                );
              })}
            </div>
            <p className="mt-3 font-mono text-[10px] text-muted-foreground">
              Priority list changes per day · calm and consistent
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

function OnboardingTile({ state }: { state: OnboardingState | null }) {
  const completedCount = state?.completedPhases.length ?? 0;

  if (completedCount === 0) {
    return (
      <div className="mt-6 space-y-3">
        <p className="text-sm text-muted-foreground">Onboarding not started</p>
        <Link
          to="/onboarding"
          className="inline-block rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:brightness-110"
        >
          Start onboarding →
        </Link>
      </div>
    );
  }

  if (completedCount >= 6) {
    return (
      <div className="mt-6 space-y-1">
        <p className="text-2xl font-medium">Complete</p>
        {state?.updatedAt && (
          <p className="text-xs text-muted-foreground">
            {new Date(state.updatedAt).toLocaleDateString()}
          </p>
        )}
      </div>
    );
  }

  const pct = Math.round((completedCount / 6) * 100);
  return (
    <div className="mt-6 flex items-center gap-6">
      <RingProgress pct={pct} />
      <div>
        <p className="text-2xl font-medium">{completedCount} of 6</p>
        <p className="text-xs text-muted-foreground">phases complete</p>
      </div>
    </div>
  );
}

function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("rounded-2xl border border-border bg-card p-6", className)}
    >
      {children}
    </div>
  );
}
function CardTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold text-foreground">{children}</h3>;
}
function RingProgress({ pct }: { pct: number }) {
  const r = 28;
  const c = 2 * Math.PI * r;
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" className="-rotate-90">
      <circle
        cx="36"
        cy="36"
        r={r}
        stroke="var(--muted)"
        strokeWidth="6"
        fill="none"
      />
      <circle
        cx="36"
        cy="36"
        r={r}
        stroke="var(--primary)"
        strokeWidth="6"
        fill="none"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - pct / 100)}
        strokeLinecap="round"
      />
    </svg>
  );
}
