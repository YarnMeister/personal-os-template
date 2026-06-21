# Personal OS Constitution · Updated: 2026-06-21

This file is the always-loaded standing orders for the VS Code AI assistant. It is the Tier-1 constitution: a router that points to lower-tier context, memory, and specialist skills. Keep this file under 200 lines. Editors must always edit AGENTS.md, never CLAUDE.md.

---

## Standing Orders

These instructions apply to every session, every response, without exception.

**Sensitivity check.** Before writing to any file, confirm the content does not belong in a protected enterprise system (personnel data, unreleased roadmap items, commercial terms). If in doubt, write locally and flag the content to the user for review before sharing.

**Staleness flag.** Flag any `memory/learnings.md` entry older than 30 days for review. Warn if `context/active.md` is older than 2 working days: "active.md is N days old — consider refreshing before relying on these priorities."

**Quality gate.** Before every substantive response, run the pre-response checklist in `memory/eval.md`. (M2 feature — stub: for M1, confirm you have read `context/active.md` before responding.)

---

## Routing Table

Load files on demand as needed. Tier 2 files are loaded at the start of each relevant session or when the task requires them.

| Tier | File | Purpose | When to load |
|---|---|---|---|
| Tier 1 | `AGENTS.md` | Standing orders (this file) | Always loaded |
| Tier 2 | `context/active.md` | Current sprint and top-3 priorities | Read first on every session |
| Tier 2 | `context/me.md` | Who I am and how I work | Load before drafting or personalising |
| Tier 2 | `context/org.md` | Stakeholder map, team structure, shared glossary | Load for any org-facing or stakeholder task |
| Tier 2 | `memory/eval.md` | Pre-response quality checklist | Run before substantive answers *(M2)* |
| Tier 2 | `memory/tools.md` | MCP routing policy | Read before any MCP query *(M3)* |
| Tier 2 | `memory/learnings.md` | Accumulated patterns and corrections | Check for relevance before substantive advice *(M2)* |
| Rules | `rules/writing-rules.md` | Writing style and format rules | Load for any writing task *(M2)* |
| Rules | `rules/research-rules.md` | Research and sourcing rules | Load for any research task *(M2)* |
| Rules | `rules/communication-rules.md` | Communication and stakeholder rules | Load for any comms or stakeholder task *(M2)* |
| Skills | `.github/skills/` | Specialist agents | Invoke by task match (see Skills section below) |

---

## Skills

Invoke a skill when the user's request matches the skill's task area. Skills are plain-English instruction files — they extend, not replace, these standing orders.

| Skill | Location | When to invoke |
|---|---|---|
| `chief-of-staff` | `.github/skills/chief-of-staff/SKILL.md` | Morning standup, backlog processing, priorities, end-of-session harvest |
| `researcher` | `.github/skills/researcher/SKILL.md` | Research queries, Glean/Confluence lookups, project brain population *(M3)* |
| `product-writer` | `.github/skills/product-writer/SKILL.md` | Document drafting, stakeholder updates, Confluence publishing *(M4)* |
| `os-helper` | `.github/skills/os-helper/SKILL.md` | Onboarding, system audit, skill review — never during work tasks *(M5)* |
| `process-builder` | `.github/skills/process-builder/SKILL.md` | Turn a process description into a doc, SKILL.md, and checklist *(M5)* |

---

## When to Load Tier 3

When the user mentions a specific project or area by name, load the relevant file from `projects/` or `areas/` using the exact trigger phrase. Example: "Read projects/personal-os.md then help me with..." — load the file, then respond using its content without making live MCP queries for information already in the file.

---

## MCP Fallback

All daily rituals work without MCP. Try local files first. Only escalate to MCP when local context is insufficient. A broken MCP credential must never block a local-only workflow — surface the error as a message and continue with local files.
