# Personal OS · Updated: 2026-06-21

A VS Code-native, AI-augmented knowledge and workflow system for product operations teams. Zero custom code, zero infrastructure. All intelligence lives in plain markdown files and natural-language instructions — readable and maintainable by non-technical team members.

---

## How It Works

Your VS Code AI assistant (GitHub Copilot is the reference implementation) auto-loads `AGENTS.md` as its standing orders. `AGENTS.md` routes the AI to your personal context files, accumulated memory, and specialist skill files — so every session starts grounded in your actual work rather than a blank slate.

```
AGENTS.md (always loaded)
├── context/active.md      ← your current sprint and top-3 priorities
├── context/me.md          ← who you are and how you work
├── context/org.md         ← stakeholder map and shared glossary
├── memory/eval.md         ← pre-response quality checklist
├── memory/learnings.md    ← patterns the AI has accumulated
└── .github/skills/        ← specialist agents (chief-of-staff, researcher, …)
```

---

## Quick Start — Enable the Constitution

### Step 1: Enable AGENTS.md in GitHub Copilot

Open VS Code Settings (Cmd+,) and search for `chat.useAgentsMdFile`. Enable it. This tells Copilot to auto-load `AGENTS.md` as its standing instructions.

### Step 2: Fill in your personal context

Copy `templates/context-me.md` to `context/me.md` and fill in your 5 bullets. Then edit `context/active.md` with your real current sprint, top-3 priorities, and open questions. Both files are gitignored — they never leave your machine.

### Step 3: Test the standup

Open a fresh VS Code chat window and type: **morning standup**

You should get: your top-3 priorities, any blockers, and one suggested first action — all traceable to your `context/active.md`.

*Estimated time from empty folder to first successful standup: ~40 minutes.*

---

## Directory Map

```
personal-os/
├── AGENTS.md                     # Tier 1: Constitution (always loaded, ≤200 lines) [shared]
├── CLAUDE.md                     # @AGENTS.md import shim for Claude-based assistants [shared]
├── CLAUDE.local.md               # Personal overrides — gitignored, never committed [personal]
├── BACKLOG.md                    # Zero-friction brain-dump inbox [shared template]
├── README.md                     # This file [shared]
│
├── context/
│   ├── me.md                     # Who I am and how I work [personal, gitignored]
│   ├── org.md                    # Stakeholder map, team structure, glossary [shared]
│   └── active.md                 # Current sprint, top-3 priorities, open questions [personal, gitignored]
│
├── memory/
│   ├── learnings.md              # Patterns the AI has accumulated [personal, gitignored]
│   ├── decisions.md              # Key decisions with rationale [personal, gitignored]
│   ├── tools.md                  # MCP routing policy [shared, force-included]
│   ├── usage-log.md              # Session log [personal, gitignored]
│   ├── golden-evals.md           # Test questions with known-good answers [personal, gitignored]
│   └── eval.md                   # Pre-response quality checklist [shared, force-included]
│
├── rules/
│   ├── writing-rules.md          # Writing style and format rules [shared]
│   ├── research-rules.md         # Research and sourcing rules [shared]
│   └── communication-rules.md   # Communication and stakeholder rules [shared]
│
├── templates/
│   ├── SKILL.template.md         # Template for new skill files [shared]
│   ├── context-me.md             # Template for context/me.md [shared]
│   ├── project-brief.md          # Template for project files [shared]
│   ├── decision-log.md           # Template for decisions [shared]
│   └── meeting-notes.md          # Template for meeting notes [shared]
│
├── projects/<name>.md            # Tier 3 project brains [personal, gitignored]
├── areas/<name>.md               # Tier 3 standing responsibilities [personal, gitignored]
├── knowledge/this-week.md        # Weekly consolidated reference [personal, gitignored]
│
├── .github/skills/
│   ├── REGISTRY.md               # Skill catalogue with versions [shared]
│   ├── chief-of-staff/SKILL.md   # Daily orchestration skill [shared]
│   ├── researcher/SKILL.md       # Research and consolidation skill [shared]
│   ├── product-writer/SKILL.md   # Document authoring skill [shared]
│   ├── os-helper/SKILL.md        # OS maintenance skill [shared]
│   └── process-builder/SKILL.md  # Process-to-skill builder [shared]
│
└── .vscode/mcp.json              # MCP server config, credential-free [shared, force-included]
```

---

## No-MCP Fallback Mode

**All daily rituals work without any MCP server connected.** MCP integrations (Glean, Confluence, Miro, GitHub) are additive — they enhance the system but are never load-bearing for a single session.

| Ritual | Works without MCP? | How |
|---|---|---|
| Morning standup | Yes | Reads `context/active.md` locally |
| Process my backlog | Yes | Routes to local files |
| Session memory harvest | Yes | Appends to `memory/learnings.md` locally |
| Research query | Degraded | Falls back to local Project Brains and `knowledge/this-week.md` |
| Publish to Confluence | Not available | Draft retained locally; user notified |

If a broken MCP credential blocks a local-only workflow, that is a bug. Local workflows must always complete.

---

## Setup Walkthrough (Full)

| Step | Action | Estimated time |
|---|---|---|
| 1 | Install GitHub Copilot extension in VS Code | 5 min |
| 2 | Enable `chat.useAgentsMdFile` in VS Code settings | 2 min |
| 3 | Clone this repo: `git clone <repo-url>` | 3 min |
| 4 | Copy `templates/context-me.md` to `context/me.md` and fill in your 5 bullets | 10 min |
| 5 | Edit `context/active.md` with your real current sprint and top-3 priorities | 10 min |
| 6 | Open a fresh VS Code chat, type "morning standup" — verify you get 3 sections from your context | 5 min |
| 7 | Add 3 items to `BACKLOG.md`, type "process my backlog" — verify routing | 5 min |

**Total: ~40 minutes from clone to first successful standup.**

---

## Import Debug — CLAUDE.md / @AGENTS.md

If you're using a Claude-based assistant and it doesn't seem to have standing orders:

1. Check whether the assistant resolved the `@AGENTS.md` import in `CLAUDE.md`. Ask it: "What are your standing orders?" — if it can't describe the constitution, the import failed.
2. **Fallback:** Open `AGENTS.md` directly and paste its contents as the first message in your chat session, or copy its content into `CLAUDE.local.md`.
3. If using Claude Code CLI: the `@file` import syntax is not always supported in every context. The README in `AGENTS.md` is self-contained and safe to paste directly.

---

## Data Governance

Files committed to this repo (the shared set) must contain no:
- Personnel data (performance, compensation, personal details)
- Unreleased roadmap items with commercial sensitivity
- Customer data or PII
- Credentials or tokens of any kind

If in doubt, keep it in a gitignored file (`context/me.md`, `context/active.md`, `projects/`, `areas/`). Team-level decisions belong in Confluence, not this repo.

---

## Copilot Agent Mode Note

GitHub Copilot in agent mode does not require the Filesystem MCP server — it has native file access to the workspace. The Filesystem MCP entry in `.vscode/mcp.json` exists for AI assistants that lack native file access. See `docs/specs/architecture.md §5` for details.
