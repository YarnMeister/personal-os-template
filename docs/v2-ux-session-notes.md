# v2 UX Session Notes · Updated: 2026-07-20

> Working notes from the 2026-07-20 Lovable iteration session. Resume here tomorrow.
> Status: Lovable prototype underway and looking strong. Blueprint + tech stack + Glean prompt are merged to main (PRs #2, #3). Below: what's decided but not yet folded into the blueprint, and tonight's open items.

---

## Decided in-session, prompts already given to Lovable (not yet in blueprint)

These three are agreed and have paste-ready prompts (in the session chat); they still need to be folded into `docs/lovable-v2-blueprint.md` as a "v2.1 UX amendments" PR.

### 1. My Profile page merge
"Profile" and "Me" nav items are ambiguous → one Foundation page, **My Profile**. `context/me.md` KV grid renders at the top as a "Snapshot" section (labelled as what the assistant loads daily), the `context/profile.md` claim-review sections below. Two files, two staleness badges, one page — merged view, never merged data. Empty `profile.md` → snapshot + invitation to run Glean/Curate path. Remove "Me" from nav.

### 2. Bootstrap Profile step made functional
The One-shot via Glean / Curate cards become real selections. Glean path inline: name + email fields → Collect & Copy of `templates/glean-bootstrap-prompt.md` (fetched via OsFileStore, placeholders substituted, copied verbatim) → waiting state → file-watch detects `context/profile.md` → "Review claims →". The misplaced `HANDOFF · ONBOARDING` dock moves from step 3 to the final "Connect assistant" step.

### 3. Inline wizard + first-run discovery (combined prompt)
- **One completion rule:** a step is complete when its *file contains real content* (not when a page was visited). No "Mark undone"; steps revert automatically if a file goes back to placeholder.
- **Wizard does the work inline:** each step embeds the same editing component its Foundation page uses (Me grid, Org editor, Active priority rows, taxonomy tree, handshake verify). Only "Run first standup" / "Run first wrap-up" exit into Work mode. No more shortcut-buttons-to-tabs (was 3 clicks to reach an editor).
- **Discovery, three states:** (1) fresh app + placeholder files → auto-route to Onboarding on every launch until completed or "Skip for now"; (2) in-progress/skipped → persistent Setup card at bottom of sidebar in both modes (progress ring, next step, deep link; collapsible, never dismissible, gone at 8/8); (3) complete → card vanishes, nav item relabels "Setup ✓" for re-runs. Card returns if a file reverts to placeholder.
- **Placeholder banner** on Work ritual pages while in state 2: one dismissible line — "Your assistant is running on placeholder context — finish setup for real answers."

---

## Tonight's new items (raw, to design tomorrow)

1. **Launch modal.** When the app loads and onboarding isn't done, pop a modal that takes the user to the right place to finish setup.
   - *Tension to resolve:* the combined prompt above says auto-*route* to Onboarding (no modal). Modal + route is double; pick one. Likely resolution: auto-route while foundation is pure placeholder (nothing to see anyway); switch to modal-on-launch once partially onboarded (user has real content, don't yank them — offer). Decide tomorrow.

2. **Progressive unlock of Foundation nav.** Pre-onboarding, the Foundation tab shows only **Setup** — no Overview / My Profile / Org / Active / Org Structure. Each nav item unlocks as its step completes.
   - Fits the "teach by shape" principle: nav that grows as your foundation grows.
   - *Design question:* unlock keyed to the same file-content completion rule (consistent), and does Overview unlock first or last (probably last — it's a health view over the other files)?
   - *Edge case:* user who skipped onboarding but hand-writes files in VS Code — unlock must derive from file state, not wizard progress, or the nav lies.

3. **Setup lands on three pathways.** Setup's first screen = choose your depth: **Minimum** (least needed to get Today working), **Glean bootstrap**, **Maximum effort** (manually curated foundation).
   - This is the blueprint's Fix 2 (Bare minimum / One-shot via Glean / Curate this) finally surfacing as the wizard's entry screen — Lovable built the 8-step checklist without the depth chooser. Reconcile: pathway choice determines *which of the 8 steps are required vs optional* for completion (e.g. Minimum = Fill Me + Seed Active + Connect assistant only).
   - *Design question:* how the Setup card's "n of 8" adapts per pathway (n of 3 for Minimum?).

## Other loose threads

- `me.md` "Key tools" distillation may come out thin now the profile has no tools inventory — if testing confirms, add a one-question prompt at lock-in ("your 3–4 daily tools?").
- Foundation Overview "Completeness 1/5" vs checklist "3/8": two progress systems; sidebar card counts checklist, Overview meter stays file-based — make sure Lovable didn't wire them together.
- v1's downstream tools-section hacks (`**Removed section:**` directive, `'suppressed'` renderer) are obsolete for v2 — drop them from the v2 corrections handoff spec when we next touch it.

## Tomorrow

1. Resolve modal-vs-autoroute, progressive unlock rules, and pathway→required-steps mapping (items 1–3 above).
2. Write the next Lovable prompt covering them.
3. Fold everything (sections above + this) into `docs/lovable-v2-blueprint.md` as the v2.1 UX amendments PR, then delete this notes file.
