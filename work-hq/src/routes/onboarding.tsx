import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Sparkles } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { HandoffDock } from "@/components/work-hq/HandoffDock";
import { cn } from "@/lib/utils";
import { loadOnboarding } from "@/server/load-onboarding";
import { saveOnboarding } from "@/server/save-onboarding";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Onboarding · Work HQ" }] }),
  // Load persisted state from disk before rendering.  Returns null on a fresh
  // session (file does not exist yet).
  loader: async () => loadOnboarding(),
  component: OnboardingPage,
});

type Answers = {
  role: string;
  workstyle: string;
  stakeholders: string[];
  glossary: string;
  priorities: [string, string, string];
  blockers: string;
  assistant: "copilot" | "other";
  otherAssistant: string;
  checks: { installed: boolean; contextOpen: boolean; testedPaste: boolean };
};

const emptyAnswers: Answers = {
  role: "",
  workstyle: "",
  stakeholders: [""],
  glossary: "",
  priorities: ["", "", ""],
  blockers: "",
  assistant: "copilot",
  otherAssistant: "",
  checks: { installed: false, contextOpen: false, testedPaste: false },
};

const phases = [
  { n: 1, title: "Orientation", subtitle: "How your Personal OS works" },
  { n: 2, title: "About you", subtitle: "Role and workstyle" },
  { n: 3, title: "Your org", subtitle: "Stakeholders and glossary" },
  { n: 4, title: "Right now", subtitle: "Top-3 priorities & blockers" },
  { n: 5, title: "Wire your assistant", subtitle: "Verify the bridge" },
  { n: 6, title: "First standup", subtitle: "Celebrate + hand off" },
];

/** localStorage keys — mirrors of the file-backed primary source. */
const LS_PHASE = "work-hq:onboarding:phase";
const LS_ANSWERS = "work-hq:onboarding:answers";

/** Debounce delay (ms) before writing to disk.  2 s satisfies AC3. */
const SAVE_DEBOUNCE_MS = 2000;

function OnboardingPage() {
  const { theme } = useTheme();
  void theme;

  const savedState = Route.useLoaderData();

  // File-backed state is the primary source of truth.
  // Initialize from the loader result (file), then fall back to localStorage.
  const [phase, setPhase] = useState<number>(() => {
    if (savedState) return savedState.phase;
    try {
      const raw =
        typeof window !== "undefined"
          ? window.localStorage.getItem(LS_PHASE)
          : null;
      if (raw != null) return JSON.parse(raw) as number;
    } catch {
      /* noop */
    }
    return 1;
  });

  const [answers, setAnswers] = useState<Answers>(() => {
    if (savedState) return savedState.answers as Answers;
    try {
      const raw =
        typeof window !== "undefined"
          ? window.localStorage.getItem(LS_ANSWERS)
          : null;
      if (raw != null) return JSON.parse(raw) as Answers;
    } catch {
      /* noop */
    }
    return emptyAnswers;
  });

  const [completedPhases, setCompletedPhases] = useState<number[]>(
    () => savedState?.completedPhases ?? [],
  );

  // Mirror state to localStorage so the write-through cache stays current.
  useEffect(() => {
    try {
      window.localStorage.setItem(LS_PHASE, JSON.stringify(phase));
      window.localStorage.setItem(LS_ANSWERS, JSON.stringify(answers));
    } catch {
      /* noop */
    }
  }, [phase, answers]);

  // Debounced file-backed persistence (ADR-P6-003).
  // Timer resets on every state change; the file write fires once after
  // SAVE_DEBOUNCE_MS of inactivity — never once per keystroke.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void saveOnboarding({
        data: {
          phase,
          answers,
          completedPhases,
          updatedAt: new Date().toISOString(),
        },
      });
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [phase, answers, completedPhases]);

  const set = <K extends keyof Answers>(k: K, v: Answers[K]) =>
    setAnswers((a) => ({ ...a, [k]: v }));

  const next = () => {
    // Mark the current phase as completed before advancing.
    setCompletedPhases((prev) =>
      prev.includes(phase) ? prev : [...prev, phase],
    );
    setPhase((p) => Math.min(6, p + 1));
  };

  const back = () => setPhase((p) => Math.max(1, p - 1));

  return (
    <div className="min-h-screen w-full bg-background text-foreground">
      {/* Top rail */}
      <div className="sticky top-0 z-10 border-b border-border/70 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-6 px-8 py-4">
          <Link to="/today" className="flex items-center gap-2">
            <div className="size-5 rotate-45 rounded-sm bg-primary" />
            <span className="text-sm font-semibold tracking-tight">
              WORK HQ
            </span>
          </Link>
          <div className="flex flex-1 items-center gap-3">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${(phase / 6) * 100}%` }}
              />
            </div>
            <div className="flex gap-1.5">
              {phases.map((p) => (
                <span
                  key={p.n}
                  className={cn(
                    "size-1.5 rounded-full",
                    p.n <= phase ? "bg-primary" : "bg-muted",
                  )}
                />
              ))}
            </div>
          </div>
          <Link
            to="/today"
            className="font-mono text-[10px] text-muted-foreground hover:text-foreground"
          >
            Skip →
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-8 py-16">
        <p className="font-mono text-[10px] uppercase tracking-widest text-primary">
          Phase {phase} of 6 · {phases[phase - 1].title}
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-balance">
          {phases[phase - 1].subtitle}
        </h1>

        <div className="mt-10">
          {phase === 1 && <PhaseOrientation />}
          {phase === 2 && <PhaseAbout answers={answers} set={set} />}
          {phase === 3 && <PhaseOrg answers={answers} set={set} />}
          {phase === 4 && <PhaseNow answers={answers} set={set} />}
          {phase === 5 && <PhaseWire answers={answers} set={set} />}
          {phase === 6 && <PhaseFirst answers={answers} />}
        </div>

        <div className="mt-12 flex items-center justify-between">
          <button
            onClick={back}
            disabled={phase === 1}
            className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-40"
          >
            <ArrowLeft className="size-4" /> Back
          </button>
          {phase < 6 ? (
            <button
              onClick={next}
              className="flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-[0_0_24px_-6px_var(--primary)] hover:brightness-110"
            >
              Next phase <ArrowRight className="size-4" />
            </button>
          ) : (
            <Link
              to="/today"
              className="flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground hover:brightness-110"
            >
              Enter Work HQ <ArrowRight className="size-4" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

/* ----- Phase components ----- */

function PhaseOrientation() {
  const tiers = [
    {
      n: "Tier 1",
      label: "Constitution",
      badge: "Always loaded",
      desc: "The standing orders for every session. Routes to everything else.",
      files: ["AGENTS.md", "CLAUDE.md"],
    },
    {
      n: "Tier 2",
      label: "Living context",
      badge: "On demand",
      desc: "Read at the start of a relevant session: who you are, what you're working on, what the assistant has learned.",
      files: ["context/me.md", "context/org.md", "context/active.md", "memory/"],
    },
    {
      n: "Tier 3",
      label: "Deep files",
      badge: "When you name it",
      desc: "Project and area brains opened only when you mention them by name.",
      files: ["projects/", "areas/", "BACKLOG.md"],
    },
  ];

  const triggers = ["morning standup", "process my backlog", "end session"];

  return (
    <div className="space-y-6">
      <p className="text-base leading-relaxed text-muted-foreground">
        Your Personal OS is plain markdown files — no code, no servers. One
        file,{" "}
        <code className="font-mono text-foreground">AGENTS.md</code>, acts as
        your AI's constitution: always loaded, always routing to everything
        else.
      </p>

      {/* Privacy / offline note — visible without scrolling */}
      <div className="rounded-lg border border-border bg-muted/40 px-4 py-3">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">
            Your data stays local and works offline.
          </span>{" "}
          Nothing is sent to any server we operate. Every ritual — standup,
          backlog, session harvest — runs from your own files with no internet
          required.
        </p>
      </div>

      {/* Three-tier model with exact file/folder names */}
      <div className="space-y-2">
        {tiers.map((t) => (
          <div key={t.n} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t.n} · {t.label}
              </p>
              <span className="font-mono text-[10px] uppercase tracking-widest text-primary">
                {t.badge}
              </span>
            </div>
            <p className="mb-2 text-xs text-muted-foreground">{t.desc}</p>
            <div className="flex flex-wrap gap-1">
              {t.files.map((f) => (
                <code
                  key={f}
                  className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground"
                >
                  {f}
                </code>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Daily trigger phrases */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Three phrases run your whole day
        </p>
        <div className="flex flex-wrap gap-2">
          {triggers.map((phrase) => (
            <code
              key={phrase}
              className="rounded-md border border-primary/20 bg-primary/10 px-3 py-1 font-mono text-sm text-primary"
            >
              {phrase}
            </code>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Type any phrase into a fresh VS Code chat. The constitution routes
          your assistant to the right files automatically.
        </p>
      </div>
    </div>
  );
}

function PhaseAbout({
  answers,
  set,
}: {
  answers: Answers;
  set: <K extends keyof Answers>(k: K, v: Answers[K]) => void;
}) {
  return (
    <div className="space-y-6">
      <Field label="Your role">
        <input
          value={answers.role}
          onChange={(e) => set("role", e.target.value)}
          placeholder="Product Operations Lead"
          className="w-full rounded-lg border border-border bg-card px-4 py-3 text-base outline-none focus:ring-2 focus:ring-primary/40"
        />
      </Field>
      <Field label="Workstyle in one line">
        <input
          value={answers.workstyle}
          onChange={(e) => set("workstyle", e.target.value)}
          placeholder="Async-first, deep-work mornings, batched afternoons"
          className="w-full rounded-lg border border-border bg-card px-4 py-3 text-base outline-none focus:ring-2 focus:ring-primary/40"
        />
      </Field>
    </div>
  );
}

function PhaseOrg({
  answers,
  set,
}: {
  answers: Answers;
  set: <K extends keyof Answers>(k: K, v: Answers[K]) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-warning/25 bg-warning/5 p-4">
        <p className="text-sm text-foreground/90">
          <span className="font-semibold">One gentle note:</span> the OS lives
          as plaintext markdown. Don't put secrets, salaries, or NDA content
          here — reference by alias.
        </p>
      </div>
      <Field label="Key stakeholders">
        <div className="space-y-2">
          {answers.stakeholders.map((s, i) => (
            <input
              key={i}
              value={s}
              onChange={(e) => {
                const next = [...answers.stakeholders];
                next[i] = e.target.value;
                set("stakeholders", next);
              }}
              placeholder="Sarah Chen (CTO) — decision maker"
              className="w-full rounded-lg border border-border bg-card px-4 py-3 text-base outline-none focus:ring-2 focus:ring-primary/40"
            />
          ))}
          <button
            onClick={() => set("stakeholders", [...answers.stakeholders, ""])}
            className="text-xs font-medium text-primary hover:underline"
          >
            + Add stakeholder
          </button>
        </div>
      </Field>
      <Field label="Team glossary (acronyms, project codenames)">
        <textarea
          rows={3}
          value={answers.glossary}
          onChange={(e) => set("glossary", e.target.value)}
          placeholder="TP = Team Platform&#10;Atlas = the new billing system"
          className="w-full rounded-lg border border-border bg-card px-4 py-3 text-base outline-none focus:ring-2 focus:ring-primary/40 font-mono"
        />
      </Field>
    </div>
  );
}

function PhaseNow({
  answers,
  set,
}: {
  answers: Answers;
  set: <K extends keyof Answers>(k: K, v: Answers[K]) => void;
}) {
  return (
    <div className="space-y-6">
      <Field label="Your top 3 priorities right now">
        <div className="space-y-2">
          {answers.priorities.map((p, i) => (
            <input
              key={i}
              value={p}
              onChange={(e) => {
                const next = [...answers.priorities] as [
                  string,
                  string,
                  string,
                ];
                next[i] = e.target.value;
                set("priorities", next);
              }}
              placeholder={`${i + 1}.`}
              className="w-full rounded-lg border border-border bg-card px-4 py-3 text-base outline-none focus:ring-2 focus:ring-primary/40"
            />
          ))}
        </div>
      </Field>
      <Field label="Anything blocking you today?">
        <textarea
          rows={3}
          value={answers.blockers}
          onChange={(e) => set("blockers", e.target.value)}
          className="w-full rounded-lg border border-border bg-card px-4 py-3 text-base outline-none focus:ring-2 focus:ring-primary/40"
        />
      </Field>
    </div>
  );
}

function PhaseWire({
  answers,
  set,
}: {
  answers: Answers;
  set: <K extends keyof Answers>(k: K, v: Answers[K]) => void;
}) {
  const checkItems = [
    {
      key: "installed" as const,
      label: "I have GitHub Copilot (or my assistant) open in VS Code",
    },
    {
      key: "contextOpen" as const,
      label: "My OS folder is open as a workspace so the AI can read it",
    },
    {
      key: "testedPaste" as const,
      label: "I've tested pasting the verification prompt below",
    },
  ];
  const verification = `Please read context/active.md and memory/learnings.md.
Summarize my current top-3 priorities and top blocker in <5 lines.`;

  return (
    <div className="space-y-8">
      <div className="flex gap-2 rounded-lg border border-border bg-card p-1">
        {(["copilot", "other"] as const).map((k) => (
          <button
            key={k}
            onClick={() => set("assistant", k)}
            className={cn(
              "flex-1 rounded-md px-3 py-2 text-sm font-medium capitalize transition",
              answers.assistant === k
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {k === "copilot" ? "GitHub Copilot" : "Other assistant"}
          </button>
        ))}
      </div>

      {answers.assistant === "other" && (
        <Field label="Which assistant?">
          <input
            value={answers.otherAssistant}
            onChange={(e) => set("otherAssistant", e.target.value)}
            placeholder="Claude, ChatGPT, Cursor…"
            className="w-full rounded-lg border border-border bg-card px-4 py-3 outline-none focus:ring-2 focus:ring-primary/40"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Works the same — as long as the assistant reads pasted markdown.
          </p>
        </Field>
      )}

      <div className="space-y-2">
        {checkItems.map((c) => (
          <label
            key={c.key}
            className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-card p-4"
          >
            <input
              type="checkbox"
              checked={answers.checks[c.key]}
              onChange={(e) =>
                set("checks", { ...answers.checks, [c.key]: e.target.checked })
              }
              className="size-4 accent-primary"
            />
            <span className="text-sm">{c.label}</span>
            {answers.checks[c.key] && (
              <Check className="ml-auto size-4 text-fresh" />
            )}
          </label>
        ))}
      </div>

      <HandoffDock
        spec={{
          kind: "gather-answers",
          sections: [{ label: "Verification prompt", body: verification }],
        }}
        title="Verification prompt"
        filename="verify.md"
        hint="Paste this into your assistant. If the summary is accurate, you're wired up."
      />
    </div>
  );
}

function PhaseFirst({ answers }: { answers: Answers }) {
  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-8 text-center">
        <Sparkles className="mx-auto size-8 text-primary" />
        <h3 className="mt-4 text-2xl font-semibold">You're set up.</h3>
        <p className="mt-2 text-sm text-muted-foreground text-pretty">
          Everything you told Work HQ is now ready to hand off to your assistant
          as your very first standup. From tomorrow, this becomes a 2-minute
          morning ritual.
        </p>
      </div>

      <HandoffDock
        spec={{
          kind: "first-standup",
          sections: [
            { label: "Role", body: answers.role },
            { label: "Workstyle", body: answers.workstyle },
            { label: "Stakeholders", body: answers.stakeholders },
            { label: "Glossary", body: answers.glossary },
            { label: "Top 3 priorities", body: [...answers.priorities] },
            { label: "Blockers", body: answers.blockers },
            {
              label: "Ask",
              body: "Please initialize my context/ and memory/ files from the above and confirm you understand my context.",
            },
          ],
        }}
        title="First standup handoff"
        filename="first-standup.md"
        hint="Paste into your assistant to write your initial context/ files."
      />
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}
