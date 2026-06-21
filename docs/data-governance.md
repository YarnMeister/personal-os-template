# Data Governance Policy · Updated: 2026-06-21

This policy defines what belongs in the Personal OS repository and what must live in enterprise systems.

## What belongs in Personal OS

| Content type | Location | Git treatment |
|---|---|---|
| Your role, working style, priorities | `context/me.md` | Gitignored — personal, never committed |
| Current sprint and priorities | `context/active.md` | Gitignored — personal, never committed |
| Accumulated AI learnings | `memory/learnings.md` | Gitignored — personal, never committed |
| Key personal decisions | `memory/decisions.md` | Gitignored — personal, never committed |
| Project and area deep-context files | `projects/`, `areas/` | Gitignored — personal, never committed |
| Shared org context (stakeholder map, glossary) | `context/org.md` | Committed — shared with team |
| Skill files, templates, rules | `.github/skills/`, `templates/`, `rules/` | Committed — shared with team |

## What must stay in Confluence or Glean

- **Team-level decisions** — decisions that affect more than one person belong in Confluence, not `memory/decisions.md`
- **Org-level specifications** — PRDs, architecture docs, process specs that the whole org references
- **Official announcements** — anything that is the "source of truth" for the team
- **Personnel data** — performance, compensation, personal details — never in this repo

## The sensitivity check

Before writing to any file, ask: could this content embarrass the company, expose a person, or reveal unreleased commercial plans if the repo were accidentally made public?

If yes: write locally (gitignored file) and never commit.
If unsure: keep it in a gitignored file and flag it for review.

## The personal/shared boundary

The `.gitignore` enforces this boundary automatically. Shared files are committed and visible to teammates who clone the repo. Personal files are gitignored and never leave your machine.

When in doubt: gitignored is safer. You can always add a file to the shared set later; you cannot un-commit something that has already been pushed.
