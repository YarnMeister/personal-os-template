# Milestone 1 — Architectural Review · Updated: 2026-06-21

> Reviewer: BMAD Systems Architect · Scope: M1 ("The Morning Standup Works") · Ground truth: `docs/specs/architecture.md`

### Overall Assessment

The M1 implementation is strong and largely faithful to the architecture. The core architectural bet — a tiered markdown constitution read by a stock VS Code AI, delivering daily value with zero MCP — is correctly executed. AGENTS.md is a genuine router at 61 lines (ceiling 200), CLAUDE.md is a clean shim, the security boundary in `.gitignore` is correct including all force-includes, file headers are consistent, and the Chief-of-Staff skill enforces the three-section standup with explicit anti-fabrication guards and correct M2 stubs. No release-blocking defects were found. The one real concern is that AGENTS.md and README route to a number of files that do not yet exist in the M1 slice (memory/*, rules/*, four of five skills); this is expected for a vertical slice but creates dangling references an assistant may try to load. This is a MEDIUM issue worth a one-line guard, not a blocker.

### Issues Found

**Issue 1 — Routing table points to files not present in the M1 slice**
- **Severity:** MEDIUM
- **Dimension:** AD-2 (router integrity) / M1 scope
- **Finding:** AGENTS.md routes to `memory/eval.md`, `memory/tools.md`, `memory/learnings.md`, `rules/writing-rules.md`, `rules/research-rules.md`, `rules/communication-rules.md`, and skills `researcher`, `product-writer`, `os-helper`, `process-builder`. None of these exist yet (confirmed via filesystem). README's "How It Works" diagram and Directory Map likewise list memory/, rules/, templates/ subfiles and five skills that are absent. An assistant following the router may attempt to open missing files. The Quality-gate and Routing-table entries for `memory/eval.md` are stubbed in prose (line 15) but still listed as a live Tier-2 routing target (line 29) without an "exists in M2" marker.
- **Required before release:** NO (M1 standup + backlog paths are self-contained and work)
- **Recommendation:** Add a one-line note in the AGENTS.md routing table and README that memory/, rules/, and non–chief-of-staff skills arrive in M2/M3; or mark those rows "(M2)". Keeps the router honest and prevents failed-load noise. Low effort.

**Issue 2 — Skills table lists skills that do not yet exist**
- **Severity:** LOW
- **Dimension:** AD-8 / M1 scope
- **Finding:** AGENTS.md §Skills lists five skills; only `chief-of-staff/SKILL.md` is implemented. No `REGISTRY.md` exists yet (it is an M5 component per the build plan, so its absence is correct).
- **Required before release:** NO
- **Recommendation:** Same fix as Issue 1 — annotate later-milestone skills, or trim the Skills table to chief-of-staff for M1 and reintroduce rows as skills land.

**Issue 3 — README setup time figures are internally inconsistent**
- **Severity:** LOW
- **Dimension:** README completeness / NFR (M1 "one working day"; M5 "under 30 minutes")
- **Finding:** README states "under 4 hours" (line 39), "~40 minutes" (line 123), and the walkthrough sums to ~40 min. The 30-minute onboarding bar is an M5 target, not M1, so none of these violate the spec, but the three different numbers in one document read as unreviewed.
- **Required before release:** NO
- **Recommendation:** Reconcile to a single figure. M1's bar is "one working day," so any of these comfortably passes; pick one and use it consistently.

**Issue 4 — `docs/` is committed but not addressed by the governance boundary**
- **Severity:** LOW
- **Dimension:** AD-5 / Security
- **Finding:** `docs/specs/` (architecture, this review, PRD) is committed and shared. That is appropriate for architecture docs, but `Personal OS PRD.md` and `org-structure.md` at repo root are untracked and not in `.gitignore`; if they contain unreleased-roadmap or org-sensitive detail they could be committed inadvertently. The architecture's durability-class table does not classify `docs/` or these root files.
- **Required before release:** NO
- **Recommendation:** Confirm PRD/org-structure contain nothing sensitive before committing, or classify them explicitly. Consider one line in README Data Governance covering `docs/`.

### Confirmed Correct

- **AD-2:** AGENTS.md is 61 lines (≤200). It is a pure router — standing orders + routing table + skills index + Tier-3 trigger, no embedded context knowledge. Tier-3 trigger phrase documented correctly (explicit "Read projects/<name>.md then…" example).
- **AD-3:** CLAUDE.md contains only the `@AGENTS.md` import plus two editorial comments, including the OQ-1 import-debug note pointing to README. The "edit AGENTS.md, never CLAUDE.md" convention is stated in both AGENTS.md (line 3) and CLAUDE.md (line 1).
- **AD-5:** `.gitignore` correctly ignores all durable-personal files (CLAUDE.local.md, context/me.md, context/active.md, all four personal memory files, projects/, areas/, knowledge/) and force-includes `!memory/tools.md`, `!memory/eval.md`, `!.vscode/mcp.json` past the `.vscode/` rule. All shared files (AGENTS.md, CLAUDE.md, context/org.md, BACKLOG.md, templates/, README.md, .github/skills/) are not ignored. CLAUDE.local.md is explicitly listed. Boundary is correct.
- **AD-8:** chief-of-staff SKILL.md is at the correct path with complete frontmatter (name, description, version, last-updated). Plain English, no CLI syntax. Reads `context/active.md` first ("no exceptions").
- **§4.2 headers:** Every durable file reviewed carries `# <Title> · Updated: 2026-06-21`. Template correctly uses `YYYY-MM-DD` placeholder.
- **OQ-8:** All filenames and skill directories are lowercase kebab-case, no emoji.
- **README:** Includes directory map matching §4.3, no-MCP fallback table, full setup sequence, OQ-1 import-debug section, OQ-3 Copilot-no-Filesystem-MCP note, and OQ-10 `chat.useAgentsMdFile` enablement steps. Data-governance policy is present and accessible.
- **SKILL.md functional correctness:** Morning standup returns exactly 3 sections (priorities/blockers/first action). "Process my backlog" clears BACKLOG.md after routing. Session-harvest and eval.md are correctly stubbed as comments, not implemented. Strong fabrication guard ("Never fabricate priorities… not present in context files", "Never answer a standup from memory alone").
- **Security:** No credentials, PII, or sensitive content in any committed file reviewed. context/me.md and context/active.md (which carry personal content) are gitignored.

### Release Recommendation

**APPROVE WITH CONDITIONS.**

M1 meets all of its acceptance criteria and contains no blocking defects. Before tagging, address the two cheap hygiene items so the router does not advertise capability the slice does not yet have:

1. Annotate the AGENTS.md routing/skills tables and the README diagram/directory map so memory/, rules/, and non–chief-of-staff skills are clearly marked as later-milestone (Issue 1, Issue 2). This prevents failed-load noise on a clean M1 workspace.
2. Reconcile the three conflicting setup-time figures in README to one number (Issue 3).

Issue 4 (docs/ and root PRD/org files governance) should be confirmed but is not an M1 gate. All conditions are documentation-only edits; none touch the working standup or backlog paths.
