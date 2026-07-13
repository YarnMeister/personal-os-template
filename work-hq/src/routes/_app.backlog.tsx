import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowDown, ArrowUp, Check, Plus, Trash2 } from "lucide-react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { mock, type BacklogItem } from "@/lib/mock";
import { HandoffDock } from "@/components/work-hq/HandoffDock";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/backlog")({
  head: () => ({ meta: [{ title: "Backlog · Work HQ" }] }),
  component: BacklogPage,
});

function BacklogPage() {
  const [items, setItems] = useLocalStorage<BacklogItem[]>(
    "work-hq:backlog",
    mock.backlog,
  );
  const [draft, setDraft] = useState("");

  const add = () => {
    const text = draft.trim();
    if (!text) return;
    setItems((xs) => [
      { id: crypto.randomUUID(), text, createdAt: new Date().toISOString() },
      ...xs,
    ]);
    setDraft("");
  };

  const move = (id: string, dir: -1 | 1) =>
    setItems((xs) => {
      const i = xs.findIndex((x) => x.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= xs.length) return xs;
      const next = [...xs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const remove = (id: string) =>
    setItems((xs) => xs.filter((x) => x.id !== id));
  const toggleProcessed = (id: string) =>
    setItems((xs) =>
      xs.map((x) => (x.id === id ? { ...x, processed: !x.processed } : x)),
    );

  const unprocessed = items.filter((i) => !i.processed);

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-border/70 px-8">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Quick capture
          </p>
          <h1 className="text-lg font-medium">Backlog</h1>
        </div>
        <span className="font-mono text-[10px] text-muted-foreground">
          {unprocessed.length} open · {items.length - unprocessed.length}{" "}
          processed
        </span>
      </header>

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 overflow-y-auto p-8">
        <div className="flex gap-2 rounded-xl border border-border bg-card p-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Capture a thought… (press Enter)"
            className="flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/60"
          />
          <button
            onClick={add}
            className="flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="size-4" /> Add
          </button>
        </div>

        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className={cn(
                "group flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 transition",
                item.processed && "opacity-50",
              )}
            >
              <button
                onClick={() => toggleProcessed(item.id)}
                className={cn(
                  "flex size-5 items-center justify-center rounded border text-transparent transition",
                  item.processed
                    ? "border-fresh bg-fresh text-primary-foreground"
                    : "border-border hover:border-primary",
                )}
              >
                <Check className="size-3" />
              </button>
              <span
                className={cn(
                  "flex-1 text-sm",
                  item.processed && "line-through text-muted-foreground",
                )}
              >
                {item.text}
              </span>
              <div className="flex items-center opacity-0 transition group-hover:opacity-100">
                <button
                  onClick={() => move(item.id, -1)}
                  className="rounded p-1 text-muted-foreground hover:bg-muted"
                >
                  <ArrowUp className="size-3.5" />
                </button>
                <button
                  onClick={() => move(item.id, 1)}
                  className="rounded p-1 text-muted-foreground hover:bg-muted"
                >
                  <ArrowDown className="size-3.5" />
                </button>
                <button
                  onClick={() => remove(item.id)}
                  className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-stale"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </li>
          ))}
          {items.length === 0 && (
            <li className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Nothing captured yet. Type above to get started.
            </li>
          )}
        </ul>

        <HandoffDock
          spec={{
            kind: "process-backlog",
            sections: [
              {
                label: "Ask",
                body: "Please help me route, group, and prioritize the backlog below. Suggest what to drop.",
              },
              { label: "Backlog", body: unprocessed.map((i) => i.text) },
            ],
          }}
          title="Process my backlog"
          filename="backlog.md"
          hint="After the AI groups these, come back and mark them processed."
        />
      </div>
    </div>
  );
}
