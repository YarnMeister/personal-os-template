# MCP Tools & Routing Policy · Updated: 2026-06-21

This file is the MCP capability registry and query-routing policy. Read it before making any MCP query. The routing hierarchy is: **Glean → Confluence → Miro**. Always try local files first before escalating to MCP.

## MCP Configuration

MCP servers are configured individually by each team member in their VS Code User settings (`~/Library/Application Support/Code/User/mcp.json`) — not in this workspace. The routing policy below applies regardless of how MCP is configured. When joining the team, configure your own Glean, Confluence, Miro, GitHub, and Filesystem servers in your global VS Code MCP settings.

## Routing Hierarchy

### 1. Glean — Discovery & People (query first)
- **Authoritative for:** enterprise search, people directory, recent activity, team announcements
- **Read/write:** Read-only for V1 (write-back deferred to V2)
- **When to query:** discovery queries, "who works on X", "what's happening with Y", recent documents
- **Escalate when:** fewer than 3 relevant results → escalate to Confluence
- **Rate limits:** check your org's Glean plan; default API tier allows ~100 queries/day — avoid fan-out queries, consolidate results locally
- **Last tested:** —

### 2. Confluence — Decisions & Specs (escalate from Glean)
- **Authoritative for:** team decisions, specifications, process docs, the official source of truth for team knowledge
- **Read/write:** Bidirectional — read decisions/specs; publish session summaries and finished documents (default behaviour)
- **When to query:** after Glean returns <3 results; for any decision or spec lookup; to publish finished artefacts
- **Publish default:** after a substantive session, offer to publish to Confluence (Chief-of-Staff harvest Step 3)
- **Rate limits:** Atlassian REST API — 10 requests/second per user; batch reads where possible; no hard daily cap on standard plans
- **Last tested:** —

### 3. Miro — Visual Artefacts (after Confluence)
- **Authoritative for:** boards, diagrams, workshop outputs, visual design artefacts
- **Read/write:** Read-only for V1
- **When to query:** after Confluence, when visual/whiteboard context is needed
- **Rate limits:** Miro REST API — 300 requests/minute; read-only V1 usage well within limit
- **Last tested:** —

### 4. GitHub — Repo Operations (on demand)
- **Authoritative for:** code repositories, pull requests, issues, skill versioning
- **Read/write:** Bidirectional
- **When to query:** when explicitly asked for repo operations or skill updates
- **Rate limits:** GitHub API — 5,000 requests/hour for authenticated PAT; well within limit for skill-versioning use
- **Last tested:** —

### 5. Filesystem — Local File Access (fallback for non-native AI)
- **Authoritative for:** local workspace files (used by AI assistants without native file access)
- **Read/write:** Bidirectional, scoped to workspace root
- **When to query:** only if the AI lacks native file access; Copilot agent mode does NOT need this
- **Rate limits:** local disk — no rate limits; scoped to workspace root only
- **Last tested:** —

## Routing Rules

1. **Local first.** Always check `context/`, `memory/`, `projects/`, `knowledge/` before any MCP call.
2. **Glean first** for discovery. Escalate to Confluence if <3 results.
3. **Confluence** for decisions, specs, publishing. After Glean.
4. **Miro** for visual context only. After Confluence.
5. **Never MCP for information already in a local file.** "Consolidate once, reference often."
6. **MCP failure is never fatal.** All daily rituals work without MCP. Surface failure as a message and continue locally.

## Personal Tuning

To override routing policy for your setup, add overrides in `CLAUDE.local.md` (gitignored, personal). The rules above are team defaults.
