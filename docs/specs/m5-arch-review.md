# Milestone 5 — Architectural Review · Updated: 2026-06-21

> Reviewer: BMAD Systems Architect · Scope: M5 ("Packaged, Shareable, Self-Maintaining") · Ground truth: `docs/specs/architecture.md` (AD-8, AD-5, AD-2, §6 M5 criteria) · Prior context: `docs/specs/m4-arch-review.md`

### Overall Assessment

M5 is a strong, near-complete implementation. The skill library is consistent and well-catalogued: all 12 skill directories have valid AD-8 frontmatter and every one has a matching `REGISTRY.md` row (and vice versa). OS-Helper has a precise work-task refusal guard; Process-Builder explicitly binds Artefact 2 to `templates/SKILL.template.md`. The data-governance policy satisfies Story 014 AC4 (what belongs in Personal OS, what stays in Confluence/Glean, plus the sensitivity check) and is committed/shared, not gitignored. AGENTS.md remains 64 lines.

There are **no release-blocking defects**. One MEDIUM issue carries over from M4 Issue 2 and is now M5's to close: Product-Writer references two Lenny skills by names that do not match (or do not exist in) the as-built fork. The rest are LOW.

### Issues Found

**Issue 1 — Product-Writer references Lenny skills with wrong/nonexistent names**
- **Severity:** MEDIUM
- **Dimension:** AD-8 / §3 catalogue (carryover of M4 Issue 2)
- **Finding:** `.github/skills/product-writer/SKILL.md` lines 69–70 reference `roadmap-prioritisation` and `metrics-and-analytics`. The as-built M5 fork ships `prioritizing-roadmap` (different slug) and ships **no** `metrics-and-analytics` skill at all. The instruction "Load .github/skills/[skill-name]/SKILL.md" will therefore fail to resolve for both. M4 review explicitly deferred this: "Confirm the Lenny fork lands in M5 before relying on these paths." M5 landed the fork but did not reconcile the two names. The line-74 note ("Lenny skills are added in M5") is also now stale and should be removed.
- **Release-blocking:** NO
- **Recommendation:** Rename the reference `roadmap-prioritisation` → `prioritizing-roadmap`; either add a `metrics-and-analytics` skill or drop the reference; delete the stale "added in M5" note. (This is a Product-Writer edit, but belongs to M5's reconciliation since M5 owns the Lenny set.)

**Issue 2 — Lenny skills omit the template's "Output Format" section**
- **Severity:** LOW
- **Dimension:** AD-8 / template conformance
- **Finding:** `templates/SKILL.template.md` defines required sections Role, Before You Start, Process, **Output Format**, Quality Check. The 7 Lenny skills substitute a domain section (Core Topics / Frameworks / OKR Structure / etc.) and a Quality Check, but none carry an explicit "Output Format" section, and most omit "Process". Process-Builder line 55 asserts generated skills must include "Role, Before You Start, Process, Output Format, Quality Check" — so the Lenny skills do not themselves conform to the contract Process-Builder will enforce on future skills.
- **Release-blocking:** NO
- **Recommendation:** Acceptable for hand-curated domain-expertise skills (they are reference knowledge, not output-producing workflows). If strict conformance is desired, either relax the template to mark Output Format optional for advisory skills, or add a one-line Output Format to each. Note the divergence so Process-Builder's "conform exactly" claim stays honest.

**Issue 3 — Onboarding checklist references a `context-me.md` template that is not in §4.3**
- **Severity:** LOW
- **Dimension:** §6 M5 / catalogue consistency
- **Finding:** os-helper Mode 1 step 3 instructs "Copy `templates/context-me.md` → `context/me.md`". The architecture §4.3 templates tree lists `SKILL.template.md`, `project-brief.md`, `decision-log.md`, `meeting-notes.md` — no `context-me.md`. If that template file does not exist, the onboarding step dangles (same defect class as Issue 1).
- **Release-blocking:** NO
- **Recommendation:** Confirm `templates/context-me.md` exists; if not, create it or change the step to "create `context/me.md` with the 5 bullets below."

**Issue 4 — os-helper embeds shell command in onboarding checklist**
- **Severity:** LOW (informational)
- **Dimension:** AD-8 (plain-English, no CLI) / NFR Portability
- **Finding:** os-helper Mode 1 step 1 contains `git clone <repo-url>`. AD-8 and NFR Portability require plain English with no CLI syntax. This is a user-facing setup instruction (arguably unavoidable for a clone step) rather than AI-execution syntax, so it is defensible, but it is the one literal command in the skill set.
- **Release-blocking:** NO
- **Recommendation:** Acceptable as-is; optionally phrase as "clone the repo (your onboarder will share the command)".

### Confirmed Correct

**AD-8 — skill structure & REGISTRY**
- `ls .github/skills/` = 12 skill dirs + `REGISTRY.md`. All 12 dirs (os-helper, process-builder, chief-of-staff, researcher, product-writer + 7 Lenny) appear in REGISTRY.md; every REGISTRY row maps to a real dir. No orphans, no missing entries.
- os-helper and process-builder carry valid frontmatter (`name`, `description`, `version: "1.0"`, `last-updated: 2026-06-21`); all 7 Lenny skills likewise valid.
- Registry lives at `.github/skills/REGISTRY.md` (OQ-7 satisfied) with name/version/description/last-updated/last-used columns (§6 criterion 5 met).

**AD-5 — security boundary & data governance**
- `docs/data-governance.md` covers all three required elements: what belongs in Personal OS (per-file table with git treatment), what stays in Confluence/Glean (team decisions, org specs, announcements, personnel), and the sensitivity check rule. Satisfies Story 014 AC4.
- Committed/shared (under `docs/`, not matched by `.gitignore`) — correct.
- REGISTRY.md contains no personal data; `last-used` dates are usage-log-derived placeholders, as allowed.
- `.gitignore` excludes all durable-personal memory files and force-includes `tools.md` + `eval.md` (§6 criterion 1, AD-5).

**OS-Helper — refusal guard**
- Explicit work-task examples ("draft a PRD", "morning standup", "process my backlog") are refused; explicit maintenance allowlist ("onboard", "audit", "review skills", "evolve") activates. Refusal message redirects to the correct skill. Low false-positive risk — the allowlist is specific and disjoint from work verbs.

**Process-Builder — template conformance**
- Artefact 2 references `templates/SKILL.template.md` explicitly (lines 20, 53, 76) and instructs "conform exactly". Generated frontmatter (4 fields) matches the template. (Caveat: section-list claim diverges from as-built Lenny skills — see Issue 2.)

**Lenny skills — quality & consistency**
- All 7 are sufficiently detailed (each carries domain frameworks: RICE/MoSCoW, OKR structure, RACI, influence×interest grid, etc.), plain English, no CLI syntax.
- All 7 reference `memory/eval.md` in their Quality Check section.

**AD-2 — AGENTS.md size**
- 64 lines, far under the 200 ceiling. os-helper and process-builder are wired in the Skills table with correct trigger phrases and **no** `*(M5)*` markers (§6 / AD-2).

### Release Recommendation

**APPROVE WITH CONDITIONS.**

M5 meets all six §6 acceptance criteria and is faithful to AD-8, AD-5, and AD-2. No defect blocks the milestone or the `v1.0` tag.

**Conditions for approval:**
1. (Recommended) Resolve Issue 1 — fix the two broken Lenny references in Product-Writer (`roadmap-prioritisation` → `prioritizing-roadmap`; drop or add `metrics-and-analytics`) and remove the stale "added in M5" note. This closes the carried-over M4 Issue 2 and removes the only dangling skill path in the shipped set.
2. (Recommended) Resolve Issue 3 — confirm `templates/context-me.md` exists or adjust the onboarding step, so the 30-minute clone-to-standup path (§6 criterion 6 / DoD) has no broken reference.
3. (Optional) Reconcile Issue 2 — relax the template's Output Format requirement for advisory skills, or align the Lenny skills, so Process-Builder's "conform exactly" claim stays accurate.
