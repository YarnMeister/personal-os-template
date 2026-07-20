# Work HQ v2 — Lovable Design Blueprint · Updated: 2026-07-20

> **How to use this file:** paste everything below the divider into Lovable as the founding prompt for the v2 app. It is self-contained — Lovable needs no access to the v1 repo. The "Grounding" sections at the end give it the exact markdown file contracts so generated UI maps 1:1 onto our real data.

---

# Prompt for Lovable

Design and build **Work HQ v2** — a local-first companion app for a "Personal OS": a folder of plain markdown files that an AI assistant (Copilot, Claude, etc.) loads as its standing context. The markdown files are the database. The app's job is to keep those files **accurate, fresh, and easy to maintain** — and to hand work to the AI assistant only where AI genuinely adds value.

This is a v2. We built v1 and got close. Below is what to keep, what to fix, and the exact design brief.

## The product in one paragraph

A knowledge worker opens Work HQ each morning. It reads their markdown context files (priorities, blockers, profile, org map) and renders them as clean, editable UI. They run short daily rituals (standup, backlog triage, wrap-up) by typing directly into the app, which writes back to the markdown files. When a task needs the AI assistant (synthesising a profile from enterprise search, distilling corrections into multiple files), the app produces a copy-paste handoff prompt. Setup is a built-in onboarding flow that gets them from empty folder to first standup — fast or thorough, their choice.

## What v1 taught us — keep these

1. **Markdown is the database.** Files have strict section contracts (see Grounding A). Every screen renders from and writes to those contracts. No hidden state that isn't in a file.
2. **The two-pane ritual layout works.** Left pane: read-only "OS State" panel showing what the markdown files currently say (with filename + staleness badge). Right pane: today's inputs. Keep this.
3. **The handoff pattern works — when it's earned.** A "handoff dock" that collects a structured markdown prompt with a one-click **Collect & Copy** button, char/byte count, and a preview. Keep the component; use it far less often (see Fix #3).
4. **Autosave everywhere.** Fields save on debounce with a tiny "Saving… / Saved" indicator. No Save buttons in ritual flows.
5. **Staleness is a first-class signal.** Every durable file carries `# Title · Updated: YYYY-MM-DD`. The UI shows fresh/aging/stale badges (active files stale after 2 working days; learnings entries flagged after 30 days).
6. **Structured review beats raw markdown.** v1's best screen parsed a long AI-generated profile into per-section cards where each claim ("fact") could be accepted / edited / removed with status chips (Confirmed / Derived / Unknown). Keep and generalise this.

## What v1 got wrong — fix these

### Fix 1 — One app, one entry point
v1 shipped two npm scripts (`npm run dev` opened the daily app, `npm run onboard` opened a separate onboarding wizard). That split sucks. **v2 is a single app.** Onboarding is a route inside it, reachable from a persistent, obvious place in the shell (see Fix 4). First launch with no context files lands you in onboarding automatically; after that it's always one click away, never a separate process.

### Fix 2 — Onboarding offers three depths of upfront context
Replace the linear 6-phase wizard with a **choose-your-depth** entry screen. Three cards, honest about cost and payoff:

1. **Bare minimum** (~3 min) — "Just enough to get to work." Name, role, today's top priority. The AI learns the rest as you work; the app nudges you to enrich the foundation over time (an ambient "foundation completeness" meter, never a nag wall).
2. **One-shot via Glean** (~10 min) — "Absorb everything Glean knows about me." Generates the bootstrap research prompt, the user runs it in their Glean-connected assistant, the app detects the resulting `context/profile.md` and drops them into the structured review screen (accept/edit/remove each claim), then distils the foundation files.
3. **Curate this** (30–60 min) — "Hand-craft a solid foundation now; every answer after is sharper from prompt one." A guided, form-based deep interview covering identity, working style, team, stakeholders, org taxonomy, glossary, priorities. All CRUD, no AI required.

All three paths converge on the same outcome: populated foundation files + a verified assistant handshake + the first standup. Paths are resumable and upgradeable — someone who chose Bare Minimum can later run the Glean or Curate path from the Foundation area without redoing anything.

### Fix 3 — Rebalance CRUD vs AI handoff
v1 assumed AI handoff for almost everything. Wrong default. **v2 rule: if the user can express the change directly, the app writes the file — no AI involved.** Editing a priority, fixing a stakeholder's role, adding a glossary term, reordering a list: direct CRUD with autosave into the markdown contract.

Reserve the handoff dock for tasks that genuinely need the assistant:
- Researching + generating the Glean profile
- Distilling an updated profile into `me.md` / `org.md` / `active.md`
- Session harvest (append learnings), first standup verification

Every handoff card must say *why* this step needs the assistant, in one sentence. If we can't write that sentence, it should be a CRUD interaction instead.

### Fix 4 — Two modes, one obvious switch
The app has exactly two modes, and the user always knows which one they're in:

- **Work** — daily rituals: Today (standup), Backlog, Wrap-Up, plus reference views (Health, Decisions, Questions).
- **Foundation** — curating the OS itself: profile, me/org/active files, org taxonomy, glossary, skills registry, memory pruning, and the onboarding/re-onboarding flows.

Put a segmented **Work / Foundation** switch at the top of the sidebar (think Slack's workspace switcher or Linear's workspace/settings split — instant, spatial, impossible to miss). Each mode has its own nav list and its own accent treatment so a glance tells you where you are. Onboarding lives in Foundation; the "resume setup" card in Work mode deep-links into it.

### Fix 5 — Intuitive design over in-app education
v1 leaned on walls of explanatory text and marketing-style headings. v2 principle: **the interface teaches by shape, not by copy.**

- Max one sentence of helper text per screen section. No paragraph-length intros, no benefit statements, no "Why this matters" blocks.
- Empty states do the onboarding: an empty Backlog shows a ghost row with placeholder text, not an essay about what backlogs are for.
- Progressive disclosure: raw markdown, advanced options, and full handoff payloads live behind a collapsed "View raw" disclosure — never the primary surface.
- Labels are verbs and nouns ("Add priority", "Review claims"), not slogans.
- If a flow needs explaining, redesign the flow.

## The markdown↔UI component library (build this deliberately)

v1 grew these organically inside one giant file. In v2, make them a **first-class, reusable library**: every component binds a markdown section shape to an editing UI, renders from parsed markdown, and writes back in the exact canonical shape. A section's renderer is selected by shape (with per-heading overrides) — never dumped as raw text.

| Component | Markdown shape it binds | UI + behaviour |
|---|---|---|
| **KV Grid** | Two-or-more-column table, or `**Key:** value` bullets | Label/value grid; inline edit per cell; multi-column rows edit as a row |
| **Item List** | Flat `- item` bullets | Reorderable list; add row pinned at bottom; swipe/click to remove |
| **Fact List** | Prose or bullets carrying claims | Per-claim cards: status chip (Confirmed / Derived / Unknown) + accept / edit / remove triage |
| **Taxonomy Picker** | `##` heading → `-` bullet → nested `-` bullet hierarchy | Cascading picker (Business Area → Portfolio → Squad); manage the tree itself in Foundation mode |
| **Priority Rows** | `<title> — Owner: <o> — Due: <date>` lines | Structured rows: title input, owner select, date picker |
| **Section Text** | Free-prose section body | Autosave textarea with markdown-lite preview |
| **Glossary Table** | One-per-line term list | Two-column term/definition editor with search |
| **OS State Panel** | Whole file | Read-only rendered view: filename, staleness badge, sections |
| **Staleness Badge** | `Updated: YYYY-MM-DD` header | fresh / aging / stale pill, threshold per file type |
| **Handoff Dock** | n/a (output) | Collect & Copy prompt block: preview, char count, one-line "why AI" |
| **Autosave Field** | Any single value | Input/textarea with debounce save + Saving/Saved dot |

Rule: any new file section must be expressible in one of these components before it ships. If it can't, extend the library — don't hand-roll a one-off.

## Screens

**Shell:** left sidebar with Work/Foundation switch, mode-specific nav, user chip, theme toggle, foundation-completeness meter (subtle ring or bar).

**Work mode**
- **Today** — two-pane standup: OS State (priorities, blockers, suggested first action) left; focus / big-frog / noise inputs right; wrap with a small handoff only for the assistant-verified standup.
- **Backlog** — zero-friction capture list; triage each item to a destination (priority, project, question, decision) via CRUD; handoff only for bulk "process my backlog" synthesis.
- **Wrap-Up** — day close: what moved, new learnings (writes to memory), streak indicator.
- **Health / Decisions / Questions** — reference views rendered from their files with inline editing.

**Foundation mode**
- **Overview** — file map with staleness at a glance; completeness meter; entry points to the three onboarding depths.
- **Profile** — the fact-list review screen for `context/profile.md` (the v1 crown jewel, now permanent, not onboarding-only).
- **Me / Org / Active** — contract-bound editors built from the component library.
- **Org Structure** — taxonomy tree editor.
- **Onboarding** — the three-depth chooser and its flows (Fix 2).

## Visual direction

Keep v1's bones: Inter + JetBrains Mono, shadcn/Radix components, Tailwind, light/dark themes, calm neutral surfaces with a single confident accent color per mode (e.g. indigo for Work, warm amber for Foundation). Density like Linear: compact, keyboard-friendly, generous whitespace only where it aids scanning. Monospace for filenames, dates, and byte counts. No hero sections, no illustration blobs, no marketing gradients.

## Technical notes for the prototype

- Stack: React + TypeScript + Tailwind + shadcn/ui (matches v1; we will port back into a Vite/TanStack Start local app).
- The real app reads/writes local markdown via server functions. In Lovable, put all file I/O behind a thin `OsFileStore` interface (`readFile(path) → { updatedAt, sections }`, `writeFile(path, sections)`) and back it with an in-memory mock seeded with realistic fixture content for every file in Grounding A. We swap the implementation later; do not scatter fetch calls through components.
- Writes are full-file canonical re-serialisation (parse → edit → re-emit the whole file in canonical shape), never string surgery.
- Single-user, local, no auth, no backend database.

---

## Grounding A — File contracts (bind UI to these exactly)

Every durable file starts with `# <Title> · Updated: YYYY-MM-DD` (line 1, real date).

- **`context/me.md`** — four bullets: `**Role:**`, `**Working style:**`, `**Team:**`, `**Key tools:**` → KV Grid.
- **`context/org.md`** — sections `## Team structure` (prose → Section Text), `## Key stakeholders` (rows: name | role | relationship → KV Grid multi-column), `## Glossary` (one term per line → Glossary Table). Sensitivity rule: this file is shared with the team — the UI shows a persistent one-line reminder that no personnel data, unreleased roadmap items, or commercial terms belong here.
- **`context/active.md`** — `## Priorities` (lines in exact format `<title> — Owner: <owner> — Due: <YYYY-MM-DD>` → Priority Rows), `## Blockers` (Section Text), `## Open questions` (Item List). Stale after 2 working days.
- **`context/profile.md`** — AI-generated deep profile. `# <Full Name> — AI Context Profile` title; ~19 `##` sections (executive summary, identity, business area, role scope, projects, manager, team, stakeholders, OKRs, decision scope, work style, communication style, cadence, expertise, risks, AI preferences, open questions…). Claims labelled Confirmed / Derived / Unknown → Fact List per section; `Business area` section → Taxonomy Picker; a per-heading override map may suppress sections entirely.
- **`context/org-structure.md`** — taxonomy: `## <Business Area>` → `- <Portfolio>` → `  - <Squad>` → Taxonomy Picker + tree editor.
- **`memory/learnings.md`** — dated one-line entries, append-and-prune; entries >30 days flagged for review → Item List with staleness per row.
- **`BACKLOG.md`** — free bullets, cleared on triage → Item List.

## Grounding B — Handoff block format

All AI handoffs are markdown blocks beginning `## Work HQ handoff · <kind> · YYYY-MM-DD`, followed by `**<Section>**` blocks, ending with an `**Ask**` block. Established kinds: `onboarding` (verify scaffolded files + run first standup), `profile-bootstrap` (Glean research prompt with name/email substituted; instructs the assistant to write `context/profile.md`), `profile-corrections` (edited facts as plain bullets, removed facts as `- **Removed:** <original text>`, removed sections as `**Removed section:** <heading>`; asks the assistant to apply corrections then distil me/org/active). The copied bytes are a contract — the UI may preview them behind a disclosure but must copy them verbatim.

## Grounding C — Assistant handshake

Onboarding verifies the assistant actually loaded the OS by asking the user to paste a one-line prompt; the assistant replies with the user's #1 priority and writes `docs/data/local/handshake.json` (`{ verifiedAt, assistant }`). The app polls for that file and locks the verification step to "✓ Assistant verified at HH:MM", with a manual checkbox fallback for assistants that can't write files. Keep this pattern in all three onboarding depths.
