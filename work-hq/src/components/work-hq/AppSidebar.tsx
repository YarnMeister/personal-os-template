import { Link, useRouterState } from "@tanstack/react-router";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";
import { mock } from "@/lib/mock";

const rituals = [
  { to: "/today", label: "Today" },
  { to: "/backlog", label: "Backlog" },
  { to: "/wrap-up", label: "Wrap-Up" },
];
const reference = [
  { to: "/health", label: "Health" },
  { to: "/decisions", label: "Decisions" },
  { to: "/questions", label: "Questions" },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { theme, toggle } = useTheme();
  const onbPhase = mock.onboardingSeed.phase;
  const onbComplete = onbPhase >= 6;

  const NavItem = ({ to, label }: { to: string; label: string }) => {
    const active = pathname === to;
    return (
      <Link
        to={to}
        className={cn(
          "flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors",
          active
            ? "bg-sidebar-accent text-primary"
            : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
        )}
      >
        <span>{label}</span>
        {label === "Wrap-Up" && (
          <span className="rounded bg-fresh/10 px-1.5 py-0.5 font-mono text-[10px] text-fresh">
            {mock.streak}d
          </span>
        )}
      </Link>
    );
  };

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-border/70 bg-sidebar p-6">
      <Link to="/today" className="mb-10 flex items-center gap-3 px-2">
        <div className="size-6 rotate-45 rounded-sm bg-primary" />
        <span className="font-semibold tracking-tight text-foreground">
          WORK HQ
        </span>
      </Link>

      <div className="space-y-6">
        <div>
          <p className="mb-2 px-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
            Rituals
          </p>
          <nav className="space-y-1">
            {rituals.map((r) => (
              <NavItem key={r.to} {...r} />
            ))}
          </nav>
        </div>
        <div>
          <p className="mb-2 px-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
            Reference
          </p>
          <nav className="space-y-1">
            {reference.map((r) => (
              <NavItem key={r.to} {...r} />
            ))}
          </nav>
        </div>
      </div>

      <div className="mt-auto space-y-4">
        {!onbComplete && (
          <div className="rounded-xl border border-border/60 bg-card/60 p-4">
            <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Onboarding
            </p>
            <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${(onbPhase / 6) * 100}%` }}
              />
            </div>
            <p className="text-xs text-foreground/90">Phase {onbPhase} of 6</p>
            <Link
              to="/onboarding"
              className="mt-3 block w-full rounded bg-muted py-2 text-center text-xs font-semibold text-foreground transition hover:bg-accent hover:text-accent-foreground"
            >
              Resume Setup
            </Link>
          </div>
        )}

        <div className="flex items-center justify-between rounded-lg border border-border/60 bg-card/40 px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-foreground">
              {mock.user.initials}
            </div>
            <div className="leading-tight">
              <p className="text-[11px] font-medium text-foreground">
                {mock.user.name}
              </p>
              <p className="font-mono text-[9px] text-muted-foreground">
                v1.0.0
              </p>
            </div>
          </div>
          <button
            onClick={toggle}
            aria-label="Toggle theme"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {theme === "dark" ? (
              <Moon className="size-4" />
            ) : (
              <Sun className="size-4" />
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}
