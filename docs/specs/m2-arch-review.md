# Milestone 2 — Architectural Review · Updated: 2026-06-21

> Reviewer: BMAD Systems Architect · Scope: M2 ("Persistent Memory & Self-Grounding") · Ground truth: `docs/specs/architecture.md` · M1 context: `docs/specs/m1-arch-review.md`

### Overall Assessment

M2 is a clean, faithful implementation that resolves the principal MEDIUM concern from the M1 review (router advertising files that did not exist). The memory layer (`learnings.md`, `decisions.md`, `usage-log.md`), the shared `eval.md` checklist, the three rules modules, and the Chief-of-Staff v1.1 harvest block all match the architecture's intent and formats. AD-6 (curation, not append-only), AD-4 (graceful Confluence degradation in the harvest), AD-2 (Tier-1 budget), AD-5 (security boundary), and the OQ-2 eval.md positioning are all correctly executed. The §7 observability formats match the spec exactly. No release-blocking defects were found. Two LOW issues and one informational note are below; all are documentation hygiene, none touch the working memory/grounding paths.

### Issues Found

**Issue 1 — `decisions.md` template example uses today's date, risking a misleading staleness signal**
- **Severity:** LOW
- **Dimension:** AD-6 / NFR Observability
- **Finding:** `memory/decisions.md` carries an "Example Entry (template — delete when first real entry added)" dated 2026-06-21. The instruction to delete it is present, but a dated placeholder will read as a real, fresh decision to the AI until removed, and the file `Updated:` header tracks the placeholder, not real activity.
- **Release-blocking:** NO
- **Recommendation:** Use a non-date placeholder (`YYYY-MM-DD`) in the example, consistent with how `learnings.md` and `usage-log.md` present their format lines without a live-looking dated row. Cosmetic; no functional impact.

**Issue 2 — `decisions.md` is not wired into the harvest or eval flow**
- **Severity:** LOW
- **Dimension:** AD-6 / §3 catalogue
- **Finding:** The catalogue describes `memory/decisions.md` as "AI appends," but the Chief-of-Staff harvest block (Steps 1–3) only writes `learnings.md` and `usage-log.md`. There is no skill or standing-order instruction that ever appends to `decisions.md`. This is acceptable for M2 scope (the M2 acceptance criteria name only learnings + usage-log), but the file currently has no producer.
- **Release-blocking:** NO
- **Recommendation:** Either add a one-line harvest sub-step ("if a consequential decision was made this session, append to `memory/decisions.md`") or accept that decisions are user-authored for now and note that in the catalogue. Defer to M4 if preferred; flag so it is not silently orphaned.

**Issue 3 — Routing-table 30-day flag is wired in two places with slightly different wording**
- **Severity:** LOW (informational)
- **Dimension:** NFR Observability
- **Finding:** The 30-day learnings staleness flag is correctly present in both AGENTS.md Standing Orders and `eval.md` (checklist + thresholds). `eval.md` phrases it as "date prefix more than 30 days before today" while AGENTS.md says "older than 30 days." Same intent; no conflict. Noted only for future consistency.
- **Release-blocking:** NO
- **Recommendation:** None required. Optionally align wording on next edit.

### Confirmed Correct

**AD-6 — Memory as curation surfaces (not append-only)**
- All three personal memory files carry the `# <Title> · Updated: 2026-06-21` staleness header (§4.2 convention).
- `learnings.md` explicitly states the append-and-prune pattern: "Reviewed and pruned weekly — entries older than 30 days are flagged for removal." Not described as append-only.
- The 30-day flag is present in both AGENTS.md Standing Orders (line 13) and `eval.md` (checklist item + Staleness thresholds section). Correctly wired in both router and checklist.

**AD-4 — Confluence publish degrades gracefully**
- Chief-of-Staff Session Harvest runs Steps 1 (learnings), 2 (usage-log), 3 (Confluence) strictly in order with an explicit "Do not skip steps because a later step fails" and "NEVER block Steps 1 or 2 because Step 3 failed."
- Step 3 has both branches (MCP available → publish; unavailable → retain locally + notify user). No path leaves the harvest stuck if Confluence is down. Local appends are the load-bearing sink, exactly per the §4.4 harvest flow and the AD-4/OQ-6 tension resolution.

**AD-2 — Tier-1 size budget**
- AGENTS.md is 61 lines — far under the 200-line ceiling, even after the M2 routing-table additions (memory/*, rules/*).
- `eval.md` is correctly positioned as a router pointer: AGENTS.md Standing Orders "Quality gate" says "Read that file and satisfy each item" rather than inlining the checklist. The checklist content lives in `eval.md`, not the constitution. Router-not-store discipline held.
- M1 Issue 1 (dangling router references) is resolved: memory/ and rules/ targets now exist; M3/M4/M5 skills and `memory/tools.md` are clearly annotated *(M3)/(M4)/(M5)*.

**AD-5 — Security boundary**
- `.gitignore` gitignores all four personal memory files (`learnings.md`, `decisions.md`, `usage-log.md`, `golden-evals.md`) plus context/me.md, context/active.md, projects/, areas/, knowledge/, CLAUDE.local.md.
- `eval.md` and `tools.md` are force-included (`!memory/eval.md`, `!memory/tools.md`); `.vscode/mcp.json` force-include precedes the `.vscode/` ignore rule (correct ordering). M1 force-include rules preserved with no regression.
- `eval.md` content is generic org-process checklist material with no credentials or PII — safe to commit as a shared file. `org.md` (shared) contains only role-level structure and glossary, no personnel/commercial detail.

**NFR Observability (§7)**
- `usage-log.md` format matches the spec exactly: `date | task | sources | rating 1–5 | notes` (header row and the seed entry both conform; rating guide 1–5 included).
- `learnings.md` format matches exactly: `YYYY-MM-DD — [pattern]`, and the single seed entry follows it.
- Every durable file carries the `Updated:` header.

**eval.md quality and positioning (OQ-2)**
- Located at `memory/eval.md` (correct OQ-2 resolution).
- Contains all five required checklist items: (a) read active.md, (b) check learnings.md, (c) ground in org.md, (d) role-specific (Head of Product Operations / PM-Design-TPM Ops), (e) named owners and dates. Plus bonus staleness and sensitivity checks.
- Referenced explicitly from both AGENTS.md (Standing Orders "Quality gate") and chief-of-staff/SKILL.md ("Quality Check" section: "run the pre-response checklist in `memory/eval.md`").

**Rules files scope (§3 "keep each under ~100 lines")**
- `writing-rules.md` (29 lines), `research-rules.md` (24 lines), `communication-rules.md` (29 lines) — all well under ~100.
- Plain English throughout, no CLI syntax.
- Genuine Tier-2 extracts: they elaborate domain behaviour (format/length/voice, source hierarchy, audience tailoring) without duplicating Tier-1 standing orders. `research-rules.md` correctly references the Glean→Confluence→Miro hierarchy as *(M3+)* and points to `memory/tools.md` rather than restating it.

**Chief-of-Staff SKILL.md version bump (AD-8)**
- Frontmatter `version: "1.1"`, `last-updated: 2026-06-21`. Frontmatter complete (name, description, version, last-updated).
- Harvest block is complete and correctly structured (three ordered steps, exact formats matching learnings.md and usage-log.md, fail-safe ordering).
- Quality Check section points to `memory/eval.md`. Anti-fabrication constraints from M1 preserved ("Never answer a standup from memory alone").

### Release Recommendation

**APPROVE.**

M2 meets all of its acceptance criteria with no blocking defects, and it closes the principal MEDIUM finding carried over from M1. The memory layer, self-grounding checklist, rules modules, and the graceful-degradation harvest are all faithful to AD-2, AD-4, AD-5, AD-6, OQ-2, and the §7 observability formats. The three LOW items (decisions.md dated placeholder, decisions.md lacking a producer, minor 30-day wording variance) are documentation hygiene and can be folded into M3/M4 work rather than gating this release. Recommend tagging M2 and, when convenient, deciding the owning milestone for the `decisions.md` write path (Issue 2) so it does not stay orphaned.
