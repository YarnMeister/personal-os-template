# The Huddle — Interaction Spec · Updated: 2026-07-22

> Status: v1.1 (presentation model, voice deck, and initiative-awareness folded in) · Owner: Jan Jr
> Companion to `docs/lovable-v2-blueprint.md`. Replaces standup/wrap-up with one adaptive ritual, presented as an overlay on the Dashboard (the "desk"). Arrival-time agnostic, forgiving of gaps, guilt-free by contract.

---

## 1. The model

Standup and wrap-up were the same activity wearing two costumes: synchronising **what's in your head, what's in the files, and what the assistant believes**. The Huddle is that one activity, adaptive to when you arrive and how much has piled up. The user brings chaos; the OS untangles, distils, and returns an ordered picture.

```
entropy in ──▶ HUDDLE (unload · untangle · replenish · rebalance · brief) ──▶ order settles into the DESK
```

## 2. Presentation: an overlay on the desk

- The **Start a huddle** button on the Dashboard opens the ritual in a large modal (~90% viewport) that scales up from the button; the desk dims and blurs beneath. The huddle is deliberately *on top of* the current snapshot.
- **Minimise, never destroy.** Escape, click-outside, or the minimise control collapses the modal to a floating pill docked bottom-right showing the current turn ("Huddle · Copilot's turn"). Clicking restores mid-state. Huddle state survives full page reload. When a reply lands while minimised, the pill pulses once and updates ("Reply's in — 5 to review").
- **The settle (finish animation).** On Finish: the modal contracts toward the priorities zone and fades; the desk visibly absorbs the results — priorities FLIP-reorder to their new ranking, the next-big-thing card pulses softly once, the greeting crossfades to "Balance restored — next up: {x}", the huddle button relaxes. ≤800ms, interruptible by any click. No confetti, no badges, no sound.
- Keyboard: `h` starts/restores; Escape minimises.

## 3. Presentation: the conveyor

Inside the modal, exactly **one stage is expanded at a time**:

- **Completed stages** collapse to one-line **receipts** above: check icon, stage name, outcome ("Unloaded 3 thoughts" · "5 items routed · 2 follow-ups flagged" · "Skipped"). Receipts are clickable — reopening a past stage collapses the current one; closing resumes.
- **Upcoming stages** are dimmed one-line stubs below (name + one-line description), not interactive.
- No breadcrumb bar, no progress bar — the receipt rail and stubs are the orientation. A small "2 / 5" may sit in the active card header.
- Confirm/skip collapses the active stage to its receipt and expands the next, smooth-scrolling the new card to the top. Skip appears only on the active card.
- **Waiting never stalls the belt:** a stage waiting on the assistant can be left via "Continue while it works" — it collapses to a pulsing receipt and the belt moves on; the receipt flips to a review badge when the reply lands. Reaching Brief with a review pending shows one line: "1 stage waiting on your review."

## 4. The five stages

Every stage works fully without the assistant (AD-4). Stage-intent lines and all state copy: §7 copy deck.

### Stage 1 — Unload
Dump textarea + type chips (meeting · decision · task · blocker · idea) appending to `BACKLOG.md`. Beneath: the computed **Since last huddle** panel — backlog items added, files changed (mtime via OsFileStore), priorities past due.

### Stage 2 — Untangle *(ping-pong: `huddle-untangle`)*
Handoff carries the dump + open backlog items; the assistant triages each → **priority / decision / question / initiative (Now list or tagged priority) / drop**, flags external follow-ups, and writes a reply file (§6). Proposals render as **TriageCards** (accept / edit / remove — the claim-review component). Items triaged **Drop** never carry a follow-up (selector cleared and disabled). On confirm the **app** writes the routed items via canonical contract writes and clears them from `BACKLOG.md`. Manual fallback: same cards, destination picker.

### Stage 3 — Replenish *(ping-pong: `huddle-refresh`, optional)*
The sweep handoff asks the assistant to check external sources per `memory/tools.md` **and whether the resource maps still match reality**: upcoming meetings, assigned tickets, mentions, doc updates, changed resources, and anything new it can see (a fresh Miro board, a new Slack channel). Reply candidates render as TriageCards; accepting a map suggestion adds the row to that initiative's Resource map. No MCP / skipped → collapses to one line.

### Stage 4 — Rebalance
Every standing priority gets one-tap verdicts **keep · bump · done · drop**; accepted new items slot in; drag to reorder; the top item becomes the suggested next big thing. Confirm rewrites `context/active.md` canonically with today's date (button label: **"Update priorities"** — never a filename). Staleness is cured as a side effect of the ritual, never by nagging.

### Stage 5 — Brief
The payoff: refreshed ordered priorities, next big thing, one suggested first action, outcome line ("4 items routed, 2 priorities retired."), and the **Follow-ups queue** — resource-aware: a follow-up tied to an initiative offers that initiative's resources as targets; a `COPILOT` resource produces a handoff, a `MANUAL` one a checklist row with the deep link, its Reviewed date, and "mark reviewed" on completion. Finishing records `lastHuddle` + a `memory/usage-log.md` row (`kind: huddle`, gap, items routed) and triggers the settle (§2).

## 5. The forgiveness engine

`gap = now − lastHuddle` (from `docs/data/local/huddle-state.json`) tunes emphasis, never gates:

| Gap | Mode | Behaviour |
|---|---|---|
| < 4 h | Quick sync | Stage 1 collapses to one line; stage 3 defaults skipped; ~1 min. |
| Same/next day | Standard | All stages, light recap. |
| 2–5 days | Catch-up | Since-last-huddle panel expands and leads; catch-up estimate on the CTA ("~10 min"); staleness amnesty. |
| > 5 days | Recovery | The untangle Ask adds: "active.md is likely stale — reconstruct candidate priorities from the backlog, signals, and recent file changes." Rebalance expects a rebuild. |

**Catch-up estimate:** computed from signal volume; shown as a small honest number on the Dashboard CTA. It converts dread into a priced task.

**Tone contract (binding):** never *missed / forgot / overdue*. The app reports what it can pick up: "since we last spoke…", "here's what piled up." One sentence per stage.

## 6. The ping-pong protocol (files as the bus)

UI → assistant: versioned handoff blocks via **Copy for Copilot** (`## Work HQ handoff · huddle-untangle · YYYY-MM-DD`). Assistant → UI: reply files at pinned paths, detected by file-watch. The Ask includes verbatim:

> Write your reply to `docs/data/local/huddle/reply-untangle.md` using the reply format below, then tell me it's ready. Do not apply any changes to context files yourself — the app will apply what I confirm.

**Reply contract:**

```markdown
## Huddle reply · untangle · 2026-07-22

**Routed**
- <item text> → priority | Owner: Me | Due: 2026-07-25 | Initiative: <slug|ad-hoc>
- <item text> → decision
- <item text> → question
- <item text> → initiative:<slug>
- <item text> → drop

**Follow-ups**
- <item text> → <resource name or type>: <suggested title>

**Map suggestions**            (refresh replies only)
- <initiative slug> → | <Name> | <type> | <url> | manual | <today> |

**Notes**
- <anything the assistant wants the user to see>
```

**Rules:** pinned paths per kind (`reply-untangle.md`, `reply-refresh.md`), directory gitignored, files cleared on huddle completion · replies are proposals — the app applies only after triage confirmation · malformed reply → soft error card (view raw / retry / manual), never a dead end · no reply → waiting state always offers copy-again and do-it-manually; waiting is never modal.

## 7. Copy deck (verbatim strings — implementers add nothing)

**Intent lines** (under each active stage header):
- Unload: "Empty your head — I'll keep track from here."
- Untangle: "Now I'll sort what you dumped. This one's a relay: I write the prompt, you run it."
- Replenish: "Want me to check what's headed your way — and whether our map still matches reality?"
- Rebalance: "Old plan, meet new reality — rule on each one."
- Brief: "Balance restored. Here's where you stand."

**Turn chip** (Untangle/Replenish header): `YOUR MOVE` → `COPILOT'S TURN` → `YOUR REVIEW` → (chip gone, receipt takes over).

**Untangle states** (Replenish mirrors):
- Ready: "Your dump plus {n} backlog items, instructions included. Take it to Copilot." · button **"Copy for Copilot"** · after copy: "On your clipboard — paste it into your assistant, then come back."
- Waiting: "Watching for the reply. Keep moving if you like — I'll flag it here the moment it lands." · buttons "Copy again" · "Route it myself" · "Continue while it works".
- Reply arrived: "Copilot suggests homes for {n} items. Accept, tweak, or toss." · confirm **"Make it so"** · minimised badge: "Reply's in — {n} items to review".
- Manual: "No assistant handy — point each item where it belongs."
- Unreadable reply: "I couldn't read that reply. Try again, or route it yourself." · "View raw" · "Copy again" · "Route it myself".
- Replenish ready: "I've written a sweep request for whatever your assistant can reach." · reply arrived: "{n} signals worth a look." · empty: "Nothing new out there — moving on."

**One-time explainer** (first-ever Untangle, dismissible, never again): "How we talk: I write the prompt → you ferry it to Copilot → it writes a file back → I pick it up. You never wait on either of us."

**Receipts:** "Unloaded {n} thoughts." · "{n} items routed · {m} follow-ups flagged." · "Swept — {n} signals added." · "Skipped." Counts always real.

## 8. Cross-references

- Dashboard zones, drawer, keyboard map, voice rules: blueprint (`docs/lovable-v2-blueprint.md`).
- Reply/handoff byte contracts and file paths: §6 here, mirrored in blueprint Grounding B.
- Retired by this spec: Today/standup, Wrap-Up, streaks, `standup-verify` and wrap-up handoff kinds, the Work-mode multi-page nav.
- Components introduced: TriageCard, SinceLastPanel, TurnChip, HandoffDock waiting state (library table in the blueprint).
