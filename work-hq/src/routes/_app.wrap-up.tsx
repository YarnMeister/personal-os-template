import { createFileRoute } from "@tanstack/react-router";
import { Flame, Plus, X } from "lucide-react";
import { RitualLayout } from "@/components/work-hq/RitualLayout";
import { OsStatePanel } from "@/components/work-hq/OsStatePanel";
import { AutosaveField } from "@/components/work-hq/AutosaveField";
import { HandoffDock } from "@/components/work-hq/HandoffDock";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { mock } from "@/lib/mock";
import { relativeAge } from "@/lib/time";

export const Route = createFileRoute("/_app/wrap-up")({
  head: () => ({ meta: [{ title: "Wrap-Up · Work HQ" }] }),
  component: WrapUpPage,
});

type WrapUpState = {
  shipped: string;
  learnings: string[];
  decisions: string[];
  tomorrow: [string, string, string];
};

function WrapUpPage() {
  const [state, setState] = useLocalStorage<WrapUpState>("work-hq:wrap-up", {
    shipped: "",
    learnings: [""],
    decisions: [""],
    tomorrow: ["", "", ""],
  });

  const setArr = (key: "learnings" | "decisions", i: number, v: string) =>
    setState((s) => {
      const next = [...s[key]];
      next[i] = v;
      return { ...s, [key]: next };
    });

  const addArr = (key: "learnings" | "decisions") =>
    setState((s) => ({ ...s, [key]: [...s[key], ""] }));

  const removeArr = (key: "learnings" | "decisions", i: number) =>
    setState((s) => ({ ...s, [key]: s[key].filter((_, j) => j !== i) }));

  const setTomorrow = (i: 0 | 1 | 2, v: string) =>
    setState((s) => {
      const t = [...s.tomorrow] as [string, string, string];
      t[i] = v;
      return { ...s, tomorrow: t };
    });

  return (
    <RitualLayout
      eyebrow="Evening ritual"
      title="Wrap-Up"
      status={
        <span className="flex items-center gap-1.5 rounded border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-primary">
          <Flame className="size-3" /> {mock.streak}-day streak
        </span>
      }
      left={
        <OsStatePanel
          filename="state/learnings.md"
          updatedAt={mock.learnings[0].capturedAt}
          sections={[
            {
              title: "Recent Learnings",
              render: (
                <ul className="space-y-1.5">
                  {mock.learnings.slice(0, 5).map((l) => (
                    <li key={l.id} className="flex gap-2">
                      <span className="text-muted-foreground">-</span>
                      <span>
                        {l.text}{" "}
                        <span className="text-[10px] text-muted-foreground">
                          ({relativeAge(l.capturedAt)})
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              ),
            },
            {
              title: "Today's Priorities (for reference)",
              render: (
                <ol className="space-y-1">
                  {mock.priorities.map((p, i) => (
                    <li key={p.id}>
                      {i + 1}. {p.text}
                    </li>
                  ))}
                </ol>
              ),
            },
          ]}
        />
      }
      right={
        <div className="space-y-10">
          <div>
            <h2 className="text-xl font-semibold">Close out the day</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Take four minutes. Future-you will thank you.
            </p>
          </div>

          <AutosaveField
            label="What shipped today?"
            as="textarea"
            rows={3}
            value={state.shipped}
            onChange={(v) => setState((s) => ({ ...s, shipped: v }))}
            placeholder="Merged, deployed, communicated, decided…"
          />

          <RepeatingField
            label="Learnings candidates"
            values={state.learnings}
            onChange={(i, v) => setArr("learnings", i, v)}
            onAdd={() => addArr("learnings")}
            onRemove={(i) => removeArr("learnings", i)}
            placeholder="One tactical takeaway…"
          />

          <RepeatingField
            label="Decisions made"
            values={state.decisions}
            onChange={(i, v) => setArr("decisions", i, v)}
            onAdd={() => addArr("decisions")}
            onRemove={(i) => removeArr("decisions", i)}
            placeholder="ADR-worthy choice…"
          />

          <div className="space-y-2">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Tomorrow's top 3
            </label>
            <div className="space-y-2">
              {state.tomorrow.map((t, i) => (
                <input
                  key={i}
                  value={t}
                  onChange={(e) => setTomorrow(i as 0 | 1 | 2, e.target.value)}
                  placeholder={`${i + 1}.`}
                  className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                />
              ))}
            </div>
          </div>

          <HandoffDock
            spec={{
              kind: "wrap-up",
              sections: [
                { label: "Shipped", body: state.shipped },
                { label: "Learnings", body: state.learnings },
                { label: "Decisions", body: state.decisions },
                {
                  label: "Tomorrow's top 3",
                  body: state.tomorrow as unknown as string[],
                },
              ],
            }}
            title="End session"
            filename="wrap-up.md"
            hint="Paste into your assistant with the instruction: 'end session'."
          />
        </div>
      }
    />
  );
}

function RepeatingField({
  label,
  values,
  onChange,
  onAdd,
  onRemove,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (i: number, v: string) => void;
  onAdd: () => void;
  onRemove: (i: number) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </label>
      <div className="space-y-2">
        {values.map((v, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={v}
              onChange={(e) => onChange(i, e.target.value)}
              placeholder={placeholder}
              className="flex-1 rounded-lg border border-border bg-card px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
            {values.length > 1 && (
              <button
                onClick={() => onRemove(i)}
                className="rounded p-2 text-muted-foreground hover:bg-muted hover:text-stale"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        ))}
        <button
          onClick={onAdd}
          className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          <Plus className="size-3" /> Add another
        </button>
      </div>
    </div>
  );
}
