import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { HandoffDock } from "@/components/work-hq/HandoffDock";
import { cn } from "@/lib/utils";
import { loadOnboarding } from "@/server/load-onboarding";
import { saveOnboarding } from "@/server/save-onboarding";
import { checkProfileExists } from "@/server/check-profile-exists";
import { readBootstrapPrompt } from "@/server/read-bootstrap-prompt";

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
  /** AC1/AC5: 'bootstrap' | 'manual' | '' — empty means no path chosen yet */
  seedingPath: "bootstrap" | "manual" | "";
  /** AC3: full name collected before generating the bootstrap prompt */
  fullName: string;
  /** AC3: work email collected before generating the bootstrap prompt */
  workEmail: string;
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
  seedingPath: "",
  fullName: "",
  workEmail: "",
};

const phases = [
  { n: 1, title: "Orientation", subtitle: "How your Personal OS works" },
  { n: 2, title: "Wire your assistant", subtitle: "Verify the bridge" },
  { n: 3, title: "Seed your profile", subtitle: "Choose your setup path" },
  { n: 4, title: "Your org", subtitle: "Stakeholders and glossary" },
  { n: 5, title: "Right now", subtitle: "Top-3 priorities & blockers" },
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

  // Phase 2 requires all three checkboxes before advancing (AC6: ensures
  // phase 2 is only added to completedPhases once wiring is confirmed).
  const allWireChecks = Object.values(answers.checks).every(Boolean);
  // Phase 3 requires a seeding path to be chosen before advancing (AC1/AC5).
  const nextDisabled =
    (phase === 2 && !allWireChecks) || (phase === 3 && !answers.seedingPath);

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
          {phase === 2 && <PhaseWire answers={answers} set={set} />}
          {phase === 3 && (
            <PhaseSeeding
              answers={answers}
              set={set}
              completedPhases={completedPhases}
            />
          )}
          {phase === 4 && <PhaseOrg answers={answers} set={set} />}
          {phase === 5 && <PhaseNow answers={answers} set={set} />}
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
              disabled={nextDisabled}
              title={
                nextDisabled
                  ? "Tick all three checkboxes to continue"
                  : undefined
              }
              className={cn(
                "flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground",
                nextDisabled
                  ? "cursor-not-allowed opacity-50"
                  : "shadow-[0_0_24px_-6px_var(--primary)] hover:brightness-110",
              )}
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
      files: [
        "context/me.md",
        "context/org.md",
        "context/active.md",
        "memory/",
      ],
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
        file, <code className="font-mono text-foreground">AGENTS.md</code>, acts
        as your AI's constitution: always loaded, always routing to everything
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
          <div
            key={t.n}
            className="rounded-xl border border-border bg-card p-4"
          >
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

/* ----- PhaseSeeding (phase 3) — story 009 ----- */

/**
 * Renders a raw-content Collect & Copy block for the bootstrap prompt.
 * Visually matches HandoffDock but accepts arbitrary text rather than a
 * structured HandoffSpec, because the bootstrap prompt is a full markdown
 * document authored in templates/bootstrap-profile-prompt.md.
 */
function BootstrapCopyBlock({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);

  const onCopy = () => {
    void navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="rounded-2xl border border-primary/25 bg-primary/5 p-5 shadow-[0_0_40px_-20px_var(--primary)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 className="text-sm font-semibold text-foreground">
            Bootstrap prompt ready
          </h4>
          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
            profile-bootstrap · ~{content.length.toLocaleString()} chars
          </p>
        </div>
        <button
          type="button"
          onClick={onCopy}
          className={cn(
            "flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-semibold shadow-[0_0_24px_-6px_var(--primary)] transition-all",
            copied
              ? "bg-fresh text-primary-foreground"
              : "bg-primary text-primary-foreground hover:brightness-110",
          )}
        >
          {copied ? (
            <>
              <Check className="size-4" /> Copied
            </>
          ) : (
            <>
              <Copy className="size-4" /> Collect &amp; Copy
            </>
          )}
          <kbd className="ml-1 rounded bg-white/20 px-1 font-mono text-[10px]">
            ⌘C
          </kbd>
        </button>
      </div>

      <pre className="relative mt-4 max-h-56 overflow-auto rounded-lg border border-border/60 bg-background/60 p-4 font-mono text-[11px] leading-relaxed text-muted-foreground">
        <code className="text-primary">{content.split("\n")[0]}</code>
        {"\n"}
        {content.split("\n").slice(1).join("\n")}
      </pre>

      <p className="mt-3 text-center text-[10px] text-muted-foreground">
        {copied ? "✓ On your clipboard. " : ""}
        Paste into your Glean-connected AI assistant to generate your profile.
      </p>
    </div>
  );
}

/**
 * PhaseSeeding — phase 3 of the onboarding wizard (story 009).
 *
 * Presents two paths:
 *  - Bootstrap with Glean (requires phase 2 complete; collects name + email;
 *    shows the substituted bootstrap prompt via Collect & Copy; then polls for
 *    context/profile.md every 5 s)
 *  - Set up manually (records seedingPath: 'manual'; enables Next phase)
 */
function PhaseSeeding({
  answers,
  set,
  completedPhases,
}: {
  answers: Answers;
  set: <K extends keyof Answers>(k: K, v: Answers[K]) => void;
  completedPhases: number[];
}) {
  // AC2: Bootstrap is only active when phase 2 is marked complete.
  const phase2Done = completedPhases.includes(2);

  // Local UI state — not persisted (prompt content is derived from the template).
  const [promptContent, setPromptContent] = useState<string | null>(null);
  const [promptLoading, setPromptLoading] = useState(false);
  const [promptError, setPromptError] = useState(false);
  const [profileDetected, setProfileDetected] = useState(false);
  const [checking, setChecking] = useState(false);

  // AC4: Auto-poll context/profile.md every 5 s once the prompt has been shown.
  useEffect(() => {
    if (!promptContent || profileDetected) return;
    const id = setInterval(() => {
      void checkProfileExists().then(({ exists }) => {
        if (exists) setProfileDetected(true);
      });
    }, 5000);
    return () => clearInterval(id);
  }, [promptContent, profileDetected]);

  const handleRefresh = () => {
    setChecking(true);
    void checkProfileExists().then(({ exists }) => {
      setChecking(false);
      if (exists) setProfileDetected(true);
    });
  };

  // AC3: Fetch and substitute the bootstrap prompt template.
  const handleGetPrompt = () => {
    if (!answers.fullName.trim() || !answers.workEmail.trim()) return;
    setPromptLoading(true);
    setPromptError(false);
    void readBootstrapPrompt({
      data: {
        fullName: answers.fullName.trim(),
        workEmail: answers.workEmail.trim(),
      },
    })
      .then(({ content }) => {
        setPromptContent(content);
        setPromptLoading(false);
      })
      .catch(() => {
        setPromptError(true);
        setPromptLoading(false);
      });
  };

  // ── Path choice screen ──
  if (!answers.seedingPath) {
    return (
      <div className="space-y-4">
        <p className="text-base leading-relaxed text-muted-foreground">
          Your profile seeds your assistant with context about who you are and
          how you work. Choose how you want to create it.
        </p>

        {/* Bootstrap with Glean card (AC2: disabled when phase 2 not complete) */}
        <button
          type="button"
          disabled={!phase2Done}
          onClick={() => set("seedingPath", "bootstrap")}
          className={cn(
            "group w-full rounded-xl border p-5 text-left transition",
            phase2Done
              ? "border-primary/40 bg-primary/5 hover:border-primary/70 hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary/40"
              : "cursor-not-allowed border-border bg-muted/30 opacity-60",
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles
                className={cn(
                  "size-5",
                  phase2Done ? "text-primary" : "text-muted-foreground",
                )}
              />
              <span
                className={cn(
                  "text-sm font-semibold",
                  phase2Done ? "text-foreground" : "text-muted-foreground",
                )}
              >
                Bootstrap with Glean
              </span>
            </div>
            {phase2Done && (
              <span className="font-mono text-[10px] uppercase tracking-widest text-primary">
                Recommended
              </span>
            )}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {phase2Done
              ? "Use your enterprise data to generate a rich AI context profile in one step."
              : "Complete assistant wiring in phase 2 first"}
          </p>
        </button>

        {/* Set up manually card (AC5) */}
        <button
          type="button"
          onClick={() => set("seedingPath", "manual")}
          className="group w-full rounded-xl border border-border bg-card p-5 text-left transition hover:border-foreground/30 hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <span className="text-sm font-semibold text-foreground">
            Set up manually
          </span>
          <p className="mt-1 text-sm text-muted-foreground">
            Skip bootstrapping and fill in your profile step-by-step in the next
            phase.
          </p>
        </button>
      </div>
    );
  }

  // ── Manual path (AC5) ──
  if (answers.seedingPath === "manual") {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <Check className="size-5 text-fresh" />
            <span className="text-sm font-semibold text-foreground">
              Manual setup selected
            </span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            You'll fill in your profile step-by-step in the next phase. Click{" "}
            <strong>Next phase</strong> to continue.
          </p>
        </div>
        <button
          type="button"
          onClick={() => set("seedingPath", "")}
          className="text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          ← Change selection
        </button>
      </div>
    );
  }

  // ── Bootstrap path ──

  // Step 1: Collect name + email (AC3)
  if (!promptContent) {
    return (
      <div className="space-y-6">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Your name and work email are substituted into the bootstrap prompt so
          Glean can identify the right person.
        </p>

        <Field label="Your full name">
          <input
            value={answers.fullName}
            onChange={(e) => set("fullName", e.target.value)}
            placeholder="Alex Smith"
            className="w-full rounded-lg border border-border bg-card px-4 py-3 text-base outline-none focus:ring-2 focus:ring-primary/40"
          />
        </Field>

        <Field label="Your work email">
          <input
            type="email"
            value={answers.workEmail}
            onChange={(e) => set("workEmail", e.target.value)}
            placeholder="alex.smith@company.com"
            className="w-full rounded-lg border border-border bg-card px-4 py-3 text-base outline-none focus:ring-2 focus:ring-primary/40"
          />
        </Field>

        {promptError && (
          <p className="text-sm text-destructive">
            Could not load the bootstrap template. Check that
            templates/bootstrap-profile-prompt.md exists.
          </p>
        )}

        <button
          type="button"
          onClick={handleGetPrompt}
          disabled={
            promptLoading ||
            !answers.fullName.trim() ||
            !answers.workEmail.trim()
          }
          className={cn(
            "flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold transition-all",
            promptLoading ||
              !answers.fullName.trim() ||
              !answers.workEmail.trim()
              ? "cursor-not-allowed bg-muted text-muted-foreground opacity-60"
              : "bg-primary text-primary-foreground shadow-[0_0_24px_-6px_var(--primary)] hover:brightness-110",
          )}
        >
          {promptLoading ? "Loading…" : "Get my bootstrap prompt"}
          {!promptLoading && <ArrowRight className="size-4" />}
        </button>

        <button
          type="button"
          onClick={() => set("seedingPath", "")}
          className="text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          ← Change selection
        </button>
      </div>
    );
  }

  // Step 2: Show prompt + waiting area (AC3 + AC4)
  return (
    <div className="space-y-6">
      {/* AC3: Collect & Copy block with handoff kind 'profile-bootstrap' */}
      <BootstrapCopyBlock content={promptContent} />

      {/* AC4: Waiting / refresh area */}
      {profileDetected ? (
        <div className="rounded-xl border border-fresh/40 bg-fresh/5 p-5">
          <div className="flex items-center gap-2">
            <Check className="size-5 text-fresh" />
            <span className="text-sm font-semibold text-foreground">
              Profile detected
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            <code className="font-mono text-xs text-foreground">
              context/profile.md
            </code>{" "}
            is ready. Click <strong>Next phase</strong> to continue.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Waiting for your assistant
          </p>
          <p className="text-sm text-muted-foreground">
            Paste the prompt above into your Glean-connected assistant and wait
            for it to write{" "}
            <code className="font-mono text-xs text-foreground">
              context/profile.md
            </code>
            . Return here once it confirms the file is written.
          </p>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={checking}
            className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline disabled:opacity-50"
          >
            <RefreshCw className={cn("size-4", checking && "animate-spin")} />
            {checking ? "Checking…" : "Refresh now"}
          </button>
          <p className="text-[10px] text-muted-foreground">
            Auto-checking every 5 seconds in the background.
          </p>
        </div>
      )}
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
  const [showDebug, setShowDebug] = useState(false);
  const [copied, setCopied] = useState(false);

  // AC2: exact verification prompt text — hardcoded, not user-editable.
  const verificationPrompt =
    "Confirm you can read my constitution and context/active.md — tell me my #1 priority.";

  const handleCopy = () => {
    void navigator.clipboard.writeText(verificationPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // AC1: Copilot branch checkboxes map to the two explicit setup steps + prompt test.
  const copilotCheckItems: Array<{
    key: keyof Answers["checks"];
    label: string;
  }> = [
    {
      key: "installed",
      label: "I’ve enabled chat.useAgentsMdFile in VS Code Settings",
    },
    {
      key: "contextOpen",
      label: "My workspace folder containing AGENTS.md is open in VS Code",
    },
    {
      key: "testedPaste",
      label: "I’ve sent the verification prompt and my assistant responded",
    },
  ];

  // AC3: Other-assistant checkboxes use assistant-agnostic language.
  const otherCheckItems: Array<{
    key: keyof Answers["checks"];
    label: string;
  }> = [
    {
      key: "installed",
      label: "My assistant is running and can read my workspace files",
    },
    {
      key: "contextOpen",
      label: "My AGENTS.md folder is accessible to my assistant",
    },
    {
      key: "testedPaste",
      label: "I’ve sent the verification prompt and my assistant responded",
    },
  ];

  const checkItems =
    answers.assistant === "copilot" ? copilotCheckItems : otherCheckItems;

  return (
    <div className="space-y-8">
      {/* Assistant type selector */}
      <div className="flex gap-2 rounded-lg border border-border bg-card p-1">
        {(["copilot", "other"] as const).map((k) => (
          <button
            key={k}
            onClick={() => set("assistant", k)}
            className={cn(
              "flex-1 rounded-md px-3 py-2 text-sm font-medium transition",
              answers.assistant === k
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {k === "copilot" ? "GitHub Copilot" : "Other assistant"}
          </button>
        ))}
      </div>

      {/* ── GitHub Copilot branch (AC1) ── */}
      {answers.assistant === "copilot" && (
        <div className="space-y-3">
          {/* Step 1: enable chat.useAgentsMdFile */}
          <div className="space-y-1.5 rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Step 1 of 2
            </p>
            <p className="text-sm">
              Enable the VS Code setting{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
                chat.useAgentsMdFile
              </code>
              . Open VS Code Settings (
              <kbd className="font-mono text-xs">⌘,</kbd> or{" "}
              <kbd className="font-mono text-xs">Ctrl+,</kbd>), search for{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
                chat.useAgentsMdFile
              </code>
              , and enable it.
            </p>
          </div>

          {/* Step 2: workspace folder open */}
          <div className="space-y-1.5 rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Step 2 of 2
            </p>
            <p className="text-sm">
              Confirm the workspace folder containing{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
                AGENTS.md
              </code>{" "}
              is open in VS Code. Use <strong>File &rarr; Open Folder</strong>{" "}
              to open your Personal OS folder if it is not already.
            </p>
          </div>
        </div>
      )}

      {/* ── Other assistant branch (AC3) ── */}
      {answers.assistant === "other" && (
        <div className="space-y-3">
          {/* (a) As-is setup assumes GitHub Copilot in VS Code native chat */}
          <div className="rounded-lg border border-border bg-muted/40 px-4 py-3">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">Note:</span> The
              as-is setup assumes GitHub Copilot in VS Code native chat &mdash;
              the steps and setting names below reflect that configuration.
            </p>
          </div>

          {/* (b) CLAUDE.md is a thin shim pointing Claude-flavoured tools at AGENTS.md */}
          <div className="space-y-1.5 rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Claude and Claude Code
            </p>
            <p className="text-sm text-muted-foreground">
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
                CLAUDE.md
              </code>{" "}
              is a thin shim that points Claude-flavoured tools at{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
                AGENTS.md
              </code>{" "}
              &mdash; all the real constitution content lives in{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
                AGENTS.md
              </code>
              .
            </p>
          </div>

          {/* (c) Generic guidance for adapting to a different assistant */}
          <div className="space-y-1.5 rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Adapting to your assistant
            </p>
            <p className="text-sm text-muted-foreground">
              Point your assistant at{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
                AGENTS.md
              </code>{" "}
              as its always-loaded instruction file &mdash; via a setting, an
              import directive, or by pasting its contents directly. The
              verification prompt below will confirm it loaded.
            </p>
          </div>
        </div>
      )}

      {/* Confirmation checkboxes — same three keys for both branches */}
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

      {/* Verification prompt (AC2) — copyable block */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Verification prompt
        </p>
        <button
          type="button"
          onClick={handleCopy}
          title="Click to copy to clipboard"
          className="group w-full rounded-xl border border-border bg-card p-4 text-left transition hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <p className="font-mono text-sm text-foreground">
            {verificationPrompt}
          </p>
          <p className="mt-2 text-[10px] font-medium text-muted-foreground transition group-hover:text-primary">
            {copied ? "Copied to clipboard ✓" : "Click to copy"}
          </p>
        </button>
        <p className="text-xs text-muted-foreground">
          Paste this into your assistant. If it tells you your #1 priority,
          you&apos;re wired up.
        </p>
      </div>

      {/* That didn't work — expandable debug panel (AC4) */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <button
          type="button"
          onClick={() => setShowDebug((v) => !v)}
          aria-expanded={showDebug}
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <span>That didn&apos;t work</span>
          <span className="font-mono text-xs">{showDebug ? "▲" : "▼"}</span>
        </button>
        {showDebug && (
          <div className="space-y-3 border-t border-border px-4 pb-4 pt-3">
            {/* Source: skills/os-helper/SKILL.md Mode 1 Troubleshooting note */}
            <p className="text-sm text-muted-foreground">
              Ask your assistant:{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
                What are your standing orders?
              </code>
            </p>
            <p className="text-sm text-muted-foreground">
              If it cannot describe the constitution,{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
                @AGENTS.md
              </code>{" "}
              did not load.
            </p>
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">Fallback:</span>{" "}
              open{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
                AGENTS.md
              </code>{" "}
              and paste its contents directly into chat.
            </p>
          </div>
        )}
      </div>
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
