// FICTIONAL PERSONA — do not replace with real data.
// This fixture is used in development and tests for the Review & correct phase
// (story 010) to exercise the profile parser and editable section cards without
// requiring a real context/profile.md file. All names, roles, org details, and
// specifics are entirely invented and bear no relation to any real person.

export const FICTIONAL_PROFILE_MD = `# Morgan Reyes — AI Context Profile

## Executive summary
**Confirmed**
Morgan Reyes is a Senior Product Operations Lead at Acme Corp, responsible for
coordinating cross-functional product delivery across three business units.
Strong background in process design, stakeholder alignment, and OKR facilitation.

## Identity and current role
**Confirmed**
| Field | Value |
|---|---|
| Name | Morgan Reyes |
| Title | Senior Product Operations Lead |
| Email | morgan.reyes@acme-example.io |
| Manager | Director of Product, Jordan Vale |
| Location | Remote (EST) |
| Department | Product Operations |
| Start date | 2021-03-15 |

## Business area
**Confirmed**
Acme Corp's Product Operations function sits within the broader Product
organisation and acts as the connective tissue between Product, Engineering,
and Go-to-Market. Morgan's remit covers three product lines: Core Platform,
Developer Tools, and Partner Integrations.

## Role scope and responsibilities
**Confirmed**
- Owns and facilitates the quarterly OKR process for the Product org (~40 people)
- Runs the weekly Product Leadership sync and prepares the briefing pack
- Maintains the product delivery calendar and coordinates release sign-offs
- Identifies and resolves cross-team dependencies before they become blockers
- Manages the ProdOps team of 4 (2 PMs, 1 analyst, 1 delivery coordinator)

## Major projects and programs
**Confirmed**
- **Project Atlas**: migrating the billing system from Stripe to a homegrown
  solution; Morgan owns the product-side delivery plan
- **Q3 OKR refresh**: running the full cycle for 8 product teams
- **Stakeholder reporting automation**: reducing time-to-report from 4 hours to
  30 minutes using AI-assisted summarisation

## Manager
**Confirmed**
Jordan Vale (Director of Product). Weekly 1:1s every Monday. Jordan focuses
on strategic direction; Morgan handles operational execution.

## Team managed
**Confirmed**
4-person ProdOps team:
- Alex Chen (PM, Core Platform)
- Sam Okonkwo (PM, Developer Tools)
- Priya Nair (Analyst)
- Robin Torres (Delivery Coordinator)

## Direct reports
**Confirmed**
Priya Nair and Robin Torres report directly to Morgan. Alex and Sam are
matrixed: they report to Morgan for operational alignment but to domain PMs
for product decisions.

## Key collaborators and stakeholder network
**Confirmed**
| Name | Role | Interaction |
|---|---|---|
| Jordan Vale | Director of Product | Weekly strategic alignment |
| Dana Kowalski | VP Engineering | Release sign-offs, dependency resolution |
| Sage Obi | Head of GTM | Launch coordination |
| Riley Park | Data & Insights Lead | Reporting automation |

## Known OKRs and goals
**Confirmed**
Q3 2026 OKRs (Morgan's contribution):
- KR1: 100% of product teams submit OKR drafts by week 3
- KR2: Stakeholder reporting time reduced by 80% (from 4h to <30 min)
- KR3: Zero missed release sign-offs across all three product lines

## Decision-making scope
**Confirmed**
Morgan can approve operational process changes and delivery calendar shifts
unilaterally. Budget decisions above $10k require Jordan's sign-off. Headcount
decisions require VP approval.

## Derived work style
**Derived**
Evidence from meeting transcripts, Confluence docs, and Slack tone suggests
Morgan is an async-first, structured communicator. Uses structured agendas for
every meeting. Batches synchronous conversations. Prefers to read context before
discussing rather than discovering in real time.

## Derived communication style
**Derived**
- Written comms: concise, numbered, action-oriented
- Preferred format for summaries: 3 bullets max, then a recommendation
- Slack: short messages, lots of threads, rarely uses voice
- Meeting style: pre-read required; no pre-read = meeting rescheduled

## Operating cadence and rituals
**Confirmed**
| Cadence | Ritual |
|---|---|
| Daily | AI-assisted morning standup (top-3, blockers, asks) |
| Weekly | Product Leadership sync (Monday 10am EST) |
| Weekly | ProdOps team sync (Wednesday 9am EST) |
| Monthly | OKR health check across all product teams |
| Quarterly | OKR planning cycle ownership |

## Tools, systems, and domains
**Confirmed**
Primary tools: Jira, Confluence, Slack, Glean, GitHub Copilot, Looker.
Close familiarity with: Miro (workshop facilitation), Notion (personal notes),
Google Sheets (ad hoc analysis).

## Domain expertise
**Confirmed**
- Product operations and delivery coordination
- OKR design and facilitation
- Process documentation and playbook creation
- Stakeholder reporting and executive communication

## Risks, constraints, and recurring problem themes
**Derived**
- Recurring friction: late dependency surfacing from Engineering teams
- Risk: Project Atlas timeline is tight; any slip cascades to Q4 planning
- Constraint: limited analyst capacity — Priya is at near-full utilisation

## Preferences and patterns an AI assistant should know
**Confirmed**
- Morgan prefers bullet-point summaries with a clear recommendation at the end
- Never wants generic filler — if unsure, say so explicitly
- Prefers named people and named systems over abstract descriptions
- Wants trade-offs surfaced before decisions, not after

## Open questions and assumptions to validate
**Unknown / needs validation**
- Exact remit boundaries between Morgan and domain PMs on Atlas
- Whether the reporting automation initiative has formal OKR coverage or is
  informal improvement work
- Morgan's preference for AI writing style (first-person vs third-person)

## How my AI assistant should support me
**Confirmed**
- Draft in a concise, structured style — bullets and numbered lists preferred
- Summaries: 3 bullets max then a clear recommendation
- Prepare meeting agendas with pre-read requirements explicit
- Surface blockers and dependencies proactively; don't wait to be asked
- When ambiguous, ask one clarifying question rather than assuming
- Use named people, named systems, named programs — no generic references
- Flag evidence gaps explicitly; never smooth over unknowns
`;
