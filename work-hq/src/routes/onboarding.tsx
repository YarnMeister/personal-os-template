import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  ChevronsUpDown,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { ActionCard } from "@/components/work-hq/ActionCard";
import { Badge, badgeVariants } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildHandoff } from "@/lib/handoff";
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

/** Per-fact review status — mirrors detectStatus's return type (story 013). */
type FactStatus = "Confirmed" | "Derived" | "Unknown";

/** The triage decision a user makes on a single fact (story 013 / ADR-P6-009). */
type FactDecisionKind = "pending" | "accepted" | "edited" | "removed";

/**
 * A single parsed fact from a profile section body plus its triage state
 * (story 013 / ADR-P6-009).
 * - `id` — stable per-section index.
 * - `text` — original parsed fact text (for round-tripping / removal marker).
 * - `status` — per-fact label (detectStatus on the fact, falling back to the
 *   section-level status when the fact carries no label).
 * - `decision` — the user's triage choice.
 * - `editedText` — the corrected text when `decision === "edited"`.
 */
interface Fact {
  id: string;
  text: string;
  status: FactStatus;
  decision: FactDecisionKind;
  editedText?: string;
}

/** Persisted fact decision (onboarding-state.json, file-contracts §3.1). */
type FactDecision = Fact;

/** A structured stakeholder row — story 014 AC4. */
type Stakeholder = { name: string; role: string; relationship: string };

/** Structured team shape — size bucket + free-text descriptor — story 014 AC3. */
type Team = { size: string; descriptor: string };

type Answers = {
  role: string;
  /**
   * Working style as structured chips (story 014 AC2).  Migrated from the old
   * flat `string` in normalizeAnswers; scaffold-files renders it back to a
   * single comma-joined line for context/me.md.
   */
  workstyle: string[];
  /**
   * Immediate team as a size bucket + free-text descriptor (story 014 AC3).
   * Migrated from the old flat `team: string` in normalizeAnswers.
   */
  team: Team;
  /** AI assistant + enterprise tools (story 003 AC1). */
  keyTools: string[];
  /**
   * Structured stakeholder rows (story 014 AC4).  Migrated from the old
   * `string[]` in normalizeAnswers (each string becomes a name-only row).
   */
  stakeholders: Stakeholder[];
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
   * Story 010 + story 013 (ADR-P6-009): review state from the Review & correct
   * phase.  Keys are section headings from context/profile.md.
   * - `body` + `edited` — the section-level raw-edit escape hatch (story 010):
   *   `body` holds the current full section text, `edited: true` marks a section
   *   the user changed via the raw textarea.
   * - `facts` — optional per-fact triage decisions (story 013).  Additive:
   *   legacy `{ body, edited }` entries lack it and fall back to raw-body
   *   editing.  Persisted in onboarding-state.json so decisions survive refresh.
   */
  editedSections: Record<
    string,
    { body: string; edited: boolean; facts?: FactDecision[] }
  >;
};

const emptyAnswers: Answers = {
  role: "",
  workstyle: [],
  team: { size: "", descriptor: "" },
  keyTools: [""],
  stakeholders: [{ name: "", role: "", relationship: "" }],
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

const FACT_STATUSES: FactStatus[] = ["Confirmed", "Derived", "Unknown"];
const FACT_DECISIONS: FactDecisionKind[] = [
  "pending",
  "accepted",
  "edited",
  "removed",
];

/** Coerce one raw persisted fact into a valid FactDecision. */
function normalizeFactDecision(
  raw: Record<string, unknown>,
  i: number,
): FactDecision {
  const status = FACT_STATUSES.includes(raw.status as FactStatus)
    ? (raw.status as FactStatus)
    : "Unknown";
  const decision = FACT_DECISIONS.includes(raw.decision as FactDecisionKind)
    ? (raw.decision as FactDecisionKind)
    : "pending";
  const fact: FactDecision = {
    id: typeof raw.id === "string" ? raw.id : String(i),
    text: typeof raw.text === "string" ? raw.text : "",
    status,
    decision,
  };
  if (decision === "edited" && typeof raw.editedText === "string") {
    fact.editedText = raw.editedText;
  }
  return fact;
}

/**
 * Normalise the editedSections map (story 010 + story 013 migration).
 * Handles both the legacy `{ body, edited }` shape (leaves `facts` undefined —
 * the section falls back to raw-body editing, and any legacy raw edit still
 * surfaces in the corrections handoff) and the new `{ body, edited, facts }`
 * shape.  No data loss on either path.
 */
function normalizeEditedSections(raw: unknown): Answers["editedSections"] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Answers["editedSections"] = {};
  for (const [heading, value] of Object.entries(
    raw as Record<string, unknown>,
  )) {
    if (!value || typeof value !== "object") continue;
    const entry = value as Record<string, unknown>;
    const normalized: Answers["editedSections"][string] = {
      body: typeof entry.body === "string" ? entry.body : "",
      edited: typeof entry.edited === "boolean" ? entry.edited : false,
    };
    if (Array.isArray(entry.facts)) {
      normalized.facts = entry.facts
        .filter(
          (f): f is Record<string, unknown> => !!f && typeof f === "object",
        )
        .map((f, i) => normalizeFactDecision(f, i));
    }
    out[heading] = normalized;
  }
  return out;
}

/**
 * Migrate the working-style field (story 014 AC2).
 * - New shape: `string[]` — kept as-is (empty strings dropped).
 * - Legacy shape: a flat `string` — split on commas into individual chips so a
 *   pre-seeded CSV line ("Async-first, deep-work mornings") round-trips into
 *   chips with no data loss.  A single non-CSV string becomes one chip.
 */
function normalizeWorkstyle(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter(
      (x): x is string => typeof x === "string" && x.trim() !== "",
    );
  }
  if (typeof raw === "string" && raw.trim() !== "") {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

/**
 * Migrate the team field (story 014 AC3).
 * - New shape: `{ size, descriptor }` — coerced key-by-key.
 * - Legacy shape: a flat `string` — placed into `descriptor`, leaving `size`
 *   empty (no data loss).
 */
function normalizeTeam(raw: unknown): Team {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const t = raw as Record<string, unknown>;
    return {
      size: typeof t.size === "string" ? t.size : "",
      descriptor: typeof t.descriptor === "string" ? t.descriptor : "",
    };
  }
  if (typeof raw === "string") {
    return { size: "", descriptor: raw };
  }
  return { size: "", descriptor: "" };
}

/**
 * Migrate the stakeholders field (story 014 AC4).
 * - New shape: array of `{ name, role, relationship }` — coerced key-by-key.
 * - Legacy shape: `string[]` — each string becomes a name-only row
 *   (`{ name, role: "", relationship: "" }`), preserving every entry.
 */
function normalizeStakeholders(raw: unknown): Stakeholder[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((s) => {
    if (typeof s === "string") {
      return { name: s, role: "", relationship: "" };
    }
    if (s && typeof s === "object") {
      const o = s as Record<string, unknown>;
      return {
        name: typeof o.name === "string" ? o.name : "",
        role: typeof o.role === "string" ? o.role : "",
        relationship: typeof o.relationship === "string" ? o.relationship : "",
      };
    }
    return { name: "", role: "", relationship: "" };
  });
}

/**
 * Normalise a raw answers blob loaded from disk or localStorage.
 * Migrates the old flat-string priorities format
 * (i.e. priorities: [string, string, string]) to the structured object format
 * introduced in story 003, the old `editedSections` `{ body, edited }` shape to
 * the story-013 `{ body, edited, facts? }` shape, and the story-014 structured
 * controls: `workstyle: string → string[]`, `team: string → { size, descriptor }`,
 * and `stakeholders: string[] → Array<{ name, role, relationship }>`.
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

  // Normalise editedSections, migrating the legacy { body, edited } shape.
  const editedSections = normalizeEditedSections(a.editedSections);

  // Story 014 structured-control migrations (explicit keys win over the raw
  // spread below, so legacy shapes are always upgraded without data loss).
  const workstyle = normalizeWorkstyle(a.workstyle);
  const team = normalizeTeam(a.team);
  const stakeholders = normalizeStakeholders(a.stakeholders);

  return {
    ...emptyAnswers,
    ...(raw as Partial<Answers>),
    priorities,
    editedSections,
    workstyle,
    team,
    stakeholders,
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

  // AC4 (story 006): Phase 6 is the completion/handoff phase — mark it as
  // complete the moment it is reached so completedPhases contains 1–6.
  // Uses the callback form of setCompletedPhases to avoid a stale-closure
  // read; the debounced save above will persist the updated array.
  useEffect(() => {
    if (phase === 6) {
      setCompletedPhases((prev) => (prev.includes(6) ? prev : [...prev, 6]));
    }
  }, [phase]);

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

  // Count changed sections for the dynamic phase 4 bootstrap heading (AC3) —
  // a section counts when raw-edited or carrying an edited/removed fact (story 013).
  const editedCount = Object.values(answers.editedSections).filter(
    sectionHasChanges,
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
 * Renders the bootstrap prompt as an ActionCard (story 012).
 * The raw template markdown (from templates/bootstrap-profile-prompt.md) is
 * passed through unchanged as the clipboard payload; the human-readable step
 * list summarises what the Glean-connected assistant will do. The optional
 * `statusLine` surfaces the phase-3 profile-detection polling state.
 */
function BootstrapCopyBlock({
  content,
  statusLine,
}: {
  content: string;
  statusLine?: React.ReactNode;
}) {
  return (
    <ActionCard
      title="Bootstrap prompt ready"
      meta={`profile-bootstrap · ~${content.length.toLocaleString()} chars`}
      stepList={[
        "Research you via Glean enterprise data",
        "Write context/profile.md in this workspace",
        "Tell you it's ready for review here",
      ]}
      copyPayload={content}
      statusLine={statusLine}
      hint="Paste into your Glean-connected AI assistant to generate your profile."
    />
  );
}

/**
 * Build the profile-corrections handoff block markdown (§4.3 file-contracts.md).
 *
 * Rebuilt at fact level (story 013 / ADR-P6-009, file-contracts §4.3):
 * - A section appears only if it has changes — a raw-section edit (`edited`),
 *   or at least one edited/removed fact.  Untouched sections are omitted.
 * - Raw-edited sections emit their full corrected body (escape hatch, story 010).
 * - Fact-triaged sections list ONLY changed facts: an edited fact as a plain
 *   bullet with its NEW text (`- <new text>`); a removed fact with the removal
 *   marker (`- **Removed:** <original text>`).  Unchanged facts are omitted.
 * - When nothing changed, the body states "No corrections — all sections
 *   accepted as is" (story 011 AC2 — unchanged zero-changes wording).
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

  const changedEntries = Object.entries(editedSections).filter(([, v]) =>
    sectionHasChanges(v),
  );

  const nameRef = fullName.trim() ? ` for ${fullName.trim()}` : "";

  // The sensitivity gate phrase must match AGENTS.md §Sensitivity check exactly.
  const askText =
    `Apply the corrections above to context/profile.md — update edited facts in place ` +
    `and delete any fact marked "**Removed:**" (write the file, confirm when done). ` +
    `Then run the first-person conversion: rewrite the corrected profile as a polished ` +
    `first-person assistant context document${nameRef} — preserve all strong evidence, ` +
    `keep uncertain items marked as "Needs my confirmation", rewrite in a professional ` +
    `self-description tone, keep the structure assistant-friendly, and add a final section ` +
    `called "What I want my AI assistant to optimize for". Save the converted profile back ` +
    `to context/profile.md. Then distil context/me.md, context/org.md (sensitivity gate: ` +
    `no personnel data, unreleased roadmap items, or commercial terms in the committed ` +
    `org.md), and context/active.md seeds from the updated profile. Confirm each file is written.`;

  // Build one markdown block per changed section.
  const sectionBlock = ([heading, entry]: [
    string,
    Answers["editedSections"][string],
  ]): string => {
    // Raw-section escape hatch wins: emit the full corrected body verbatim.
    if (entry.edited) {
      return `**${heading}**\n${entry.body.trim()}`;
    }
    // Fact level: only edited and removed facts, in original order.
    const lines = (entry.facts ?? [])
      .filter((f) => f.decision === "edited" || f.decision === "removed")
      .map((f) =>
        f.decision === "removed"
          ? `- **Removed:** ${f.text.trim()}`
          : `- ${(f.editedText ?? f.text).trim()}`,
      );
    return `**${heading}**\n${lines.join("\n")}`;
  };

  const body =
    changedEntries.length === 0
      ? `No corrections — all sections accepted as is\n\n**Ask**\n${askText}`
      : changedEntries.map(sectionBlock).join("\n\n") +
        `\n\n**Ask**\n${askText}`;

  return `${header}\n\n${body}\n`;
}

/**
 * ActionCard for the profile-corrections handoff (story 011 AC1/AC2, story 012).
 * Markdown is built via buildProfileCorrectionsMarkdown and passed through
 * unchanged as the clipboard payload.
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
  const markdown = buildProfileCorrectionsMarkdown(editedSections, fullName);

  return (
    <ActionCard
      title="Profile corrections handoff"
      meta={`profile-corrections · ${
        editedCount === 0
          ? "no edits"
          : `${editedCount} section${editedCount === 1 ? "" : "s"} edited`
      } · ~${markdown.length.toLocaleString()} chars`}
      stepList={[
        "Apply your corrections to context/profile.md",
        "Rewrite it as a first-person assistant context document",
        "Distil context/me.md, org.md, and active.md from it",
      ]}
      copyPayload={markdown}
      hint="Paste into your AI assistant to apply corrections and lock in your context files."
    />
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

  // Step 2: Show prompt + polling status (AC3 + AC4)
  // AC4: profile-detection polling is surfaced inside the ActionCard's
  // statusLine slot — waiting state (auto-checking every 5 s, with a manual
  // Refresh) flips to a "✓ Profile detected" confirmation once found.
  const statusLine = profileDetected ? (
    <div className="flex items-start gap-2 rounded-xl border border-fresh/40 bg-fresh/5 px-4 py-3">
      <Check className="mt-0.5 size-4 shrink-0 text-fresh" />
      <p className="text-sm text-foreground">
        <span className="font-semibold">Profile detected</span> —{" "}
        <code className="font-mono text-xs text-foreground">
          context/profile.md
        </code>{" "}
        is ready. Click <strong>Next phase</strong> to continue.
      </p>
    </div>
  ) : (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-sm text-muted-foreground">
        Waiting for your assistant… auto-checking every 5 s.
      </p>
      <button
        type="button"
        onClick={handleRefresh}
        disabled={checking}
        className="flex shrink-0 items-center gap-1.5 rounded text-sm font-medium text-primary hover:underline disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <RefreshCw className={cn("size-4", checking && "animate-spin")} />
        {checking ? "Checking…" : "Refresh now"}
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* AC3: bootstrap prompt (kind 'profile-bootstrap') + polling status. */}
      <BootstrapCopyBlock content={promptContent} statusLine={statusLine} />
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

/* ----- Fact parser — story 013 / ADR-P6-009 ----- */

/**
 * Paragraph blocks at or over this length are NOT force-split into a fact;
 * they are left to the per-section raw-edit escape hatch (ADR-P6-009).
 */
const FACT_LENGTH_LIMIT = 200;

/** A line that is nothing but a status label, e.g. `**Confirmed**`. */
function isLabelOnlyLine(line: string): boolean {
  return /^\s*\*{0,2}\s*(Confirmed|Derived|Unknown(\s*\/\s*needs validation)?)\s*\*{0,2}\s*$/i.test(
    line,
  );
}

/** A markdown bullet line: starts (after optional indent) with `- ` or `* `. */
function isBulletLine(line: string): boolean {
  return /^\s*[-*]\s+/.test(line);
}

/**
 * Per-fact status: reuse detectStatus when the fact text carries a label,
 * otherwise fall back to the section-level status (story 013 AC2).
 */
function factStatusFor(text: string, sectionStatus: FactStatus): FactStatus {
  return /Confirmed|Derived|Unknown/.test(text)
    ? detectStatus(text)
    : sectionStatus;
}

/**
 * Split a section body into individual facts (ADR-P6-009, Option A).
 *
 * Splitting rule (applied exactly):
 * - Standalone status-label lines (e.g. `**Confirmed**`) are section markers,
 *   not facts — they are stripped and used as the section-level status.
 * - Lines beginning with `- ` or `* ` are each one bullet fact; an immediately
 *   following non-bullet, non-blank line is treated as a wrapped continuation
 *   of that bullet.
 * - Remaining non-bullet text is segmented into paragraph blocks (split on
 *   blank lines); each block under FACT_LENGTH_LIMIT characters becomes one
 *   short-paragraph fact.  Blocks at/over the limit are omitted (left to the
 *   raw-section escape hatch) rather than force-split.
 *
 * Each fact carries a stable per-section `id` (index), original `text`, a
 * per-fact `status`, and an initial `decision` of `"pending"`.
 */
function parseFacts(body: string): Fact[] {
  const sectionStatus = detectStatus(body);
  const lines = body.split("\n");
  const collected: Array<{ text: string; status: FactStatus }> = [];

  let bulletBuf: string[] | null = null;
  let paraBuf: string[] = [];

  const push = (raw: string) => {
    const text = raw.trim();
    if (!text) return;
    collected.push({ text, status: factStatusFor(text, sectionStatus) });
  };
  const flushBullet = () => {
    if (bulletBuf) {
      push(bulletBuf.join(" "));
      bulletBuf = null;
    }
  };
  const flushPara = () => {
    const text = paraBuf.join(" ").trim();
    paraBuf = [];
    if (text && text.length < FACT_LENGTH_LIMIT) push(text);
  };

  for (const line of lines) {
    if (isLabelOnlyLine(line)) {
      flushBullet();
      flushPara();
      continue;
    }
    if (isBulletLine(line)) {
      flushPara();
      flushBullet();
      bulletBuf = [line.replace(/^\s*[-*]\s+/, "")];
      continue;
    }
    if (line.trim() === "") {
      flushBullet();
      flushPara();
      continue;
    }
    // Non-blank, non-bullet, non-label line.
    if (bulletBuf) {
      bulletBuf.push(line.trim()); // wrapped continuation of the open bullet
    } else {
      paraBuf.push(line);
    }
  }
  flushBullet();
  flushPara();

  return collected.map((f, i) => ({
    id: String(i),
    text: f.text,
    status: f.status,
    decision: "pending" as const,
  }));
}

/**
 * Reconcile freshly-parsed facts with any persisted decisions (matched by id).
 * Parsed text/status stay authoritative; persisted decision/editedText win.
 */
function reconcileFacts(parsed: Fact[], persisted?: FactDecision[]): Fact[] {
  if (!persisted || persisted.length === 0) return parsed;
  return parsed.map((f) => {
    const p = persisted.find((x) => x.id === f.id);
    if (!p) return f;
    return {
      ...f,
      decision: p.decision,
      editedText: p.decision === "edited" ? p.editedText : undefined,
    };
  });
}

/**
 * A fact is "settled" (folded into the confirmed/accepted summary) when the
 * user accepted it, or it is a still-pending Confirmed claim.  Everything else
 * — pending Derived/Unknown, plus any edited or removed fact — needs review.
 */
function isSettledFact(f: Fact): boolean {
  if (f.decision === "removed" || f.decision === "edited") return false;
  if (f.decision === "accepted") return true;
  return f.status === "Confirmed";
}

/**
 * Whether a section carries any correction to hand off — a raw-section edit, or
 * at least one edited/removed fact (story 013 selection rule, file-contracts §4.3).
 */
function sectionHasChanges(entry: {
  edited: boolean;
  facts?: FactDecision[];
}): boolean {
  if (entry.edited) return true;
  return (entry.facts ?? []).some(
    (f) => f.decision === "edited" || f.decision === "removed",
  );
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

/* ----- FactRow (story 013) ----- */

/** Shared focus-ring utility for icon/text action buttons (WCAG 2.2 AA). */
const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/**
 * A single triage-able fact row (story 013 AC2).
 * Renders the fact text with a per-fact status chip and three action controls:
 * Accept (toggle), Edit (inline textarea), and Remove.  A removed fact renders
 * struck-through with an Undo control (AC3).  All controls are keyboard-reachable
 * with visible focus rings and carry aria-labels.
 */
function FactRow({
  fact,
  onAccept,
  onEdit,
  onRemove,
  onUndoRemove,
}: {
  fact: Fact;
  /** Toggle accepted <-> pending. */
  onAccept: () => void;
  onEdit: (text: string) => void;
  onRemove: () => void;
  onUndoRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(fact.editedText ?? fact.text);

  const display = fact.editedText ?? fact.text;
  const accepted = fact.decision === "accepted";
  const edited = fact.decision === "edited";

  // Removed — struck-through with an Undo (AC3).
  if (fact.decision === "removed") {
    return (
      <div className="flex items-start justify-between gap-3 rounded-lg border border-border/70 bg-muted/30 px-3 py-2">
        <p className="min-w-0 text-sm leading-relaxed text-muted-foreground line-through">
          {fact.text}
        </p>
        <button
          type="button"
          onClick={onUndoRemove}
          aria-label={`Undo removal of "${fact.text}"`}
          className={cn(
            "flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10",
            FOCUS_RING,
          )}
        >
          <RotateCcw className="size-3.5" /> Undo
        </button>
      </div>
    );
  }

  // Inline edit mode (AC2).
  if (editing) {
    return (
      <div className="space-y-2 rounded-lg border border-primary/40 bg-background px-3 py-2">
        <label htmlFor={`fact-edit-${fact.id}`} className="sr-only">
          Edit fact text
        </label>
        <textarea
          id={`fact-edit-${fact.id}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
          autoFocus
          className="w-full resize-y rounded-md border border-border bg-card px-3 py-2 text-sm leading-relaxed text-foreground outline-none focus:ring-2 focus:ring-primary/40"
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              onEdit(draft);
              setEditing(false);
            }}
            className={cn(
              "flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:brightness-110",
              FOCUS_RING,
            )}
          >
            <Check className="size-3.5" /> Save
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(fact.editedText ?? fact.text);
              setEditing(false);
            }}
            className={cn(
              "flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground",
              FOCUS_RING,
            )}
          >
            <X className="size-3.5" /> Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2">
      <div className="min-w-0 space-y-1">
        <p className="text-sm leading-relaxed text-foreground">{display}</p>
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip status={fact.status} />
          {accepted && (
            <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-fresh">
              <Check className="size-3" /> Accepted
            </span>
          )}
          {edited && (
            <span className="font-mono text-[10px] uppercase tracking-widest text-primary">
              Edited
            </span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onAccept}
          aria-pressed={accepted}
          aria-label={
            accepted
              ? `Undo accept of "${display}"`
              : `Accept fact "${display}"`
          }
          title={accepted ? "Accepted — click to undo" : "Accept"}
          className={cn(
            "flex size-8 items-center justify-center rounded-md",
            accepted
              ? "bg-fresh/15 text-fresh"
              : "text-muted-foreground hover:bg-fresh/10 hover:text-fresh",
            FOCUS_RING,
          )}
        >
          <Check className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            setDraft(fact.editedText ?? fact.text);
            setEditing(true);
          }}
          aria-label={`Edit fact "${display}"`}
          title="Edit"
          className={cn(
            "flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-primary/10 hover:text-primary",
            FOCUS_RING,
          )}
        >
          <Pencil className="size-4" />
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove fact "${display}"`}
          title="Remove"
          className={cn(
            "flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive",
            FOCUS_RING,
          )}
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </div>
  );
}

/* ----- FactSectionCard (story 013) ----- */

/**
 * Card for one ## section, rendering per-fact triage (story 013 AC2/AC3).
 * Needs-review facts (Derived/Unknown, or any edited/removed fact) render first;
 * settled facts (Confirmed status or user-accepted) collapse into a "N confirmed"
 * disclosure.  Every card retains the story-010 "Edit raw section" escape hatch
 * (a full-body textarea) for content the fact parser cannot split cleanly.
 */
function FactSectionCard({
  heading,
  sectionStatus,
  facts,
  rawBody,
  isRawEdited,
  hasChanges,
  onUpdateFact,
  onRawEdit,
  onResetRaw,
}: {
  heading: string;
  sectionStatus: FactStatus;
  facts: Fact[];
  rawBody: string;
  isRawEdited: boolean;
  hasChanges: boolean;
  onUpdateFact: (
    id: string,
    decision: FactDecisionKind,
    editedText?: string,
  ) => void;
  onRawEdit: (body: string) => void;
  onResetRaw: () => void;
}) {
  // Open the raw-edit escape hatch by default for sections already raw-edited
  // (covers migrated legacy { body, edited } entries — ADR-P6-009).
  const [rawOpen, setRawOpen] = useState(isRawEdited);

  const reviewFacts = facts.filter((f) => !isSettledFact(f));
  const settledFacts = facts.filter(isSettledFact);

  const rawId = `raw-section-${heading.replace(/\W+/g, "-")}`;

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4 space-y-3 transition",
        hasChanges ? "border-primary/50" : "border-border",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground leading-snug">
          {heading}
        </h3>
        <div className="flex shrink-0 items-center gap-2">
          {hasChanges && (
            <span className="rounded border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-primary">
              Changed
            </span>
          )}
          <StatusChip status={sectionStatus} />
        </div>
      </div>

      {rawOpen ? (
        /* Raw-section escape hatch (story 010, retained per ADR-P6-009). */
        <div className="space-y-2">
          <label htmlFor={rawId} className="sr-only">
            Raw section body for {heading}
          </label>
          <textarea
            id={rawId}
            value={rawBody}
            onChange={(e) => onRawEdit(e.target.value)}
            rows={6}
            className="w-full resize-y rounded-lg border border-border bg-background px-4 py-3 font-mono text-xs leading-relaxed text-foreground outline-none focus:ring-2 focus:ring-primary/40"
          />
          <button
            type="button"
            onClick={() => {
              onResetRaw();
              setRawOpen(false);
            }}
            className={cn(
              "rounded-md px-1 text-xs font-medium text-muted-foreground hover:text-foreground",
              FOCUS_RING,
            )}
          >
            ← Discard raw edit &amp; return to fact review
          </button>
        </div>
      ) : (
        <>
          {reviewFacts.length > 0 ? (
            <div className="space-y-2">
              {reviewFacts.map((f) => (
                <FactRow
                  key={f.id}
                  fact={f}
                  onAccept={() =>
                    onUpdateFact(
                      f.id,
                      f.decision === "accepted" ? "pending" : "accepted",
                    )
                  }
                  onEdit={(text) =>
                    onUpdateFact(
                      f.id,
                      text.trim() === f.text.trim() ? "pending" : "edited",
                      text,
                    )
                  }
                  onRemove={() => onUpdateFact(f.id, "removed")}
                  onUndoRemove={() => onUpdateFact(f.id, "pending")}
                />
              ))}
            </div>
          ) : facts.length === 0 ? (
            <p className="text-xs leading-relaxed text-muted-foreground">
              This section couldn&apos;t be split into individual facts. Use{" "}
              <strong className="text-foreground">Edit raw section</strong>{" "}
              below to correct it directly.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Every fact in this section is confirmed — nothing needs your
              review.
            </p>
          )}

          {settledFacts.length > 0 && (
            <details className="group rounded-lg border border-border/60 bg-muted/20">
              <summary
                className={cn(
                  "flex cursor-pointer list-none items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground",
                  FOCUS_RING,
                )}
              >
                <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" />
                {settledFacts.length} confirmed — click to expand
              </summary>
              <div className="space-y-2 border-t border-border/60 px-3 py-2">
                {settledFacts.map((f) => (
                  <FactRow
                    key={f.id}
                    fact={f}
                    onAccept={() =>
                      onUpdateFact(
                        f.id,
                        f.decision === "accepted" ? "pending" : "accepted",
                      )
                    }
                    onEdit={(text) =>
                      onUpdateFact(
                        f.id,
                        text.trim() === f.text.trim() ? "pending" : "edited",
                        text,
                      )
                    }
                    onRemove={() => onUpdateFact(f.id, "removed")}
                    onUndoRemove={() => onUpdateFact(f.id, "pending")}
                  />
                ))}
              </div>
            </details>
          )}

          <button
            type="button"
            onClick={() => setRawOpen(true)}
            className={cn(
              "rounded-md px-1 text-xs font-medium text-muted-foreground hover:text-foreground",
              FOCUS_RING,
            )}
          >
            Edit raw section
          </button>
        </>
      )}
    </div>
  );
}

/* ----- PhaseReviewCorrect (phase 4, bootstrap path) — story 010 / 013 ----- */

/**
 * PhaseReviewCorrect — phase 4 of the onboarding wizard, bootstrap path
 * (story 010, rebuilt as per-fact triage in story 013 / ADR-P6-009).
 *
 * Waiting state: context/profile.md not found → shows instruction text,
 *   a Refresh button (AC1), and a subtle Continue link as an escape hatch.
 *   Auto-polls every 5 s via check-profile-exists (reused from story 009).
 *
 * Review state: profile parsed into sections, each section into per-fact rows
 *   (parseFacts).  Each fact can be Accepted / Edited / Removed; needs-review
 *   facts surface first under an "N items need your review" header and confirmed
 *   facts collapse into a per-section summary.  A per-section "Edit raw section"
 *   escape hatch remains for un-splittable content.  Decisions persist to
 *   answers.editedSections; "Confirm all" / "Looks good" saves + advances (AC4).
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

  // Review state — parse profile.md into sections, then each section into
  // per-fact triage rows (story 013 AC1).
  const sections = parseProfileSections(profileContent);

  // Persist a single section's decisions, preserving the raw-edit escape hatch.
  const writeSection = (
    heading: string,
    value: Answers["editedSections"][string],
  ) => set("editedSections", { ...answers.editedSections, [heading]: value });

  // Build per-section view data + running totals for the review header (AC3).
  let totalReview = 0;
  let totalSettled = 0;

  const sectionData = sections.map((section) => {
    const saved = answers.editedSections[section.heading];
    const parsed = parseFacts(section.body);
    const facts = reconcileFacts(parsed, saved?.facts);
    const rawBody = saved?.body ?? section.body;
    const isRawEdited = saved?.edited ?? false;
    const hasChanges = saved ? sectionHasChanges(saved) : false;
    const reviewCount = facts.filter((f) => !isSettledFact(f)).length;

    // Raw-edited sections aren't in fact-triage mode — don't count their facts.
    if (!isRawEdited) {
      totalReview += reviewCount;
      totalSettled += facts.length - reviewCount;
    }

    return {
      section,
      facts,
      rawBody,
      isRawEdited,
      hasChanges,
      reviewCount,
      sectionStatus: detectStatus(section.body),
    };
  });

  // AC3: sort sections that need attention (review facts or a raw edit) first.
  const ordered = [...sectionData].sort(
    (a, b) =>
      (a.isRawEdited || a.reviewCount > 0 ? 0 : 1) -
      (b.isRawEdited || b.reviewCount > 0 ? 0 : 1),
  );

  // Sections carrying a correction, for the handoff label + Confirm button.
  const changedCount = Object.values(answers.editedSections).filter(
    sectionHasChanges,
  ).length;

  const updateFact = (
    heading: string,
    facts: Fact[],
    rawBody: string,
    isRawEdited: boolean,
    id: string,
    decision: FactDecisionKind,
    editedText?: string,
  ) => {
    const nextFacts: FactDecision[] = facts.map((f) => {
      if (f.id !== id) {
        const d: FactDecision = {
          id: f.id,
          text: f.text,
          status: f.status,
          decision: f.decision,
        };
        if (f.decision === "edited" && f.editedText !== undefined)
          d.editedText = f.editedText;
        return d;
      }
      const d: FactDecision = {
        id: f.id,
        text: f.text,
        status: f.status,
        decision,
      };
      if (decision === "edited" && editedText !== undefined)
        d.editedText = editedText;
      return d;
    });
    writeSection(heading, {
      body: rawBody,
      edited: isRawEdited,
      facts: nextFacts,
    });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Review each claim your assistant wrote. Accept, edit, or remove
        individual facts — your decisions are saved automatically and only your
        changes are sent to your assistant.
      </p>

      {/* AC3: review header — needs-review count + confirmed count, both visible. */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
        <p className="text-sm font-semibold text-foreground">
          {totalReview > 0
            ? `${totalReview} item${totalReview === 1 ? "" : "s"} need${
                totalReview === 1 ? "s" : ""
              } your review`
            : "Nothing left to review — every fact is confirmed"}
        </p>
        {totalSettled > 0 && (
          <p className="font-mono text-[10px] uppercase tracking-widest text-fresh">
            {totalSettled} confirmed
          </p>
        )}
      </div>

      {ordered.map((d) => (
        <FactSectionCard
          key={d.section.heading}
          heading={d.section.heading}
          sectionStatus={d.sectionStatus}
          facts={d.facts}
          rawBody={d.rawBody}
          isRawEdited={d.isRawEdited}
          hasChanges={d.hasChanges}
          onUpdateFact={(id, decision, editedText) =>
            updateFact(
              d.section.heading,
              d.facts,
              d.rawBody,
              d.isRawEdited,
              id,
              decision,
              editedText,
            )
          }
          onRawEdit={(newBody) =>
            writeSection(d.section.heading, {
              body: newBody,
              edited: newBody.trim() !== d.section.body.trim(),
              facts: answers.editedSections[d.section.heading]?.facts,
            })
          }
          onResetRaw={() =>
            writeSection(d.section.heading, {
              body: d.section.body,
              edited: false,
              facts: answers.editedSections[d.section.heading]?.facts,
            })
          }
        />
      ))}

      {/* story 011 AC1/AC2 + story 013 AC5: profile-corrections handoff (fact-level). */}
      <ProfileCorrectionsDock
        editedSections={answers.editedSections}
        editedCount={changedCount}
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
          {changedCount === 0 ? "Looks good" : "Confirm all"}{" "}
          <ArrowRight className="size-4" />
        </button>
      </div>
    </div>
  );
}

/* ----- Structured interview controls (story 014) ----- */

/** Shared trigger styling for combobox/select controls — matches text inputs. */
const CONTROL_TRIGGER =
  "flex w-full items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-base outline-none focus:ring-2 focus:ring-primary/40 focus-visible:ring-2 focus-visible:ring-primary/40";

/** Pre-seeded role titles (story 014 AC1) — free entry still accepted. */
const ROLE_OPTIONS = [
  "Product Manager",
  "Product Operations Lead",
  "Program Manager",
  "Chief of Staff",
  "Operations Manager",
  "Head of Product",
  "Director of Product",
  "Delivery Manager",
];

/** Pre-seeded working-style chips (story 014 AC2) — custom entry accepted. */
const WORKSTYLE_OPTIONS = [
  "async-first",
  "deep-work mornings",
  "meeting-heavy",
  "batched afternoons",
  "structured days",
  "flex schedule",
];

/** The four team-size buckets (story 014 AC3). */
const TEAM_SIZES = ["1–2", "3–5", "6–10", "11+"];

/** Common enterprise tools seeded into the key-tools combobox (story 014). */
const KEY_TOOL_OPTIONS = [
  "GitHub Copilot",
  "Jira",
  "Confluence",
  "Slack",
  "Glean",
  "Notion",
  "Figma",
  "GitHub",
  "Linear",
  "Asana",
];

/** The three stakeholder relationship kinds (story 014 AC4). */
const RELATIONSHIPS = ["Decision maker", "Collaborator", "Informed"];

/** Sentinel Select value for the phase-5 owner free-entry escape hatch (AC5). */
const OWNER_CUSTOM = "__custom__";

/**
 * RoleCombobox — single-value combobox (shadcn Command in a Popover) seeded with
 * common titles, with a free-entry "Create" escape hatch (story 014 AC1).
 * Keyboard-operable: cmdk highlights the first match; Enter selects it, so a
 * typed value that isn't in the list selects the Create row.
 */
function RoleCombobox({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const trimmed = query.trim();
  const showCreate =
    trimmed.length > 0 &&
    !ROLE_OPTIONS.some((o) => o.toLowerCase() === trimmed.toLowerCase());

  const commit = (v: string) => {
    onChange(v);
    setQuery("");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          className={CONTROL_TRIGGER}
        >
          <span className={cn(!value && "text-muted-foreground")}>
            {value || "Select or type your role…"}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] p-0"
      >
        <Command>
          <CommandInput
            placeholder="Search or type a role…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>
              {trimmed ? "Press Enter to add this role." : "No roles found."}
            </CommandEmpty>
            <CommandGroup>
              {ROLE_OPTIONS.map((opt) => (
                <CommandItem key={opt} value={opt} onSelect={() => commit(opt)}>
                  <Check
                    className={cn(
                      "size-4",
                      value === opt ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {opt}
                </CommandItem>
              ))}
              {showCreate && (
                <CommandItem value={trimmed} onSelect={() => commit(trimmed)}>
                  <Plus className="size-4" /> Create &ldquo;{trimmed}&rdquo;
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/**
 * WorkstyleChips — toggleable Badge chips for working style plus a free-entry
 * input for custom chips (story 014 AC2).  Selected chips render filled
 * (default variant); unselected render outline.  Each chip is a real button
 * with aria-pressed for screen readers.
 */
function WorkstyleChips({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const selected = value.filter(Boolean);
  const isSelected = (s: string) =>
    selected.some((x) => x.toLowerCase() === s.toLowerCase());

  const toggle = (s: string) =>
    isSelected(s)
      ? onChange(selected.filter((x) => x.toLowerCase() !== s.toLowerCase()))
      : onChange([...selected, s]);

  const addCustom = () => {
    const t = draft.trim();
    if (t && !isSelected(t)) onChange([...selected, t]);
    setDraft("");
  };

  // Predefined options plus any custom-selected values not in the preset list.
  const customSelected = selected.filter(
    (s) => !WORKSTYLE_OPTIONS.some((o) => o.toLowerCase() === s.toLowerCase()),
  );
  const options = [...WORKSTYLE_OPTIONS, ...customSelected];

  return (
    <div className="space-y-3">
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Working style"
      >
        {options.map((opt) => {
          const on = isSelected(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              aria-pressed={on}
              className={cn(
                badgeVariants({ variant: on ? "default" : "outline" }),
                "cursor-pointer px-3 py-1.5",
                on ? "hover:bg-primary/80" : "hover:bg-muted",
              )}
            >
              {on && <Check className="mr-1 size-3" />}
              {opt}
            </button>
          );
        })}
      </div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustom();
            }
          }}
          placeholder="Add your own…"
          aria-label="Add a custom working-style chip"
          className="flex-1 rounded-lg border border-border bg-card px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
        />
        <button
          type="button"
          onClick={addCustom}
          disabled={!draft.trim()}
          className={cn(
            "shrink-0 rounded-lg border border-border px-4 py-2.5 text-sm font-medium",
            draft.trim()
              ? "text-primary hover:bg-primary/10"
              : "cursor-not-allowed text-muted-foreground opacity-60",
            FOCUS_RING,
          )}
        >
          Add
        </button>
      </div>
    </div>
  );
}

/**
 * TeamControl — a size Select (four buckets) plus a free-text descriptor input
 * (story 014 AC3).  Persists as `{ size, descriptor }`.
 */
function TeamControl({
  value,
  onChange,
}: {
  value: Team;
  onChange: (v: Team) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <label
          htmlFor="team-size"
          className="text-xs font-medium text-muted-foreground"
        >
          Team size
        </label>
        <Select
          value={value.size || undefined}
          onValueChange={(size) => onChange({ ...value, size })}
        >
          <SelectTrigger id="team-size" className="h-auto px-4 py-3 text-base">
            <SelectValue placeholder="Select a size…" />
          </SelectTrigger>
          <SelectContent>
            {TEAM_SIZES.map((s) => (
              <SelectItem key={s} value={s}>
                {s} people
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <label
          htmlFor="team-descriptor"
          className="text-xs font-medium text-muted-foreground"
        >
          Short descriptor
        </label>
        <input
          id="team-descriptor"
          value={value.descriptor}
          onChange={(e) => onChange({ ...value, descriptor: e.target.value })}
          placeholder="e.g. ProdOps team — 2 PMs, 1 analyst, 1 coordinator"
          className="w-full rounded-lg border border-border bg-card px-4 py-3 text-base outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>
    </div>
  );
}

/**
 * KeyToolsCombobox — multi-select combobox (shadcn Command in a Popover) seeded
 * with common enterprise tools, with a free-entry "Create" escape hatch
 * (story 014).  Selected tools render as removable Badge chips.
 */
function KeyToolsCombobox({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = value.filter(Boolean);
  const trimmed = query.trim();
  const isSelected = (s: string) =>
    selected.some((x) => x.toLowerCase() === s.toLowerCase());

  const toggle = (tool: string) => {
    if (isSelected(tool)) {
      onChange(selected.filter((x) => x.toLowerCase() !== tool.toLowerCase()));
    } else {
      onChange([...selected, tool]);
    }
  };
  const addCustom = (tool: string) => {
    const t = tool.trim();
    if (t && !isSelected(t)) onChange([...selected, t]);
    setQuery("");
  };
  const remove = (tool: string) => onChange(selected.filter((x) => x !== tool));

  const showCreate =
    trimmed.length > 0 &&
    !KEY_TOOL_OPTIONS.some((o) => o.toLowerCase() === trimmed.toLowerCase()) &&
    !isSelected(trimmed);

  return (
    <div className="space-y-3">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            role="combobox"
            aria-expanded={open}
            className={CONTROL_TRIGGER}
          >
            <span className="text-muted-foreground">
              {selected.length > 0
                ? `${selected.length} tool${selected.length === 1 ? "" : "s"} selected`
                : "Select or type your tools…"}
            </span>
            <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[var(--radix-popover-trigger-width)] p-0"
        >
          <Command>
            <CommandInput
              placeholder="Search or type a tool…"
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              <CommandEmpty>
                {trimmed ? "Press Enter to add this tool." : "No tools found."}
              </CommandEmpty>
              <CommandGroup>
                {KEY_TOOL_OPTIONS.map((opt) => (
                  <CommandItem
                    key={opt}
                    value={opt}
                    onSelect={() => toggle(opt)}
                  >
                    <Check
                      className={cn(
                        "size-4",
                        isSelected(opt) ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {opt}
                  </CommandItem>
                ))}
                {showCreate && (
                  <CommandItem
                    value={trimmed}
                    onSelect={() => addCustom(trimmed)}
                  >
                    <Plus className="size-4" /> Add &ldquo;{trimmed}&rdquo;
                  </CommandItem>
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-label="Selected tools">
          {selected.map((tool) => (
            <Badge
              key={tool}
              variant="secondary"
              className="gap-1 py-1 pl-2.5 pr-1"
            >
              {tool}
              <button
                type="button"
                onClick={() => remove(tool)}
                aria-label={`Remove ${tool}`}
                className={cn(
                  "flex size-4 items-center justify-center rounded-sm hover:bg-foreground/10",
                  FOCUS_RING,
                )}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * StakeholderRows — structured stakeholder rows, each with Name, Role/Title, and
 * a Relationship Select (story 014 AC4).  Add appends an empty row; Remove
 * deletes a row.  Every control is labelled for assistive tech.
 */
function StakeholderRows({
  value,
  onChange,
}: {
  value: Stakeholder[];
  onChange: (v: Stakeholder[]) => void;
}) {
  const rows =
    value.length > 0 ? value : [{ name: "", role: "", relationship: "" }];

  const update = (i: number, key: keyof Stakeholder, v: string) =>
    onChange(rows.map((r, idx) => (idx === i ? { ...r, [key]: v } : r)));
  const add = () =>
    onChange([...rows, { name: "", role: "", relationship: "" }]);
  const remove = (i: number) => onChange(rows.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-3">
      {rows.map((row, i) => (
        <div
          key={i}
          className="rounded-xl border border-border bg-card p-3 space-y-3"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground">
              Stakeholder {i + 1}
            </p>
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label={`Remove stakeholder ${i + 1}`}
                className={cn(
                  "flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive",
                  FOCUS_RING,
                )}
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor={`stk-name-${i}`}
                className="text-xs font-medium text-muted-foreground"
              >
                Name
              </label>
              <input
                id={`stk-name-${i}`}
                value={row.name}
                onChange={(e) => update(i, "name", e.target.value)}
                placeholder="e.g. Sarah Chen"
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor={`stk-role-${i}`}
                className="text-xs font-medium text-muted-foreground"
              >
                Role / Title
              </label>
              <input
                id={`stk-role-${i}`}
                value={row.role}
                onChange={(e) => update(i, "role", e.target.value)}
                placeholder="e.g. CTO"
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor={`stk-rel-${i}`}
              className="text-xs font-medium text-muted-foreground"
            >
              Relationship
            </label>
            <Select
              value={row.relationship || undefined}
              onValueChange={(v) => update(i, "relationship", v)}
            >
              <SelectTrigger id={`stk-rel-${i}`}>
                <SelectValue placeholder="Select a relationship…" />
              </SelectTrigger>
              <SelectContent>
                {RELATIONSHIPS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className={cn(
          "flex items-center gap-1 rounded-md px-1 text-xs font-medium text-primary hover:underline",
          FOCUS_RING,
        )}
      >
        <Plus className="size-3.5" /> Add stakeholder
      </button>
    </div>
  );
}

/**
 * OwnerSelect — phase-5 priority owner Select populated from the stakeholder
 * names entered in phase 4, prefixed with "Me", plus a free-entry fallback
 * (story 014 AC5).  Choosing "Someone else…" reveals a text input.
 */
function OwnerSelect({
  value,
  ownerOptions,
  onChange,
}: {
  value: string;
  ownerOptions: string[];
  onChange: (v: string) => void;
}) {
  const isKnown = value !== "" && ownerOptions.includes(value);
  const [custom, setCustom] = useState(value !== "" && !isKnown);

  if (custom) {
    return (
      <div className="space-y-2">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. Alex Smith or Product team"
          aria-label="Priority owner (free entry)"
          autoFocus
          className="w-full rounded-lg border border-border bg-background px-4 py-3 text-base outline-none focus:ring-2 focus:ring-primary/40"
        />
        <button
          type="button"
          onClick={() => {
            setCustom(false);
            onChange("");
          }}
          className={cn(
            "rounded-md px-1 text-xs font-medium text-muted-foreground hover:text-foreground",
            FOCUS_RING,
          )}
        >
          ← Choose from list
        </button>
      </div>
    );
  }

  return (
    <Select
      value={isKnown ? value : undefined}
      onValueChange={(v) => {
        if (v === OWNER_CUSTOM) {
          setCustom(true);
          onChange("");
        } else {
          onChange(v);
        }
      }}
    >
      <SelectTrigger className="h-auto px-4 py-3 text-base">
        <SelectValue placeholder="Select an owner…" />
      </SelectTrigger>
      <SelectContent>
        {ownerOptions.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
        <SelectItem value={OWNER_CUSTOM}>Someone else…</SelectItem>
      </SelectContent>
    </Select>
  );
}

/** Render a stakeholder row as one legible summary line (story 014 AC6/AC8). */
function stakeholderSummary(s: Stakeholder): string {
  const name = s.name.trim();
  if (!name) return "";
  const role = s.role.trim();
  const rel = s.relationship.trim();
  return `${name}${role ? ` (${role})` : ""}${rel ? ` — ${rel}` : ""}`;
}

/** Render the structured team object as one legible summary line. */
function teamSummary(t: Team): string {
  const descriptor = t.descriptor.trim();
  const size = t.size.trim();
  const parts: string[] = [];
  if (descriptor) parts.push(descriptor);
  if (size) parts.push(`${size} people`);
  return parts.join(" — ");
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
          <RoleCombobox value={answers.role} onChange={(v) => set("role", v)} />
        </Field>

        <Field label="Working style">
          <WorkstyleChips
            value={answers.workstyle}
            onChange={(v) => set("workstyle", v)}
          />
        </Field>

        <Field label="Your immediate team">
          <TeamControl value={answers.team} onChange={(v) => set("team", v)} />
        </Field>

        <Field label="Key tools">
          <KeyToolsCombobox
            value={answers.keyTools}
            onChange={(v) => set("keyTools", v)}
          />
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
          <StakeholderRows
            value={answers.stakeholders}
            onChange={(v) => set("stakeholders", v)}
          />
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
        <ReviewRow
          label="Working style"
          value={answers.workstyle.filter(Boolean).join(", ") || "—"}
        />
        <ReviewRow label="Team" value={teamSummary(answers.team) || "—"} />
        <ReviewRow
          label="Key tools"
          value={answers.keyTools.filter(Boolean).join(", ") || "—"}
        />
        <ReviewRow
          label="Stakeholders"
          value={
            answers.stakeholders
              .map(stakeholderSummary)
              .filter(Boolean)
              .join("\n") || "—"
          }
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

  // AC5: priority-owner options = "Me" + each stakeholder name entered in
  // phase 4, de-duplicated.  A free-entry fallback is offered by OwnerSelect.
  const stakeholderNames = answers.stakeholders
    .map((s) => s.name.trim())
    .filter(Boolean);
  const ownerOptions = ["Me", ...stakeholderNames].filter(
    (o, i, arr) => arr.indexOf(o) === i,
  );

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
                <OwnerSelect
                  value={p.owner}
                  ownerOptions={ownerOptions}
                  onChange={(owner) => {
                    const updated = [
                      ...answers.priorities,
                    ] as typeof answers.priorities;
                    updated[i] = { ...updated[i], owner };
                    set("priorities", updated);
                  }}
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

/**
 * PhaseFirst — phase 6 of the onboarding wizard (story 006).
 *
 * The OS files are ALREADY WRITTEN by this phase. This component:
 *  - Confirms completion with copy that states files are ready (AC1).
 *  - Emits a handoff block with kind "onboarding" (AC2): lists the three
 *    scaffolded files and a two-part ask (verify + morning standup), with no
 *    instruction to write any file and no use of the word "initialize".
 */
function PhaseFirst({ answers: _answers }: { answers: Answers }) {
  // AC2: kind "onboarding" → first line is "## Work HQ handoff · onboarding · <date>".
  // Built via buildHandoff and passed through ActionCard unchanged (story 012).
  const { markdown } = buildHandoff({
    kind: "onboarding",
    sections: [
      {
        label: "Scaffolded files",
        body: ["context/me.md", "context/org.md", "context/active.md"],
      },
      {
        label: "Ask",
        body:
          "(a) Verify these files are in place and contain real content — confirm each is present.\n" +
          '(b) Run my first "morning standup".',
      },
    ],
  });

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-8 text-center">
        <Sparkles className="mx-auto size-8 text-primary" />
        <h3 className="mt-4 text-2xl font-semibold">Your OS is ready.</h3>
        <p className="mt-2 text-sm text-muted-foreground text-pretty">
          Your context files are written and your assistant already has
          everything it needs. Paste the handoff below to verify them and run
          your first morning standup.
        </p>
      </div>

      <ActionCard
        title="Onboarding handoff"
        meta={`onboarding · ${markdown.length.toLocaleString()} chars · onboarding-handoff.md`}
        stepList={[
          "Verify context/me.md, org.md, and active.md are in place",
          "Run your first morning standup",
        ]}
        copyPayload={markdown}
        hint="Paste into your assistant to verify your context files and run your first standup."
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
