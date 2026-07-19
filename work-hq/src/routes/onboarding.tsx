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
import { checkHandshake } from "@/server/check-handshake";
import { checkContextFiles } from "@/server/check-context-files";
import { scaffoldFiles } from "@/server/scaffold-files";
import { readBootstrapPrompt } from "@/server/read-bootstrap-prompt";
import { readProfile } from "@/server/read-profile";
import { readTaxonomy } from "@/server/read-taxonomy";
import type { Taxonomy } from "@/server/read-taxonomy";
import { writeTaxonomy } from "@/server/write-taxonomy";

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
   * Story 017 AC3 (file-contracts §3.1): true once the phase-3
   * `checkProfileExists` poll finds context/profile.md. Persisted so phase 4
   * renders section cards immediately on reload without re-showing the waiting
   * state. Backward compatible — legacy state lacking it defaults to false.
   */
  profileDetected: boolean;
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
  profileDetected: false,
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

  // Story 017 AC3: coerce profileDetected to a boolean; legacy state lacking
  // it (or carrying a non-boolean) falls back to false with no data loss.
  const profileDetected = a.profileDetected === true;

  return {
    ...emptyAnswers,
    ...(raw as Partial<Answers>),
    priorities,
    editedSections,
    workstyle,
    team,
    stakeholders,
    profileDetected,
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
            {/* labeledStep stepper (story 017 AC2): completed phases are
                clickable stepButtons that navigate back via setPhase; the
                current phase carries aria-current="step"; future phases are
                non-interactive locked indicators. Phase titles are exposed to
                assistive tech via aria-label + sr-only text. */}
            <nav
              aria-label="Onboarding progress"
              className="flex items-center gap-1.5"
            >
              {phases.map((p) => {
                const isCompleted = completedPhases.includes(p.n);
                const isCurrent = p.n === phase;
                const label = `Phase ${p.n} of 6: ${p.title}`;
                const dotBase = "size-1.5 rounded-full";
                // Completed and not the current phase → clickable back-nav.
                if (isCompleted && !isCurrent) {
                  return (
                    <button
                      key={p.n}
                      type="button"
                      onClick={() => setPhase(p.n)}
                      aria-label={`${label} (completed) — go back to this phase`}
                      className={cn(
                        "flex size-6 items-center justify-center rounded-full transition-colors hover:bg-primary/10",
                        FOCUS_RING,
                      )}
                    >
                      <span className={cn(dotBase, "bg-primary")} />
                      <span className="sr-only">{label}, completed</span>
                    </button>
                  );
                }
                // Current phase → indicated, not interactive.
                if (isCurrent) {
                  return (
                    <span
                      key={p.n}
                      aria-current="step"
                      aria-label={`${label} (current)`}
                      className="flex size-6 items-center justify-center rounded-full ring-1 ring-primary/50"
                    >
                      <span className={cn(dotBase, "bg-primary")} />
                      <span className="sr-only">{label}, current</span>
                    </span>
                  );
                }
                // Future phase → locked, non-interactive.
                return (
                  <span
                    key={p.n}
                    aria-disabled="true"
                    aria-label={`${label} (locked)`}
                    className="flex size-6 items-center justify-center rounded-full"
                  >
                    <span className={cn(dotBase, "bg-muted")} />
                    <span className="sr-only">{label}, locked</span>
                  </span>
                );
              })}
            </nav>
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

/**
 * Canned assistant replies for the phase-1 mini-chat (story 016 AC3).
 * Content is hardcoded — no server call is made — and mirrors the real
 * chief-of-staff rituals (skills/chief-of-staff/SKILL.md) so the preview is
 * accurate about which files each phrase reads and writes.
 */
const cannedReplies: Record<string, string> = {
  "morning standup":
    "I read context/active.md and reply with your morning standup: your top-3 priorities (title, owner, due date), any blockers listed there, and one suggested first action for today. Nothing is written back — it is a read-only briefing.",
  "process my backlog":
    "I read BACKLOG.md in full and route each item to the right file — actions to context/active.md, project notes to projects/, learnings to memory/learnings.md, reference material to knowledge/this-week.md — then clear BACKLOG.md and report where everything went.",
  "end session":
    "I run the session harvest: append 1–3 patterns to memory/learnings.md, record any significant decision in memory/decisions.md, and log one row in memory/usage-log.md so the next session starts with fresh context.",
};

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

  // Click-to-explore state (story 016 AC1) — one tier highlighted at a time,
  // or null initially.  Local UI only: nothing is persisted, no set() call.
  const [selectedTier, setSelectedTier] = useState<number | null>(null);

  // Roving focus across the tier cards (story 016 AC2).  Native <button>
  // handles Enter/Space; this onKeyDown adds ArrowUp/ArrowDown/Home/End
  // navigation without conflicting with the toggle click.
  const tierRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const onTierKeyDown = (e: React.KeyboardEvent, i: number, count: number) => {
    let target: number | null = null;
    if (e.key === "ArrowDown") target = (i + 1) % count;
    else if (e.key === "ArrowUp") target = (i - 1 + count) % count;
    else if (e.key === "Home") target = 0;
    else if (e.key === "End") target = count - 1;
    if (target !== null) {
      e.preventDefault();
      tierRefs.current[target]?.focus();
    }
  };

  // Mini-chat state (story 016 AC3) — the last clicked trigger drives a canned
  // user/assistant turn.  Local UI only; no real assistant call is made.
  const [chatHistory, setChatHistory] = useState<
    Array<{ role: "user" | "assistant"; text: string }>
  >([]);

  const playTrigger = (phrase: string) => {
    setChatHistory([
      { role: "user", text: phrase },
      { role: "assistant", text: cannedReplies[phrase] },
    ]);
  };

  return (
    <div className="space-y-6">
      <p className="text-base leading-relaxed text-muted-foreground">
        Your Personal OS is plain markdown files — no code, no servers. One
        file, <code className="font-mono text-foreground">AGENTS.md</code>, acts
        as your AI's constitution: always loaded, always routing to everything
        else.
      </p>

      {/* Privacy / offline note — kept early in DOM order so it stays visible
          without scrolling at 1280px (story 002 regression guard, story 016 AC4). */}
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

      {/* Three-tier model — click a card to explore its files + description
          (story 016 AC1/AC2).  Each card is a real <button>: keyboard-operable,
          focus-ringed, and reports its selected state via aria-pressed. */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">
          Click a tier to explore what lives there.
        </p>
        {tiers.map((t, i) => {
          const selected = selectedTier === i;
          return (
            <button
              key={t.n}
              type="button"
              ref={(el) => {
                tierRefs.current[i] = el;
              }}
              aria-pressed={selected}
              onClick={() => setSelectedTier(selected ? null : i)}
              onKeyDown={(e) => onTierKeyDown(e, i, tiers.length)}
              className={cn(
                "w-full rounded-xl border p-4 text-left transition-colors",
                FOCUS_RING,
                selected
                  ? "border-primary/60 bg-primary/5 ring-1 ring-primary/40"
                  : "border-border bg-card hover:border-primary/40 hover:bg-muted/40",
              )}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-foreground">
                  {t.n} · {t.label}
                </p>
                <span className="font-mono text-[10px] uppercase tracking-widest text-primary">
                  {t.badge}
                </span>
              </div>
              {selected ? (
                <div className="mt-2 space-y-2">
                  <p className="text-xs text-muted-foreground">{t.desc}</p>
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
              ) : (
                <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Click to explore
                </p>
              )}
            </button>
          );
        })}
      </div>

      {/* Daily trigger phrases — click a chip to preview the ritual it runs
          in the mini-chat below (story 016 AC3).  No assistant is called. */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Three phrases run your whole day
        </p>
        <p className="text-xs text-muted-foreground">
          Click a phrase to preview what your assistant would do. In real use
          you type it into a fresh VS Code chat and the constitution routes to
          the right files automatically.
        </p>
        <div className="flex flex-wrap gap-2">
          {triggers.map((phrase) => {
            const active = chatHistory[0]?.text === phrase;
            return (
              <button
                key={phrase}
                type="button"
                aria-pressed={active}
                onClick={() => playTrigger(phrase)}
                className={cn(
                  "rounded-md border px-3 py-1 font-mono text-sm transition-colors",
                  FOCUS_RING,
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-primary/20 bg-primary/10 text-primary hover:bg-primary/20",
                )}
              >
                {phrase}
              </button>
            );
          })}
        </div>

        {/* Mini-chat panel — canned user + assistant turns (AC3). The live
            region is pre-mounted empty (story 019 AC5, story 016 QA follow-up)
            so assistive tech registers it before a reply is injected; the card
            chrome + content are applied only once a trigger has been played, so
            an empty region shows nothing. The node is never unmounted. */}
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className={cn(
            chatHistory.length > 0 &&
              "space-y-2 rounded-lg border border-border bg-background p-3",
          )}
        >
          {chatHistory.length > 0 && (
            <>
              {chatHistory.map((turn, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex",
                    turn.role === "user" ? "justify-end" : "justify-start",
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed",
                      turn.role === "user"
                        ? "bg-primary font-mono text-primary-foreground"
                        : "bg-muted text-foreground",
                    )}
                  >
                    {turn.text}
                  </div>
                </div>
              ))}
              <p className="text-[10px] text-muted-foreground">
                Preview only — no assistant was called and no files were
                changed.
              </p>
            </>
          )}
        </div>
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
 * - The `Tools, systems, and domains` section is suppressed from the review UI
 *   (story 019) and unconditionally queued for deletion here (story 023 /
 *   file-contracts §4.3): every handoff emits the block-level section-removal
 *   directive `**Removed section:** Tools, systems, and domains` and appends the
 *   exact removal sentence to the Ask. Because that directive is always present,
 *   the handoff is never empty — the legacy "No corrections — all sections
 *   accepted as is" branch (story 011) can no longer occur and is removed
 *   (§4.3 no-empty-handoff clause).
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

  // Section-level removal directive (story 023 / file-contracts §4.3): a
  // BLOCK-LEVEL line (not a bullet) instructing the assistant to delete the
  // entire named section from context/profile.md. Emitted unconditionally for
  // `Tools, systems, and domains`, which is suppressed from the review UI
  // (story 019). Heading text carries no `##` prefix, mirroring the
  // `**<Edited section heading>**` block label.
  const removalSectionDirective =
    "**Removed section:** Tools, systems, and domains";

  // Appended verbatim to the Ask (story 023 / §4.3) — casing, punctuation, and
  // the `##` prefix are exact.
  const removalAskSentence =
    "Remove the ## Tools, systems, and domains section from context/profile.md entirely.";

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

  // The unconditional section-removal directive always trails the changed
  // section blocks, so the handoff is never empty (§4.3 no-empty-handoff
  // clause). The Ask always appears last, with the removal sentence appended
  // after the existing ask text.
  const blocks = [
    ...changedEntries.map(sectionBlock),
    removalSectionDirective,
  ];
  const body =
    blocks.join("\n\n") + `\n\n**Ask**\n${askText}\n\n${removalAskSentence}`;

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
  // Story 017 AC3: seed local detection state from persisted answers so a
  // refresh after detection keeps the confirmation without re-polling.
  const [profileDetected, setProfileDetected] = useState(
    () => answers.profileDetected,
  );
  const [checking, setChecking] = useState(false);

  // Story 017 AC3: mark detection both locally (drives the status UI) and in
  // persisted answers (survives refresh; written to onboarding-state.json by
  // the debounced save).
  const markDetected = () => {
    setProfileDetected(true);
    if (!answers.profileDetected) set("profileDetected", true);
  };

  // AC4: Auto-poll context/profile.md every 5 s once the prompt has been shown.
  useEffect(() => {
    if (!promptContent || profileDetected) return;
    const id = setInterval(() => {
      void checkProfileExists().then(({ exists }) => {
        if (exists) markDetected();
      });
    }, 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promptContent, profileDetected]);

  const handleRefresh = () => {
    setChecking(true);
    void checkProfileExists().then(({ exists }) => {
      setChecking(false);
      if (exists) markDetected();
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

/* ----- Line-prose item parser (story 021) ----- */

/**
 * Split a bullet-less item-list section body into one Fact per line (story 021
 * AC4). Used for sections routed to `'item-list'` via {@link HEADING_OVERRIDE_MAP}
 * whose bodies contain no bullet lines (currently only 'Derived work style',
 * whose body is soft-wrapped prose under a `**Derived**` label). It splits the
 * body on `\n`, drops blank lines and status-label lines, and yields one pending
 * Fact per remaining non-blank line — `text` is the trimmed line, `status` is the
 * section-level status ({@link detectStatus} on the body), and `id` is the line's
 * index in the filtered sequence (stable while the body is unchanged).
 *
 * Label lines are matched with {@link isLabelOnlyLine} (the shared helper, which
 * covers `**Derived**` and the bare-word `Derived` variants) as well as AC4's
 * `/^\*\*.+\*\*$/` bold-only pattern, so any bold-only marker line is skipped.
 */
function parseLineItems(body: string): Fact[] {
  const sectionStatus = detectStatus(body);
  return body
    .split("\n")
    .filter(
      (l) =>
        l.trim() !== "" &&
        !isLabelOnlyLine(l) &&
        !/^\*\*.+\*\*$/.test(l.trim()),
    )
    .map((l, i) => ({
      id: String(i),
      text: l.trim(),
      status: sectionStatus,
      decision: "pending" as const,
    }));
}

/**
 * Facts for an `'item-list'` section (story 021). A body carrying bullet lines
 * reuses the story-013 bullet extractor ({@link parseFacts}) unchanged; a
 * bullet-less overridden body (e.g. 'Derived work style') is split per line via
 * {@link parseLineItems} so each prose line becomes an individually triageable
 * item rather than one over-length paragraph the fact parser would drop.
 */
function parseItemFacts(body: string): Fact[] {
  return body.split("\n").some(isBulletLine)
    ? parseFacts(body)
    : parseLineItems(body);
}

/**
 * Reconcile item-list facts with persisted decisions (story 021). Like
 * {@link reconcileFacts}, but a persisted fact whose `id` matches no freshly
 * parsed item is a user-added item (the "Add item" affordance, AC3) and is
 * appended so it survives reload and reaches the corrections handoff.
 */
function reconcileItemFacts(
  parsed: Fact[],
  persisted?: FactDecision[],
): Fact[] {
  const base = reconcileFacts(parsed, persisted);
  if (!persisted || persisted.length === 0) return base;
  const parsedIds = new Set(parsed.map((f) => f.id));
  const added = persisted.filter((p) => !parsedIds.has(p.id));
  return added.length > 0 ? [...base, ...added] : base;
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

/* ----- Renderer dispatch + inline-markdown helpers (story 019) ----- */

/**
 * Which review renderer a profile section is routed to (feature f-review-ux,
 * file-contracts §2). Chosen by {@link selectRenderer}: a per-heading override
 * wins, otherwise the body's shape decides.
 * - `'kv-grid'`         — a `|`-delimited table (story 020).
 * - `'item-list'`       — a bulleted list (story 021).
 * - `'taxonomy-picker'` — the Business-area cascading picker (story 022).
 * - `'prose-card'`      — free paragraph text (existing FactSectionCard path).
 * - `'suppressed'`      — never rendered; queued for removal (story 023).
 */
type RendererKind =
  "kv-grid" | "item-list" | "taxonomy-picker" | "prose-card" | "suppressed";

/**
 * Per-heading renderer overrides — they take full precedence over shape
 * detection (file-contracts §2). Keys MUST match the exact `## ` heading
 * strings parseProfileSections emits from context/profile.md, NOT the
 * file-contracts §2 prose paraphrase: the actual heading is
 * `Tools, systems, and domains` (verified against context/profile.md), not the
 * spec's descriptive "…they appear closest to".
 */
const HEADING_OVERRIDE_MAP: Record<string, RendererKind> = {
  "Business area": "taxonomy-picker",
  "Derived work style": "item-list",
  "Tools, systems, and domains": "suppressed",
};

/**
 * Choose the review renderer for one profile section (story 019 AC1).
 * The override map wins; otherwise shape detection runs on the body:
 *   a line starting with `|`         → `'kv-grid'`
 *   a line starting with `- ` / `* ` → `'item-list'`
 *   otherwise                        → `'prose-card'`
 * `|` is checked before bullets so a table with an incidental bullet still
 * routes to the grid. Status-label lines (`**Confirmed**`) start with `**`, not
 * `* ` or `|`, so they never influence the shape.
 */
function selectRenderer(heading: string, body: string): RendererKind {
  const override = HEADING_OVERRIDE_MAP[heading];
  if (override) return override;
  const lines = body.split("\n");
  if (lines.some((l) => l.trimStart().startsWith("|"))) return "kv-grid";
  if (lines.some((l) => isBulletLine(l))) return "item-list";
  return "prose-card";
}

/**
 * Strip inline markdown markers, returning clean plain text (story 019 AC3).
 * `***bold-italic***` → `bold-italic`, `**bold**` → `bold`,
 * `*italic*` / `_italic_` → `italic`, `` `code` `` → `code`.
 * Used as the source for EVERY edit-field initial value so the user never edits
 * raw `**` / `*` / `` ` `` markers. Applied triple → double → single so the
 * outer markers are consumed before the inner ones.
 */
function humanizeMarkdown(text: string): string {
  return text
    .replace(/\*\*\*(.+?)\*\*\*/g, "$1")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/`(.+?)`/g, "$1");
}

/**
 * Render inline markdown as real DOM — `**bold**` → `<strong>`,
 * `*italic*` / `_italic_` → `<em>`, `` `code` `` → `<code>` — via a regex
 * split (story 019 AC4). No dangerouslySetInnerHTML, no markdown library:
 * a capturing split interleaves plain text with the matched spans, and each
 * span is rendered as the matching element. Used wherever a fact's text appears
 * in read (non-edit) state.
 */
function InlineMarkdown({ text }: { text: string }) {
  // Ordered alternation: bold-italic, then bold, then italic, then code so the
  // longer marker runs win before their prefixes.
  const pattern = /(\*\*\*.+?\*\*\*|\*\*.+?\*\*|\*.+?\*|_.+?_|`.+?`)/g;
  const parts = text.split(pattern);
  return (
    <>
      {parts.map((part, i) => {
        if (!part) return null;
        if (/^\*\*\*.+\*\*\*$/.test(part)) {
          return (
            <strong key={i}>
              <em>{part.slice(3, -3)}</em>
            </strong>
          );
        }
        if (/^\*\*.+\*\*$/.test(part)) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        if (/^\*.+\*$/.test(part)) {
          return <em key={i}>{part.slice(1, -1)}</em>;
        }
        if (/^_.+_$/.test(part)) {
          return <em key={i}>{part.slice(1, -1)}</em>;
        }
        if (/^`.+`$/.test(part)) {
          return <code key={i}>{part.slice(1, -1)}</code>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

/* ----- Markdown-table parser + KV-grid helpers (story 020) ----- */

/** The exact `## ` heading of the identity section (min-key injection target). */
const IDENTITY_HEADING = "Identity and current role";

/**
 * The seven fields the identity grid always surfaces (story 020 AC3). Any of
 * these absent from the parsed table is injected as an empty row so the user
 * always sees all seven — even before the assistant has filled them in.
 */
const IDENTITY_MIN_KEYS = [
  "Name",
  "Title",
  "Email",
  "Manager",
  "Location",
  "Department",
  "Start date",
];

/** The cell delimiter for KV-row facts in the corrections handoff (§4.3). */
const CELL_JOIN = " | ";

/**
 * Parse a markdown table body into headers + rows (story 020 AC2). Pure and
 * column-count-generic: splits on newlines, keeps only lines beginning with
 * `|`, skips separator rows (`|---|---|`), takes the first remaining line as the
 * header row and every subsequent one as a data row. Each row is the pipe-
 * delimited cells with the empty leading/trailing elements dropped and every
 * cell trimmed. Non-table content around the table (status labels, prose) is
 * ignored because it never starts with `|`.
 */
function parseMarkdownTable(body: string): {
  headers: string[];
  rows: string[][];
} {
  const toCells = (line: string): string[] =>
    line
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());

  const dataLines = body
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("|"))
    // Skip separator rows: only pipes, whitespace, dashes, and alignment colons.
    .filter((l) => !/^[|\s:-]+$/.test(l));

  if (dataLines.length === 0) return { headers: [], rows: [] };
  return {
    headers: toCells(dataLines[0]),
    rows: dataLines.slice(1).map(toCells),
  };
}

/** Split a stored row `text` / `editedText` back into its cells. */
function splitCells(joined: string): string[] {
  return joined.split(CELL_JOIN);
}

/** True when a row carries at least one non-empty value cell (columns ≥ 1). */
function rowHasValue(cells: string[]): boolean {
  return cells.slice(1).some((c) => c.trim() !== "");
}

/**
 * The current display cells for a grid-row fact — the edited cells when the row
 * is edited, otherwise the original parsed cells — padded to `colCount`.
 */
function currentCells(f: Fact, colCount: number): string[] {
  const source =
    f.decision === "edited" && f.editedText !== undefined
      ? f.editedText
      : f.text;
  const cells = splitCells(source);
  return Array.from({ length: colCount }, (_, i) => cells[i] ?? "");
}

/** Coerce a Fact into a persisted FactDecision (drop editedText when unused). */
function toFactDecision(f: Fact): FactDecision {
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

/**
 * A grid row is "settled" (folded into the confirmed count) when it is pending
 * and carries a value. Injected empty rows (identity min-keys awaiting input),
 * edited rows, and removed rows all still "need review" (story 020 review
 * totals) — this mirrors {@link isSettledFact} so the review/confirmed header
 * totals stay consistent across renderers.
 */
function isSettledGridRow(f: Fact): boolean {
  if (f.decision === "edited" || f.decision === "removed") return false;
  return rowHasValue(splitCells(f.editedText ?? f.text));
}

/**
 * Build the grid rows for one KV section (story 020 AC2/AC3/AC5): parse the
 * table, map each row to a Fact (`id` = field name for identity, row index
 * otherwise; `text` = cells joined by ` | `), inject any missing identity
 * min-keys as empty rows, then reconcile persisted decisions by `id`. Persisted
 * facts whose `id` matches no parsed/injected row are user-added rows and are
 * appended in order.
 */
function buildGridRows(
  heading: string,
  body: string,
  sectionStatus: FactStatus,
  persisted?: FactDecision[],
): { headers: string[]; rows: Fact[] } {
  const parsed = parseMarkdownTable(body);
  const isIdentity = heading === IDENTITY_HEADING;
  const headers =
    parsed.headers.length > 0
      ? parsed.headers
      : isIdentity
        ? ["Field", "Value"]
        : [];

  const base: Fact[] = parsed.rows.map((cells, i) => ({
    id: isIdentity ? cells[0] : String(i),
    text: cells.join(CELL_JOIN),
    status: sectionStatus,
    decision: "pending" as const,
  }));

  // AC3: inject any missing identity min-keys as empty rows (key cell filled,
  // value cell empty), appended in IDENTITY_MIN_KEYS order.
  if (isIdentity) {
    const present = new Set(parsed.rows.map((c) => c[0]));
    for (const key of IDENTITY_MIN_KEYS) {
      if (!present.has(key)) {
        base.push({
          id: key,
          text: [key, ...Array(Math.max(headers.length - 1, 1)).fill("")].join(
            CELL_JOIN,
          ),
          status: sectionStatus,
          decision: "pending" as const,
        });
      }
    }
  }

  // Reconcile persisted decisions by id; keep parsed text/status authoritative.
  const rows: Fact[] = base.map((f) => {
    const p = persisted?.find((x) => x.id === f.id);
    if (!p) return f;
    return {
      ...f,
      decision: p.decision,
      editedText: p.decision === "edited" ? p.editedText : undefined,
    };
  });

  // Persisted facts with no matching base row are user-added rows.
  const baseIds = new Set(base.map((f) => f.id));
  for (const p of persisted ?? []) {
    if (!baseIds.has(p.id)) rows.push({ ...p });
  }

  return { headers, rows };
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
  // Edit textarea is seeded with humanized plain text (story 019 AC3) so the
  // user never edits raw `**`/`*`/backtick markers.
  const [draft, setDraft] = useState(
    humanizeMarkdown(fact.editedText ?? fact.text),
  );

  const display = fact.editedText ?? fact.text;
  const accepted = fact.decision === "accepted";
  const edited = fact.decision === "edited";

  // Removed — struck-through with an Undo (AC3).
  if (fact.decision === "removed") {
    return (
      <div className="flex items-start justify-between gap-3 rounded-lg border border-border/70 bg-muted/30 px-3 py-2">
        <p className="min-w-0 text-sm leading-relaxed text-muted-foreground line-through">
          <InlineMarkdown text={fact.text} />
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
              setDraft(humanizeMarkdown(fact.editedText ?? fact.text));
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
        <p className="text-sm leading-relaxed text-foreground">
          <InlineMarkdown text={display} />
        </p>
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
            setDraft(humanizeMarkdown(fact.editedText ?? fact.text));
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
                      // Baseline is the humanized original (story 019): humanizing
                      // alone must not mark a fact edited — only a real user
                      // change relative to the humanized text counts.
                      text.trim() === humanizeMarkdown(f.text).trim()
                        ? "pending"
                        : "edited",
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
                        // AC7: compare against the humanized baseline so saving a
                        // marker-stripped fact unchanged (e.g. `**Project Atlas**`
                        // shown as `Project Atlas`) never falsely flags it edited.
                        text.trim() === humanizeMarkdown(f.text).trim()
                          ? "pending"
                          : "edited",
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

/* ----- ItemListCard (story 021) ----- */

/**
 * An unsaved "Add item" row (story 021 AC3). Renders an autofocused textarea
 * seeded empty, with Save (button or Enter) and Cancel (button or Escape). Save
 * commits the trimmed text as a new item; Cancel — or Save with only whitespace
 * — discards the row without persisting. Kept as its own component so each new
 * row owns its draft state and mounts with focus, whether opened by mouse or
 * keyboard.
 */
function NewItemRow({
  id,
  onSave,
  onCancel,
}: {
  id: string;
  onSave: (text: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState("");
  const commit = () => {
    if (draft.trim()) onSave(draft.trim());
    else onCancel();
  };
  return (
    <div className="space-y-2 rounded-lg border border-primary/40 bg-background px-3 py-2">
      <label htmlFor={id} className="sr-only">
        New item text
      </label>
      <textarea
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
        rows={2}
        autoFocus
        placeholder="Describe the item…"
        className="w-full resize-y rounded-md border border-border bg-card px-3 py-2 text-sm leading-relaxed text-foreground outline-none focus:ring-2 focus:ring-primary/40"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={commit}
          className={cn(
            "flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:brightness-110",
            FOCUS_RING,
          )}
        >
          <Check className="size-3.5" /> Save
        </button>
        <button
          type="button"
          onClick={onCancel}
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

/**
 * Card for one `'item-list'` ## section (story 021). Extends the story-013
 * fact-triage card: it wraps the same {@link FactRow} per item — Accept / inline
 * Edit / Remove with {@link StatusChip} chips — with needs-review items first and
 * confirmed items collapsed into an "N confirmed" disclosure, and every card
 * keeps the story-010 "Edit raw section" escape hatch. It adds an always-visible
 * "Add item" affordance (never gated on item status): activating it opens an
 * autofocused {@link NewItemRow}; saving persists the entry as a new `Fact`
 * (`decision: 'edited'`) that flows into the corrections handoff as a new bullet.
 * Item text renders through {@link InlineMarkdown}; edit fields seed from
 * {@link humanizeMarkdown} (via FactRow), so raw markers never appear.
 */
function ItemListCard({
  heading,
  sectionStatus,
  facts,
  rawBody,
  isRawEdited,
  hasChanges,
  onUpdateFact,
  onAddItem,
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
  onAddItem: (text: string) => void;
  onRawEdit: (body: string) => void;
  onResetRaw: () => void;
}) {
  // Open the raw-edit escape hatch by default for already raw-edited sections
  // (mirrors FactSectionCard / KvGridCard).
  const [rawOpen, setRawOpen] = useState(isRawEdited);

  // Locally-held unsaved "Add item" rows (AC3). Each becomes a persisted Fact
  // only once saved with content, so empty adds never leak to the handoff.
  const [newItems, setNewItems] = useState<string[]>([]);
  const newCounter = useRef(0);

  const reviewFacts = facts.filter((f) => !isSettledFact(f));
  const settledFacts = facts.filter(isSettledFact);
  const rawId = `raw-section-${heading.replace(/\W+/g, "-")}`;

  const addItem = () =>
    setNewItems((n) => [...n, `add-${newCounter.current++}`]);
  const dropNewItem = (tempId: string) =>
    setNewItems((n) => n.filter((t) => t !== tempId));

  // One FactRow per item — identical triage semantics to FactSectionCard,
  // including the story-019/020 AC7 humanized-baseline edited comparison.
  const renderRow = (f: Fact) => (
    <FactRow
      key={f.id}
      fact={f}
      onAccept={() =>
        onUpdateFact(f.id, f.decision === "accepted" ? "pending" : "accepted")
      }
      onEdit={(text) =>
        onUpdateFact(
          f.id,
          text.trim() === humanizeMarkdown(f.text).trim()
            ? "pending"
            : "edited",
          text,
        )
      }
      onRemove={() => onUpdateFact(f.id, "removed")}
      onUndoRemove={() => onUpdateFact(f.id, "pending")}
    />
  );

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
        /* Raw-section escape hatch (story 010, retained per AC6). */
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
            ← Discard raw edit &amp; return to the item list
          </button>
        </div>
      ) : (
        <>
          {reviewFacts.length > 0 ? (
            <div className="space-y-2">{reviewFacts.map(renderRow)}</div>
          ) : facts.length === 0 ? (
            newItems.length === 0 && (
              <p className="text-xs leading-relaxed text-muted-foreground">
                No items yet — use{" "}
                <strong className="text-foreground">Add item</strong> below to
                add the first one.
              </p>
            )
          ) : (
            <p className="text-xs text-muted-foreground">
              Every item in this section is confirmed — nothing needs your
              review.
            </p>
          )}

          {/* Unsaved, locally-added items (AC3) — always editable, autofocused. */}
          {newItems.length > 0 && (
            <div className="space-y-2">
              {newItems.map((tempId) => (
                <NewItemRow
                  key={tempId}
                  id={`${rawId}-${tempId}`}
                  onSave={(text) => {
                    onAddItem(text);
                    dropNewItem(tempId);
                  }}
                  onCancel={() => dropNewItem(tempId)}
                />
              ))}
            </div>
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
                {settledFacts.map(renderRow)}
              </div>
            </details>
          )}

          <div className="flex items-center justify-between gap-3">
            {/* AC3: Add item is unconditional — never gated on item settled-state. */}
            <button
              type="button"
              onClick={addItem}
              aria-label={`Add item to ${heading}`}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10",
                FOCUS_RING,
              )}
            >
              <Plus className="size-3.5" /> Add item
            </button>
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
          </div>
        </>
      )}
    </div>
  );
}

/* ----- KvGridCard (story 020) ----- */

/**
 * Renders a KV / table profile section as an editable HTML grid (story 020) —
 * never raw markdown, never a visible pipe. Column headers come from the parsed
 * table; each row supports in-place edit (an input per cell), removal (with a
 * struck-through Undo), and an "Add row" affordance. Display cells pass through
 * {@link InlineMarkdown}; every edit field is seeded with
 * {@link humanizeMarkdown} so the user never edits raw markers (AC4). Grid rows
 * map 1:1 to the section's `Fact` decisions in the parent, so edits/adds/removes
 * flow through the existing corrections handoff unchanged (AC5/AC6). The
 * per-section raw-edit escape hatch (story 010) is retained.
 */
function KvGridCard({
  heading,
  sectionStatus,
  headers,
  rows,
  rawBody,
  isRawEdited,
  hasChanges,
  onCommitRow,
  onRemoveRow,
  onUndoRow,
  onAddRow,
  onRawEdit,
  onResetRaw,
}: {
  heading: string;
  sectionStatus: FactStatus;
  headers: string[];
  rows: Fact[];
  rawBody: string;
  isRawEdited: boolean;
  hasChanges: boolean;
  onCommitRow: (id: string, cells: string[]) => void;
  onRemoveRow: (id: string) => void;
  onUndoRow: (id: string) => void;
  onAddRow: (cells: string[]) => void;
  onRawEdit: (body: string) => void;
  onResetRaw: () => void;
}) {
  const colCount = Math.max(headers.length, 1);
  const [rawOpen, setRawOpen] = useState(isRawEdited);
  const gridId = `kv-${heading.replace(/\W+/g, "-")}`;

  // Ephemeral drafts for rows being edited in-place: id → humanized cell values
  // (AC4). Seeded on mount for injected empty rows so identity min-keys open in
  // edit mode by default (AC3).
  const [editing, setEditing] = useState<Record<string, string[]>>(() => {
    const init: Record<string, string[]> = {};
    for (const r of rows) {
      const cells = currentCells(r, colCount);
      if (r.decision === "pending" && !rowHasValue(cells)) {
        init[r.id] = cells.map((c) => humanizeMarkdown(c));
      }
    }
    return init;
  });

  // Locally-added rows that have not yet been persisted (AC4b) — they become
  // real facts only once saved with content, so empty adds never leak to the
  // handoff.
  const [newRows, setNewRows] = useState<
    Array<{ tempId: string; cells: string[] }>
  >([]);
  const newCounter = useRef(0);

  const rowKeyOf = (r: Fact) => {
    const first = currentCells(r, colCount)[0]?.trim();
    return first && first.length > 0 ? first : "this";
  };

  const startEdit = (r: Fact) =>
    setEditing((e) => ({
      ...e,
      [r.id]: currentCells(r, colCount).map((c) => humanizeMarkdown(c)),
    }));
  const cancelEdit = (id: string) =>
    setEditing((e) => {
      const n = { ...e };
      delete n[id];
      return n;
    });
  const changeEditCell = (id: string, i: number, value: string) =>
    setEditing((e) => {
      const cells = [...(e[id] ?? Array.from({ length: colCount }, () => ""))];
      cells[i] = value;
      return { ...e, [id]: cells };
    });
  const saveEdit = (id: string) => {
    onCommitRow(id, editing[id] ?? []);
    cancelEdit(id);
  };

  const addRow = () => {
    const tempId = `new-${newCounter.current++}`;
    setNewRows((n) => [
      ...n,
      { tempId, cells: Array.from({ length: colCount }, () => "") },
    ]);
  };
  const changeNewCell = (tempId: string, i: number, value: string) =>
    setNewRows((n) =>
      n.map((r) =>
        r.tempId === tempId
          ? { ...r, cells: r.cells.map((c, ci) => (ci === i ? value : c)) }
          : r,
      ),
    );
  const cancelNew = (tempId: string) =>
    setNewRows((n) => n.filter((r) => r.tempId !== tempId));
  const saveNew = (tempId: string) => {
    const row = newRows.find((r) => r.tempId === tempId);
    if (row && rowHasValue(row.cells)) onAddRow(row.cells);
    cancelNew(tempId);
  };

  const cellKeyDown = (
    e: React.KeyboardEvent,
    i: number,
    onEnter: () => void,
    onEscape: () => void,
  ) => {
    if (e.key === "Enter" && i === colCount - 1) {
      e.preventDefault();
      onEnter();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onEscape();
    }
  };

  const iconBtn =
    "flex size-8 items-center justify-center rounded-md text-muted-foreground";

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4 space-y-3 transition",
        hasChanges ? "border-primary/50" : "border-border",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold leading-snug text-foreground">
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
        /* Raw-section escape hatch (story 010, retained per AC8). */
        <div className="space-y-2">
          <label htmlFor={`${gridId}-raw`} className="sr-only">
            Raw section body for {heading}
          </label>
          <textarea
            id={`${gridId}-raw`}
            value={rawBody}
            onChange={(e) => onRawEdit(e.target.value)}
            rows={8}
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
            ← Discard raw edit &amp; return to the grid
          </button>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border/70">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">{heading}</caption>
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {Array.from({ length: colCount }, (_, i) => (
                    <th
                      key={i}
                      scope="col"
                      className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      {headers[i] ?? ""}
                    </th>
                  ))}
                  <th scope="col" className="px-3 py-2 text-right">
                    <span className="sr-only">Row actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const rowKey = rowKeyOf(r);
                  const draft = editing[r.id];

                  // Removed — struck-through with an Undo (AC4c).
                  if (r.decision === "removed") {
                    const cells = currentCells(r, colCount);
                    return (
                      <tr
                        key={r.id}
                        className="border-b border-border/60 bg-muted/20 last:border-0"
                      >
                        {cells.map((c, i) => (
                          <td
                            key={i}
                            className="px-3 py-2 align-top text-muted-foreground line-through"
                          >
                            <InlineMarkdown text={c} />
                          </td>
                        ))}
                        <td className="px-3 py-2 text-right align-top">
                          <button
                            type="button"
                            onClick={() => onUndoRow(r.id)}
                            aria-label={`Undo removal of ${rowKey} row`}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10",
                              FOCUS_RING,
                            )}
                          >
                            <RotateCcw className="size-3.5" /> Undo
                          </button>
                        </td>
                      </tr>
                    );
                  }

                  // In-place edit — an input per cell (AC4a).
                  if (draft) {
                    return (
                      <tr
                        key={r.id}
                        className="border-b border-border/60 bg-background last:border-0"
                      >
                        {Array.from({ length: colCount }, (_, i) => (
                          <td key={i} className="px-2 py-1.5 align-top">
                            <label
                              htmlFor={`${gridId}-${r.id}-${i}`}
                              className="sr-only"
                            >
                              {headers[i] ?? `Column ${i + 1}`} for {rowKey} row
                            </label>
                            <input
                              id={`${gridId}-${r.id}-${i}`}
                              type="text"
                              value={draft[i] ?? ""}
                              onChange={(e) =>
                                changeEditCell(r.id, i, e.target.value)
                              }
                              onKeyDown={(e) =>
                                cellKeyDown(
                                  e,
                                  i,
                                  () => saveEdit(r.id),
                                  () => cancelEdit(r.id),
                                )
                              }
                              aria-label={`${headers[i] ?? `Column ${i + 1}`} for ${rowKey} row`}
                              autoFocus={i === 0}
                              className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/40"
                            />
                          </td>
                        ))}
                        <td className="whitespace-nowrap px-2 py-1.5 text-right align-top">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => saveEdit(r.id)}
                              aria-label={`Save ${rowKey} row`}
                              className={cn(
                                iconBtn,
                                "hover:bg-fresh/10 hover:text-fresh",
                                FOCUS_RING,
                              )}
                            >
                              <Check className="size-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => cancelEdit(r.id)}
                              aria-label={`Cancel editing ${rowKey} row`}
                              className={cn(
                                iconBtn,
                                "hover:bg-muted hover:text-foreground",
                                FOCUS_RING,
                              )}
                            >
                              <X className="size-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  // Display row (AC1) — cells via InlineMarkdown, no pipes.
                  const cells = currentCells(r, colCount);
                  return (
                    <tr
                      key={r.id}
                      className={cn(
                        "border-b border-border/60 last:border-0",
                        r.decision === "edited" && "bg-primary/5",
                      )}
                    >
                      {cells.map((c, i) => (
                        <td
                          key={i}
                          className="px-3 py-2 align-top text-foreground"
                        >
                          {c.trim() ? (
                            <InlineMarkdown text={c} />
                          ) : (
                            <span className="italic text-muted-foreground">
                              Not set
                            </span>
                          )}
                        </td>
                      ))}
                      <td className="whitespace-nowrap px-3 py-2 text-right align-top">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => startEdit(r)}
                            aria-label={`Edit ${rowKey} row`}
                            title="Edit"
                            className={cn(
                              iconBtn,
                              "hover:bg-primary/10 hover:text-primary",
                              FOCUS_RING,
                            )}
                          >
                            <Pencil className="size-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onRemoveRow(r.id)}
                            aria-label={`Remove ${rowKey} row`}
                            title="Remove"
                            className={cn(
                              iconBtn,
                              "hover:bg-destructive/10 hover:text-destructive",
                              FOCUS_RING,
                            )}
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {/* Unsaved, locally-added rows (AC4b) — always editable. */}
                {newRows.map((nr) => (
                  <tr
                    key={nr.tempId}
                    className="border-b border-border/60 bg-background last:border-0"
                  >
                    {Array.from({ length: colCount }, (_, i) => (
                      <td key={i} className="px-2 py-1.5 align-top">
                        <label
                          htmlFor={`${gridId}-${nr.tempId}-${i}`}
                          className="sr-only"
                        >
                          {headers[i] ?? `Column ${i + 1}`} for new row
                        </label>
                        <input
                          id={`${gridId}-${nr.tempId}-${i}`}
                          type="text"
                          value={nr.cells[i] ?? ""}
                          onChange={(e) =>
                            changeNewCell(nr.tempId, i, e.target.value)
                          }
                          onKeyDown={(e) =>
                            cellKeyDown(
                              e,
                              i,
                              () => saveNew(nr.tempId),
                              () => cancelNew(nr.tempId),
                            )
                          }
                          aria-label={`${headers[i] ?? `Column ${i + 1}`} for new row`}
                          placeholder={headers[i] ?? ""}
                          autoFocus={i === 0}
                          className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/40"
                        />
                      </td>
                    ))}
                    <td className="whitespace-nowrap px-2 py-1.5 text-right align-top">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => saveNew(nr.tempId)}
                          aria-label="Save new row"
                          className={cn(
                            iconBtn,
                            "hover:bg-fresh/10 hover:text-fresh",
                            FOCUS_RING,
                          )}
                        >
                          <Check className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => cancelNew(nr.tempId)}
                          aria-label="Cancel new row"
                          className={cn(
                            iconBtn,
                            "hover:bg-muted hover:text-foreground",
                            FOCUS_RING,
                          )}
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={addRow}
              aria-label="Add row"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10",
                FOCUS_RING,
              )}
            >
              <Plus className="size-3.5" /> Add row
            </button>
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
          </div>
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
  // Story 022: taxonomy for the Business-area cascading picker.
  const [taxonomy, setTaxonomy] = useState<Taxonomy | null>(null);

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

  // Story 022: load taxonomy on mount for the Business-area picker.
  useEffect(() => {
    void readTaxonomy().then(setTaxonomy);
  }, []);

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
    // Story 019 AC2: every section is routed through selectRenderer.
    const renderer = selectRenderer(section.heading, section.body);
    const saved = answers.editedSections[section.heading];
    // Story 021: item-list sections parse per item (bullets via parseFacts, a
    // bullet-less overridden body via parseLineItems) and reconcile so user-added
    // items survive; every other renderer keeps the story-013 fact parser.
    const isItemList = renderer === "item-list";
    const parsed = isItemList
      ? parseItemFacts(section.body)
      : parseFacts(section.body);
    const facts = isItemList
      ? reconcileItemFacts(parsed, saved?.facts)
      : reconcileFacts(parsed, saved?.facts);
    const sectionStatus = detectStatus(section.body);
    // Raw-section escape hatch is also seeded with humanized plain text (story
    // 019 AC3) so it never shows raw markers; a persisted edit wins over the seed.
    const rawBody = saved?.body ?? humanizeMarkdown(section.body);
    const isRawEdited = saved?.edited ?? false;
    const hasChanges = saved ? sectionHasChanges(saved) : false;

    // Story 020: KV / table sections are now interactively reviewable, so build
    // their grid rows and fold them into the same review/confirmed totals as the
    // fact-triage card.
    const isKvGrid = renderer === "kv-grid";
    const grid = isKvGrid
      ? buildGridRows(
          section.heading,
          section.body,
          sectionStatus,
          saved?.facts,
        )
      : null;
    const usesFactCard = renderer === "item-list" || renderer === "prose-card";
    const isTaxonomyPicker = renderer === "taxonomy-picker";

    // Story 022: taxonomy-picker reviewCount: 0 once a full three-level
    // selection exists (BA + Portfolio + Squad joined with ' > '), 1 otherwise.
    const taxonomySettled = (() => {
      if (!isTaxonomyPicker) return false;
      const baFact = saved?.facts?.find(
        (f) => f.id === "business-area-selection",
      );
      const parts = (baFact?.editedText ?? "")
        .split(" > ")
        .filter((p) => p.trim());
      return parts.length >= 3;
    })();

    const reviewCount = usesFactCard
      ? facts.filter((f) => !isSettledFact(f)).length
      : grid
        ? grid.rows.filter((r) => !isSettledGridRow(r)).length
        : isTaxonomyPicker
          ? taxonomySettled
            ? 0
            : 1
          : 0;

    // Sections rendered via the fact-triage card, the KV grid, OR the
    // taxonomy-picker contribute to the review/confirmed header totals.
    // Suppressed sections are never rendered and never counted.
    if (!isRawEdited) {
      if (usesFactCard) {
        totalReview += reviewCount;
        totalSettled += facts.length - reviewCount;
      } else if (grid) {
        totalReview += reviewCount;
        totalSettled += grid.rows.length - reviewCount;
      } else if (isTaxonomyPicker) {
        totalReview += reviewCount;
        totalSettled += taxonomySettled ? 1 : 0;
      }
    }

    return {
      section,
      renderer,
      facts,
      grid,
      rawBody,
      isRawEdited,
      hasChanges,
      reviewCount,
      sectionStatus,
    };
  });

  // Story 019 AC2: a 'suppressed' section renders no card at all — drop it here
  // (its unconditional removal is handled in the corrections handoff, story 023).
  // AC3: sort sections that need attention (review facts or a raw edit) first.
  const ordered = [...sectionData]
    .filter((d) => d.renderer !== "suppressed")
    .sort(
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

      {ordered.map((d) => {
        // Story 020: KV / table sections render the interactive KvGridCard. Its
        // rows map to the section's Fact decisions, so edits/adds/removes flow
        // through the existing corrections handoff with no special-casing.
        if (d.renderer === "kv-grid" && d.grid) {
          const grid = d.grid;
          const isIdentity = d.section.heading === IDENTITY_HEADING;
          const persist = (nextFacts: FactDecision[]) =>
            writeSection(d.section.heading, {
              body: d.rawBody,
              edited: d.isRawEdited,
              facts: nextFacts,
            });
          return (
            <KvGridCard
              key={d.section.heading}
              heading={d.section.heading}
              sectionStatus={d.sectionStatus}
              headers={grid.headers}
              rows={grid.rows}
              rawBody={d.rawBody}
              isRawEdited={d.isRawEdited}
              hasChanges={d.hasChanges}
              onCommitRow={(id, cells) => {
                const trimmed = cells.map((c) => c.trim());
                const newJoined = trimmed.join(CELL_JOIN);
                persist(
                  grid.rows.map((r) => {
                    if (r.id !== id) return toFactDecision(r);
                    // Baseline is the humanized original (story 019/AC7): saving
                    // marker-stripped cells unchanged, or leaving all value cells
                    // empty, must not mark the row edited.
                    const originalHumanized = splitCells(r.text)
                      .map((c) => humanizeMarkdown(c).trim())
                      .join(CELL_JOIN);
                    if (
                      !rowHasValue(trimmed) ||
                      newJoined === originalHumanized
                    ) {
                      return {
                        id: r.id,
                        text: r.text,
                        status: r.status,
                        decision: "pending" as const,
                      };
                    }
                    return {
                      id: r.id,
                      text: r.text,
                      status: r.status,
                      decision: "edited" as const,
                      editedText: newJoined,
                    };
                  }),
                );
              }}
              onRemoveRow={(id) => {
                const target = grid.rows.find((r) => r.id === id);
                // A real parsed row (original value present) is marked removed so
                // the handoff emits its `- **Removed:** …` bullet. An injected or
                // added empty row is simply dropped (nothing to remove upstream).
                const originalHasValue = target
                  ? rowHasValue(splitCells(target.text))
                  : false;
                persist(
                  originalHasValue
                    ? grid.rows.map((r) =>
                        r.id === id
                          ? {
                              id: r.id,
                              text: r.text,
                              status: r.status,
                              decision: "removed" as const,
                            }
                          : toFactDecision(r),
                      )
                    : grid.rows.filter((r) => r.id !== id).map(toFactDecision),
                );
              }}
              onUndoRow={(id) =>
                persist(
                  grid.rows.map((r) =>
                    r.id === id
                      ? {
                          id: r.id,
                          text: r.text,
                          status: r.status,
                          decision: "pending" as const,
                        }
                      : toFactDecision(r),
                  ),
                )
              }
              onAddRow={(cells) => {
                const trimmed = cells.map((c) => c.trim());
                const joined = trimmed.join(CELL_JOIN);
                const id =
                  isIdentity && trimmed[0]
                    ? trimmed[0]
                    : String(grid.rows.length);
                const added: FactDecision = {
                  id,
                  text: "",
                  status: d.sectionStatus,
                  decision: "edited",
                  editedText: joined,
                };
                persist([...grid.rows.map(toFactDecision), added]);
              }}
              onRawEdit={(newBody) =>
                writeSection(d.section.heading, {
                  body: newBody,
                  edited:
                    newBody.trim() !== humanizeMarkdown(d.section.body).trim(),
                  facts: answers.editedSections[d.section.heading]?.facts,
                })
              }
              onResetRaw={() =>
                writeSection(d.section.heading, {
                  body: humanizeMarkdown(d.section.body),
                  edited: false,
                  facts: answers.editedSections[d.section.heading]?.facts,
                })
              }
            />
          );
        }
        // Story 022: taxonomy-picker renders the TaxonomyPickerCard — three
        // cascading comboboxes (BA → Portfolio → Squad) with free-entry Add.
        if (d.renderer === "taxonomy-picker") {
          return (
            <TaxonomyPickerCard
              key={d.section.heading}
              heading={d.section.heading}
              sectionStatus={d.sectionStatus}
              taxonomy={taxonomy}
              savedFacts={answers.editedSections[d.section.heading]?.facts}
              onSelectionChange={(editedText) => {
                const newFact: FactDecision = {
                  id: "business-area-selection",
                  text: "",
                  status: d.sectionStatus,
                  decision: "edited",
                  editedText,
                };
                writeSection(d.section.heading, {
                  body: d.rawBody,
                  edited: d.isRawEdited,
                  facts: [newFact],
                });
              }}
              onTaxonomyChange={setTaxonomy}
            />
          );
        }
        // Story 021: item-list sections render the interactive ItemListCard. Its
        // rows map to the section's Fact decisions (same as FactSectionCard), and
        // the "Add item" affordance appends a new edited Fact that flows through
        // the existing corrections handoff as a new bullet — no builder change.
        if (d.renderer === "item-list") {
          const persist = (nextFacts: FactDecision[]) =>
            writeSection(d.section.heading, {
              body: d.rawBody,
              edited: d.isRawEdited,
              facts: nextFacts,
            });
          return (
            <ItemListCard
              key={d.section.heading}
              heading={d.section.heading}
              sectionStatus={d.sectionStatus}
              facts={d.facts}
              rawBody={d.rawBody}
              isRawEdited={d.isRawEdited}
              hasChanges={d.hasChanges}
              onUpdateFact={(id, decision, editedText) => {
                const target = d.facts.find((f) => f.id === id);
                // Removing a user-added item (no upstream text in profile.md)
                // drops it entirely — there is nothing to mark **Removed:** —
                // mirroring the KV grid's empty-row removal (story 020).
                if (
                  decision === "removed" &&
                  target &&
                  target.text.trim() === ""
                ) {
                  persist(
                    d.facts.filter((f) => f.id !== id).map(toFactDecision),
                  );
                  return;
                }
                updateFact(
                  d.section.heading,
                  d.facts,
                  d.rawBody,
                  d.isRawEdited,
                  id,
                  decision,
                  editedText,
                );
              }}
              onAddItem={(text) => {
                // A new item is an edited Fact with generated id + empty original
                // text, so buildProfileCorrectionsMarkdown emits `- <new text>`.
                const added: FactDecision = {
                  id: `new-${Date.now()}`,
                  text: "",
                  status: d.sectionStatus,
                  decision: "edited",
                  editedText: text.trim(),
                };
                persist([...d.facts.map(toFactDecision), added]);
              }}
              onRawEdit={(newBody) =>
                writeSection(d.section.heading, {
                  body: newBody,
                  edited:
                    newBody.trim() !== humanizeMarkdown(d.section.body).trim(),
                  facts: answers.editedSections[d.section.heading]?.facts,
                })
              }
              onResetRaw={() =>
                writeSection(d.section.heading, {
                  body: humanizeMarkdown(d.section.body),
                  edited: false,
                  facts: answers.editedSections[d.section.heading]?.facts,
                })
              }
            />
          );
        }
        return (
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
                // Compare against the humanized baseline (story 019): stripping
                // markers alone must not mark the section edited — only a real
                // change relative to the humanized seed does.
                edited:
                  newBody.trim() !== humanizeMarkdown(d.section.body).trim(),
                facts: answers.editedSections[d.section.heading]?.facts,
              })
            }
            onResetRaw={() =>
              writeSection(d.section.heading, {
                body: humanizeMarkdown(d.section.body),
                edited: false,
                facts: answers.editedSections[d.section.heading]?.facts,
              })
            }
          />
        );
      })}

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

/* ----- TaxonomyPickerCard (story 022) ----- */

/**
 * TaxonomyPickerCard — Business-area cascading picker for the phase-4 review.
 *
 * Three-level comboboxes: Business Area → Portfolio → Squad.  Level 2 and 3
 * are disabled when their parent is unset.  Each level has a free-entry "Add"
 * option (KeyToolsCombobox pattern) that calls writeTaxonomy immediately and
 * then selects the new entry.  The chosen triple persists as a single Fact
 * { id: 'business-area-selection', decision: 'edited', editedText: 'BA > P > S' }
 * via the `onSelectionChange` callback — no special-casing in the handoff builder.
 *
 * Reload restores state: `savedFacts` seeds the initial selection from
 * `answers.editedSections['Business area']?.facts`.
 *
 * a11y: each control carries an `aria-label` naming its role; levels 2/3 carry
 * `aria-disabled='true'` / `disabled` when their parent is unset; all controls
 * are Tab-reachable with a visible FOCUS_RING.
 */
function TaxonomyPickerCard({
  heading,
  sectionStatus,
  taxonomy,
  savedFacts,
  onSelectionChange,
  onTaxonomyChange,
}: {
  heading: string;
  sectionStatus: FactStatus;
  taxonomy: Taxonomy | null;
  savedFacts?: FactDecision[];
  onSelectionChange: (editedText: string) => void;
  onTaxonomyChange: (t: Taxonomy) => void;
}) {
  // Derive initial selection from the persisted 'business-area-selection' fact.
  const savedFact = savedFacts?.find((f) => f.id === "business-area-selection");
  const savedParts = (savedFact?.editedText ?? "")
    .split(" > ")
    .map((p) => p.trim());

  const [selectedBA, setSelectedBA] = useState(savedParts[0] ?? "");
  const [selectedPortfolio, setSelectedPortfolio] = useState(
    savedParts[1] ?? "",
  );
  const [selectedSquad, setSelectedSquad] = useState(savedParts[2] ?? "");

  const [baOpen, setBAOpen] = useState(false);
  const [baQuery, setBAQuery] = useState("");
  const [portfolioOpen, setPortfolioOpen] = useState(false);
  const [portfolioQuery, setPortfolioQuery] = useState("");
  const [squadOpen, setSquadOpen] = useState(false);
  const [squadQuery, setSquadQuery] = useState("");

  const areas = taxonomy?.businessAreas ?? [];
  const currentArea = areas.find((a) => a.name === selectedBA);
  const portfolios = currentArea?.portfolios ?? [];
  const currentPortfolio = portfolios.find((p) => p.name === selectedPortfolio);
  const squads = currentPortfolio?.squads ?? [];

  /** Emit selection string — partial selections drop trailing levels (AC5). */
  const emitSelection = (ba: string, portfolio: string, squad: string) => {
    const parts = [ba, portfolio, squad].filter(Boolean);
    onSelectionChange(parts.join(" > "));
  };

  // --- Level 1: Business Area ---

  const commitBA = (name: string) => {
    setSelectedBA(name);
    setSelectedPortfolio("");
    setSelectedSquad("");
    emitSelection(name, "", "");
    setBAOpen(false);
    setBAQuery("");
  };

  const addNewBA = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const newArea = { name: trimmed, portfolios: [] };
    const next: Taxonomy = { businessAreas: [...areas, newArea] };
    try {
      await writeTaxonomy({ data: next });
      onTaxonomyChange(next);
    } catch {
      /* persist failure — still select the new entry in UI */
    }
    commitBA(trimmed);
  };

  // --- Level 2: Portfolio ---

  const commitPortfolio = (name: string) => {
    setSelectedPortfolio(name);
    setSelectedSquad("");
    emitSelection(selectedBA, name, "");
    setPortfolioOpen(false);
    setPortfolioQuery("");
  };

  const addNewPortfolio = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || !currentArea) return;
    const newPortfolio = { name: trimmed, squads: [] };
    const newArea = {
      ...currentArea,
      portfolios: [...currentArea.portfolios, newPortfolio],
    };
    const next: Taxonomy = {
      businessAreas: areas.map((a) => (a.name === selectedBA ? newArea : a)),
    };
    try {
      await writeTaxonomy({ data: next });
      onTaxonomyChange(next);
    } catch {
      /* persist failure — still select in UI */
    }
    commitPortfolio(trimmed);
  };

  // --- Level 3: Squad ---

  const commitSquad = (name: string) => {
    setSelectedSquad(name);
    emitSelection(selectedBA, selectedPortfolio, name);
    setSquadOpen(false);
    setSquadQuery("");
  };

  const addNewSquad = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || !currentArea || !currentPortfolio) return;
    const newPortfolio = {
      ...currentPortfolio,
      squads: [...currentPortfolio.squads, trimmed],
    };
    const newArea = {
      ...currentArea,
      portfolios: currentArea.portfolios.map((p) =>
        p.name === selectedPortfolio ? newPortfolio : p,
      ),
    };
    const next: Taxonomy = {
      businessAreas: areas.map((a) => (a.name === selectedBA ? newArea : a)),
    };
    try {
      await writeTaxonomy({ data: next });
      onTaxonomyChange(next);
    } catch {
      /* persist failure — still select in UI */
    }
    commitSquad(trimmed);
  };

  const showBACreate =
    baQuery.trim().length > 0 &&
    !areas.some((a) => a.name.toLowerCase() === baQuery.trim().toLowerCase());
  const showPortfolioCreate =
    portfolioQuery.trim().length > 0 &&
    !portfolios.some(
      (p) => p.name.toLowerCase() === portfolioQuery.trim().toLowerCase(),
    );
  const showSquadCreate =
    squadQuery.trim().length > 0 &&
    !squads.some((s) => s.toLowerCase() === squadQuery.trim().toLowerCase());

  // Current selection breadcrumb (shown when at least one level is selected).
  const breadcrumb = [selectedBA, selectedPortfolio, selectedSquad]
    .filter(Boolean)
    .join(" › ");

  return (
    <div
      data-renderer="taxonomy-picker"
      data-section={heading}
      className="rounded-xl border border-border bg-card p-4 space-y-4"
    >
      {/* Card header */}
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold leading-snug text-foreground">
          {heading}
        </h3>
        <StatusChip status={sectionStatus} />
      </div>

      {/* Breadcrumb: shows the current selection compactly */}
      {breadcrumb && (
        <p className="font-mono text-xs text-primary" aria-live="polite">
          {breadcrumb}
        </p>
      )}

      {taxonomy === null ? (
        <p className="text-xs text-muted-foreground">Loading taxonomy…</p>
      ) : (
        <div className="space-y-3">
          {/* Level 1 — Business Area */}
          <div className="space-y-1.5">
            <label
              htmlFor="ba-picker"
              className="text-xs font-medium text-muted-foreground"
            >
              Business area
            </label>
            <Popover open={baOpen} onOpenChange={setBAOpen}>
              <PopoverTrigger asChild>
                <button
                  id="ba-picker"
                  type="button"
                  role="combobox"
                  aria-expanded={baOpen}
                  aria-label="Business area"
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-base outline-none focus:ring-2 focus:ring-primary/40 focus-visible:ring-2 focus-visible:ring-primary/40",
                    FOCUS_RING,
                  )}
                >
                  <span className={cn(!selectedBA && "text-muted-foreground")}>
                    {selectedBA || "Select a business area…"}
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
                    placeholder="Search or add a business area…"
                    value={baQuery}
                    onValueChange={setBAQuery}
                    aria-label="Search business areas"
                  />
                  <CommandList>
                    <CommandEmpty>
                      {baQuery.trim()
                        ? "Press Enter to add."
                        : "No areas found."}
                    </CommandEmpty>
                    <CommandGroup>
                      {areas.map((a) => (
                        <CommandItem
                          key={a.name}
                          value={a.name}
                          onSelect={() => commitBA(a.name)}
                        >
                          <Check
                            className={cn(
                              "size-4",
                              selectedBA === a.name
                                ? "opacity-100"
                                : "opacity-0",
                            )}
                          />
                          {a.name}
                        </CommandItem>
                      ))}
                      {showBACreate && (
                        <CommandItem
                          value={baQuery.trim()}
                          onSelect={() => void addNewBA(baQuery.trim())}
                          aria-label={`Add business area "${baQuery.trim()}"`}
                        >
                          <Plus className="size-4" /> Add &ldquo;
                          {baQuery.trim()}&rdquo;
                        </CommandItem>
                      )}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Level 2 — Portfolio */}
          <div className="space-y-1.5">
            <label
              htmlFor="portfolio-picker"
              className="text-xs font-medium text-muted-foreground"
            >
              Portfolio
            </label>
            <Popover
              open={portfolioOpen}
              onOpenChange={(v) => {
                if (selectedBA) setPortfolioOpen(v);
              }}
            >
              <PopoverTrigger asChild>
                <button
                  id="portfolio-picker"
                  type="button"
                  role="combobox"
                  aria-expanded={portfolioOpen}
                  aria-label="Portfolio"
                  aria-disabled={!selectedBA || undefined}
                  disabled={!selectedBA}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-base outline-none focus:ring-2 focus:ring-primary/40 focus-visible:ring-2 focus-visible:ring-primary/40",
                    FOCUS_RING,
                    !selectedBA && "cursor-not-allowed opacity-50",
                  )}
                >
                  <span
                    className={cn(
                      !selectedPortfolio && "text-muted-foreground",
                    )}
                  >
                    {selectedPortfolio ||
                      (selectedBA
                        ? "Select a portfolio…"
                        : "Select a business area first")}
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
                    placeholder="Search or add a portfolio…"
                    value={portfolioQuery}
                    onValueChange={setPortfolioQuery}
                    aria-label="Search portfolios"
                  />
                  <CommandList>
                    <CommandEmpty>
                      {portfolioQuery.trim()
                        ? "Press Enter to add."
                        : "No portfolios found."}
                    </CommandEmpty>
                    <CommandGroup>
                      {portfolios.map((p) => (
                        <CommandItem
                          key={p.name}
                          value={p.name}
                          onSelect={() => commitPortfolio(p.name)}
                        >
                          <Check
                            className={cn(
                              "size-4",
                              selectedPortfolio === p.name
                                ? "opacity-100"
                                : "opacity-0",
                            )}
                          />
                          {p.name}
                        </CommandItem>
                      ))}
                      {showPortfolioCreate && (
                        <CommandItem
                          value={portfolioQuery.trim()}
                          onSelect={() =>
                            void addNewPortfolio(portfolioQuery.trim())
                          }
                          aria-label={`Add portfolio "${portfolioQuery.trim()}"`}
                        >
                          <Plus className="size-4" /> Add &ldquo;
                          {portfolioQuery.trim()}&rdquo;
                        </CommandItem>
                      )}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Level 3 — Squad */}
          <div className="space-y-1.5">
            <label
              htmlFor="squad-picker"
              className="text-xs font-medium text-muted-foreground"
            >
              Squad
            </label>
            <Popover
              open={squadOpen}
              onOpenChange={(v) => {
                if (selectedPortfolio) setSquadOpen(v);
              }}
            >
              <PopoverTrigger asChild>
                <button
                  id="squad-picker"
                  type="button"
                  role="combobox"
                  aria-expanded={squadOpen}
                  aria-label="Squad"
                  aria-disabled={!selectedPortfolio || undefined}
                  disabled={!selectedPortfolio}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-base outline-none focus:ring-2 focus:ring-primary/40 focus-visible:ring-2 focus-visible:ring-primary/40",
                    FOCUS_RING,
                    !selectedPortfolio && "cursor-not-allowed opacity-50",
                  )}
                >
                  <span
                    className={cn(!selectedSquad && "text-muted-foreground")}
                  >
                    {selectedSquad ||
                      (selectedPortfolio
                        ? "Select a squad…"
                        : "Select a portfolio first")}
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
                    placeholder="Search or add a squad…"
                    value={squadQuery}
                    onValueChange={setSquadQuery}
                    aria-label="Search squads"
                  />
                  <CommandList>
                    <CommandEmpty>
                      {squadQuery.trim()
                        ? "Press Enter to add."
                        : "No squads found."}
                    </CommandEmpty>
                    <CommandGroup>
                      {squads.map((s) => (
                        <CommandItem
                          key={s}
                          value={s}
                          onSelect={() => commitSquad(s)}
                        >
                          <Check
                            className={cn(
                              "size-4",
                              selectedSquad === s ? "opacity-100" : "opacity-0",
                            )}
                          />
                          {s}
                        </CommandItem>
                      ))}
                      {showSquadCreate && (
                        <CommandItem
                          value={squadQuery.trim()}
                          onSelect={() => void addNewSquad(squadQuery.trim())}
                          aria-label={`Add squad "${squadQuery.trim()}"`}
                        >
                          <Plus className="size-4" /> Add &ldquo;
                          {squadQuery.trim()}&rdquo;
                        </CommandItem>
                      )}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      )}
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
          aria-label="Your role"
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
            aria-label="Key tools"
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

  // Story 015: observed handshake state — local to this component, not persisted.
  const [handshakeDetected, setHandshakeDetected] = useState(false);
  const [verifiedAt, setVerifiedAt] = useState<string | null>(null);
  const [handshakeAssistant, setHandshakeAssistant] = useState<string | null>(
    null,
  );

  // Story 015 AC3: poll checkHandshake every 5 s while phase 2 is active and
  // handshake has not yet been detected — mirrors the PhaseSeeding poll for
  // checkProfileExists. Clear interval on detection or unmount.
  useEffect(() => {
    if (handshakeDetected) return;
    const id = setInterval(() => {
      void checkHandshake().then(({ detected, verifiedAt: vAt, assistant }) => {
        if (detected) {
          setHandshakeDetected(true);
          setVerifiedAt(vAt);
          setHandshakeAssistant(assistant);
          // Auto-set testedPaste persisted state so phase confirm is unblocked.
          set("checks", { ...answers.checks, testedPaste: true });
        }
      });
    }, 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handshakeDetected]);

  // Story 015: also run an immediate check on mount so a pre-existing handshake
  // file is detected without waiting for the first 5 s tick (existence-only
  // staleness rule — a handshake from a prior session still counts).
  useEffect(() => {
    void checkHandshake().then(({ detected, verifiedAt: vAt, assistant }) => {
      if (detected) {
        setHandshakeDetected(true);
        setVerifiedAt(vAt);
        setHandshakeAssistant(assistant);
        set("checks", { ...answers.checks, testedPaste: true });
      }
    });
    // Run once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // §4.4 pinned wording (story 015 / ADR-P6-008) — copy VERBATIM from
  // docs/specs/file-contracts.md §4.4. Must not be edited without a contract
  // change. The file path docs/data/local/handshake.json must appear verbatim
  // (AC1).
  const verificationPrompt =
    'Confirm you can read my constitution and context/active.md — tell me my #1 priority. Then write docs/data/local/handshake.json with this exact shape: { "verifiedAt": "<the current time as an ISO 8601 timestamp>", "assistant": "<your assistant name>" }. Create the docs/data/local/ folder if it does not already exist.';

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
        {checkItems.map((c) => {
          // Story 015 AC3: testedPaste becomes a locked observed-verified line
          // when the assistant has written handshake.json. The input is removed
          // from the DOM (not merely disabled) so it cannot be unchecked.
          if (c.key === "testedPaste" && handshakeDetected) {
            const timeLabel = verifiedAt
              ? new Date(verifiedAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : null;
            return (
              <div
                key={c.key}
                className="flex items-center gap-3 rounded-lg border border-fresh/40 bg-fresh/5 p-4"
              >
                {/* Story 017 AC8: the ✓ icon is decorative — hidden from
                    assistive tech so it is not announced redundantly. The
                    verification status is conveyed textually (sr-only prefix +
                    visible label) so it is complete without the visual mark. */}
                <Check
                  aria-hidden={true}
                  className="size-4 shrink-0 text-fresh"
                />
                <span className="text-sm font-medium text-fresh">
                  <span className="sr-only">Verified: </span>
                  {timeLabel
                    ? `Assistant verified at ${timeLabel}`
                    : "Assistant verified"}
                  {handshakeAssistant ? ` · ${handshakeAssistant}` : ""}
                </span>
              </div>
            );
          }

          // Manual / normal checkbox (all other keys, and testedPaste when no
          // handshake file is present — manual fallback preserved per AC4).
          return (
            <label
              key={c.key}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-card p-4"
            >
              <input
                type="checkbox"
                checked={answers.checks[c.key]}
                onChange={(e) =>
                  set("checks", {
                    ...answers.checks,
                    [c.key]: e.target.checked,
                  })
                }
                className="size-4 accent-primary"
              />
              <span className="text-sm">{c.label}</span>
              {answers.checks[c.key] && (
                <Check className="ml-auto size-4 text-fresh" />
              )}
            </label>
          );
        })}
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
