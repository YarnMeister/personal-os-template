# The Huddle — Work-Mode Interaction Spec · Updated: 2026-07-22

> Status: Draft for review · Owner: Jan Jr · Companion to `docs/lovable-v2-blueprint.md`
> Replaces the Today/standup + Wrap-Up model in Work mode. Kills scrum ceremony language and the twice-daily cadence assumption. One adaptive ritual, arrival-time agnostic, forgiving of gaps.

---

## 1. The model shift

v1/v2-so-far inherited scrum's shape: a morning ceremony (standup) and an evening ceremony (wrap-up), each guilt-coded to a time of day. Real usage: the user works in focus blocks, arrives at arbitrary times, and sometimes disappears for days. The two ceremonies are actually the *same activity* — synchronising three things that drift apart: **what's in your head, what's in the files, and what the assistant believes.**

So there is one ritual: the **Huddle**. A huddle at 9am naturally leans planning; at 6pm it leans logging; after four days away it leans reconciliation. The surface is identical — only the emphasis adapts. The user brings chaos (disjointed notes, half-remembered meetings, unlogged decisions); the OS untangles, distils, and returns an ordered picture. **Balance restored** is the ritual's terminal state, every time.

Core loop:

```
entropy in ──▶ HUDDLE (untangle · replenish · rebalance) ──▶ order out ──▶ NOW (rest state)
```

## 2. Work-mode nav (new)

| Item | Role |
|---|---|
| **Now** | Landing page. The current brief: ordered priorities, next big thing, blockers. Read-mostly rest state. |
| **Huddle** | The ritual. Adaptive staged flow (§4). Shows a subtle signal dot when things have piled up. |
| **Backlog** | Zero-friction capture, unchanged. Feeds the Huddle. |
| **Decisions / Questions** | Reference views, unchanged. |

"Today", "standup", and "Wrap-Up" disappear from all nav, headers, eyebrows, and handoff kinds.

## 3. The Now page (rest state)

- Greeting is time-of-day + gap aware, one line, never guilt-coded. It reports what the app can *pick up*, not what the user missed:
  - Same day: "Back again. Your next big thing: **{bigFrog}**."
  - Next day: "Morning. 3 priorities standing, 1 blocker. Ready when you are."
  - After a gap: "It's been 3 days — 7 new backlog items and 2 priorities past due. **~10 min huddle** should restore order."
- Body: the ordered priority list (from `active.md`), next big thing, blockers, open-question count.
- Primary CTA: **Start a huddle** — sized by need (see catch-up estimate, §5). If everything is fresh and quiet, the CTA is quiet too ("Quick sync").
- No streaks, no heatmaps, no "overdue" reds. The only pressure mechanism in the entire Work mode is the honest sentence about what's piled up.

## 4. The Huddle flow

A hybrid conversation/wizard: five stages rendered as a single scrolling thread of cards (chat-like progression, wizard-like structure). Every stage has a **no-assistant fallback** (AD-4: local CRUD always completes) and stages 2–4 each have an optional **ping-pong** with the assistant (§6). Stages can be skipped; skipping is a first-class button, not a buried link.

### Stage 1 — Unload
*"What's happened since we last spoke? Messy is fine."*

- One large free-text dump box + quick-capture chips (meeting · decision · new task · blocker · idea) that prefix entries for cheaper triage later.
- Everything appends to `BACKLOG.md` — the existing inbox is the buffer; no new storage concept.
- Beneath it, an auto-collected **Since last huddle** panel (computed, read-only): backlog items added, files changed (mtime via OsFileStore), priorities past due, glean-profile/foundation edits detected. The app demonstrates it was paying attention even while the user was gone.

### Stage 2 — Untangle *(ping-pong: `huddle-untangle`)*
*The chaos gets sorted.*

- With assistant: handoff block carries the dump + open backlog items; asks the assistant to triage each item — route to **priority / decision / question / project note / drop**, flag anything needing an external follow-up (ticket, page, doc) — and write a structured reply file (§6). UI detects the reply and renders the proposed routing as **triage cards** (the same accept / edit / remove component as profile claim review).
- Without assistant: the same triage cards, but the user picks each destination manually from a compact picker.
- On confirm, **the app writes the files** (canonical contract writes to `active.md`, `memory/decisions.md`, questions, project notes) and clears routed items from `BACKLOG.md`. The assistant proposes; the app commits after human confirmation — never the reverse.

### Stage 3 — Replenish *(ping-pong: `huddle-refresh`, optional stage)*
*Pull the outside world in.*

- Handoff asks the assistant to sweep external sources per `memory/tools.md` routing (calendar, Jira, Confluence, Glean — whatever MCP it has) and reply with candidate signals: upcoming meetings needing prep, tickets assigned, mentions, doc updates.
- Candidates render as the same triage cards → accepted ones become priorities/questions/prep notes.
- No MCP or no time → stage collapses to a single skipped line. Never blocks, never errors loudly.

### Stage 4 — Rebalance
*Old plan meets new reality.*

- Every existing priority gets a one-tap verdict: **keep · bump · done · drop**. New items from stages 2–3 slot into the list. Drag to reorder; the top item is offered as the next big thing.
- On confirm: `active.md` rewritten canonically with today's date. Staleness cured as a side effect of the ritual — never by nagging.

### Stage 5 — Brief *(the payoff)*
*Balance restored.*

- The regenerated brief: ordered priorities, next big thing, blockers, open questions — plus the **Follow-ups queue** (§7) if stage 2/3 flagged external work.
- One suggested first action.
- Closing line varies by gap ("That's the mess sorted — 4 items routed, 2 priorities retired.").
- This page *is* the new Now page — the huddle ends where the app rests. Log a row to `memory/usage-log.md`; record `lastHuddle` in local state.

## 5. The forgiveness engine (gap-adaptive behaviour)

`gap = now − lastHuddle` (from `docs/data/local/huddle-state.json`). It tunes emphasis, never gates:

| Gap | Mode | Behaviour |
|---|---|---|
| < 4 h | Quick sync | Stage 1 collapses to one line; stages 3 skipped by default; ~1 min. |
| Same/next day | Standard | All stages, light recap. |
| 2–5 days | Catch-up | "Since last huddle" panel expands and leads; catch-up estimate shown ("~10 min"); staleness amnesty — everything refreshes as part of the flow, zero shame copy. |
| > 5 days | Recovery | Assistant-led: the untangle handoff includes "active.md is likely stale — reconstruct candidate priorities from the backlog, signals, and recent file changes." The app assumes the files are wrong, not the user. |

**Catch-up estimate:** computed from signal volume (backlog count, overdue priorities, external candidates). Small honest number on the CTA. This converts dread ("I haven't opened it in a week") into a priced, doable task ("10 minutes to restore order").

**Tone contract (binding for all copy):** the app never says *you missed / you forgot / overdue*. It says what *it* can pick up: "since we last spoke…", "here's what piled up", "let's get back up to speed." One sentence per stage, per Fix 5.

## 6. The ping-pong protocol (UI ⇄ assistant, files as the bus)

The app and Copilot never talk directly — the filesystem is the transport, which we already have both directions of: handoff blocks (UI → assistant via clipboard) and file-watch/SSE (assistant → UI via file writes). The huddle formalises it into a request/reply contract:

**Request** — a versioned handoff block (existing format): `## Work HQ handoff · huddle-untangle · YYYY-MM-DD`, carrying the items and ending with an Ask that includes, verbatim, the reply-file instruction:

> Write your reply to `docs/data/local/huddle/reply-untangle.md` using the reply format below, then tell me it's ready. Do not apply any changes to context files yourself — the app will apply what I confirm.

**Reply** — assistant-written markdown at a pinned path, with a contract shape the parser validates:

```markdown
## Huddle reply · untangle · 2026-07-22

**Routed**
- <item text> → priority | Owner: Me | Due: 2026-07-25
- <item text> → decision
- <item text> → question
- <item text> → drop

**Follow-ups**
- <item text> → jira-ticket: <suggested title>
- <item text> → confluence-page: <suggested title>

**Notes**
- <anything the assistant wants the user to see>
```

**Rules:**
- Reply paths are pinned per kind (`reply-untangle.md`, `reply-refresh.md`); the UI file-watches the directory; a detected reply populates the stage live — the "it just noticed" beat again.
- Replies are proposals. The app applies them only after the user confirms the triage cards, via canonical contract writes. The Ask explicitly forbids the assistant writing context files directly in this flow.
- Malformed reply → soft error card ("couldn't read the reply — view raw / retry / do it manually"), never a dead end.
- No reply → the waiting state carries both a "copy again" and a "do it manually" exit at all times. Waiting is never modal.
- Reply files are ephemeral: cleared when the huddle completes; the directory is gitignored (`docs/data/local/`).

## 7. Follow-ups queue (outbound codification)

Stage-2/3 items flagged for external systems accumulate in a visible queue on the Brief/Now page: *"2 tickets to create, 1 page to update."* Each entry has its own small handoff ("Create a Jira ticket: <title, context>…") that the user fires when ready — the assistant does the external write via its MCP; the app never integrates with Jira/Confluence/GitHub directly. Completed follow-ups are checked off manually (or detected in a later huddle's refresh sweep). This is deliberately incremental: over time this queue becomes the codification pipeline — reusable skills to GitHub pages, shared context to Confluence, tickets to Jira — without the app growing a single integration.

## 8. What this deletes/changes elsewhere

- Work nav: `Today`→`Now`, `Wrap-Up` deleted (absorbed), `Huddle` added.
- Handoff kinds `standup-verify` and any wrap-up kind retire; new kinds `huddle-untangle` v1, `huddle-refresh` v1.
- The blueprint's Work-mode screens list and Fix-4 nav sketch need updating; HandoffDock gains a "waiting for reply" state; the component library gains **TriageCard** (generalised from Fact List) and **SinceLastPanel**.
- `memory/usage-log.md` row format gains `kind: huddle` with gap + items-routed counts — the observability that replaces streaks.
