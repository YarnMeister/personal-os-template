import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { mock, type Question } from "@/lib/mock";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { HandoffDock } from "@/components/work-hq/HandoffDock";
import { cn } from "@/lib/utils";
import { relativeAge } from "@/lib/time";

export const Route = createFileRoute("/_app/questions")({
  head: () => ({ meta: [{ title: "Questions · Work HQ" }] }),
  component: QuestionsPage,
});

type QState = Record<string, { answer: string; status: Question["status"] }>;

const statuses: Question["status"][] = [
  "open",
  "answered",
  "resolved",
  "parked",
];

function QuestionsPage() {
  const [tab, setTab] = useState<Question["status"]>("open");
  const [state, setState] = useLocalStorage<QState>(
    "work-hq:questions",
    Object.fromEntries(
      mock.questions.map((q) => [q.id, { answer: "", status: q.status }]),
    ),
  );

  const items = mock.questions.filter(
    (q) => (state[q.id]?.status ?? q.status) === tab,
  );

  const setAnswer = (id: string, v: string) =>
    setState((s) => ({
      ...s,
      [id]: { ...(s[id] ?? { status: "open" }), answer: v },
    }));
  const setStatus = (id: string, st: Question["status"]) =>
    setState((s) => ({
      ...s,
      [id]: { ...(s[id] ?? { answer: "" }), status: st },
    }));

  const withAnswers = mock.questions
    .map((q) => ({ q, a: state[q.id]?.answer ?? "" }))
    .filter((x) => x.a.trim().length > 0);

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-border/70 px-8">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Open loops
          </p>
          <h1 className="text-lg font-medium">Questions</h1>
        </div>
        <div className="flex gap-1 rounded-lg border border-border bg-card p-1">
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => setTab(s)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium capitalize transition",
                tab === s
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-3xl space-y-4">
          {items.length === 0 && (
            <p className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              Nothing in “{tab}”.
            </p>
          )}
          {items.map((q) => {
            const st = state[q.id]!;
            return (
              <div
                key={q.id}
                className="rounded-xl border border-border bg-card p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-base font-semibold text-foreground">
                      {q.question}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {q.context}
                    </p>
                    <p className="mt-2 font-mono text-[10px] text-muted-foreground">
                      asked {relativeAge(q.askedAt)}
                    </p>
                  </div>
                  <select
                    value={st.status}
                    onChange={(e) =>
                      setStatus(q.id, e.target.value as Question["status"])
                    }
                    className="rounded-md border border-border bg-background px-2 py-1 text-xs capitalize"
                  >
                    {statuses.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <textarea
                  rows={2}
                  value={st.answer}
                  onChange={(e) => setAnswer(q.id, e.target.value)}
                  placeholder="Draft an answer or working hypothesis…"
                  className="mt-4 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            );
          })}

          <HandoffDock
            spec={{
              kind: "gather-answers",
              sections: [
                {
                  label: "Ask",
                  body: "Please review my drafted answers below and either confirm, refine, or push back.",
                },
                ...withAnswers.map((x) => ({
                  label: `Q: ${x.q.question}`,
                  body: x.a,
                })),
              ],
            }}
            title="Gather answers"
            filename="questions.md"
            hint="Only cards with a drafted answer are bundled."
          />
        </div>
      </div>
    </div>
  );
}
