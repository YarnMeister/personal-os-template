# v2 UX Session Notes · Updated: 2026-07-22

> Working notes from the Lovable v2 iteration sessions (2026-07-20 → 2026-07-22).
> Status: Lovable prototype underway and looking strong. Blueprint + tech stack + Glean prompt are merged to main (PRs #2, #3). Below: everything decided but not yet folded into the blueprint. Fold all of it into `docs/lovable-v2-blueprint.md` as a "v2.1 UX amendments" PR, then delete this file.

---

## Decided — prompts already given to Lovable (not yet in blueprint)

### 1. My Profile page merge
"Profile" and "Me" nav items were ambiguous → one Foundation page, **My Profile**. `context/me.md` KV grid renders at the top as a "Snapshot" section (labelled as what the assistant loads daily), the `context/profile.md` claim-review sections below. Two files, two staleness badges, one page — merged view, never merged data. Empty `profile.md` → snapshot + Glean/Curate invitation. "Me" removed from nav.

### 2. Bootstrap Profile step made functional
Glean path inline: name + email fields → Collect & Copy of `templates/glean-bootstrap-prompt.md` (fetched via OsFileStore, placeholders substituted, copied verbatim) → waiting state → file-watch detects `context/profile.md` → "Review claims →". The misplaced `HANDOFF · ONBOARDING` dock moved to the end of onboarding.

### 3. Inline editing everywhere (survives from the wizard rework)
- **One completion rule:** a file/step is "done" when the file contains real content (populated-check: no `[` placeholders, no literal `YYYY-MM-DD`) — never because a page was visited. Content reverting to placeholder reverts the state.
- Editors embed inline (Me grid, Org editor, Active priority rows, taxonomy tree) — same components as the Foundation pages, bound to the same files. No shortcut-buttons-to-tabs.

### 4. Health → nav; two pages killed; Setup as three-path fork (2026-07-22 session, supersedes parts of the earlier discovery spec)
- **Killed:** Health page (Work nav) and Overview page (Foundation nav). All stowaways deleted — wrap-up streak, frequency heatmap, priority churn, contract-drift tile. No relocation.
- **Live health states on Foundation nav items** (derived from OsFileStore, real-time): grey = missing/placeholder · green = real content within staleness threshold · orange = past threshold · red = contract violation (missing required sections / unparseable) only — never size overruns. Compact glanceable notation; nav must not become a dashboard.
- **Setup screen = the fork** (Foundation → Setup; also first-launch landing while foundation is placeholder; "Skip for now" → Today):
  - **Quick start (~3 min)** — inline on the Setup screen itself: name + role (→ `me.md` Role key), 1–3 priorities, owner defaults Me, due optional (→ `active.md`), optional blocker line. Finish → Work → Today.
  - **Glean boost (~10 min)** — the clean prompt experience (item 2 above).
  - **Full setup (30–60 min)** — sequenced inline editors for every foundation file.
  - Paths stackable, never exclusive; Setup stays in nav for re-runs.
- **No completion arithmetic anywhere** — no "n of 8", no progress rings, no checklist rail, no sidebar Setup card, no launch modal. Grey/green nav items are the only progress UI.
- **Glean CTA post-Setup** (until `profile.md` exists): My Profile empty state leads with Glean boost as primary action; Quick-start finish offers one secondary action ("Sharper answers from day one — run the Glean boost"). No other nagging.
- **Connect-assistant step dropped** from onboarding entirely (superficial in VS Code; Copilot works by default). Handshake gating removed. File-watch mechanism kept — powers Glean profile detection.
- Kept: one-time dismissible placeholder banner on Work ritual pages while foundation is placeholder.

## Deferred / parked ideas

- **Verify prompt as diagnostic:** the dropped "confirm you can read my constitution — tell me my #1 priority" prompt should resurface later as a small troubleshooting utility on the Setup page (not an onboarding gate).
- `me.md` "Key tools" distillation may come out thin now the Glean profile has no tools inventory — if testing confirms, add a one-question prompt at claim-review lock-in.
- v1's downstream tools-section hacks (`**Removed section:**` directive, `'suppressed'` renderer) are obsolete for v2 — drop from the v2 corrections handoff spec when next touched.

## Next steps

1. Give Lovable the consolidated prompt from the 2026-07-22 session (item 4 above — full text in session chat).
2. Watch for: Lovable keeping some vestige of the checklist rail, or wiring nav states to wizard progress instead of file content — both would violate the completion rule.
3. Fold items 1–4 + parked ideas into `docs/lovable-v2-blueprint.md` (touches Fix 2, Fix 4, the screens list, and the component library table — StalenessBadge grows into the four-state NavHealth treatment), update `docs/specs/file-contracts.md` §3.2/§4.4 if the handshake drop is made permanent, then delete this file.
