import { createFileRoute } from "@tanstack/react-router";
import { RitualLayout } from "@/components/work-hq/RitualLayout";
import { OsStatePanel } from "@/components/work-hq/OsStatePanel";
import { AutosaveField } from "@/components/work-hq/AutosaveField";
import { HandoffDock } from "@/components/work-hq/HandoffDock";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { mock } from "@/lib/mock";

export const Route = createFileRoute("/_app/today")({
  head: () => ({ meta: [{ title: "Today · Work HQ" }] }),
  component: TodayPage,
});

type TodayState = { focus: string; bigFrog: string; noise: string };

function TodayPage() {
  const [state, setState] = useLocalStorage<TodayState>("work-hq:today", {
    focus: "",
    bigFrog: "",
    noise: "",
  });

  const set = (patch: Partial<TodayState>) =>
    setState((s) => ({ ...s, ...patch }));

  return (
    <RitualLayout
      eyebrow="Morning ritual"
      title="Standup"
      status={
        <span className="rounded border border-fresh/25 bg-fresh/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-fresh">
          On track
        </span>
      }
      left={
        <OsStatePanel
          filename="state/priorities.md"
          updatedAt={mock.prioritiesUpdatedAt}
          sections={[
            {
              title: "Active Priorities",
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
            {
              title: "Blockers",
              render: (
                <ul className="space-y-1">
                  {mock.blockers.map((b) => (
                    <li
                      key={b.id}
                      className={b.severity === "high" ? "text-stale" : ""}
                    >
                      {b.severity === "high" ? "! " : "- "}
                      {b.text}
                    </li>
                  ))}
                </ul>
              ),
            },
            {
              title: "Suggested First Action",
              render: (
                <p className="text-primary/90">→ {mock.suggestedFirstAction}</p>
              ),
            },
          ]}
        />
      }
      right={
        <div className="space-y-10">
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              Focus for today
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              What will make today a win?
            </p>
          </div>
          <div className="space-y-6">
            <AutosaveField
              label="Top priority focus"
              value={state.focus}
              onChange={(v) => set({ focus: v })}
              placeholder="e.g. Unblock the roadmap review…"
            />
            <AutosaveField
              label='The "big frog" action'
              as="textarea"
              rows={3}
              value={state.bigFrog}
              onChange={(v) => set({ bigFrog: v })}
              placeholder="One concrete step to take immediately…"
            />
            <AutosaveField
              label="Any new blockers or noise?"
              as="textarea"
              rows={2}
              value={state.noise}
              onChange={(v) => set({ noise: v })}
              placeholder="What's getting in the way?"
            />
          </div>

          <HandoffDock
            spec={{
              kind: "standup",
              sections: [
                { label: "Focus", body: state.focus },
                { label: "Big-frog action", body: state.bigFrog },
                { label: "New blockers / noise", body: state.noise },
                {
                  label: "Current priorities",
                  body: mock.priorities.map((p) => p.text),
                },
              ],
            }}
            filename="standup-morning.md"
          />
        </div>
      }
    />
  );
}
