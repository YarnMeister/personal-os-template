# Milestone 3 — Architectural Review · Updated: 2026-06-21

> Reviewer: BMAD Systems Architect · Scope: M3 ("MCP-Backed Research & Project Brains") · Ground truth: `docs/specs/architecture.md` (AD-4, AD-5, AD-7, AD-8, §5, NFR Security) · Prior context: `docs/specs/m2-arch-review.md`

### Overall Assessment

M3 is a strong, largely faithful implementation of the MCP layer. The credential-free `mcp.json` migration, the shared `memory/tools.md` routing policy, and the new Researcher skill all match the architecture's intent. AD-5 (security boundary), AD-8 (skill structure), and the §5 Glean → Confluence → Miro hierarchy with correct read-only V1 markings are all correctly executed. AD-4 graceful degradation is well handled in both the Researcher fallback and the README fallback table.

There is **one release-blocking defect**: `mcp.json` references an `${input:glean_url}` prompt that is never declared in the `inputs` array, so the Glean server will fail to resolve at first use. One MEDIUM (mcp.json/architecture contract divergence on the Glean URL) is the same root cause. The remaining items are LOW documentation hygiene. The security boundary itself is sound: no credentials are present in the committed file and the force-include ordering is correct.

### Issues Found

**Issue 1 — `${input:glean_url}` is referenced but never declared (broken Glean config)**
- **Severity:** HIGH
- **Dimension:** AD-7 / §5 Glean
- **Finding:** `.vscode/mcp.json` line 12 sets the Glean server `url` to `${input:glean_url}`, but the `inputs` array (lines 2–8) declares only `glean_token` — there is no `glean_url` input. VS Code resolves `${input:...}` against the `inputs` array; an undeclared reference fails, so the Glean server cannot start. This breaks the primary, first-in-hierarchy integration that M3 exists to deliver.
- **Release-blocking:** YES
- **Recommendation:** Either (a) add `{ "id": "glean_url", "description": "Glean MCP base URL (e.g. https://your-org.glean.com/mcp)", "password": false }` to `inputs`, or (b) hard-code the org URL per architecture §5 (`https://<org>.glean.com/mcp`) and keep only `glean_token` as a prompt. Option (b) matches the §5 contract, which treats only the token as a secret/input and the URL as a fixed value.

**Issue 2 — mcp.json Glean shape diverges from the §5 contract**
- **Severity:** MEDIUM
- **Dimension:** §5 Integration Points
- **Finding:** §5 specifies the Glean server as an HTTP/OAuth endpoint at a fixed `https://<org>.glean.com/mcp` with `Authorization: Bearer ${input:glean_token}` — i.e. one secret (token), URL fixed. The implementation instead parameterises the URL as an input. This is the root cause of Issue 1 and is also a contract drift: the architecture did not intend the URL to be a per-user prompt. Same root cause as Issue 1; called out separately because the fix should reconcile to §5, not just silence the resolver error.
- **Release-blocking:** NO (folds into the Issue 1 fix)
- **Recommendation:** Resolve via Issue 1 option (b) so the file matches the §5 contract. If the org URL genuinely varies per user, raise an ad hoc ADR to amend §5 rather than diverging silently.

**Issue 3 — README references `templates/context-me.md` not in M3 scope/tree**
- **Severity:** LOW
- **Dimension:** §4.3 / AD-3
- **Finding:** README Step 2 and the Setup Walkthrough instruct copying `templates/context-me.md`. The architecture §4.3 tree lists `templates/SKILL.template.md`, `project-brief.md`, `decision-log.md`, `meeting-notes.md` — no `context-me.md`. If the template file does not yet exist, the documented onboarding step dangles (the same class of defect M1 Issue 1 flagged for router targets).
- **Release-blocking:** NO
- **Recommendation:** Confirm `templates/context-me.md` exists, or align the README to an existing template / add the file to the §4.3 tree. M5 onboarding criterion depends on this path resolving.

**Issue 4 — `tools.md` "Last tested" dates are uniform placeholders**
- **Severity:** LOW
- **Dimension:** NFR Observability / §7
- **Finding:** Every server in `memory/tools.md` carries `Last tested: 2026-06-21`. Given the Glean config defect (Issue 1), Glean could not have been successfully tested, so the uniform date is aspirational rather than observed. This mirrors M2 Issue 1 (a dated placeholder reading as real activity).
- **Release-blocking:** NO
- **Recommendation:** Set "Last tested" only after a real successful connection; use `—` until then. Re-test Glean after the Issue 1 fix.

**Issue 5 — Filesystem server lacks a `type` while Glean declares one (style only)**
- **Severity:** LOW (informational)
- **Dimension:** AD-7
- **Finding:** Glean uses `"type": "http"`; the stdio servers (confluence, miro, github, filesystem) omit `type`, relying on VS Code's `command`-implies-stdio default. This is valid but inconsistent. No functional impact.
- **Release-blocking:** NO
- **Recommendation:** None required. Optionally add `"type": "stdio"` to the command-based servers for explicitness.

### Confirmed Correct

**AD-7 — Credential-free mcp.json**
- Root key is `servers` (not `mcpServers`) — the documented footgun is avoided.
- All five required servers present: glean, confluence, miro, github, filesystem.
- Every credential is an `${input:...}` reference; no literal token values anywhere in the file.
- Sensitive inputs (`glean_token`, `confluence_token`, `miro_token`, `github_token`) all carry `password: true`; `confluence_url` correctly `password: false`. (The missing `glean_url` is the exception — see Issue 1.)
- Filesystem server scoped to workspace root `"."` only — no broader disk access (NFR Security / §5 satisfied).

**AD-5 — Security boundary**
- No credentials or sensitive values in the committed `mcp.json` — only input references and public-shaped descriptions.
- `.gitignore` force-include ordering is correct: `.vscode/` exclusion (line 22) precedes `!.vscode/mcp.json` (line 26), with an inline comment documenting the required ordering. The negation will take effect.
- `memory/tools.md` and `memory/eval.md` force-includes (`!memory/tools.md`, `!memory/eval.md`) preserved from M2 with no regression; all four personal memory files still gitignored.

**AD-4 — MCP additive, never load-bearing**
- Researcher SKILL.md implements local-first: Step 2 ("Check Local Files First") runs before any MCP call; Step 3 only fires "if local insufficient."
- Explicit "Fallback — No MCP Available" section: states the message, names local sources, flags staleness. No code path lets a failed MCP connection block a daily ritual.
- README fallback table marks standup / backlog / harvest as "Yes" without MCP; research "Degraded"; Confluence publish "Not available → draft retained locally." Consistent with AD-4 and the §4.4 flows.

**§5 — Routing hierarchy**
- `memory/tools.md` documents Glean → Confluence → Miro in order, with authority statements per server and the explicit numbered Routing Rules.
- Glean correctly marked "Read-only for V1 (write-back deferred to V2)" (OQ-9).
- Miro correctly marked "Read-only for V1" and positioned after Confluence (OQ-4).
- Document-grader pattern present in both `tools.md` ("<3 results → escalate to Confluence") and Researcher Step 3 ("Fewer than 3 relevant results → … Escalate to Confluence"). Miro consulted after Confluence for visual context, per hierarchy.

**AD-8 — Skill file structure**
- Researcher at the correct path: `.github/skills/researcher/SKILL.md`.
- Full frontmatter: `name`, `description`, `version: "1.0"`, `last-updated: 2026-06-21`.
- Plain English throughout; no CLI syntax.
- Quality Check section references `memory/eval.md` ("run the pre-response checklist in `memory/eval.md`").

**AD-2 — AGENTS.md size budget**
- AGENTS.md is 61 lines — well under the 200-line ceiling.
- `*(M3)*` markers correctly removed for now-existing components: the researcher row and `memory/tools.md` routing-table row carry no marker; remaining `*(M4)*`/`*(M5)*` markers (product-writer, os-helper, process-builder) are correctly retained.

### Release Recommendation

**APPROVE WITH CONDITIONS.**

M3 meets the bulk of its acceptance criteria and is faithful to AD-4, AD-5, AD-7, AD-8, and §5. The security boundary is sound and the routing/fallback logic is correct. However, the single HIGH defect (Issue 1, undeclared `${input:glean_url}`) means the Glean server — the first link in the routing hierarchy and the centrepiece of M3's "MCP-Backed Research" goal — cannot start as committed. This directly fails the M3 acceptance criterion "Researcher reads `tools.md`, runs a Glean query, and writes synthesis to a `projects/<name>.md`."

**Conditions for approval:**
1. (Blocking) Fix Issue 1 — declare `glean_url` or hard-code the URL per §5; prefer the §5-aligned hard-coded URL (Issue 2).
2. (Blocking-gate, not file-level) Confirm the M3 security gate: every pre-migration plain-text secret (Glean, Confluence, Miro, GitHub) has been rotated/revoked per AD-7 and OQ-4, with the rotation recorded. This review can confirm the file is credential-free but cannot confirm rotation occurred — it must be evidenced before M3 is marked done.
3. (Recommended) Resolve Issue 3 (templates/context-me.md) and reset the `tools.md` "Last tested" dates to reflect a real Glean connection after the fix.

Once Issue 1 is fixed and the rotation gate is evidenced, M3 is approvable.
