// Seed data for the Work HQ prototype. Read-only "OS state" plus history.

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
};

export type Priority = { id: string; text: string };
export type Blocker = { id: string; text: string; severity: "high" | "low" };

export type BacklogItem = {
  id: string;
  text: string;
  createdAt: string;
  processed?: boolean;
};

export type Learning = { id: string; text: string; capturedAt: string };

export type AdrOption = {
  key: "A" | "B" | "C";
  title: string;
  pros: string[];
  cons: string[];
};
export type Adr = {
  id: string;
  title: string;
  status: "Proposed" | "Accepted" | "Superseded";
  context: string;
  options: AdrOption[];
  chosen?: "A" | "B" | "C";
  updatedAt: string;
};

export type Question = {
  id: string;
  question: string;
  context: string;
  status: "open" | "answered" | "resolved" | "parked";
  askedAt: string;
};

export type OsFile = {
  name: string;
  updatedAt: string;
  sizeBytes: number;
  maxBytes: number;
};

export const mock = {
  user: { name: "Jamie Doe", initials: "JD", role: "Product Operations Lead" },

  priorities: [
    { id: "p1", text: "Finalize Q3 capacity planning with engineering" },
    { id: "p2", text: "Standardize the ADR template across squads" },
    { id: "p3", text: "Stakeholder interview: Sarah (Design Ops)" },
  ] as Priority[],

  blockers: [
    {
      id: "b1",
      text: "Awaiting API schema from Platform team",
      severity: "high",
    },
    { id: "b2", text: "Budget sign-off pending VP approval", severity: "low" },
  ] as Blocker[],

  suggestedFirstAction:
    "Ping @platform on Slack for the schema draft — even a rough shape unblocks planning.",

  prioritiesUpdatedAt: daysAgo(3),

  backlog: [
    { id: "bk1", text: "Review team velocity metrics", createdAt: daysAgo(1) },
    {
      id: "bk2",
      text: "Schedule follow-up on tool consolidation",
      createdAt: daysAgo(1),
    },
    {
      id: "bk3",
      text: "Audit Slack channel proliferation",
      createdAt: daysAgo(2),
    },
    {
      id: "bk4",
      text: "Draft the retro facilitation guide",
      createdAt: daysAgo(3),
    },
    {
      id: "bk5",
      text: "Move onboarding docs to the new wiki",
      createdAt: daysAgo(4),
      processed: true,
    },
    {
      id: "bk6",
      text: "Clarify on-call rotation ownership",
      createdAt: daysAgo(5),
    },
    {
      id: "bk7",
      text: "Prep 1:1 template for new IC hires",
      createdAt: daysAgo(6),
    },
    {
      id: "bk8",
      text: "Consolidate vendor renewal calendar",
      createdAt: daysAgo(8),
    },
  ] as BacklogItem[],

  learnings: [
    {
      id: "l1",
      text: "Context switching cost peaks Wednesday afternoons.",
      capturedAt: daysAgo(2),
    },
    {
      id: "l2",
      text: "Async standups outperform sync when the team spans 3+ timezones.",
      capturedAt: daysAgo(9),
    },
    {
      id: "l3",
      text: "ADRs are only read when linked from the PR.",
      capturedAt: daysAgo(21),
    },
    {
      id: "l4",
      text: "The 'no-agenda no-meeting' rule saved ~3h/week per IC.",
      capturedAt: daysAgo(45),
    },
    {
      id: "l5",
      text: "Written pre-reads cut decision meetings by half.",
      capturedAt: daysAgo(62),
    },
  ] as Learning[],

  adrs: [
    {
      id: "adr-001",
      title: "State storage format for the Personal OS",
      status: "Accepted",
      context:
        "We need a durable, human-editable state format that the AI can read directly. JSON is precise but noisy for humans; YAML is fussy; Markdown is warm but weakly typed.",
      options: [
        {
          key: "A",
          title: "JSON files",
          pros: ["Strict schema", "Easy to parse"],
          cons: ["Hostile to human edits", "Noisy diffs"],
        },
        {
          key: "B",
          title: "Markdown with frontmatter",
          pros: ["Human-first", "AI-friendly", "Nice diffs"],
          cons: ["Weak typing", "Custom parser"],
        },
        {
          key: "C",
          title: "YAML files",
          pros: ["Compact", "Typed"],
          cons: ["Indentation footguns", "Poor for prose"],
        },
      ],
      chosen: "B",
      updatedAt: daysAgo(5),
    },
    {
      id: "adr-002",
      title: "How the app talks to the AI",
      status: "Accepted",
      context: "Direct API calls, MCP, or a copy-paste bridge?",
      options: [
        {
          key: "A",
          title: "Direct provider APIs",
          pros: ["Automatable"],
          cons: ["Key management", "Vendor lock-in", "Trust surface"],
        },
        {
          key: "B",
          title: "Copy-paste bridge (Collect & Copy)",
          pros: [
            "Zero secrets",
            "User is in the loop",
            "Portable across assistants",
          ],
          cons: ["One extra step"],
        },
        {
          key: "C",
          title: "MCP server",
          pros: ["Standardized"],
          cons: ["Setup overhead", "Not everyone runs MCP"],
        },
      ],
      chosen: "B",
      updatedAt: daysAgo(10),
    },
    {
      id: "adr-003",
      title: "Where to keep sensitive stakeholder data",
      status: "Proposed",
      context: "The OS is plaintext markdown. Some org data is sensitive.",
      options: [
        {
          key: "A",
          title: "In-tree, plaintext",
          pros: ["Simple"],
          cons: ["Leak risk"],
        },
        {
          key: "B",
          title: "Separate encrypted file",
          pros: ["Safer"],
          cons: ["Loss of AI context"],
        },
        {
          key: "C",
          title: "Aliased references only",
          pros: ["Safe + contextual"],
          cons: ["Requires discipline"],
        },
      ],
      updatedAt: daysAgo(1),
    },
    {
      id: "adr-004",
      title: "Ritual cadence enforcement",
      status: "Accepted",
      context: "Do we nag, streak, or leave it fully passive?",
      options: [
        {
          key: "A",
          title: "Passive",
          pros: ["Calm"],
          cons: ["Wrap-Up gets skipped"],
        },
        {
          key: "B",
          title: "Streaks + gentle nudges",
          pros: ["Motivating", "Not annoying"],
          cons: ["Streak anxiety"],
        },
        {
          key: "C",
          title: "Hard blockers",
          pros: ["Guarantees hygiene"],
          cons: ["Hostile"],
        },
      ],
      chosen: "B",
      updatedAt: daysAgo(14),
    },
    {
      id: "adr-005",
      title: "Learnings retention policy",
      status: "Proposed",
      context: "How long do raw learnings live before promotion or archive?",
      options: [
        {
          key: "A",
          title: "Never expire",
          pros: ["Complete history"],
          cons: ["File bloat"],
        },
        {
          key: "B",
          title: "Flag after 30 days",
          pros: ["Nudges review"],
          cons: ["Manual work"],
        },
        {
          key: "C",
          title: "Auto-archive at 60 days",
          pros: ["Self-cleaning"],
          cons: ["Loss risk"],
        },
      ],
      updatedAt: daysAgo(2),
    },
    {
      id: "adr-006",
      title: "Assistant portability",
      status: "Superseded",
      context: "Which assistants we officially support in onboarding.",
      options: [
        {
          key: "A",
          title: "Copilot only",
          pros: ["Focused"],
          cons: ["Excludes users"],
        },
        {
          key: "B",
          title: "Copilot + Claude + ChatGPT",
          pros: ["Broad"],
          cons: ["Testing surface"],
        },
        {
          key: "C",
          title: "Any chat that accepts markdown",
          pros: ["Universal"],
          cons: ["Untested edges"],
        },
      ],
      chosen: "C",
      updatedAt: daysAgo(30),
    },
  ] as Adr[],

  questions: [
    {
      id: "q1",
      question: "Should learnings older than 30 days auto-archive?",
      context:
        "Related to ADR-005. Depends on how often we actually re-read them.",
      status: "open",
      askedAt: daysAgo(2),
    },
    {
      id: "q2",
      question: "What counts as a 'shipped' outcome for Wrap-Up?",
      context: "Merged PR? Deployed? Communicated?",
      status: "open",
      askedAt: daysAgo(4),
    },
    {
      id: "q3",
      question: "Do we surface contract-drift as a warning or a fix-it?",
      context: "When the AI's summary diverges from the source files.",
      status: "open",
      askedAt: daysAgo(6),
    },
    {
      id: "q4",
      question: "How should Backlog integrate with existing task tools?",
      context: "Do we push to Linear/Jira, or stay in-file?",
      status: "open",
      askedAt: daysAgo(9),
    },
  ] as Question[],

  files: [
    {
      name: "priorities.md",
      updatedAt: daysAgo(3),
      sizeBytes: 1240,
      maxBytes: 4096,
    },
    {
      name: "backlog.md",
      updatedAt: daysAgo(1),
      sizeBytes: 3120,
      maxBytes: 8192,
    },
    {
      name: "learnings.md",
      updatedAt: daysAgo(9),
      sizeBytes: 5420,
      maxBytes: 16384,
    },
    {
      name: "decisions.md",
      updatedAt: daysAgo(5),
      sizeBytes: 8890,
      maxBytes: 16384,
    },
  ] as OsFile[],

  contractDrift: [
    {
      file: "priorities.md",
      detail: "AI summary mentions 'Q4 planning' — source says Q3.",
    },
    {
      file: "learnings.md",
      detail: "3 entries older than 30 days flagged for review.",
    },
  ],

  // 30-day ritual history (most recent last)
  ritualHistory: Array.from({ length: 30 }, (_, i) => ({
    date: daysAgo(29 - i),
    standup: Math.random() > 0.15,
    wrapUp: Math.random() > 0.35,
  })),

  streak: 12,

  onboardingSeed: {
    phase: 4,
    completed: [1, 2, 3],
    answers: {
      role: "Product Operations Lead",
      workstyle: "Async-first, deep-work mornings",
      stakeholders: [
        "Sarah Chen (CTO) — decision maker",
        "Marcus (Platform lead)",
      ],
    },
  },
};
