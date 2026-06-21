# Milestone 4 — Architectural Review · Updated: 2026-06-21

> Reviewer: BMAD Systems Architect · Scope: M4 ("Quality Loop & Authoring") · Ground truth: `docs/specs/architecture.md` (AD-4, AD-6, AD-8, §6 M4 criteria, NFR Observability) · Prior context: `docs/specs/m3-arch-review.md`

### Overall Assessment

M4 is a faithful, high-quality implementation. The golden-eval loop (AD-6 / NFR Observability) is well-designed: five evals each carry an actionable, named-file staleness pointer, the quality target (≥4.0/5, zero below 3) is documented, and the run procedure is self-contained enough for a non-technical monthly reviewer. Product-Writer correctly treats Confluence publish as the default with graceful local-retain degradation (AD-4 / OQ-6), carries valid frontmatter, and references `memory/eval.md`. The four templates are consistent and useful. AGENTS.md stays well under budget.

There are **no release-blocking defects**. One MEDIUM issue (usage-log column-format divergence between the golden-eval logging spec and the as-built `usage-log.md` table) should be reconciled so monthly trend calculation is unambiguous. The rest are LOW.

### Issues Found

**Issue 1 — golden-eval log format vs. usage-log.md table shape diverge**
- **Severity:** MEDIUM
- **Dimension:** NFR Observability / AD-6
- **Finding:** `golden-evals.md` instructs logging as `date | golden-eval | eval-ID | score | notes` (5 fields, with a literal `golden-eval` marker and a per-eval ID). The as-built `memory/usage-log.md` table has columns `Date | Task type | MCP sources | Quality | Notes`. The golden-eval row does not map cleanly: there is no `eval-ID` column and `MCP sources` has no golden-eval analogue. A monthly reviewer pasting five rows in the prescribed format will produce rows that misalign with the existing table, making per-eval trend extraction error-prone.
- **Release-blocking:** NO
- **Recommendation:** Reconcile to one shape. Cleanest: log golden-eval rows into the existing table as `<date> | golden-eval <eval-ID> | None | <score> | <notes>` (Task type carries `golden-eval 001`, MCP sources = None). Update the `golden-evals.md` step-4 format string to match the live table so the two specs agree.

**Issue 2 — Product-Writer references Lenny skills that do not yet exist**
- **Severity:** LOW
- **Dimension:** AD-8 / §3 catalogue
- **Finding:** SKILL.md references `writing-prds`, `stakeholder-alignment`, `roadmap-prioritisation`, `metrics-and-analytics` and instructs "Load .github/skills/[skill-name]/SKILL.md". Only chief-of-staff, researcher, and product-writer exist on disk; the Lenny set is M5-scoped (§3 `<lenny>` row). The instruction therefore dangles today — same defect class as M3 Issue 3 (documented path that does not resolve).
- **Release-blocking:** NO
- **Recommendation:** Either gate the Lenny section with a "(available from M5)" note, or have the skill degrade gracefully if the referenced file is absent. Confirm the Lenny fork lands in M5 before relying on these paths.

**Issue 3 — Eval 003 references "Story 004" — an artefact-tracking leak**
- **Severity:** LOW
- **Dimension:** AD-6 / hygiene
- **Finding:** Eval 003's staleness pointer says "Ensure the Chief-of-Staff session harvest is running (Story 004)." A story ID is an implementation-tracking reference that a monthly reviewer reading only `memory/` cannot resolve. The pointer should name the file/behaviour, not the backlog item.
- **Release-blocking:** NO
- **Recommendation:** Replace "(Story 004)" with the observable check, e.g. "verify `memory/learnings.md` is being appended at session end by Chief-of-Staff."

**Issue 4 — `Last score: — / Date: —` field naming differs slightly from §6 criterion text**
- **Severity:** LOW (informational)
- **Dimension:** §6 M4 acceptance
- **Finding:** §6 specifies evals "with `Last score: — / Date: —` fields." The file renders these as `**Last score:** — / **Date:** —`. Semantically identical and acceptable; noting only for exactness. No change required.
- **Release-blocking:** NO

### Confirmed Correct

**AD-6 / NFR Observability — eval quality loop**
- `golden-evals.md` carries the staleness header `# Golden Evaluations · Updated: 2026-06-21`.
- Five evals present, each with `Last score: — / Date: —` runnable fields and "paste into a fresh chat" instructions (§6 criterion 1 met).
- Every sub-3 path maps to a named file (`active.md`, `org.md`, `learnings.md`, `me.md`, `eval.md`) with a concrete remediation — actionable staleness pointers, not generic advice.
- Quality target documented verbatim: "average ≥ 4.0/5, zero evals below 3" — matches NFR Observability threshold.
- Run procedure is self-contained: fresh chat, no priming, score 1–5, log, compute average, follow pointer. A monthly reviewer can run and trend it without developer help (modulo Issue 1).
- Correctly gitignored (durable-personal per AD-5 / §4.1).

**AD-4 / OQ-6 — Confluence publish degrades gracefully**
- Publish is the DEFAULT, not on-request: "offer to publish to Confluence as the default. Do not wait to be asked."
- Failure path explicit and matches §4.4: MCP unavailable → draft retained locally + surfaced message "Confluence publish failed — draft saved locally. The content is not lost." → never silently dropped (§6 criterion 4 met).
- User can suppress with "keep local" / "don't publish" / "local only" — local-only is the explicit exception, not the default (OQ-6 satisfied).
- Local memory remains primary sink; Confluence is the preferred default layered on top — consistent with the AD-4 tension line.

**AD-8 — Skill file structure**
- Valid frontmatter: `name`, `description`, `version: "1.0"`, `last-updated: 2026-06-21`.
- Path correct: `.github/skills/product-writer/SKILL.md`; plain English, no CLI syntax.
- Quality Check references `memory/eval.md` ("run the checklist in `memory/eval.md`").
- `templates/SKILL.template.md` matches the as-built skill shape (frontmatter, title-with-Updated header, Invocation Phrases, Before You Start, Process, Quality Check referencing eval.md, Constraints) — consistent with chief-of-staff / researcher.

**§6 — Product-Writer authoring**
- Reads `context/me.md` + `context/org.md` before drafting; warns on stale/missing files; pulls `rules/writing-rules.md` (all three rules files exist).
- Document formats (stakeholder update, meeting notes, decision doc, project brief, PRD) defined with structure, voice, and word ceilings (§6 criterion 3 met).

**AD-2 — AGENTS.md size budget**
- Still 61 lines — far under the 200-line ceiling.
- product-writer row correctly wired with trigger phrases ("draft", "write", "stakeholder update", "publish to Confluence"); `*(M4)*` marker correctly removed now that the skill exists.

**templates/ consistency**
- All four templates carry the `# <Title> · Updated: YYYY-MM-DD` header convention (meeting-notes uses `# [Meeting Name] · YYYY-MM-DD · Updated: YYYY-MM-DD`, a reasonable extension).
- Realistic starter structure with placeholders, not prescriptive — appropriately detailed (project-brief, decision-log, meeting-notes all match §4.3 tree).

### Release Recommendation

**APPROVE WITH CONDITIONS.**

M4 meets all four §6 acceptance criteria and is faithful to AD-4, AD-6, AD-8, OQ-6, and NFR Observability. The eval loop is genuinely actionable and the Confluence default/degradation logic is correct. No defect blocks the milestone.

**Conditions for approval:**
1. (Recommended, not blocking) Resolve Issue 1 — reconcile the golden-eval logging format to the live `usage-log.md` table shape so per-eval trend extraction is unambiguous. This directly underpins the §6 DoD ("a full golden-eval cycle … produces an actionable staleness pointer") and the NFR Observability trend requirement.
2. (Recommended) Resolve Issue 2 (gate or graceful-degrade the Lenny skill references) and Issue 3 (remove the "Story 004" leak from Eval 003).

With Issue 1 reconciled, M4 is cleanly approvable.
