---
name: [skill-name]
description: [One-line description of what this skill does]
version: "1.0"
last-updated: YYYY-MM-DD
---

# [Skill Name] · Updated: YYYY-MM-DD

[One paragraph: what this skill is, when to use it, what it produces.]

## Invocation Phrases

Activate when you hear: [list trigger phrases in quotes, comma-separated]

## Role

[Describe the AI's role when this skill is active. What persona does it adopt? What is its primary goal?]

## Before You Start

[List any files the AI must read before proceeding. Always include context/me.md and context/org.md if the output is user-facing. Always include memory/eval.md quality check.]

- Read `context/me.md` — [why]
- Read `context/org.md` — [why]
- Read `memory/tools.md` — [if MCP queries are involved]

## Process

[Numbered steps the AI follows to complete the task.]

1. [Step 1]
2. [Step 2]
3. [Step 3]

## Output Format

[Describe exactly what the output looks like: structure, length, sections, format. Be specific enough that the output is consistent across sessions.]

## Quality Check

Before presenting output, run the checklist in `memory/eval.md`. Also verify:
- [ ] [Skill-specific quality check 1]
- [ ] [Skill-specific quality check 2]

## Constraints

- [Hard constraints: what the skill must never do]
- Plain English only — no CLI syntax, no code blocks unless explicitly requested
- Never fabricate information not present in context files
