import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check } from "lucide-react";
import { mock, type Adr } from "@/lib/mock";
import { cn } from "@/lib/utils";
import { relativeAge } from "@/lib/time";

export const Route = createFileRoute("/_app/decisions")({
  head: () => ({ meta: [{ title: "Decisions · Work HQ" }] }),
  component: DecisionsPage,
});

const statusStyles: Record<Adr["status"], string> = {
  Accepted: "border-fresh/30 bg-fresh/10 text-fresh",
  Proposed: "border-warning/30 bg-warning/10 text-warning",
  Superseded: "border-border bg-muted text-muted-foreground",
};

function DecisionsPage() {
  const [selectedId, setSelectedId] = useState(mock.adrs[0].id);
  const selected = mock.adrs.find((a) => a.id === selectedId)!;

  return (
    <div className="flex h-full">
      {/* List */}
      <div className="w-80 shrink-0 overflow-y-auto border-r border-border/70 bg-muted/20 p-4">
        <p className="mb-3 px-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {mock.adrs.length} decisions
        </p>
        <ul className="space-y-1">
          {mock.adrs.map((a) => (
            <li key={a.id}>
              <button
                onClick={() => setSelectedId(a.id)}
                className={cn(
                  "w-full rounded-lg border border-transparent p-3 text-left transition",
                  a.id === selectedId
                    ? "border-border bg-card"
                    : "hover:bg-card/60",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {a.id}
                  </span>
                  <span
                    className={cn(
                      "rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-tight",
                      statusStyles[a.status],
                    )}
                  >
                    {a.status}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm font-medium text-foreground">
                  {a.title}
                </p>
                <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                  {relativeAge(a.updatedAt)}
                </p>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Detail */}
      <div className="flex-1 overflow-y-auto p-10">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {selected.id} · updated {relativeAge(selected.updatedAt)}
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                {selected.title}
              </h1>
            </div>
            <span
              className={cn(
                "rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-tight",
                statusStyles[selected.status],
              )}
            >
              {selected.status}
            </span>
          </div>

          <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
            {selected.context}
          </p>

          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
            {selected.options.map((o) => {
              const chosen = selected.chosen === o.key;
              return (
                <div
                  key={o.key}
                  className={cn(
                    "rounded-xl border p-5 transition",
                    chosen
                      ? "border-primary bg-primary/5 shadow-[0_0_0_1px_var(--primary)]"
                      : "border-border bg-card",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-muted-foreground">
                      Option {o.key}
                    </span>
                    {chosen && (
                      <span className="flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                        <Check className="size-3" /> Chosen
                      </span>
                    )}
                  </div>
                  <h3 className="mt-2 text-base font-semibold">{o.title}</h3>
                  <div className="mt-4 space-y-3">
                    <div>
                      <p className="font-mono text-[10px] uppercase text-fresh">
                        Pros
                      </p>
                      <ul className="mt-1 space-y-1 text-sm">
                        {o.pros.map((p, i) => (
                          <li key={i}>+ {p}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="font-mono text-[10px] uppercase text-stale">
                        Cons
                      </p>
                      <ul className="mt-1 space-y-1 text-sm">
                        {o.cons.map((c, i) => (
                          <li key={i}>− {c}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
