# Work OS v2 — Lovable Design Blueprint · Updated: 2026-07-22

> **How to use this file:** everything below the divider is the design brief for the Work OS v2 app (working title in v1: "Work HQ"). It began as the founding Lovable prompt and is now the running source of truth, updated as the prototype iterates. Companion docs: `docs/specs/tech-stack-v2.md` (target architecture + conversion playbook) and `docs/specs/huddle-spec.md` (the Huddle interaction in full detail).
>
> **Amendment log:** v2.1 (2026-07-22) folds in the iteration decisions: three-plane architecture (desk / overlay / drawer) replacing the two-mode switch; the Huddle replacing standup/wrap-up; live health states on nav replacing the Health and Overview pages; the three-path Setup fork with no completion arithmetic; the My Profile merge; Initiatives with resource maps; the voice & tone system.
>
> **Parked (not in scope, don't lose):** the assistant verify prompt ("confirm you can read my constitution — tell me my #1 priority") returns later as a troubleshooting utility on Setup, not an onboarding gate · if `me.md` "Key tools" distils thin from tool-inventory-free profiles, add a one-question prompt at claim-review lock-in · v1's corrections-handoff tools-section hacks (`**Removed section:**` directive, `'suppressed'` renderer) are obsolete in v2.

---

# Design brief

Design and build **Work OS v2** — a local-first companion app for a "Personal OS": a folder of plain markdown files that an AI assistant (Copilot in VS Code) loads as its standing context. The markdown files are the database. The app's job is to keep those files **accurate, fresh, and easy to maintain** — and to hand work to the AI assistant only where AI genuinely adds value.

## The product in one paragraph

A product manager opens Work OS at any hour, in any state of chaos. One dashboard — their desk — shows everything live: priorities grouped by initiative, blockers, open questions, quick capture into the backlog. When head, files, and assistant have drifted apart, they start a **Huddle**: a guided, conveyor-belt ritual in an overlay on top of the desk, where they unload what happened, the assistant untangles it (via copy-paste ping-pong through the file system), and order visibly settles back into the dashboard. Durable context — profile, org, initiatives and their resource maps — lives in a **drawer** that slides out for curation and back under the desk. Setup offers three honest depths, from three minutes to an hour.

## The three-plane architecture

There are no modes and no multi-page Work navigation. The app is one room with three planes:

| Plane | Surface | Holds |
|---|---|---|
| **Desk** | The Dashboard — always beneath everything | Everything live: priorities, next big thing, blockers, quick capture, open questions, follow-ups |
| **Overlay** | The Huddle modal — on top of the desk | The synchronisation ritual (see `huddle-spec.md`) |
| **Drawer** | Foundation panel — slides from under the desk | Everything durable: My Profile, Org, Initiatives, Active editor, Org Structure, Setup, Decisions log |

Keyboard: `h` starts/restores the huddle · `c` focuses quick capture · `f` toggles the drawer · Escape closes/minimises the top plane.

### The desk (Dashboard)

- **Header:** gap-aware greeting (see Voice) + the **Start a huddle** button carrying an honest time estimate computed from signal volume; drawer handle top-right with an aggregate health dot.
- **Main column:** priorities grouped by initiative with an **Ad hoc** group last (inline edit, drag to reorder, initiative chips); next-big-thing card; blockers.
- **Side column:** **Quick capture** (append to `BACKLOG.md`, chips: meeting · decision · task · blocker · idea); **Open questions** answered inline (resolving asks one optional outcome line → logs to decisions, removes the question); **Follow-ups queue** (see Initiatives).
- **Footer:** last two decisions in one quiet line + "More in the drawer".
- Every daily action is possible in place — zero navigation.

### The overlay (Huddle)

One adaptive ritual replaces standup and wrap-up. Full spec in `docs/specs/huddle-spec.md`; binding summary: five stages (Unload → Untangle → Replenish → Rebalance → Brief) on a conveyor — one stage open at a time, completed stages collapse to one-line receipts, upcoming stages are dim stubs; no progress bars. Stages 2–3 are assistant ping-pong with turn chips (`YOUR MOVE` / `COPILOT'S TURN` / `YOUR REVIEW`) and always have manual fallbacks. The modal minimises to a floating pill (never destroyed; survives reload). Finishing triggers the **settle**: the modal contracts, priorities visibly reorder into the desk, one soft pulse on the next big thing, greeting crossfades to "Balance restored — next up: {x}". ≤800ms, interruptible, no confetti.

### The drawer (Foundation)

Full-height panel from the right (~85% width, 250–300ms ease-out, desk dims with slight parallax). Inside, a nav with **live health states** per file and these sections:

- **My Profile** — one page, two files: the `context/me.md` snapshot grid on top (labelled as what the assistant loads daily), the `context/profile.md` claim-review sections below (accept / edit / remove per claim, status chips Confirmed / Derived / Unknown). Merged view, never merged data; separate staleness badges. No profile yet → snapshot + Glean invitation.
- **Org** — team structure, stakeholders, glossary editors, with the standing sensitivity reminder (shared file: no personnel data, unreleased roadmap, commercial terms).
- **Initiatives** — see below.
- **Active** — the deep editor for `context/active.md` (priorities grouped by initiative, blockers, open questions).
- **Org Structure** — taxonomy tree editor.
- **Decisions** — the decisions log.
- **Setup** — see below.

First launch with a placeholder foundation opens with the drawer out on Setup.

**Nav health states** (derived from OsFileStore, live): **grey** = missing/placeholder · **green** = real content within its staleness threshold · **orange** = past threshold · **red** = contract violation (missing required sections / unparseable) — red is never about size. Compact glanceable notation. There is no Health page and no Overview page; the nav is the health UI, and there is **no completion arithmetic anywhere** (no scores, streaks, progress rings, or "n of m").

## Initiatives (the real-world model)

Foundation-level first-class concept backed by `projects/<slug>.md` (one file per initiative, gitignored). The Initiatives page shows one card per initiative: name, stage chip (Discovery / Delivery / Production / Side project / Paused), next milestone, custodianship line ("12 resources · 2 unreviewed 30d+"). Detail page: editable header (stage, milestone, mission), **Now** focus bullets (feeds the huddle), **Risks** bullets (live top risks), and the **Resource map** — the config-management surface: typed external links (`jira / jpd / miro / confluence / slack / sharepoint / risks`), each row carrying an **Updates badge** (`COPILOT` = publishable from VS Code, `MANUAL`) and a **Reviewed** date with one-click touch; rows unreviewed 30+ days age gently (dimmed date, amber dot — never the word "outdated").

Initiatives thread through everything: priorities/blockers/questions carry initiative chips; huddle untangle can route items **→ initiative**; the Replenish sweep reports changed resources and proposes new map rows; follow-ups tied to a `COPILOT` resource produce a handoff, to a `MANUAL` resource a checklist row with the deep link and a "mark reviewed" on completion. No aggregate custodianship score — dates and dots only.

## Setup (three ways in)

Reached via the drawer; also the first-launch landing while the foundation is placeholder ("Skip for now" → desk with honest empty states). Page header is a question: **"How much should I know before we start?"** Three door-like cards of visibly ascending weight, one conversational headline + time badge + one payoff line each:

1. **Quick start** · ~3 min — "Give me three minutes." Captured inline on the Setup screen itself: name + role (→ `me.md` Role key), 1–3 priorities (owner defaults Me, due optional → `active.md`), one optional blocker. Finish lands on the desk. Secondary action offered once at finish: "Sharper answers from day one — run the Glean boost."
2. **Glean boost** · ~10 min — "Let me read up on you." Name + email → **Copy for Copilot** emits `templates/glean-bootstrap-prompt.md` verbatim with `[FULL_NAME]`/`[WORK_EMAIL]` substituted (payload-only file: whatever it contains is exactly what the button copies) → the app file-watches for `context/profile.md` → "Review claims →" into My Profile.
3. **Full setup** · 30–60 min — "Tell me everything." Sequenced inline editors for every foundation file, the same components the drawer pages use.

Paths are stackable, never exclusive. Completion is always **derived from file content** (the populated-check: no `[` placeholders, no literal `YYYY-MM-DD`), never from visits — content reverting to placeholder reverts the state (and the nav dot). There is no Connect-assistant step and no handshake gate. Until `profile.md` exists, My Profile's empty state leads with the Glean boost; that is the only standing CTA.

## What v1 taught us — still binding

1. **Markdown is the database.** Strict per-file section contracts (Grounding A); every screen renders from and writes back to them; no hidden state that isn't in a file. Writes are full-file canonical re-serialisation, never string surgery.
2. **CRUD first, AI earned.** If the user can express a change directly, the app writes the file. Handoffs are reserved for genuinely AI-shaped work (profile research, triage, distillation, external publishing) — and every handoff card must justify itself in one sentence. If we can't write that sentence, it's a CRUD interaction.
3. **The handoff pattern, formalised as ping-pong.** UI → assistant: versioned handoff blocks via **Copy for Copilot** (byte-exact contracts, preview behind "View raw"). Assistant → UI: reply files at pinned paths under `docs/data/local/`, detected by file-watch, rendered as reviewable proposals. The assistant proposes; the app writes after human confirmation — never the reverse.
4. **Autosave everywhere; staleness is a first-class signal** (`# Title · Updated: YYYY-MM-DD` headers; per-file thresholds).
5. **Structured review beats raw markdown.** Claim triage (accept/edit/remove + status chips) is the template for every AI-proposal surface.

## Voice & tone (binding, app-wide)

The app speaks in first person as a calm, competent aide — dry, warm, brief. Personality lives in **utterances** (headlines, CTAs, greetings, receipts, empty states); body copy, forms, and errors stay neutral. The visual signature is the contrast: warm human type for what the app *says*, cool monospace for what the app *knows* (data, filenames, dates).

Hard rules: no exclamation marks · no emoji in copy · no praise or celebration copy · no feature-brochure phrasing · banned words: *missed, forgot, overdue* — the app reports what it can pick up, never what the user failed to do · max one sentence of helper copy per surface · buttons use plain human verbs ("Let's go", "Make it so", "Update priorities") — never filenames or jargon · no mascots, no illustrations, no marketing gradients.

Canonical examples: gap greeting "It's been 3 days — 7 new backlog items, 2 priorities past due. ~10 min huddle should restore order." · receipt "5 items routed · 2 follow-ups flagged." · empty backlog "Nothing on my radar yet — unload what's in your head." · aging resource "Haven't looked at this together in a while."

## The markdown↔UI component library

Every component binds a markdown section shape to an editing UI: renders from parsed markdown, writes back the exact canonical shape. Renderer selection is shape-based with per-heading overrides — raw markdown is never the primary surface. Any new file section must be expressible in one of these before it ships; extend the library rather than hand-rolling one-offs.

| Component | Binds | UI + behaviour |
|---|---|---|
| **KV Grid** | Multi-column table or `**Key:** value` bullets | Label/value grid; inline edit; multi-column rows edit as a row |
| **Item List** | Flat `- item` bullets | Reorderable; add-row pinned at bottom; remove per row |
| **Fact List / TriageCard** | Claims (prose or bullets); AI proposals | Per-claim: status chip + accept / edit / remove. Same component reviews huddle reply proposals |
| **Taxonomy Picker** | `##` → `-` → nested `-` hierarchy | Cascading picker + tree editor |
| **Priority Rows** | `<title> — Owner — Due — Initiative` lines | Structured rows: title, owner select, date, initiative chip; grouped by initiative |
| **Resource Map** | Typed link table | Typed icons, Updates badge (`COPILOT`/`MANUAL`), Reviewed date + touch, gentle aging |
| **Section Text** | Free prose | Autosave textarea, markdown-lite preview |
| **Glossary Table** | One term per line | Term/definition editor with search |
| **Quick Capture** | Appends to `BACKLOG.md` | Always-ready input + type chips |
| **NavHealth** | `Updated:` header + populated-check + contract validation | Four-state dot: grey / green / orange / red |
| **Handoff Dock** | Output contract | **Copy for Copilot**, char/byte count, "View raw" disclosure, one-line why-AI, waiting state |
| **TurnChip** | Ping-pong state | `YOUR MOVE` / `COPILOT'S TURN` / `YOUR REVIEW` |
| **SinceLastPanel** | Computed signals | Read-only recap: items added, files changed, past due |
| **Autosave Field** | Any single value | Debounced save + Saving/Saved dot |

## Visual direction

Inter + JetBrains Mono, shadcn/Radix, Tailwind, light/dark. Calm neutral surfaces; one confident accent for the desk/overlay (indigo family) and a warm accent for the drawer (amber family) so the plane is always legible. Density like Linear. Monospace for filenames, dates, counts. Motion is functional and short: drawer slide 250–300ms, receipt collapse ~150–200ms, the settle ≤800ms; no bounce.

## Technical notes for the prototype

- React + TypeScript + Tailwind + shadcn/ui (conversion target: `docs/specs/tech-stack-v2.md`).
- All file I/O behind the `OsFileStore` interface (`readFile(path) → { updatedAt, sections }`, `writeFile(path, sections)`), backed in Lovable by an in-memory mock seeded with **fictional** fixture content for every file in Grounding A — never real initiative names, dates, or personnel. File-watch events are simulated through the same interface.
- Huddle reply files live under `docs/data/local/huddle/` (mocked the same way) and are cleared when a huddle completes. Huddle state survives reload.
- Single user, local, no auth, no backend database, no external integrations — external systems are reached only by the user's assistant via its own MCP.

---

## Grounding A — File contracts (bind UI to these exactly)

Every durable file starts `# <Title> · Updated: YYYY-MM-DD` (real date). A file is "populated" when it contains neither `[` nor literal `YYYY-MM-DD`. v1's shipped contracts remain documented in `docs/specs/file-contracts.md`; the deltas below are v2-binding.

- **`context/me.md`** — bullets `**Role:**`, `**Working style:**`, `**Team:**`, `**Key tools:**` → KV Grid. (Quick start writes Role only; the rest fills over time.)
- **`context/org.md`** — `## Team structure` (Section Text), `## Key stakeholders` (rows name | role | relationship → KV Grid), `## Glossary` (Glossary Table). Shared file — sensitivity reminder always visible.
- **`context/active.md`** — `## Priorities` lines in the exact format `<title> — Owner: <owner> — Due: <YYYY-MM-DD> — Initiative: <slug|ad-hoc>` (v2 adds the Initiative tag) → Priority Rows; `## Blockers` (Section Text, optional initiative chip); `## Open questions` (Item List, optional initiative chip). Stale after 2 working days.
- **`projects/<slug>.md`** *(new in v2 — one per initiative, gitignored)* — header lines `**Stage:**` (Discovery | Delivery | Production | Side project | Paused), `**Next milestone:**`, `**Mission:**`; `## Now` (Item List); `## Risks` (Item List); `## Resources` (table `| Name | Type | Link | Updates | Reviewed |`, Type ∈ jira/jpd/miro/confluence/slack/sharepoint/risks, Updates ∈ copilot/manual, Reviewed = `YYYY-MM-DD`) → Resource Map.
- **`context/profile.md`** — AI-generated: `# <Full Name> — AI Context Profile`, ~18 `##` sections labelled Confirmed / Derived / Unknown → Fact List per section; `Business area` → Taxonomy Picker. Deliberately no tools/systems inventory section — the bootstrap prompt forbids it.
- **`context/org-structure.md`** — `## <Business Area>` → `- <Portfolio>` → `  - <Squad>` → Taxonomy Picker + tree editor.
- **`memory/learnings.md`** — dated one-liners, append-and-prune, entries >30d flagged → Item List.
- **`memory/decisions.md`** — dated decision entries (fed by inline question-resolution and huddle routing) → Item List, read-mostly.
- **`BACKLOG.md`** — free bullets, optionally type-prefixed by capture chips; cleared as items route → Quick Capture + Item List.

## Grounding B — Handoff & reply contracts

**Handoffs (UI → assistant):** markdown blocks starting `## Work HQ handoff · <kind> · YYYY-MM-DD`, `**<Section>**` blocks, `**Ask**` last. Copied bytes are a contract — preview behind a disclosure, copy verbatim. Active kinds: `profile-bootstrap` (the entire `templates/glean-bootstrap-prompt.md` with `[FULL_NAME]`/`[WORK_EMAIL]` substituted — nothing prepended or appended), `profile-corrections` (edited facts as bullets; removed facts as `- **Removed:** <original>`), `huddle-untangle`, `huddle-refresh`, and per-follow-up handoffs. Retired in v2: `onboarding`, `standup-verify`, wrap-up kinds, and the unconditional tools-section removal directive.

**Replies (assistant → UI):** pinned paths under `docs/data/local/huddle/` (`reply-untangle.md`, `reply-refresh.md`), shape `## Huddle reply · <kind> · <date>` with `**Routed**` / `**Follow-ups**` / `**Notes**` blocks — full contract in `huddle-spec.md` §6. Replies are proposals; the app applies them only after triage confirmation. The Ask in every huddle handoff instructs the assistant to write the reply file and *not* to edit context files directly.

## Grounding C — Assistant coupling

There is no onboarding handshake in v2. The assistant coupling is: (a) it auto-loads `AGENTS.md` and the context files natively in VS Code; (b) it receives handoffs by paste; (c) it writes files (profile, huddle replies) that the app detects by watching the workspace. The v1 verify prompt is parked as a future Setup-page diagnostic.
