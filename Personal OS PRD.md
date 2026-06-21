# Personal OS — Product Requirements Document

**Document status:** Draft v1.0  
**Owner:** Head of Product Operations  
**Last updated:** June 2026  
**Audience:** Product Owner, Engineering Lead, Team Pilot Participants  

***

## Executive Summary

The Personal OS is a VS Code–native, AI-augmented knowledge and workflow system for a product operations team of ~10–80 people. It solves the core productivity problem of scattered markdown files, repeated context lookups across enterprise tools (Glean, Confluence, Miro), and zero structured memory between AI working sessions.[^1]

The recommended approach is a **Layered Context Engineering** system: a three-tier markdown file hierarchy (Constitution → Living Memory → Project Brains), augmented by SKILL.md-based specialist agent workflows, stored in a GitHub-backed shared repository, and surfaced through any AI assistant embedded in VS Code (Copilot, Continue.dev, etc.). The system requires zero custom code, zero infrastructure spend, and onboards a non-technical team member in under 30 minutes.[^1]

**Primary success metric:** The morning standup prompt (reading `context/active.md` and returning today's top 3 priorities) feels faster than the current approach by Day 3 of use. If it doesn't, adoption will not happen.[^1]

***

## 1. Problem Statement

### 1.1 Core Problems

Product operations professionals working across enterprise tools face three compounding friction points:[^1]

1. **Scattered context** — Notes, decisions, and project background are spread across Confluence, Glean, Miro, local markdown files, and chat history. Every new AI session starts from zero.
2. **No structured AI memory** — AI assistants have no persistent knowledge of working patterns, stakeholder context, org terminology, or past decisions. Every session requires re-establishing context that was established in the previous one.
3. **Repeated MCP round-trips** — Live lookups to Glean and Confluence are expensive (token cost, latency) and compound across a workday. There is no local consolidation layer.

### 1.2 Why Existing Systems Fall Short

| System | What It Does Well | What It Misses |
|---|---|---|
| PARA/folder-based KM | Human findability | No AI context engineering |
| Single CLAUDE.md | Zero learning curve | Context bloat, no persistence |
| Notion/Obsidian + AI bridge | Rich UX, mobile access | Platform lock-in, breaks VS Code–native constraint |
| BMAD workflows | Structured project phases | Over-engineered for daily KM |
| Claude Code CLI setups | Architecturally mature | Requires CLI; out of scope for non-technical users |

### 1.3 Target Users

**Primary:** Non-technical product operations team members (~10–80 people) who use VS Code for AI-assisted work but do not write or maintain code.[^1]

**Secondary:** Technical product ops leads (the setup and governance layer) who configure, maintain, and evolve the shared repository.[^1]

***

## 2. Goals & Non-Goals

### 2.1 Goals

- **G1 — Daily value within Week 1.** The morning standup ritual must feel faster than the status quo by Day 3.
- **G2 — Non-technical maintainability.** Any team member should be able to update their personal context files without help from a developer.
- **G3 — Works with any VS Code AI assistant.** No dependency on Claude Code CLI, a specific model, or a paid AI tier.
- **G4 — Team-shareable via GitHub.** Shared skills, MCP config, and org context are managed centrally and inherited by individuals via git.
- **G5 — Zero custom code and zero infrastructure cost.** The system runs entirely on plain markdown files and VS Code extensions.
- **G6 — Self-improving.** The system accumulates learnings, evaluates its own quality monthly, and gets measurably better over time.[^1]

### 2.2 Non-Goals

- Building a web application, database, or custom backend
- Replacing Confluence, Glean, or Miro as the system of record
- Automating workflows on a schedule (background processes, cron jobs)
- Supporting Claude Code CLI as the primary interface
- Mobile-first or non-VS Code interfaces (out of scope for V1)

***

## 3. Architecture Overview

### 3.1 The Three-Tier Model

Each tier answers a different question. Tier 1 is always loaded. Tiers 2 and 3 are loaded on demand or via explicit reference.[^1]

```
personal-os/
├── CLAUDE.md                     ← Tier 1: Constitution (hub, ~200 lines max)
├── AGENTS.md                     ← Cross-tool instruction file (imports CLAUDE.md)
├── BACKLOG.md                    ← Zero-friction brain-dump inbox
├── README.md                     ← System map for humans and AI
│
├── context/                      ← Tier 2: Living Memory
│   ├── active.md                 ← Current sprint, top 3 priorities, open questions
│   ├── me.md                     ← Role, working style, priorities (personal, gitignored)
│   └── org.md                    ← Stakeholder map, team structure, glossary (shared)
│
├── memory/                       ← Tier 2: Accumulated Knowledge
│   ├── learnings.md              ← Patterns the AI has learned; reviewed weekly
│   ├── decisions.md              ← Key decisions with context and rationale
│   ├── tools.md                  ← MCP source registry and routing table
│   ├── usage-log.md              ← Session log: task type, MCP source, quality rating
│   └── golden-evals.md           ← 5–10 test questions with known-good answers
│
├── projects/                     ← Tier 3: Project Brains
│   └── <project-name>.md         ← One file per active project (gitignored)
│
├── areas/                        ← Tier 3: Standing Areas of Responsibility
│   └── <area-name>.md
│
├── knowledge/                    ← Consolidated reference (from weekly ritual)
│   └── this-week.md
│
├── rules/                        ← Domain-specific instruction modules
│   ├── writing-rules.md
│   ├── research-rules.md
│   └── communication-rules.md
│
├── .github/skills/               ← SKILL.md specialist agents
│   ├── chief-of-staff/SKILL.md
│   ├── researcher/SKILL.md
│   ├── product-writer/SKILL.md
│   ├── process-builder/SKILL.md
│   └── os-helper/SKILL.md
│
├── skills/REGISTRY.md            ← Skill catalogue with versions and last-updated dates
│
├── templates/                    ← Starter templates for each file type
│
├── .vscode/
│   └── mcp.json                  ← Shared MCP configuration (no credentials)
│
└── CLAUDE.local.md               ← Personal overrides (gitignored)
```

### 3.2 Tier Definitions

#### Tier 1 — Constitution (`CLAUDE.md` / `AGENTS.md`)

The "standing orders" hub. Never exceeds 200 lines. Contains:[^1]
- Who the user is and what this workspace is for
- Hard rules (tone, confidentiality, what to never do)
- Routing table pointing to lower-tier files
- Reference to `memory/tools.md` for available MCP tools
- Reference to `context/active.md` for current focus

**Key discipline:** If CLAUDE.md exceeds 200 lines, something belongs in a lower tier. The file is a hub, not a dump.[^1]

The canonical file is `AGENTS.md` (cross-tool standard supported by Codex, Aider, GitHub Copilot). `CLAUDE.md` contains a single `@AGENTS.md` import — one source of truth.[^1]

#### Tier 2 — Living Memory (`context/` and `memory/`)

What accumulates over time. The AI appends to `memory/learnings.md` at the end of every meaningful conversation — one line per new pattern or correction discovered.[^1]

- `learnings.md` and `active.md` are the two files reviewed weekly
- All other files are append-only logs
- `active.md` is updated every session; all other Tier 2 files are append-and-prune

#### Tier 3 — Project Brains (`projects/` and `areas/`)

Deep context that only loads when working on a specific project. One file per project or area. Contains everything the AI needs to not ask twice: background, constraints, decisions made, key stakeholders, current status, and links to Confluence/Glean/Miro artefacts.[^1]

**Trigger phrase convention:** `"Read projects/q3-roadmap-review.md then help me with..."` — reduces Glean/Confluence round-trips to one per project setup.[^1]

***

## 4. Feature Requirements

### 4.1 Core Features (MVP / Phase 1)

#### F1 — Constitution File (CLAUDE.md / AGENTS.md)

**Priority:** P0  
**Description:** A single always-loaded instruction file at the workspace root establishing AI persona, routing rules, and system-wide constraints.

**Acceptance criteria:**
- [ ] AGENTS.md is the canonical file; CLAUDE.md contains a single `@AGENTS.md` import
- [ ] File is under 200 lines at all times
- [ ] Contains routing instructions pointing to `context/active.md` and `memory/tools.md`
- [ ] Contains a `sensitivity check` instruction: before writing to any file, confirm the content doesn't belong in a protected enterprise system
- [ ] Readable and interpretable by GitHub Copilot, Continue.dev, and any LLM in plain English (no CLI-specific syntax)

#### F2 — Living Context Files

**Priority:** P0  
**Description:** Three personal context files that provide the AI with stable and current situational awareness.

**Acceptance criteria:**
- [ ] `context/me.md` template provided (5 bullets: role, priorities, working style, team, key tools)
- [ ] `context/org.md` includes stakeholder map, team structure, shared org glossary
- [ ] `context/active.md` tracks current sprint, top 3 priorities, open questions, and is updated every session
- [ ] Every file has a header convention: `# File Name · Updated: [date]`
- [ ] `me.md` and `active.md` are gitignored; `org.md` is committed to shared repo

#### F3 — BACKLOG.md Brain-Dump Inbox

**Priority:** P0  
**Description:** Zero-friction capture point. Non-technical users dump thoughts without caring about structure. The AI processes and routes.[^1]

**Acceptance criteria:**
- [ ] `BACKLOG.md` exists at the workspace root
- [ ] CLAUDE.md contains the instruction: "When asked to 'process my backlog', read BACKLOG.md and route items to the appropriate project file, knowledge file, or action item. Then clear BACKLOG.md."
- [ ] Processing can be triggered by a single natural-language phrase

#### F4 — Memory Files

**Priority:** P0  
**Description:** Structured append-only logs for learnings, decisions, and tool routing.

**Acceptance criteria:**
- [ ] `memory/learnings.md` is appended to by the AI at the end of every substantive session
- [ ] `memory/decisions.md` captures key decisions with date, rationale, and alternatives rejected
- [ ] `memory/tools.md` documents every MCP source with: what it's authoritative for, query type, rate limit notes, and last-tested date
- [ ] Staleness check instruction in CLAUDE.md: "Flag any learnings.md entry older than 30 days for review"

#### F5 — MCP Configuration (`mcp.json`)

**Priority:** P0  
**Description:** Shared MCP server configuration committed to the team repo. User credentials are never hardcoded; VS Code prompts securely via `inputs`.[^1]

**Acceptance criteria:**
- [ ] `.vscode/mcp.json` is committed to shared repo with no credential values
- [ ] Supports Glean (HTTP/OAuth), Confluence (npx), GitHub (npx), and filesystem MCP servers
- [ ] All credentials are referenced via `${input:token_name}` pattern
- [ ] System remains fully functional without MCP — local files provide baseline value ("no MCP fallback mode" documented in README)
- [ ] `memory/tools.md` documents which MCP source is authoritative for which query type

#### F6 — eval.md Quality Gate

**Priority:** P1  
**Description:** A pre-response checklist the AI runs before answering substantive requests. Prevents generic, context-free responses.[^1]

**Acceptance criteria:**
- [ ] `eval.md` file exists in workspace root or `memory/` folder
- [ ] Checklist includes: read `context/active.md`, check `memory/learnings.md`, ground in `context/org.md`, ensure recommendations are role-specific, ensure next steps have named owners and dates
- [ ] AI is instructed to only respond when all checks pass

***

### 4.2 Skills Layer (Phase 1 + Phase 2)

#### F7 — Chief-of-Staff Skill

**Priority:** P0  
**Description:** The primary daily-driver skill. Handles morning standup, weekly priority review, stakeholder update drafts, and meeting prep. Reads `context/active.md` first on every invocation.[^1]

**Acceptance criteria:**
- [ ] Invocable via natural language ("morning standup", "draft stakeholder update")
- [ ] Always reads `context/active.md` before any response
- [ ] Morning standup output: top 3 priorities, any blockers, one suggested first action
- [ ] Stakeholder update output: executive summary (3 bullets max), status (On Track / At Risk / Blocked), decisions needed, next steps with owners and dates

#### F8 — Researcher Skill

**Priority:** P1  
**Description:** Routes discovery queries to the correct MCP source (Glean → Confluence → Miro hierarchy), consolidates findings into Project Brain files, and flags information that should be archived.[^1]

**Acceptance criteria:**
- [ ] Reads `memory/tools.md` before querying any MCP source
- [ ] Follows explicit routing hierarchy: Glean first, Confluence for decisions/specs, Miro for visual artefacts
- [ ] Implements document grader: if Glean returns fewer than 3 relevant results, escalates to Confluence deep search before synthesising
- [ ] Output is written to the relevant Project Brain file or `knowledge/this-week.md`

#### F9 — Product Writer Skill

**Priority:** P1  
**Description:** Handles all structured writing: PRDs, strategy memos, decision docs, stakeholder updates, OKR write-ups. Inherits org tone from `context/me.md` and stakeholder context from `context/org.md`.[^1]

**Acceptance criteria:**
- [ ] Reads `context/me.md` and `context/org.md` before drafting any document
- [ ] References appropriate Lenny Skill internally (writing-prds, stakeholder-alignment) where applicable
- [ ] Output matches the document format requested (PRD, strategy memo, decision log, etc.)
- [ ] Drafted documents can be published to Confluence via MCP on request

#### F10 — OS-Helper Skill

**Priority:** P1  
**Description:** A dedicated meta-skill for maintaining the OS itself — never invoked for work tasks. Supports onboarding, staleness audits, skill reviews, and architecture evolution.[^1]

**Acceptance criteria:**
- [ ] Invocable via "onboard [name]", "audit", "review skills", "evolve"
- [ ] Onboarding mode: reads org context and generates a personalised 30-minute setup checklist for the new user
- [ ] Staleness audit mode: lists all files, checks last-modified dates, flags files not updated in 30+ days, outputs a prioritised maintenance list
- [ ] Skill review mode: reports last-used date and quality score per skill; suggests skills to improve, retire, or create
- [ ] Explicitly blocked from being invoked during normal work sessions

#### F11 — Process Builder Skill

**Priority:** P2  
**Description:** The meta-skill that grows the team skill library. Given a process description, produces a Confluence-ready process doc, a SKILL.md workflow file, and a checklist template.[^1]

**Acceptance criteria:**
- [ ] Accepts a plain-language process description as input
- [ ] Outputs three artefacts: process doc (Confluence-ready), SKILL.md file (team-ready), checklist template (markdown)
- [ ] SKILL.md output conforms to the shared skills format with correct frontmatter (name, description, version)

***

### 4.3 Quality & Observability (Phase 2)

#### F12 — Golden Evaluation Set

**Priority:** P1  
**Description:** 5–10 test questions with known-good answers. Run monthly in a fresh chat session to detect quality regression.[^1]

**Initial evaluation set:**

| ID | Question | What a Good Answer Does |
|---|---|---|
| Eval 001 | "Who are the key stakeholders I need to align on the quarterly roadmap review, and what are their main concerns?" | Names people from `context/org.md`; cites their concerns accurately; references `active.md` |
| Eval 002 | "What should I focus on this week and why?" | References `context/active.md` accurately; does not fabricate priorities |
| Eval 003 | "What is the current status of [most active project]?" | Reads correct Project Brain; accurately reflects status; flags blockers |
| Eval 004 | "Find the last decision we made about the product community OKR framework." | Routes to Confluence MCP; returns relevant content; does not hallucinate |
| Eval 005 | "Draft a brief stakeholder update on this week's progress." | Matches tone in `context/me.md`; uses correct org terminology; matches skill output format |

**Acceptance criteria:**
- [ ] `memory/golden-evals.md` contains all 5 evaluations with `Last score: — / Date: —` fields
- [ ] Run monthly by pasting file into a fresh chat session
- [ ] Scores tracked in `memory/usage-log.md`
- [ ] Any score below 3/5 triggers investigation of which context file is stale

#### F13 — Usage Log

**Priority:** P1  
**Description:** Lightweight append-only observability log. The chief-of-staff agent updates it after substantive sessions.[^1]

**Acceptance criteria:**
- [ ] `memory/usage-log.md` exists with append-only format: `date | task type | MCP sources used | quality rating (1–5) | notes`
- [ ] Updated automatically by chief-of-staff skill at session end
- [ ] After 4 weeks, patterns are reviewable: which MCP sources add value, which skills get used, which contexts go stale fastest

#### F14 — Skills Registry

**Priority:** P2  
**Description:** A typed catalogue of all SKILL.md files with version, purpose, and last-updated date.[^1]

**Acceptance criteria:**
- [ ] `skills/REGISTRY.md` lists every skill in `.github/skills/`
- [ ] Each entry includes: name, version, description, last-updated, last-used (from usage-log)
- [ ] Updated by os-helper during monthly skill review ritual

***

### 4.4 MCP Integration Features

#### F15 — Glean Enterprise MCP Integration

**Priority:** P1  
**Description:** Glean's precomputed enterprise knowledge graph via MCP, providing context-aware query routing with 2.5× preference over off-the-shelf MCP tools at 30% fewer tokens.[^1]

**Acceptance criteria:**
- [ ] Configured in `.vscode/mcp.json` with OAuth via VS Code input prompts
- [ ] Glean documented in `memory/tools.md` as primary enterprise search source
- [ ] Weekly consolidation ritual supported: researcher agent queries recent Glean activity and writes to `knowledge/this-week.md`
- [ ] Bi-directional memory write-back supported: after substantive sessions, structured summary published to Glean

#### F16 — Confluence MCP Integration

**Priority:** P1  
**Description:** Confluence as publishing target for structured outputs (decision logs, project briefs, process docs) and as source of truth for team decisions.[^1]

**Acceptance criteria:**
- [ ] Confluence MCP server configured via npx in `mcp.json`
- [ ] Supported workflows: read decisions/specs from Confluence; publish completed documents back to designated Confluence spaces
- [ ] Documented in `memory/tools.md`: "Confluence = team wiki for decisions and specs; route decision queries here"

#### F17 — Adaptive MCP Query Routing

**Priority:** P2  
**Description:** `memory/tools.md` functions as a smart routing policy that guides the AI to the right MCP source for each query type, reducing redundant multi-source lookups.[^1]

**Acceptance criteria:**
- [ ] `memory/tools.md` defines explicit routing hierarchy: Glean (discovery/people) → Confluence (decisions/specs) → Miro (visual artefacts)
- [ ] Researcher skill reads routing table before every query
- [ ] Over time, usage-log data feeds back into routing policy improvements via monthly os-helper audit

***

## 5. Workflows & Rituals

### 5.1 Daily Rituals

| Ritual | Trigger | Duration | Skill | Output |
|---|---|---|---|---|
| Morning standup | "Morning standup" | ~5 min | chief-of-staff | Top 3 priorities, blockers, first action |
| Backlog processing | "Process my backlog" | ~5 min | chief-of-staff | Items routed to correct files; BACKLOG.md cleared |
| Context harvest | End of substantive session | ~2 min | chief-of-staff | Append to `memory/learnings.md`; optional Glean write-back |

### 5.2 Weekly Rituals

| Ritual | Trigger | Duration | Skill | Output |
|---|---|---|---|---|
| Active context review | Monday morning | ~5 min | chief-of-staff | Updated `context/active.md` |
| Consolidation ritual | Once per week | ~5 min | researcher | `knowledge/this-week.md` populated from Glean activity |
| Staleness check | Weekly | ~3 min | os-helper ("audit") | Flagged stale entries in `memory/` and `context/` |
| Learnings review | Weekly | ~5 min | Manual | Pruning of `memory/learnings.md` |

### 5.3 Monthly Rituals

| Ritual | Trigger | Duration | Skill | Output |
|---|---|---|---|---|
| Golden eval run | Monthly | ~15 min | Manual (fresh session) | Scores in `usage-log.md`; flagged stale context files |
| Skill review | Monthly | ~10 min | os-helper ("review skills") | REGISTRY.md updated; skills to improve/retire identified |
| Stakeholder map sync | Monthly | ~5 min | os-helper + Glean MCP | `context/org.md` refreshed with current org structure |

### 5.4 Project Lifecycle Workflow

1. **Project start:** "Read the last 5 Confluence pages on [project] and write findings into `projects/[name].md`." One-time Glean/Confluence sweep.
2. **Active work:** Trigger phrase `"Read projects/[name].md then help me with..."` — loads deep context without live MCP round-trips.
3. **After a gap:** "Refresh `projects/[name].md` using Glean and Confluence." Researcher diffs against existing file and updates only what's changed.
4. **Project close:** Archive to `areas/` or publish key decisions to Confluence via MCP.

***

## 6. UX & Design Principles

### 6.1 Core Design Principles

1. **Simplicity over capability.** A system used by 8 out of 10 team members at 60% depth beats a sophisticated system used by 2 out of 10 at full depth.[^1]
2. **Zero-friction capture.** Non-technical users need a single place to dump thoughts without caring about structure. BACKLOG.md is that place.[^1]
3. **Five-minute daily maintenance ceiling.** Systems requiring more than 5 minutes of daily maintenance are abandoned within 3 weeks by non-technical users.[^1]
4. **AI does the finding.** The AI handles retrieval, routing, and filing. Users should never need to navigate file paths to get an answer.
5. **Staleness is the primary failure mode.** Every file needs a clear "last updated" convention. The AI enforces this via eval.md.[^1]
6. **Design for the floor first.** Build the minimum viable system and let usage patterns reveal what to add. Never pre-structure folders before a week of real use.[^1]

### 6.2 File Naming Conventions

- **Descriptive, not technical:** `q3-roadmap-review.md`, not `project-003.md`[^1]
- **Emoji prefixes for visual scanning in VS Code file tree:**
  - `📋 active.md`
  - `🧠 learnings.md`
  - `🗂️ decisions.md`
  - `🔧 tools.md`
  - `📁 projects/`
- **README.md at root** explains the system in plain language and doubles as the AI's map of the workspace[^1]
- **Shared org glossary in `context/org.md`:** canonical terms for ambiguous concepts (e.g., "When I say 'the community', I mean the Product Community of ~12 people")[^1]

### 6.3 Common Failure Modes to Avoid

| Failure Mode | Prevention |
|---|---|
| CLAUDE.md exceeds 200 lines | Tier discipline — any overflow belongs in Tier 2 or 3 |
| Memory files grow unbounded | Append *and prune*; never treat memory as a database |
| Over-structuring folders at setup | Use BACKLOG.md first; let AI suggest structure from usage |
| Skipping eval.md quality gates | AI responses drift to generic over time without them |
| Sensitive content in personal markdown | Sensitivity check instruction in CLAUDE.md |
| MCP breakage destroying trust | Design system to be valuable without MCP; document fallback mode |

***

## 7. Technical Requirements

### 7.1 VS Code Extension Stack

**Required (Core AI):**
- GitHub Copilot — reads `CLAUDE.md`, `AGENTS.md`, `SKILL.md` natively as of April 2026[^1]
- *Alternative:* Continue.dev (open-source, any LLM backend)

**Required (Knowledge):**
- Markdown All in One — preview and navigation
- Foam (optional but recommended) — wikilinks, backlinks, graph visualisation, MCP graph traversal[^1]

**Optional (Enhancement):**
- GitLens — file history and authorship context
- Context7 MCP — live documentation lookup
- AS Notes — kanban + daily notes

### 7.2 MCP Configuration Reference

The root key in `.vscode/mcp.json` is `servers` (not `mcpServers` — different from Claude Desktop).[^1]

```json
{
  "servers": {
    "glean": {
      "url": "https://your-org.glean.com/mcp",
      "type": "http",
      "headers": { "Authorization": "Bearer ${input:glean_token}" }
    },
    "confluence": {
      "command": "npx",
      "args": ["-y", "@confluence/mcp-server"],
      "env": {
        "CONFLUENCE_URL": "${input:confluence_url}",
        "CONFLUENCE_TOKEN": "${input:confluence_token}"
      }
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "${input:github_pat}" }
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "."]
    }
  }
}
```

**128-tool threshold note:** VS Code v1.103+ (July 2025) introduced a 128-tool threshold per request. When exceeded, VS Code automatically groups tools into virtual tool directories that activate on demand — the hard ceiling is effectively removed. Document the recommended active-tools set per workflow type in `memory/tools.md`.[^1]

### 7.3 Memory Persistence: Architecture Decision

| Approach | Recommended | Rationale |
|---|---|---|
| File-based (plain markdown) | ✅ Yes | Zero infrastructure, zero cost, fully portable. Works with every VS Code AI assistant. Satisfies the "no custom code" constraint[^1]. |
| In-context only | ⚠️ V0 only | Completely volatile. Suitable for exploration, not a production pattern. |
| External vector DB / SQLite | ❌ Not V1 | Requires custom code. Violates non-engineer constraint. Consider only if file-based system proves inadequate at >500 files[^1]. |

### 7.4 GitHub Repository Structure

**Shared team repo** (`product-community/personal-os-shared`):

Committed to shared repo:
- `CLAUDE.md` (team baseline)
- `AGENTS.md`
- All SKILL.md files in `.github/skills/`
- `.vscode/mcp.json` (no credentials)
- `templates/` directory
- `context/org.md`
- `skills/REGISTRY.md`
- `README.md` and setup guide

Gitignored (personal):
- `context/me.md`
- `context/active.md`
- `memory/learnings.md`
- `memory/decisions.md`
- `projects/` and `areas/` content
- `CLAUDE.local.md` (personal overrides)
- `.env` / credentials

**Skill versioning:** Use git tags (`v1.0`, `v1.1`) on the shared repo for skill versions. Team members can pin to a known-good version or opt into latest.[^1]

***

## 8. Rollout Plan

The rollout follows a three-stage model: **Prove → Package → Propagate**.[^1]

### 8.1 Phase 1 — Prove (Weeks 1–4, Solo)

**Goal:** Validate that the system delivers daily value before packaging it for others.

**Owner:** Head of Product Operations

**Activities:**
- Build and use the full system personally
- Run the morning standup ritual every workday
- Process BACKLOG.md at least 3× per week
- Track in `memory/usage-log.md`: which files are actually read, which prompts are used daily, which MCP tools provide real vs. noise value
- Run golden eval set at end of Week 4

**Exit criteria:**
- [ ] Morning standup prompt feels faster than status quo by Day 3
- [ ] At least 3 Project Brain files created and actively used
- [ ] At least 5 entries in `memory/learnings.md`
- [ ] Usage log shows consistent daily use
- [ ] Golden eval scores all ≥ 3/5

**Pruning principle:** Remove anything from the system that was never used during the 4 weeks. The output is a pruned, honest system — not an aspirational architecture.[^1]

### 8.2 Phase 2 — Package (Weeks 5–6)

**Goal:** Extract the proven system into a team-shareable repo that a non-technical person can set up in 30 minutes.

**Owner:** Head of Product Operations

**Activities:**
- Create shared GitHub repo with committed files (see §7.4)
- Write single-page README: what is this, why does it exist, how to get started in 30 minutes
- Create setup checklist: clone repo → add `context/me.md` → configure `mcp.json` → run test prompt
- Remove anything requiring more than copy-paste to install
- Tag `v1.0` on the shared repo

**Exit criteria:**
- [ ] Shared repo published and tagged `v1.0`
- [ ] 30-minute setup guide exists and is tested by at least one other person
- [ ] All SKILL.md files have correct frontmatter and are listed in REGISTRY.md
- [ ] Data governance policy documented: "what belongs in Personal OS vs. Confluence/Glean"

### 8.3 Phase 3 — Propagate (Week 7+, 2–3 Pilot Users)

**Goal:** Onboard 2–3 early adopters from the Product Community, observe friction, fix before full rollout.[^1]

**Owner:** Head of Product Operations + pilot participants

**30-minute onboarding flow:**

1. Clone the shared team repo into a local folder
2. Open the folder in VS Code
3. Fill in `context/me.md` using the provided template (5 bullet points: role, priorities, working style, team, key tools)
4. Enter MCP credentials when VS Code prompts (Glean, Confluence)
5. Run the test prompt: "Read my context files and tell me what you know about me and my work"
6. Send first real request: "What should I focus on this week based on my `active.md`?"

**Exit criteria:**
- [ ] All 3 pilot users complete setup in under 30 minutes without help
- [ ] All 3 pilot users use the morning standup ritual by Day 3
- [ ] Friction points documented and resolved in shared repo
- [ ] At least 1 pilot user reports measurably faster context retrieval than before

**Full rollout trigger:** Pilot NPS equivalent — at least 2 of 3 pilot users describe the system as "valuable" or better in a brief sync. If fewer than 2, identify the root cause before expanding.[^1]

***

## 9. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Adoption failure — system abandoned in Week 2 | High | Critical | Validate morning standup prompt by Day 3; fix `active.md` before anything else[^1] |
| Memory staleness — AI given wrong context | High | High | Weekly staleness check ritual; `eval.md` gates; `active.md` header convention |
| MCP connection breakage | Medium | Medium | Design system to be valuable without MCP; document fallback mode in README[^1] |
| AI assistant feature parity gaps | Medium | Medium | Test with GitHub Copilot first; use plain English instructions only[^1] |
| Sensitive data in personal markdown files synced to GitHub | Medium | High | Sensitivity check instruction in CLAUDE.md; data governance policy before team rollout[^1] |
| Skill library divergence / quality erosion | Low | Medium | Monthly skill review ritual; pull request model for shared repo changes[^1] |
| Context window bloat at scale | Low | Medium | Run context window check at 3 months; if CLAUDE.md + auto-loaded files exceed 50k tokens, implement stricter lazy-loading[^1] |

### 9.1 Open Questions to Validate

- Does the 5-minute morning ritual feel valuable by Day 3 of solo use?
- Which MCP tools actually reduce friction vs. add maintenance overhead?
- What is the right "sensitivity policy" — what data is safe to keep locally vs. must stay in Confluence/Glean?
- At what team size does the shared SKILL.md governance model require a formal PR review process?
- Does the Foam graph MCP layer add enough value over flat-search to justify the extension dependency?

***

## 10. Success Metrics

### 10.1 Adoption Metrics (measured at end of each phase)

| Metric | Phase 1 Target | Phase 3 Target | Full Rollout Target |
|---|---|---|---|
| Daily morning standup use | 5 days/week (solo) | 3/3 pilot users | 80%+ of team |
| BACKLOG.md processing frequency | ≥3×/week | Active use by all pilots | ≥3×/week per user |
| AI session context restarts | Baseline established | 50% reduction vs. baseline | 70% reduction vs. baseline |
| MCP round-trips per session | Baseline established | 30% reduction | 30–50% reduction |

### 10.2 Quality Metrics (monthly golden evals)

| Metric | Baseline | Target |
|---|---|---|
| Average golden eval score | — | ≥4.0/5.0 |
| Evals scoring below 3/5 | — | 0 |
| Time to context restoration after a 1-week gap | Baseline established | <2 minutes |

### 10.3 System Health Indicators

- `memory/learnings.md` has ≥1 new entry per week
- `context/active.md` last-updated date is never older than 2 working days
- `memory/tools.md` has been reviewed within the last 30 days
- `skills/REGISTRY.md` reflects the current skill set (no orphaned files)

***

## 11. Appendix

### A. Starter SKILL.md Template

```yaml
---
name: skill-name
description: >
  One-sentence description of when this skill activates.
  Use when: [trigger condition].
version: 1.0
last-updated: 2026-06-01
---

## Role
[One sentence describing the AI's role when this skill is active.]

## Before You Start
- Read context/active.md for current priorities
- Read context/org.md for stakeholder context
- Read memory/learnings.md for known patterns

## Process
[Step-by-step instructions for the skill workflow.]

## Output Format
[Describe the expected output structure.]

## Quality Check
Before responding, verify:
- [ ] Response is grounded in actual context files, not generic advice
- [ ] Next steps have named owners and dates
- [ ] Terminology matches context/org.md glossary
```

### B. Lenny Skills Starter Set

Fork `RefoundAI/lenny-skills` and copy these 7 skills into the `skills/` directory as the initial set:[^1]

- `product-operations`
- `writing-prds`
- `stakeholder-alignment`
- `prioritizing-roadmap`
- `setting-okrs-goals`
- `running-effective-meetings`
- `cross-functional-collaboration`

### C. Implementation Sequence (Priority Order)

Do not build all features simultaneously. Each layer unlocks the next:[^1]

1. ✅ Baseline `CLAUDE.md` / `AGENTS.md` (3-tier constitution)
2. ✅ `context/me.md` + `context/org.md` + `context/active.md`
3. ✅ `chief-of-staff` SKILL.md — daily standup ritual first
4. ✅ `BACKLOG.md` brain-dump + routing instruction
5. ✅ `memory/tools.md` — routing table for Glean/Confluence/Miro
6. 🔄 `researcher` SKILL.md + first consolidation ritual
7. 🔄 2–3 Project Brain files from active projects
8. 🔄 `usage-log.md` — start tracking what's useful
9. 🔄 `golden-evals.md` — 5 test questions from real work situations
10. ⬜ `rules/` subfolder — extract domain-specific rules from CLAUDE.md
11. ⬜ `product-writer` SKILL.md
12. ⬜ `os-helper` SKILL.md — ready for first team onboarding
13. ⬜ Package shared repo — commit shared files, gitignore personal
14. ⬜ `REGISTRY.md` — catalogue all skills with versions
15. ⬜ `process-builder` SKILL.md — grows team skill library over time
16. ⬜ First 2–3 pilot onboardings using `os-helper`

---

## References

1. Personal-OS-Research-Report.html — [link redacted: contained embedded temporary AWS pre-signed URL; file available locally at `Personal OS Research Report.html`]

The core problem — scattered markdown, repeated context lookups, no structured...

