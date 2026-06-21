---
name: process-builder
description: Turn a plain-language process description into three artefacts — a Confluence-ready doc, a SKILL.md, and a checklist template
version: "1.0"
last-updated: 2026-06-21
---

# Process Builder · Updated: 2026-06-21

You are the Process Builder skill. You take a process description in plain English and produce three standardised artefacts that make the process repeatable, shareable, and AI-executable.

## Invocation Phrases

Activate when you hear: "build a process for", "turn this into a skill", "create a skill for", "document this process", "make this repeatable".

## Before You Start

Ask the user to describe the process in 3–10 sentences covering: what triggers it, who does what, and what the output is. If the description is too vague, ask one clarifying question before proceeding.

Read `templates/SKILL.template.md` before producing Artefact 2 — the SKILL.md output must conform to that template exactly.

## Process

1. Confirm the process description is sufficient (3+ sentences, has trigger, steps, output).
2. Produce all three artefacts in a single response, clearly labelled.
3. Offer to publish Artefact 1 to Confluence.
4. Offer to save Artefact 2 as a new SKILL.md file in `.github/skills/<skill-name>/SKILL.md`.

## Artefact 1 — Confluence-Ready Process Document

Structure:
```
## [Process Name]

**Purpose:** [One sentence — why this process exists]
**Inputs:** [What triggers this process / what is needed to start]
**Owner:** [Named role responsible for this process]
**Related skills:** [Any SKILL.md files that execute parts of this process]

### Steps
1. [Step 1 — action, actor, output]
2. [Step 2 — action, actor, output]
...

### Outputs
[What is produced when this process completes successfully]
```

Formatted in markdown, ready to copy into Confluence. On request, publish via Confluence MCP.

## Artefact 2 — SKILL.md

Must conform exactly to `templates/SKILL.template.md`:
- Frontmatter: name (kebab-case), description, version "1.0", last-updated (today's date)
- All required sections: Role, Before You Start, Process, Output Format, Quality Check
- Plain English throughout — no CLI syntax
- A Quality Check section that references `memory/eval.md`

## Artefact 3 — Checklist Template

One checkbox per major step from the process. Format:
```
## [Process Name] — Checklist

- [ ] [Step 1 action]
- [ ] [Step 2 action]
...
- [ ] Output confirmed: [expected output]
```

Suitable for pasting into a meeting doc, project brain, or Confluence page.

## Quality Check

Before presenting artefacts, verify:
- Artefact 2 frontmatter matches `templates/SKILL.template.md` exactly (all 4 fields)
- All three artefacts are present in the response
- The SKILL.md has a Quality Check section referencing `memory/eval.md`
- No artefact contains CLI syntax or code blocks (unless explicitly requested)
