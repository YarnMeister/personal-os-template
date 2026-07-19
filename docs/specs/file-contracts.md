# File Contracts · Personal OS · v1.3

> Status: Live · Owner: Head of Product Operations · Last revised: 2026-07-19
> Scope: Binding specifications for the durable files written or read by Work HQ and the onboarding wizard. These contracts govern what the wizard writes, what the AI assistant reads at runtime, and the handoff formats that connect the two.

---

## 1. Context file section contracts

All durable context files carry a staleness header on line 1:

```
# <Title> · Updated: YYYY-MM-DD
```

The date is a real calendar date (format `YYYY-MM-DD`, e.g. `2026-07-05`), never the literal string `YYYY-MM-DD`. A file is considered populated (non-placeholder) when it contains neither a `[` character nor the literal `YYYY-MM-DD`. Work HQ uses this heuristic to detect user-written content before any overwrite.

---

### 1.1 context/me.md

**Header:** `# Me · Updated: YYYY-MM-DD`

**Section contract (bullet list, no sub-headings):**

| Bullet key | Content |
|---|---|
| `**Role:**` | Title and primary responsibility in one sentence |
| `**Working style:**` | Preferred response style, format, async preferences, check-in rhythm |
| `**Team:**` | Immediate team description and headcount |
| `**Key tools:**` | AI assistant + 3–4 enterprise tools used daily, comma-separated |

**Writer (manual path):** `scaffold-files` server function, from phase-4 interview answers.

**Writer (bootstrap path):** The user's AI assistant, via the lock-in handoff in story 011 (distilled from `context/profile.md`). `scaffold-files` does NOT write me.md when `context/profile.md` exists.

**Gitignore:** Personal (never committed).

**Staleness threshold:** No hard rule; refreshed after onboarding and on role change.

---

### 1.2 context/org.md

**Header:** `# Org · Updated: YYYY-MM-DD`

**Section contract (## sub-headings):**

| Section | Content |
|---|---|
| `## Team structure` | Immediate team, reporting structure, headcount |
| `## Key stakeholders` | Key stakeholders — reference sensitive individuals by role or alias, never by personal name, salary, or personnel data |
| `## Glossary` | Acronyms, project codenames, team-specific terms, one per line |

**Writer (manual path):** `scaffold-files` server function, from phase-4 org-form answers — only after the user confirms the sensitivity gate ("no personnel data, unreleased roadmap items, or commercial terms"). If the sensitivity gate is declined, this file is not written.

**Writer (bootstrap path):** The user's AI assistant, via the lock-in handoff in story 011. `scaffold-files` does NOT write org.md when `context/profile.md` exists.

**Gitignore:** Committed (shared with team). The onboarding sensitivity gate prevents personnel data from reaching the committed file.

**Staleness threshold:** Reviewed monthly or on org change.

---

### 1.3 context/active.md

**Header:** `# Active · Updated: YYYY-MM-DD`

**Section contract (## sub-headings):**

| Section | Content |
|---|---|
| `## Priorities` | Top priorities, each on its own line in the format: `<title> — Owner: <owner> — Due: <dueDate>` |
| `## Blockers` | Current blockers or impediments in free text |
| `## Open questions` | Open questions that need resolution |

**Priority line format (exact):**

```
<title> — Owner: <owner> — Due: <dueDate>
```

Example:

```
- Launch product discovery sprint — Owner: Alex Smith — Due: 2026-07-15
```

**Writer:** `scaffold-files` server function, from phase-5 right-now answers. Both the manual path and the bootstrap path write active.md via this route.

**Gitignore:** Personal (never committed).

**Staleness threshold:** Must not be older than 2 working days (flagged by the Chief-of-Staff standup skill per AD-6).

---

### 1.4 context/org-structure.md (business-area taxonomy)

**Decision:** ADR-P6-010. Committed, human-editable markdown holding the Business Area → Portfolio → Squad taxonomy that seeds the phase-4 review taxonomy picker (story 022). The user asked for a `.md` file they can configure by hand; this is that file.

**Path:** `context/org-structure.md` — resolved server-side as `resolve(process.cwd(), "../context/org-structure.md")` (the same idiom `scaffold-files` uses for `context/*.md`).

**Header:** `# Org Structure · Updated: YYYY-MM-DD` (real date, §4.2 staleness convention).

**Exact structure (three line-shapes only):**

```markdown
# Org Structure · Updated: 2026-07-19

## <Business Area>
- <Portfolio>
  - <Squad>
  - <Squad>
- <Portfolio>
  - <Squad>
```

- Business area — a `## <Business Area>` heading.
- Portfolio — a top-level `- <Portfolio>` bullet (zero leading whitespace).
- Squad — a nested `  - <Squad>` bullet (two leading spaces).
- Any other line (the title, blank lines, an optional HTML guidance comment) is ignored by the parser.

**Seed content (committed by the story-022 developer, verbatim, date refreshed to ship date):** six business areas — `Residential`, `Commercial`, `New Homes and Media`, `Experience and Platforms`, `Financial Services`, `Product Operations`; each seeded with `Portfolio 1` and `Portfolio 2`; each portfolio seeded with `Squad name 1`, `Squad name 2`, `Squad name 3`. The full seeded file body is pinned in ADR-P6-010.

**Reader / parse rules:** `readTaxonomy` (`work-hq/src/server/read-taxonomy.ts`, `createServerFn` GET, `strict:false`, modelled on `load-onboarding.ts`) returns `{ businessAreas: Array<{ name: string; portfolios: Array<{ name: string; squads: string[] }> }> }`. If the file is absent it returns `{ businessAreas: [] }`. A `## ` line opens a business area; a top-level `- ` line opens a portfolio under the current area; an indented `- ` line pushes a squad onto the current portfolio. Values are trimmed. The parser is deliberately **lenient on input whitespace** (a tab or 2+ spaces both read as a nested squad) so hand-edits survive.

**Writer / write-back rules:** `writeTaxonomy` (`work-hq/src/server/write-taxonomy.ts`, `createServerFn` POST, modelled on `save-onboarding.ts`) accepts the **full** `{ businessAreas }` structure (not a delta) and re-serialises the whole file in **one canonical shape**: refresh the `Updated:` header to today, preserve the guidance comment, then emit `## <name>` per area, `- <name>` per portfolio, `  - <name>` per squad, one blank line between areas; `mkdirSync(dirname)` + `writeFileSync`. This is a full-file canonical write, not in-place text surgery (no server function in this codebase does surgical patching). **Preservation is bounded and explicit:** all areas/portfolios/squads and their list order — including any user-added entry appended to its parent — are preserved exactly; only non-canonical whitespace is normalised. A round-trip of the seeded file is byte-idempotent.

**Selection representation:** the chosen triple persists in `onboarding-state.json` `answers.editedSections['Business area']` as a single `Fact` `{ id: 'business-area-selection', decision: 'edited', text: '', editedText: '<BusinessArea> > <Portfolio> > <Squad>' }`. Partial selections drop trailing levels. This flows to the corrections handoff as one bullet (see §4.3).

**Gitignore:** Committed (durable-shared, like `context/org.md`). `.gitignore` ignores only `context/profile.md`, `context/me.md`, `context/active.md`, and `example-profile.md` — **not** `context/*.md` broadly — so this file is committed with **no new gitignore rule**.

**Concurrency:** Single-user local app; last-write-wins is acceptable and chosen. The taxonomy has its own file precisely so `writeTaxonomy` never collides with the assistant's whole-file writes to `context/org.md`.

**Staleness threshold:** No hard rule; edited when the org changes.

---

## 2. context/profile.md structure

`context/profile.md` is the AI Context Profile generated by the Glean-bootstrap path (ADR-P6-007). It is a first-class Tier-2 durable-personal file: loaded after `context/me.md`, before drafting or personalising.

**Title header (exact format):**

```
# <Full Name> — AI Context Profile
```

**Section structure:**

Sections use `## ` headings. The parser splits on `## ` boundaries and does not assume numbering — sections may be numbered (`## 1. Executive summary`) or unnumbered. Required sections in the bootstrap prompt:

1. Executive summary
2. Identity and current role
3. Business area
4. Role scope and responsibilities
5. Major projects / programs
6. Manager
7. Team managed
8. Direct reports
9. Key collaborators / stakeholder network
10. Known OKRs and goals
11. Decision-making scope
12. Derived work style
13. Derived communication style
14. Operating cadence / rituals
15. Tools, systems, and domains they appear closest to
16. Domain expertise / subject-matter areas
17. Risks, constraints, or recurring problem themes in their work
18. Preferences or patterns an AI assistant should know
19. Open questions / assumptions to validate with the person

Plus at least 8 additional evidence-based attributes (leadership style, product philosophy, data fluency, etc.).

**Claim labels:**

Every section labels its content with one of:

| Label | Meaning |
|---|---|
| `Confirmed` | Sourced from Glean people data or direct documents |
| `Derived` | Interpreted from documents or observed patterns |
| `Unknown / needs validation` | Gap or assumption requiring human validation |

**Required terminal sections (always present in every profile):**

- `## Open questions / assumptions to validate` — explicit evidence gaps and assumptions the user must confirm
- `## How my AI assistant should support me` — closing section with practical AI guidance bullets (how to draft, summarise, handle ambiguity, prepare meetings, etc.)

**Gitignore:** Personal (never committed). Contains personnel-adjacent data (manager, direct reports, start date) per AD-5 / ADR-P6-007.

**Review-UI renderer selection (informational, feature f-review-ux).** The phase-4 review page does not render raw markdown. `selectRenderer(heading, body)` chooses a renderer per section: primarily **shape-based** (KV grid, item-list, per-fact list) from the parsed body, with a `HEADING_OVERRIDE_MAP` that forces specific headings to a specific renderer regardless of body — including `'taxonomy-picker'` for `Business area` (story 022, §1.4) and `'suppressed'` for `Tools, systems, and domains`. A `'suppressed'` section is **never rendered** on the review page (no section card, no visible text) and is instead queued for unconditional removal from `context/profile.md` via the section-level removal directive in the corrections handoff (story 023, §4.3). Suppression is driven by heading string alone, not body content.

---

## 3. Local runtime state files (gitignored)

Two runtime files live under `docs/data/local/` — gitignored as a directory at `.gitignore` line 20, so neither is ever committed. The wizard writes and reads the first; the user's AI assistant writes the second and the wizard only reads it.

### 3.1 onboarding-state.json shape

**Path:** `docs/data/local/onboarding-state.json` (gitignored)

**Persistence model:** Written on a 2-second debounce after any state change; flushed immediately on phase Confirm. Read once on wizard mount via the `loadOnboarding` server function; `localStorage` is a write-through cache for offline resilience.

**Schema:**

```json
{
  "phase": 4,
  "answers": {
    "role": "string",
    "workstyle": ["string"],
    "team": { "size": "1–2 | 3–5 | 6–10 | 11+ | ''", "descriptor": "string" },
    "keyTools": ["string"],
    "stakeholders": [
      { "name": "string", "role": "string", "relationship": "Decision maker | Collaborator | Informed | ''" }
    ],
    "glossary": "string",
    "priorities": [
      { "title": "string", "owner": "string", "dueDate": "string" },
      { "title": "string", "owner": "string", "dueDate": "string" },
      { "title": "string", "owner": "string", "dueDate": "string" }
    ],
    "blockers": "string",
    "openQuestions": "string",
    "assistant": "copilot | other",
    "otherAssistant": "string",
    "checks": {
      "installed": "boolean",
      "contextOpen": "boolean",
      "testedPaste": "boolean"
    },
    "seedingPath": "bootstrap | manual | ''",
    "fullName": "string",
    "workEmail": "string",
    "editedSections": {
      "<section heading>": {
        "body": "string",
        "edited": "boolean",
        "facts": [
          {
            "id": "string",
            "text": "string",
            "status": "Confirmed | Derived | Unknown",
            "decision": "pending | accepted | edited | removed",
            "editedText": "string"
          }
        ]
      }
    }
  },
  "completedPhases": [1, 2, 3],
  "updatedAt": "2026-07-05T12:00:00.000Z"
}
```

**Field notes:**

- `phase` — integer 1–6: the phase currently displayed in the wizard.
- `answers.workstyle` — **current shape** `string[]` (story 014): the selected working-style chips, plus any free-entry chips. **Accepted legacy input:** a single `string` (the pre-014 CSV/free-text value); `normalizeAnswers` migrates it losslessly into the array.
- `answers.team` — **current shape** `{ size, descriptor }` (story 014): `size` is one of `"1–2" | "3–5" | "6–10" | "11+"` (or `""` before selection); `descriptor` is the free-text team description. **Accepted legacy input:** a flat `string`; `normalizeAnswers` migrates it by placing the string into `descriptor` and leaving `size` empty.
- `answers.stakeholders` — **current shape** `Array<{ name, role, relationship }>` (story 014): structured rows where `relationship` is one of `"Decision maker" | "Collaborator" | "Informed"` (or `""` before selection). **Accepted legacy input:** `string[]`; `normalizeAnswers` migrates each string to `{ name: <string>, role: "", relationship: "" }`. Phase-5 priority owner options are derived from these `name` values (prefixed with `"Me"`).
- `answers.seedingPath` — `"bootstrap"` when the user chose the Glean path; `"manual"` for the interview path; `""` before the path is chosen.
- `answers.editedSections` — map of section headings from `context/profile.md` to per-section review state. `body` + `edited` are the section-level raw-edit escape hatch (story 010): `body` holds the current full section text, `edited: true` marks a section the user changed. `facts` (optional, story 013 / ADR-P6-009) holds the per-fact triage decisions when the user reviews individual claims: each fact carries a stable `id`, its original `text`, a per-fact `status` (from `detectStatus`, defaulting to `Unknown`), a `decision` (`pending` | `accepted` | `edited` | `removed`), and `editedText` when `decision: "edited"`. `facts` is additive — legacy entries lacking it fall back to raw-body editing. `normalizeAnswers` migrates the old `{ body, edited }` shape by leaving `facts` undefined and preserving `body`/`edited` with no data loss. Only edited sections (and, within them, only changed facts) appear in the profile-corrections handoff (§4.3).
- `completedPhases` — list of phase numbers that have been confirmed (Confirm button clicked). Drives the Health tile's progress indicator.
- `answers.profileDetected` — `boolean` (story 017): set `true` once the phase-3 `checkProfileExists` poll finds `context/profile.md`. Persisted so phase 4 renders section cards immediately on reload without re-showing the waiting state.
- `updatedAt` — ISO 8601 timestamp of the last write.

---

### 3.2 handshake.json shape

**Path:** `docs/data/local/handshake.json` (gitignored)

**Purpose:** The observed phase-2 verification handshake (story 015 / ADR-P6-008). It lets the wizard detect that the user's AI assistant has confirmed it loaded the constitution, replacing self-attestation. The wizard **never** writes this file — only the assistant does.

**Schema:**

```json
{
  "verifiedAt": "2026-07-13T09:41:00.000Z",
  "assistant": "GitHub Copilot"
}
```

| Field | Type | Content |
|---|---|---|
| `verifiedAt` | string | ISO 8601 timestamp of when the assistant confirmed verification |
| `assistant` | string | Human-readable name of the assistant that verified (e.g. `GitHub Copilot`) |

**Writer:** The user's AI assistant, instructed by the phase-2 verification prompt (§4.4). The assistant creates `docs/data/local/` if absent and writes the file after confirming it can read the constitution and `context/active.md`.

**Reader:** The wizard's `checkHandshake` server function (`work-hq/src/server/check-handshake.ts`), a read-only `createServerFn` GET modelled exactly on `check-profile-exists.ts`. It returns `{ detected: boolean; verifiedAt: string | null; assistant: string | null }`. `PhaseWire` polls it on a 5 000 ms interval while phase 2 is active and `handshake.json` is absent; on detection, polling stops and the `testedPaste` checkbox locks to `✓ Assistant verified at <HH:MM>`.

**Gitignore:** Personal (never committed). Covered by the existing `docs/data/local/` rule (`.gitignore` line 20); `git ls-files --error-unmatch docs/data/local/handshake.json` must exit non-zero.

**Staleness rule:** Existence-only detection, mirroring `check-profile-exists` (which never inspects mtime). A handshake written in a **previous** session still counts — the wizard does not gate on `verifiedAt` recency. Rationale (ADR-P6-008): the file is gitignored and single-workspace, so its presence means this workspace's assistant was verified at least once; the real `verifiedAt` is shown to the user, who retains the manual fallback if they distrust a stale value. `verifiedAt` is returned for display only, never for gating.

**Manual fallback:** If `handshake.json` never appears (assistant cannot write files), the `testedPaste` checkbox stays interactive; the user ticks it by hand, `answers.checks.testedPaste` persists to `onboarding-state.json`, and they are not blocked. The observed handshake is preferred, not required.

---

## 4. Handoff block formats

Work HQ's Collect & Copy blocks emit a standard markdown header:

```
## Work HQ handoff · <kind> · YYYY-MM-DD
```

Each kind is versioned independently. The version label is embedded in the `kind` field as documented below.

> **Presentation note (story 012).** In the onboarding route, handoff payloads may be presented behind a collapsed `ActionCard` disclosure ("View raw prompt") with a human-readable step summary shown above it — raw markdown is never the primary UI. This is purely a display wrapper: the string placed on the clipboard by the Copy button remains **byte-identical** to the contract below (same header line, same section order, same body). Any change to the copied bytes is a contract change, not a UI change.

---

### 4.1 Onboarding handoff — `onboarding`

**Version:** v1.1  
**Emitted by:** Phase 6 (Finish) — passed through `ActionCard` (story 012) as its `copyPayload`, built via `buildHandoff` with `kind: "onboarding"`. (Superseded the phase-6 `HandoffDock` usage; the generic `HandoffDock` component itself is unchanged.)  
**Purpose:** Delivered to the user's AI assistant to **verify** the already-scaffolded context files and run the first standup. By phase 6 the OS files are already written — this handoff never instructs the assistant to write or "initialize" anything.

```markdown
## Work HQ handoff · onboarding · YYYY-MM-DD

**Scaffolded files**
- context/me.md
- context/org.md
- context/active.md

**Ask**
(a) Verify these files are in place and contain real content — confirm each is present.
(b) Run my first "morning standup".
```

Sections with empty values are omitted. The `Ask` section always appears last. The word "initialize" and any file-write instruction are deliberately absent (story 006 AC1).

> **Drift note (2026-07-13):** This section previously documented a `first-standup` kind whose `Ask` said "Please initialize my context/ and memory/ files…". The shipped phase-6 implementation (story 006) emits `kind: "onboarding"` with the verify-and-standup ask above. The contract is corrected here to match reality; the drift was flagged in story 006's QA report. The full profile/answers summary that the old block carried is not emitted by phase 6 — the files it would have described are already scaffolded on disk.

---

### 4.2 Bootstrap handoff — `profile-bootstrap`

**Version:** v1.0  
**Emitted by:** Phase 3 (Seed your profile), bootstrap path — `BootstrapCopyBlock` component.  
**Purpose:** Delivered to a Glean-connected assistant to research and write `context/profile.md`.

The bootstrap handoff is the full content of `templates/bootstrap-profile-prompt.md` with the Personal OS wrapper prepended and `[FULL_NAME]` / `[WORK_EMAIL]` substituted. It is not emitted by the standard `buildHandoff` function — it is shown as raw template content in the Collect & Copy block.

**Label displayed in Work HQ:** `profile-bootstrap · ~<char count> chars`

**Personal OS wrapper (prepended to the master prompt):**

```markdown
> Save the final Markdown profile to `context/profile.md` in this workspace,
> overwriting if present. This environment requires the file write — do not
> only return the profile in chat. When the file is written, tell me it is
> ready for review in Work HQ.
```

The template source is committed at `templates/bootstrap-profile-prompt.md`. Its structural output contract is defined in §2 above.

---

### 4.3 Profile corrections handoff — `profile-corrections`

**Version:** v1.2 (feature f-review-ux adds the section-level removal directive, the multi-column KV-row convention, and the business-area single-bullet)  
**Emitted by:** Phase 4 (Review & correct), bootstrap path — built by `buildProfileCorrectionsMarkdown` and passed through `ActionCard` (story 012) as its `copyPayload`.  
**Purpose:** Delivered to the user's AI assistant to apply the user's corrections to `context/profile.md`, then distil `context/me.md`, `context/org.md`, and `context/active.md` from it.

**Two granularities.** Section-level (raw-edit escape hatch, story 010) and fact-level (per-fact triage, story 013 / ADR-P6-009) share the same header and `Ask`. The first line is always exactly `## Work HQ handoff · profile-corrections · <YYYY-MM-DD>`.

**Section-level (escape-hatch) block** — a section the user edited via the raw textarea emits its full corrected body:

```markdown
**<Edited section heading>**
<corrected body text>
```

**Fact-level block** (story 013). When the user triages individual facts, the section block lists **only the facts that changed** — unchanged facts are omitted. Implementers emit exactly:

- an **edited** fact → a plain markdown bullet carrying its **new** text: `- <new fact text>`
- a **removed** fact → a bullet with the explicit removal marker: `- **Removed:** <original fact text>`

```markdown
## Work HQ handoff · profile-corrections · YYYY-MM-DD

**<Edited section heading>**
- <edited fact new text>
- **Removed:** <original removed fact text>

**Ask**
Apply the corrections above to context/profile.md — update edited facts in place
and delete any fact marked "**Removed:**" — then distil context/me.md,
context/org.md (through the sensitivity gate — no personnel data), and
context/active.md seeds from the updated profile. Confirm each file is written.
```

**`**Removed:**` convention (binding).** The literal string `- **Removed:** ` prefixes the fact's **original** text and is the assistant's instruction to delete that fact from `context/profile.md`. Edited facts carry no marker — their bullet is the desired final text. This is the only *fact-level* removal signal; implementers must emit it verbatim.

**Section-level removal directive (binding — story 023 / ADR-P6-010).** Distinct from the fact-level `- **Removed:**` marker, a **section-level** removal directive instructs the assistant to delete an entire named section — heading line and all body content — from `context/profile.md`. It is a **block-level** line (not a bullet, because it removes the section itself, not a fact within it):

```markdown
**Removed section:** <section heading text>
```

The `<section heading text>` is the plain heading with no `##` prefix (mirroring the `**<Edited section heading>**` block label). Implementers emit this verbatim. Its concrete required use: the `Tools, systems, and domains` section is suppressed from the review UI (§2) and its removal is **unconditional** — `buildProfileCorrectionsMarkdown` emits `**Removed section:** Tools, systems, and domains` in **every** corrections handoff, even when the user made no other edit.

Paired with the directive, the `**Ask**` block gains, appended after the existing ask text, this exact sentence (casing, punctuation, and `##` prefix are exact):

```text
Remove the ## Tools, systems, and domains section from context/profile.md entirely.
```

**Business-area single-bullet (story 022 / ADR-P6-010).** The taxonomy picker's selection is a single `decision: 'edited'` fact (`id: 'business-area-selection'`), so it needs no special-casing — it emits through the standard edited-fact path as exactly one bullet under the `**Business area**` heading: `- <BusinessArea> > <Portfolio> > <Squad>`. The pinned join token is ` > ` (space-greater-than-space); partial selections drop trailing levels (`- <BusinessArea> > <Portfolio>` or `- <BusinessArea>`).

**Multi-column KV-row convention (story 020 / ratified here — PM flag #5).** A KV-grid or table section can carry rows with more than one value column (e.g. a stakeholder row `Name | Role | Relationship`). When such a row is **edited or added**, the fact bullet joins the row's cells with ` | ` (space-pipe-space) in cell order:

```markdown
- <cell 1> | <cell 2> | <cell 3>
```

**Applying it back (assistant instruction):** the assistant splits the bullet on ` | ` and maps the cells, in order, to the columns of the corresponding markdown table row in `context/profile.md` — updating the matching row when the first cell (the key) already exists, or inserting a new row when it does not. The ` | ` token is the cell delimiter only; it never appears inside a cell value.

**Selection rule:** Sections with changes appear (`edited: true`, or at least one non-`pending`/non-`accepted` fact decision in `onboarding-state.json:answers.editedSections`); the unconditional `Tools, systems, and domains` section-removal directive also always appears. Within an appearing section, only edited and removed facts are listed. Unchanged facts and untouched sections are omitted, so the assistant never rewrites text the user did not touch (round-trip safety).

**No-empty-handoff clause (PM flag #3 — supersedes the prior zero-corrections wording).** Because the `Tools, systems, and domains` section-removal directive is emitted **unconditionally**, the corrections handoff always carries at least that directive plus its Ask sentence. The legacy `No corrections — all sections accepted as is` body (story 011) can therefore **no longer occur** — that branch is dead once the unconditional directive exists. Implementers must not emit the zero-corrections string; the removal directive is always present.

**Sensitivity gate:** The `Ask` instruction includes an explicit reminder that `context/org.md` must not contain personnel data, unreleased roadmap items, or commercial terms before being committed.

---

### 4.4 Phase-2 verification prompt (pinned wording)

**Version:** v1.1 (story 015 / ADR-P6-008 appends the handshake instruction)  
**Displayed by:** `PhaseWire` (phase 2) as a copyable, non-editable block.  
**Purpose:** The user pastes this into their assistant to verify the constitution loaded; the appended instruction asks the assistant to write the observed handshake (§3.2).

Exact wording (implementers copy verbatim):

```text
Confirm you can read my constitution and context/active.md — tell me my #1 priority. Then write docs/data/local/handshake.json with this exact shape: { "verifiedAt": "<the current time as an ISO 8601 timestamp>", "assistant": "<your assistant name>" }. Create the docs/data/local/ folder if it does not already exist.
```

The first sentence is unchanged from the shipped prompt; only the handshake instruction is appended (story 015 out-of-scope forbids other wording changes). The file path `docs/data/local/handshake.json` must appear verbatim in the on-screen text (story 015 AC1). Assistants that cannot write files simply confirm the priority; the user then uses the manual-fallback checkbox (§3.2).
