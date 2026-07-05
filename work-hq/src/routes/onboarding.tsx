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
import { checkContextFiles } from "@/server/check-context-files";
import { scaffoldFiles } from "@/server/scaffold-files";
import { readBootstrapPrompt } from "@/server/read-bootstrap-prompt";
import { readProfile } from "@/server/read-profile";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Onboarding · Work HQ" }] }),
  // Load persisted state from disk before rendering.  Returns null on a fresh
  // session (file does not exist yet).
  loader: async () => loadOnboarding(),
  component: OnboardingPage,
});

/** A single priority entry — story 003 AC4. */
type Priority = { title: string; owner: string; dueDate: string };

type Answers = {
  role: string;
  workstyle: string;
  /** Free-text describing immediate team and headcount (story 003 AC1). */
  team: string;
  /** AI assistant + enterprise tools (story 003 AC1). */
  keyTools: string[];
  stakeholders: string[];
  glossary: string;
  /** Three structured priorities, each with title / owner / dueDate (story 003 AC4). */
  priorities: [Priority, Priority, Priority];
  blockers: string;
  /** Optional open-questions field (story 003 AC5). */
  openQuestions: string;
  assistant: "copilot" | "other";
  otherAssistant: string;
  checks: { installed: boolean; contextOpen: boolean; testedPaste: boolean };
  /** AC1/AC5: 'bootstrap' | 'manual' | '' — empty means no path chosen yet */
  seedingPath: "bootstrap" | "manual" | "";
  /** AC3: full name collected before generating the bootstrap prompt */
  fullName: string;
  /** AC3: work email collected before generating the bootstrap prompt */
  workEmail: string;
  /**
   * AC3 (story 010): edited section bodies and flags from the Review & correct
   * phase.  Keys are section headings from context/profile.md; values hold the
   * current body text (possibly user-edited) and an `edited` flag.
   * Persisted in onboarding-state.json so edits survive a page refresh.
   */
  editedSections: Record<string, { body: string; edited: boolean }>;
};

const emptyAnswers: Answers = {
  role: "",
  workstyle: "",
  team: "",
  keyTools: [""],
  stakeholders: [""],
  glossary: "",
  priorities: [
    { title: "", owner: "", dueDate: "" },
    { title: "", owner: "", dueDate: "" },
    { title: "", owner: "", dueDate: "" },
  ],
  blockers: "",
  openQuestions: "",
  assistant: "copilot",
  otherAssistant: "",
  checks: { installed: false, contextOpen: false, testedPaste: false },
  seedingPath: "",
  fullName: "",
  workEmail: "",
  editedSections: {},
};

/**
 * Normalise a raw answers blob loaded from disk or localStorage.
 * Migrates the old flat-string priorities format
 * (i.e. priorities: [string, string, string]) to the structured object format
 * introduced in story 003.
 */
function normalizeAnswers(raw: unknown): Answers {
  if (!raw || typeof raw !== "object") return emptyAnswers;
  const a = raw as Record<string, unknown>;

  const rawPriorities = a.priorities as unknown[] | undefined;
  let priorities: [Priority, Priority, Priority] = [
    { title: "", owner: "", dueDate: "" },
    { title: "", owner: "", dueDate: "" },
    { title: "", owner: "", dueDate: "" },
  ];
  if (Array.isArray(rawPriorities) && rawPriorities.length === 3) {
    const migrated = rawPriorities.map((p) =>
      typeof p === "string"
        ? { title: p, owner: "", dueDate: "" }
        : (p as Priority),
    );
    priorities = migrated as [Priority, Priority, Priority];
  }

  // Normalise editedSections: default to {} if missing or malformed.
  const rawEditedSections = a.editedSections;
  const editedSections: Answers["editedSections"] =
    rawEditedSections &&
    typeof rawEditedSections === "object" &&
    !Array.isArray(rawEditedSections)
      ? (rawEditedSections as Answers["editedSections"])
      : {};

  return {
    ...emptyAnswers,
    ...(raw as Partial<Answers>),
    priorities,
    editedSections,
  };
}

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
    if (savedState) return normalizeAnswers(savedState.answers);
    try {
      const raw =
        typeof window !== "undefined"
          ? window.localStorage.getItem(LS_ANSWERS)
          : null;
      if (raw != null) return normalizeAnswers(JSON.parse(raw));
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

  /**
   * Immediately flush current state to disk, cancelling any pending debounce.
   * Called by phase review Confirm actions to guarantee persistence before
   * the phase advances.
   */
  const saveNow = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    void saveOnboarding({
      data: {
        phase,
        answers,
        completedPhases,
        updatedAt: new Date().toISOString(),
      },
    });
  };

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

  // Phase 4 (both paths) and phase 5 manage their own Confirm action that
  // saves + advances — the global Next button is hidden for those cases so
  // the Confirm action is the only way to advance.
  // Bootstrap path: internal "Confirm all" / "Looks good" in PhaseReviewCorrect.
  // Manual path: internal "Confirm" in PhaseFourManual.
  // Waiting state (bootstrap, profile not yet written): a "Continue" link in
  // PhaseReviewCorrect acts as the escape hatch.
  const hideNextButton = phase === 4 || phase === 5;

  // Count edited sections for the dynamic phase 4 bootstrap heading (AC3).
  const editedCount = Object.values(answers.editedSections).filter(
    (s) => s.edited,
  ).length;

  // Dynamic subtitle for phase 4 bootstrap path — shows edited-section count.
  const phaseSubtitle =
    phase === 4 && answers.seedingPath === "bootstrap"
      ? editedCount > 0
        ? `Review your profile · ${editedCount} section${editedCount === 1 ? "" : "s"} edited`
        : "Review your profile"
      : phases[phase - 1].subtitle;

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
          {phaseSubtitle}
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
          {phase === 4 && (
            <PhaseFour
              answers={answers}
              set={set}
              next={next}
              saveNow={saveNow}
            />
          )}
          {phase === 5 && (
            <PhaseNow
              answers={answers}
              set={set}
              next={next}
              saveNow={saveNow}
            />
          )}
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
          {phase === 6 ? (
            <Link
              to="/today"
              className="flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground hover:brightness-110"
            >
              Enter Work HQ <ArrowRight className="size-4" />
            </Link>
          ) : !hideNextButton ? (
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
          ) : null}
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
 * Build the profile-corrections handoff block markdown (§4.3 file-contracts.md).
 *
 * - Only sections with `edited: true` are included in the body.
 * - When no sections were edited, the body states "No corrections — all sections
 *   accepted as is" as required by story 011 AC2.
 * - The Ask always appears, covering: apply corrections → first-person conversion
 *   → distil me/org/active (sensitivity gate per AGENTS.md §Sensitivity check).
 */
function buildProfileCorrectionsMarkdown(
  editedSections: Answers["editedSections"],
  fullName: string,
): string {
  const today = new Date().toISOString().slice(0, 10);
  // The kind string "profile-corrections" must appear in this file for AC verification.
  const header = `## Work HQ handoff · profile-corrections · ${today}`;

  const editedEntries = Object.entries(editedSections).filter(
    ([, v]) => v.edited,
  );

  const nameRef = fullName.trim() ? ` for ${fullName.trim()}` : "";

  // The sensitivity gate phrase must match AGENTS.md §Sensitivity check exactly.
  const askText =
    `Apply the corrections above to context/profile.md (write the file, confirm when done). ` +
    `Then run the first-person conversion: rewrite the corrected profile as a polished ` +
    `first-person assistant context document${nameRef} — preserve all strong evidence, ` +
    `keep uncertain items marked as "Needs my confirmation", rewrite in a professional ` +
    `self-description tone, keep the structure assistant-friendly, and add a final section ` +
    `called "What I want my AI assistant to optimize for". Save the converted profile back ` +
    `to context/profile.md. Then distil context/me.md, context/org.md (sensitivity gate: ` +
    `no personnel data, unreleased roadmap items, or commercial terms in the committed ` +
    `org.md), and context/active.md seeds from the updated profile. Confirm each file is written.`;

  const body =
    editedEntries.length === 0
      ? `No corrections — all sections accepted as is\n\n**Ask**\n${askText}`
      : editedEntries
          .map(
            ([heading, { body: sectionBody }]) =>
              `**${heading}**\n${sectionBody.trim()}`,
          )
          .join("\n\n") + `\n\n**Ask**\n${askText}`;

  return `${header}\n\n${body}\n`;
}

/**
 * Collect & Copy block for the profile-corrections handoff (story 011 AC1/AC2).
 * Visually matches HandoffDock; markdown is built via buildProfileCorrectionsMarkdown.
 */
function ProfileCorrectionsDock({
  editedSections,
  editedCount,
  fullName,
}: {
  editedSections: Answers["editedSections"];
  editedCount: number;
  fullName: string;
}) {
  const [copied, setCopied] = useState(false);
  const markdown = buildProfileCorrectionsMarkdown(editedSections, fullName);

  const onCopy = () => {
    void navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="rounded-2xl border border-primary/25 bg-primary/5 p-5 shadow-[0_0_40px_-20px_var(--primary)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 className="text-sm font-semibold text-foreground">
            Profile corrections handoff
          </h4>
          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
            profile-corrections ·{" "}
            {editedCount === 0
              ? "no edits"
              : `${editedCount} section${editedCount === 1 ? "" : "s"} edited`}{" "}
            · ~{markdown.length.toLocaleString()} chars
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
        <code className="text-primary">{markdown.split("\n")[0]}</code>
        {"\n"}
        {markdown.split("\n").slice(1).join("\n")}
      </pre>

      <p className="mt-3 text-center text-[10px] text-muted-foreground">
        {copied ? "✓ On your clipboard. " : ""}
        Paste into your AI assistant to apply corrections and lock in your
        context files.
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

/* ----- PhaseFour (phase 4) — story 003 ----- */

/**
 * PhaseFour — phase 4 of the onboarding wizard (story 003 + story 010).
 *
 * Manual path (seedingPath === 'manual'):
 *   About-you form → sensitivity check → Your-org form → review summary.
 *   Internal Confirm action saves + advances to phase 5.
 *   The global Next button is hidden for this path (see OnboardingPage).
 *
 * Bootstrap path (seedingPath === 'bootstrap'):
 *   PhaseReviewCorrect — reads context/profile.md, renders editable section
 *   cards, persists edits to onboarding-state.json.  Internal Confirm action
 *   saves + advances.  Global Next button is hidden (see OnboardingPage).
 */
function PhaseFour({
  answers,
  set,
  next,
  saveNow,
}: {
  answers: Answers;
  set: <K extends keyof Answers>(k: K, v: Answers[K]) => void;
  next: () => void;
  saveNow: () => void;
}) {
  if (answers.seedingPath === "bootstrap") {
    return (
      <PhaseReviewCorrect
        answers={answers}
        set={set}
        next={next}
        saveNow={saveNow}
      />
    );
  }

  // Manual path — multi-step interview form.
  return (
    <PhaseFourManual
      answers={answers}
      set={set}
      next={next}
      saveNow={saveNow}
    />
  );
}

/* ----- Profile parser — story 010 ----- */

/** Parsed section from context/profile.md (## heading boundaries). */
interface ProfileSection {
  heading: string;
  body: string;
}

/**
 * Detect the status label from a section body.
 * Returns the first of "Confirmed", "Derived", or "Unknown" found in `body`,
 * defaulting to "Unknown" when none is present (AC2).
 */
function detectStatus(body: string): "Confirmed" | "Derived" | "Unknown" {
  type StatusLabel = "Confirmed" | "Derived" | "Unknown";
  const candidates = (
    [
      { status: "Confirmed" as StatusLabel, pos: body.indexOf("Confirmed") },
      { status: "Derived" as StatusLabel, pos: body.indexOf("Derived") },
      { status: "Unknown" as StatusLabel, pos: body.indexOf("Unknown") },
    ] satisfies Array<{ status: StatusLabel; pos: number }>
  ).filter(({ pos }) => pos !== -1);

  if (candidates.length === 0) return "Unknown";
  candidates.sort((a, b) => a.pos - b.pos);
  return candidates[0].status;
}

/**
 * Parse a profile.md string into sections on `## ` heading boundaries (AC2).
 * The content before the first `## ` heading (title line, preamble) is skipped.
 */
function parseProfileSections(content: string): ProfileSection[] {
  const parts = content.split(/^## /m);
  return parts
    .slice(1) // drop preamble before first ##
    .map((part) => {
      const newlineIdx = part.indexOf("\n");
      const heading =
        newlineIdx === -1 ? part.trim() : part.slice(0, newlineIdx).trim();
      const body =
        newlineIdx === -1 ? "" : part.slice(newlineIdx + 1).trimEnd();
      return { heading, body };
    })
    .filter((s) => s.heading.length > 0);
}

/* ----- StatusChip ----- */

function StatusChip({
  status,
}: {
  status: "Confirmed" | "Derived" | "Unknown";
}) {
  const styles: Record<"Confirmed" | "Derived" | "Unknown", string> = {
    Confirmed: "border-fresh/40 bg-fresh/10 text-fresh",
    Derived: "border-warning/40 bg-warning/10 text-warning",
    Unknown: "border-border bg-muted text-muted-foreground",
  };
  return (
    <span
      className={cn(
        "rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest",
        styles[status],
      )}
    >
      {status}
    </span>
  );
}

/* ----- SectionCard ----- */

/**
 * Editable card for a single ## section from context/profile.md.
 * Shows the section heading, current body in a textarea, and a live status
 * chip (re-detected from the current body text).  Displays an "Edited" badge
 * when `isEdited` is true (AC2, AC3).
 */
function SectionCard({
  heading,
  body,
  isEdited,
  onChange,
}: {
  heading: string;
  body: string;
  isEdited: boolean;
  onChange: (body: string) => void;
}) {
  const status = detectStatus(body);

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4 space-y-3 transition",
        isEdited ? "border-primary/50" : "border-border",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground leading-snug">
          {heading}
        </h3>
        <div className="flex shrink-0 items-center gap-2">
          {isEdited && (
            <span className="rounded border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-primary">
              Edited
            </span>
          )}
          <StatusChip status={status} />
        </div>
      </div>
      <textarea
        value={body}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        className="w-full resize-y rounded-lg border border-border bg-background px-4 py-3 font-mono text-xs leading-relaxed text-foreground outline-none focus:ring-2 focus:ring-primary/40"
      />
    </div>
  );
}

/* ----- PhaseReviewCorrect (phase 4, bootstrap path) — story 010 ----- */

/**
 * PhaseReviewCorrect — phase 4 of the onboarding wizard, bootstrap path
 * (story 010).
 *
 * Waiting state: context/profile.md not found → shows instruction text,
 *   a Refresh button (AC1), and a subtle Continue link as an escape hatch.
 *   Auto-polls every 5 s via check-profile-exists (reused from story 009).
 *
 * Review state: profile parsed → renders one SectionCard per ## section (AC2).
 *   Editing a card updates answers.editedSections and marks it as edited (AC3).
 *   "Confirm all" / "Looks good" button saves + advances to phase 5 (AC4).
 */
function PhaseReviewCorrect({
  answers,
  set,
  next,
  saveNow,
}: {
  answers: Answers;
  set: <K extends keyof Answers>(k: K, v: Answers[K]) => void;
  next: () => void;
  saveNow: () => void;
}) {
  const [profileContent, setProfileContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  // Load profile.md on mount (AC2: read at request time, not import.meta.glob).
  useEffect(() => {
    void readProfile().then(({ content }) => {
      setProfileContent(content);
      setLoading(false);
    });
  }, []);

  // AC1: Auto-poll every 5 s while waiting for the file to appear.
  useEffect(() => {
    if (loading || profileContent !== null) return;
    const id = setInterval(() => {
      void checkProfileExists().then(({ exists }) => {
        if (exists) {
          void readProfile().then(({ content }) => {
            setProfileContent(content);
          });
        }
      });
    }, 5000);
    return () => clearInterval(id);
  }, [loading, profileContent]);

  const handleRefresh = () => {
    setChecking(true);
    void readProfile().then(({ content }) => {
      setChecking(false);
      setProfileContent(content);
    });
  };

  // While awaiting initial server read, show nothing (avoids flicker).
  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">Loading profile…</p>
      </div>
    );
  }

  // AC1: Waiting state — profile.md does not exist yet.
  if (profileContent === null) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Waiting for your assistant
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            After your assistant writes{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
              context/profile.md
            </code>
            , click Refresh or wait — this page detects the file automatically.
          </p>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={checking}
            className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline disabled:opacity-50"
          >
            <RefreshCw className={cn("size-4", checking && "animate-spin")} />
            {checking ? "Checking…" : "Refresh"}
          </button>
          <p className="text-[10px] text-muted-foreground">
            Auto-checking every 5 seconds in the background.
          </p>
        </div>

        {/* Escape hatch: advance without reviewing if user wants to skip. */}
        <button
          type="button"
          onClick={() => {
            saveNow();
            next();
          }}
          className="text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          Continue without reviewing →
        </button>
      </div>
    );
  }

  // AC2: Review state — parse profile.md and render editable section cards.
  const sections = parseProfileSections(profileContent);

  // Count sections the user has edited for the Confirm button label (AC4).
  const editedCount = Object.values(answers.editedSections).filter(
    (s) => s.edited,
  ).length;

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Review each section your assistant wrote. Edit any section to correct
        errors — edited sections are highlighted and saved automatically.
      </p>

      {sections.map((section) => {
        const saved = answers.editedSections[section.heading];
        // AC3: show saved body if edited; otherwise show original parsed body.
        const currentBody = saved !== undefined ? saved.body : section.body;
        const isEdited = saved?.edited ?? false;

        return (
          <SectionCard
            key={section.heading}
            heading={section.heading}
            body={currentBody}
            isEdited={isEdited}
            onChange={(newBody) => {
              // AC3: mark as edited only when the text differs from original.
              const isNowEdited = newBody !== section.body;
              set("editedSections", {
                ...answers.editedSections,
                [section.heading]: { body: newBody, edited: isNowEdited },
              });
            }}
          />
        );
      })}

      {/* story 011 AC1/AC2: Collect & Copy block for the profile-corrections handoff. */}
      <ProfileCorrectionsDock
        editedSections={answers.editedSections}
        editedCount={editedCount}
        fullName={answers.fullName}
      />

      {/* AC4: internal Confirm action — no global Next button for phase 4. */}
      <div className="flex items-center gap-4 pt-2">
        <button
          type="button"
          onClick={() => {
            saveNow();
            next();
          }}
          className="flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-[0_0_24px_-6px_var(--primary)] hover:brightness-110"
        >
          {editedCount === 0 ? "Looks good" : "Confirm all"}{" "}
          <ArrowRight className="size-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * Internal sub-step manager for the manual path of phase 4.
 * Steps: 'about' → 'org' (with sensitivity gate) → 'review'.
 */
function PhaseFourManual({
  answers,
  set,
  next,
  saveNow,
}: {
  answers: Answers;
  set: <K extends keyof Answers>(k: K, v: Answers[K]) => void;
  next: () => void;
  saveNow: () => void;
}) {
  const [step, setStep] = useState<"about" | "org" | "review">("about");
  // Tracks whether the user has accepted the sensitivity-check gate for the
  // org sub-step.  Resets if the component unmounts (phase navigation away).
  const [orgAgreed, setOrgAgreed] = useState(false);

  // AC4: Check for existing non-placeholder me.md / org.md on phase mount.
  // Results are available by the time the user reaches the review sub-step.
  const [existingFiles, setExistingFiles] = useState<{
    me: boolean;
    org: boolean;
  } | null>(null);
  const [overwriteMe, setOverwriteMe] = useState(false);
  const [overwriteOrg, setOverwriteOrg] = useState(false);
  const [scaffolding, setScaffolding] = useState(false);

  useEffect(() => {
    void checkContextFiles().then((result) => {
      setExistingFiles({ me: result.me, org: result.org });
    });
  }, []);

  /* ── About-you step ── */
  if (step === "about") {
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

        <Field label="Working style in one line">
          <input
            value={answers.workstyle}
            onChange={(e) => set("workstyle", e.target.value)}
            placeholder="Async-first, deep-work mornings, batched afternoons"
            className="w-full rounded-lg border border-border bg-card px-4 py-3 text-base outline-none focus:ring-2 focus:ring-primary/40"
          />
        </Field>

        <Field label="Your immediate team">
          <textarea
            rows={2}
            value={answers.team}
            onChange={(e) => set("team", e.target.value)}
            placeholder="e.g. 4-person ProdOps team — 2 PMs, 1 analyst, 1 coordinator"
            className="w-full rounded-lg border border-border bg-card px-4 py-3 text-base outline-none focus:ring-2 focus:ring-primary/40"
          />
        </Field>

        <Field label="Key tools">
          <div className="space-y-2">
            {answers.keyTools.map((t, i) => (
              <input
                key={i}
                value={t}
                onChange={(e) => {
                  const updated = [...answers.keyTools];
                  updated[i] = e.target.value;
                  set("keyTools", updated);
                }}
                placeholder={
                  i === 0
                    ? "AI assistant — e.g. GitHub Copilot"
                    : "Tool — e.g. Jira, Confluence, Slack"
                }
                className="w-full rounded-lg border border-border bg-card px-4 py-3 text-base outline-none focus:ring-2 focus:ring-primary/40"
              />
            ))}
            <button
              type="button"
              onClick={() => set("keyTools", [...answers.keyTools, ""])}
              className="text-xs font-medium text-primary hover:underline"
            >
              + Add tool
            </button>
          </div>
        </Field>

        <button
          type="button"
          onClick={() => setStep("org")}
          className="flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-[0_0_24px_-6px_var(--primary)] hover:brightness-110"
        >
          Continue <ArrowRight className="size-4" />
        </button>
      </div>
    );
  }

  /* ── Org step (sensitivity gate → org form) ── */
  if (step === "org") {
    // Sensitivity-check confirmation panel (AC2).
    // The exact phrase from AGENTS.md §Sensitivity check standing order must
    // appear here: "no personnel data, unreleased roadmap items, or commercial terms".
    if (!orgAgreed) {
      return (
        <div className="space-y-6">
          <div className="rounded-xl border border-warning/30 bg-warning/5 p-6 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Before you continue
            </p>
            <p className="text-sm leading-relaxed text-foreground/90">
              Your Personal OS lives as plaintext markdown that may sync to
              GitHub. Please confirm the stakeholder and glossary information
              you enter contains{" "}
              <strong>
                no personnel data, unreleased roadmap items, or commercial terms
              </strong>
              . Reference sensitive individuals by role or alias rather than by
              name or salary.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setOrgAgreed(true)}
                className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-[0_0_24px_-6px_var(--primary)] hover:brightness-110"
              >
                Understood — continue
              </button>
              <button
                type="button"
                onClick={() => setStep("about")}
                className="rounded-full border border-border px-5 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Org form shown after sensitivity confirmation (AC2).
    return (
      <div className="space-y-6">
        <Field label="Key stakeholders">
          <div className="space-y-2">
            {answers.stakeholders.map((s, i) => (
              <input
                key={i}
                value={s}
                onChange={(e) => {
                  const updated = [...answers.stakeholders];
                  updated[i] = e.target.value;
                  set("stakeholders", updated);
                }}
                placeholder="Sarah Chen (CTO) — decision maker"
                className="w-full rounded-lg border border-border bg-card px-4 py-3 text-base outline-none focus:ring-2 focus:ring-primary/40"
              />
            ))}
            <button
              type="button"
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
            placeholder={"TP = Team Platform\nAtlas = the new billing system"}
            className="w-full rounded-lg border border-border bg-card px-4 py-3 text-base outline-none focus:ring-2 focus:ring-primary/40 font-mono"
          />
        </Field>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setStep("review")}
            className="flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-[0_0_24px_-6px_var(--primary)] hover:brightness-110"
          >
            Review answers <ArrowRight className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setStep("about")}
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            ← Back to About you
          </button>
        </div>
      </div>
    );
  }

  /* ── Review step (AC3 + AC4) ── */
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Review your answers. Click <strong>Confirm</strong> to write your OS
        files and move to phase 5.
      </p>

      {/* AC4: per-file "already exists" notices with explicit Overwrite confirmation. */}
      {existingFiles?.me && (
        <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            context/me.md already exists
          </p>
          <p className="text-sm text-foreground/90">
            Your <code className="font-mono text-xs">context/me.md</code>{" "}
            already contains real content. Check the box below to overwrite it
            with your answers above.
          </p>
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={overwriteMe}
              onChange={(e) => setOverwriteMe(e.target.checked)}
              className="size-4 accent-primary"
            />
            <span className="text-sm">Overwrite context/me.md</span>
          </label>
        </div>
      )}
      {existingFiles?.org && (
        <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            context/org.md already exists
          </p>
          <p className="text-sm text-foreground/90">
            Your <code className="font-mono text-xs">context/org.md</code>{" "}
            already contains real content. Check the box below to overwrite it
            with your answers above.
          </p>
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={overwriteOrg}
              onChange={(e) => setOverwriteOrg(e.target.checked)}
              className="size-4 accent-primary"
            />
            <span className="text-sm">Overwrite context/org.md</span>
          </label>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
        <ReviewRow label="Role" value={answers.role || "—"} />
        <ReviewRow label="Working style" value={answers.workstyle || "—"} />
        <ReviewRow label="Team" value={answers.team || "—"} />
        <ReviewRow
          label="Key tools"
          value={answers.keyTools.filter(Boolean).join(", ") || "—"}
        />
        <ReviewRow
          label="Stakeholders"
          value={answers.stakeholders.filter(Boolean).join("\n") || "—"}
        />
        <ReviewRow label="Glossary" value={answers.glossary || "—"} />
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          disabled={scaffolding}
          onClick={async () => {
            if (scaffolding) return;
            setScaffolding(true);
            try {
              // AC1 + AC2: write context/me.md and context/org.md.
              // scaffold-files skips both if context/profile.md exists (AC6).
              await scaffoldFiles({
                data: {
                  target: "me-org",
                  answers: {
                    role: answers.role,
                    workstyle: answers.workstyle,
                    team: answers.team,
                    keyTools: answers.keyTools,
                    stakeholders: answers.stakeholders,
                    glossary: answers.glossary,
                    priorities: answers.priorities,
                    blockers: answers.blockers,
                    openQuestions: answers.openQuestions,
                  },
                  // Invariant: orgAgreed is true at the review step — the
                  // user must accept the sensitivity gate before the org form
                  // is shown, and the org form must be submitted before review.
                  orgAgreed: true,
                  overwriteMe,
                  overwriteOrg,
                  overwriteActive: false,
                },
              });
            } catch {
              // Write error — still advance; user can manually edit the files.
            } finally {
              setScaffolding(false);
            }
            saveNow();
            next();
          }}
          className={cn(
            "flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground",
            scaffolding
              ? "cursor-not-allowed opacity-70"
              : "shadow-[0_0_24px_-6px_var(--primary)] hover:brightness-110",
          )}
        >
          {scaffolding ? "Writing files…" : "Confirm"}{" "}
          <ArrowRight className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => setStep("org")}
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          ← Go back
        </button>
      </div>
    </div>
  );
}

/* ----- PhaseNow (phase 5) — story 003 ----- */

/**
 * PhaseNow — phase 5 of the onboarding wizard (story 003).
 *
 * Captures three structured priorities (title / owner / dueDate), a blockers
 * field, and an optional open-questions field.  Ends with a review summary
 * card; Confirm saves + advances to phase 6.
 * The global Next button is hidden for this phase (see OnboardingPage).
 */
function PhaseNow({
  answers,
  set,
  next,
  saveNow,
}: {
  answers: Answers;
  set: <K extends keyof Answers>(k: K, v: Answers[K]) => void;
  next: () => void;
  saveNow: () => void;
}) {
  const [step, setStep] = useState<"form" | "review">("form");

  // AC4: Check for existing non-placeholder active.md on phase mount.
  const [activeExists, setActiveExists] = useState<boolean | null>(null);
  const [overwriteActive, setOverwriteActive] = useState(false);
  const [scaffolding, setScaffolding] = useState(false);

  useEffect(() => {
    void checkContextFiles().then((result) => {
      setActiveExists(result.active);
    });
  }, []);

  const exampleTitles = [
    "Launch product discovery sprint",
    "Reduce stakeholder report time",
    "Align on Q3 OKRs",
  ];

  /* ── Form step ── */
  if (step === "form") {
    return (
      <div className="space-y-8">
        <div className="space-y-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Your top 3 priorities right now
          </p>
          {answers.priorities.map((p, i) => (
            <div
              key={i}
              className="rounded-xl border border-border bg-card p-4 space-y-3"
            >
              <p className="text-xs font-semibold text-muted-foreground">
                Priority {i + 1}
              </p>
              <Field label="Title">
                <input
                  value={p.title}
                  onChange={(e) => {
                    const updated = [
                      ...answers.priorities,
                    ] as typeof answers.priorities;
                    updated[i] = { ...updated[i], title: e.target.value };
                    set("priorities", updated);
                  }}
                  placeholder={`e.g. ${exampleTitles[i]}`}
                  className="w-full rounded-lg border border-border bg-background px-4 py-3 text-base outline-none focus:ring-2 focus:ring-primary/40"
                />
              </Field>
              <Field label="Owner (named person or role)">
                <input
                  value={p.owner}
                  onChange={(e) => {
                    const updated = [
                      ...answers.priorities,
                    ] as typeof answers.priorities;
                    updated[i] = { ...updated[i], owner: e.target.value };
                    set("priorities", updated);
                  }}
                  placeholder="e.g. Alex Smith or Product team"
                  className="w-full rounded-lg border border-border bg-background px-4 py-3 text-base outline-none focus:ring-2 focus:ring-primary/40"
                />
              </Field>
              <Field label="Due date">
                <input
                  type="date"
                  value={p.dueDate}
                  onChange={(e) => {
                    const updated = [
                      ...answers.priorities,
                    ] as typeof answers.priorities;
                    updated[i] = { ...updated[i], dueDate: e.target.value };
                    set("priorities", updated);
                  }}
                  className="w-full rounded-lg border border-border bg-background px-4 py-3 text-base outline-none focus:ring-2 focus:ring-primary/40"
                />
              </Field>
            </div>
          ))}
        </div>

        <Field label="Anything blocking you right now?">
          <textarea
            rows={3}
            value={answers.blockers}
            onChange={(e) => set("blockers", e.target.value)}
            placeholder="e.g. Waiting on legal sign-off for the vendor contract"
            className="w-full rounded-lg border border-border bg-card px-4 py-3 text-base outline-none focus:ring-2 focus:ring-primary/40"
          />
        </Field>

        <Field label="Open questions (optional)">
          <textarea
            rows={2}
            value={answers.openQuestions}
            onChange={(e) => set("openQuestions", e.target.value)}
            placeholder="e.g. Should we move the retrospective to Thursday?"
            className="w-full rounded-lg border border-border bg-card px-4 py-3 text-base outline-none focus:ring-2 focus:ring-primary/40"
          />
        </Field>

        <button
          type="button"
          onClick={() => setStep("review")}
          className="flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-[0_0_24px_-6px_var(--primary)] hover:brightness-110"
        >
          Review answers <ArrowRight className="size-4" />
        </button>
      </div>
    );
  }

  /* ── Review step (AC3 + AC4) ── */
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Review your priorities. Click <strong>Confirm</strong> to write your
        active context and move to phase 6.
      </p>

      {/* AC4: "file already exists" notice for context/active.md. */}
      {activeExists && (
        <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            context/active.md already exists
          </p>
          <p className="text-sm text-foreground/90">
            Your <code className="font-mono text-xs">context/active.md</code>{" "}
            already contains real content. Check the box below to overwrite it
            with your priorities above.
          </p>
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={overwriteActive}
              onChange={(e) => setOverwriteActive(e.target.checked)}
              className="size-4 accent-primary"
            />
            <span className="text-sm">Overwrite context/active.md</span>
          </label>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
        {answers.priorities.map((p, i) => (
          <div key={i} className="p-4 space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Priority {i + 1}
            </p>
            <p className="text-sm text-foreground">{p.title || "—"}</p>
            <p className="text-xs text-muted-foreground">
              Owner: {p.owner || "—"} · Due: {p.dueDate || "—"}
            </p>
          </div>
        ))}
        <ReviewRow label="Blockers" value={answers.blockers || "—"} />
        {answers.openQuestions && (
          <ReviewRow label="Open questions" value={answers.openQuestions} />
        )}
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          disabled={scaffolding}
          onClick={async () => {
            if (scaffolding) return;
            setScaffolding(true);
            try {
              // AC3: write context/active.md for both bootstrap and manual paths.
              await scaffoldFiles({
                data: {
                  target: "active",
                  answers: {
                    role: answers.role,
                    workstyle: answers.workstyle,
                    team: answers.team,
                    keyTools: answers.keyTools,
                    stakeholders: answers.stakeholders,
                    glossary: answers.glossary,
                    priorities: answers.priorities,
                    blockers: answers.blockers,
                    openQuestions: answers.openQuestions,
                  },
                  orgAgreed: false,
                  overwriteMe: false,
                  overwriteOrg: false,
                  overwriteActive,
                },
              });
            } catch {
              // Write error — still advance; user can manually edit the file.
            } finally {
              setScaffolding(false);
            }
            saveNow();
            next();
          }}
          className={cn(
            "flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground",
            scaffolding
              ? "cursor-not-allowed opacity-70"
              : "shadow-[0_0_24px_-6px_var(--primary)] hover:brightness-110",
          )}
        >
          {scaffolding ? "Writing files…" : "Confirm"}{" "}
          <ArrowRight className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => setStep("form")}
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          ← Go back
        </button>
      </div>
    </div>
  );
}

/* ----- Shared helpers ----- */

/** Labelled row for review summary cards. */
function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4 p-4">
      <span className="w-28 shrink-0 pt-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-sm text-foreground whitespace-pre-wrap">
        {value}
      </span>
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
      label: "I've enabled chat.useAgentsMdFile in VS Code Settings",
    },
    {
      key: "contextOpen",
      label: "My workspace folder containing AGENTS.md is open in VS Code",
    },
    {
      key: "testedPaste",
      label: "I've sent the verification prompt and my assistant responded",
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
      label: "I've sent the verification prompt and my assistant responded",
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
  // Format each priority as a single readable line for the handoff.
  const priorityLines = answers.priorities.map(
    (p, i) =>
      `${i + 1}. ${p.title || "(untitled)"}${p.owner ? ` — ${p.owner}` : ""}${p.dueDate ? ` by ${p.dueDate}` : ""}`,
  );

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
            { label: "Team", body: answers.team },
            { label: "Key tools", body: answers.keyTools.filter(Boolean) },
            { label: "Stakeholders", body: answers.stakeholders },
            { label: "Glossary", body: answers.glossary },
            { label: "Top 3 priorities", body: priorityLines },
            { label: "Blockers", body: answers.blockers },
            ...(answers.openQuestions
              ? [{ label: "Open questions", body: answers.openQuestions }]
              : []),
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
