# Work HQ v2 — Target Tech Stack & Conversion Playbook · Updated: 2026-07-20

> Status: Approved v1.0 · Owner: Jan Jr · Companion to `docs/lovable-v2-blueprint.md`
> Purpose: Define the target architecture Work HQ v2 converges on, and the playbook for converting the Lovable-generated UI prototype into it. Lovable owns the visual design; this document owns the runtime.

**Non-negotiables (fixed constraints, not decisions):** VS Code + GitHub Copilot as the AI shell; plain local `.md` files as the only memory/context store; the app runs locally on the user's machine, started from the repo root.

**Design principle behind every choice:** maximise byte-level overlap with what Lovable emits (React + Vite + TypeScript + Tailwind + shadcn/ui SPA), and isolate everything Lovable cannot do — local file I/O — into one thin, boring layer we own. We do not fight Lovable's stack preferences; we choose a target where ~80% of its output ports unchanged and the remaining 20% was never going to come from Lovable anyway.

---

## 1. Decision Register

| # | Component | Decision | Rejected |
|---|---|---|---|
| D1 | App shape & runtime | Vite SPA + small Node server, one process, `npm run dev` | TanStack Start/Nitro (v1), Next.js, Electron/Tauri |
| D2 | Language & contracts | TypeScript end-to-end; Zod schemas in `src/shared/contracts/` | Prose-only contracts (v1) |
| D3 | UI layer | React 19 + Tailwind + shadcn/ui (identical to Lovable output) | Any "better" alternative |
| D4 | Client routing | Keep what Lovable generates (React Router) | TanStack Router (v1) |
| D5 | Server API | Hono REST implementing the `OsFileStore` interface | Server functions (v1), tRPC, Express |
| D6 | Markdown engine | unified/remark AST + typed section models + canonical serialiser | Hand-rolled regex (v1) |
| D7 | Client data/state | TanStack Query only | Redux/Zustand/global stores |
| D8 | External-edit sync | chokidar file watcher + Server-Sent Events | Ad-hoc polling (v1), WebSockets |
| D9 | Persistence | `.md` files are the database; `docs/data/local/*.json` for app state | SQLite index, localStorage-as-store |
| D10 | Testing | Vitest + fast-check parser round-trips; Playwright smoke flows | Component unit-test coverage theatre |

### D1 — App shape: Vite SPA + a small Node server in one process

The biggest departure from v1. v1 used TanStack Start on a beta Nitro build — a full-stack meta-framework with SSR machinery, routing conventions Lovable doesn't know, and a beta dependency. This app has zero need for SSR: one local user, no SEO, no first-paint-over-network concern. What it actually needs is a browser UI plus something with filesystem access.

The target is a plain SPA talking to a ~200-line local server. `npm run dev` starts **one Node process** that runs the Hono API and the Vite dev server together (Vite middleware mode) and opens the browser at the app.

Electron/Tauri rejected: VS Code is already the desktop shell, a browser tab costs nothing, and a desktop build pipeline is pure overhead for a single-user tool.

### D2 — TypeScript end-to-end, contracts as Zod schemas

`docs/specs/file-contracts.md` is prose that humans and the AI honour by discipline. In v2 each file contract becomes a Zod schema in `src/shared/contracts/` — one source of truth that:

- validates on the server before any file write,
- types the client (form shapes, API payloads),
- types the handoff payload builders.

When a contract changes, the compiler finds every screen it touches. Zero conversion cost: Lovable emits TypeScript and ships Zod.

### D3 — UI layer: exactly Lovable's

React + Tailwind + shadcn/ui is both what Lovable produces and what v1 used — the visual language, fact-review cards, and autosave patterns all port forward. When the pragmatic choice and the ideal choice coincide, take the win. Conversion cost for the component tree: approximately zero.

### D4 — Routing: keep Lovable's React Router

For a flat SPA with ~12 routes and no data-loading cleverness, routers are commodity. Swapping every route file and `Link` back to TanStack Router costs more than it buys. The one thing v1's router did that mattered (loader-injected onboarding state) moves to TanStack Query (D7).

### D5 — Server API: Hono REST behind `OsFileStore`

The blueprint instructs Lovable to put all file I/O behind an `OsFileStore` interface backed by an in-memory mock. Conversion is therefore: write one real implementation of that interface that calls a local REST API.

Hono over Express: tiny, typed, zero config; its request/response types flow into the shared Zod schemas. tRPC rejected: elegant, but couples client and server builds and adds a conversion step for every Lovable-generated fetch. Plain REST keeps the seam dumb and inspectable with `curl` — which matters when debugging "why did my markdown get mangled."

**API surface (complete):**

```
GET    /api/files                    → file map: path, updatedAt, staleness class
GET    /api/files/:path              → { updatedAt, sections } (parsed, typed)
PUT    /api/files/:path              → full-file canonical write from section models
GET    /api/state/onboarding         → onboarding-state.json
PUT    /api/state/onboarding         → onboarding-state.json (debounced client-side)
GET    /api/state/handshake          → handshake.json presence + contents
GET    /api/events                   → SSE stream of file-change events (D8)
```

All writes are full-file canonical re-serialisation (parse → edit models → re-emit), never string surgery — same rule v1's `writeTaxonomy` established.

### D6 — Markdown engine: unified/remark with a typed contract layer (the crown jewel)

v1's biggest structural failure: ~1,500 lines of hand-rolled regex parsing inside a 5,776-line route file (`onboarding.tsx`). In v2 this is the one genuinely designed subsystem, and it is UI-free so it survives any future front-end change:

```
.md file ──remark──▶ mdast ──contract layer──▶ typed section models ──UI edits──▶ canonical serialiser ──▶ .md file
```

Typed section models: `KvEntry[]`, `PriorityRow[]`, `Fact[]` (with status + decision), `TaxonomyTree`, `GlossaryEntry[]`, `ProseSection`. Renderer selection stays shape-based with per-heading overrides, as v1's `selectRenderer` established — but operates on the AST, not regex.

Two invariants, enforced by property-based tests (D10):

1. **Canonical idempotence** — parse → serialise of a canonical file is byte-identical.
2. **Round-trip safety** — serialise → parse loses nothing; hand-edited (non-canonical whitespace) input parses leniently and normalises only whitespace on write.

Hand-rolled parsing is how you silently eat a user's hand-edited org file; an AST plus round-trip tests is how you never do.

### D7 — Client state: TanStack Query and nothing else

Every piece of durable state is a file on disk; the client's job is caching server reads and invalidating after writes — which is precisely TanStack Query, and Lovable ships it by default. Autosave is a debounced mutation. A global store would create a second copy of the truth that drifts from the files; refuse it. Ephemeral in-flight form state may sit in component state with a localStorage write-through crash buffer (D9), nothing more.

### D8 — External-edit sync: chokidar + SSE

Load-bearing for the product: the AI assistant writes the same files the app renders (`context/profile.md`, `handshake.json`, corrections). v1 handled this with ad-hoc 5-second polling in two places. v2 makes it a first-class mechanism:

- The server watches the workspace with chokidar and pushes `{ path, kind: changed|created|deleted }` events over one SSE stream (`/api/events`).
- The client holds a single EventSource and invalidates the matching TanStack Query key.

Result: the moment Copilot writes `context/profile.md`, the review screen appears — the "it just noticed" beat that makes onboarding feel alive. SSE over WebSockets because traffic is strictly one-directional and SSE is a plain HTTP response — no library, no reconnect ceremony (the browser reconnects automatically).

### D9 — Persistence: markdown files are the only database

Reaffirming v1's AD-1 because every stack conversation invites "just add SQLite": **no.** The files must remain the source of truth because Copilot reads them directly — any index or cache is a second truth that desyncs the assistant from the app.

- OS content: `.md` files under `context/`, `memory/`, `projects/`, `areas/`, `skills/`, per the file contracts.
- App runtime state (onboarding progress, handshake): `docs/data/local/*.json`, gitignored.
- localStorage: write-through crash buffer for in-flight form state only; never read as a source of truth when the server is reachable.
- Concurrency: single user, last-write-wins, per-file writes — same posture as v1's `writeTaxonomy`.

### D10 — Testing where this app actually breaks

This app fails in exactly two ways: the parser corrupts a file, or a ritual flow breaks. Budget accordingly:

- **Vitest + fast-check** on every contract: canonical idempotence, round-trip safety, lenient-input normalisation, and fixture files for each contract in `src/shared/contracts/__fixtures__/`.
- **Playwright** smoke tests on the critical flows only: standup, backlog triage, each of the three onboarding depths, profile fact-review → corrections handoff.
- No component unit-test theatre.

---

## 2. Repository Layout (target)

The split-repo layout (`work-hq/` with its own package.json and `--prefix` indirection) dies with the split app. One package at the repo root's `app/` directory:

```
personal-os/
├── AGENTS.md, CLAUDE.md, context/, memory/, rules/, skills/, templates/   # the OS — unchanged
├── docs/
│   ├── data/local/                  # gitignored runtime state (unchanged)
│   ├── lovable-v2-blueprint.md
│   └── specs/                       # this doc, file-contracts.md, architecture.md
└── app/
    ├── package.json                 # the only app package
    ├── vite.config.ts
    ├── src/
    │   ├── client/                  # Lovable output lands here
    │   │   ├── routes/              # React Router pages (Work + Foundation modes)
    │   │   ├── components/
    │   │   │   ├── ui/              # shadcn primitives
    │   │   │   └── os/              # the markdown↔UI component library
    │   │   └── lib/                 # OsFileStore client impl, query keys, SSE hook
    │   ├── server/
    │   │   ├── index.ts             # one process: Hono API + Vite middleware + open browser
    │   │   ├── routes/              # /api/files, /api/state, /api/events
    │   │   ├── store/               # OsFileStore filesystem implementation
    │   │   └── watch.ts             # chokidar → SSE bridge
    │   └── shared/
    │       ├── contracts/           # Zod schemas + parse/serialise per file contract
    │       │   └── __fixtures__/
    │       └── handoff/             # handoff payload builders (byte-exact, versioned)
    └── e2e/                         # Playwright
```

**Run model:** root `package.json` keeps `npm run dev` as the single entry — it runs `app/` directly (no `--prefix` preflight dance). The server self-checks Node ≥ 20 and installed dependencies on boot and prints a human-readable fix ("run `npm install` in app/") instead of v1's preflight script. `npm run onboard` is deleted: onboarding is a route.

---

## 3. Conversion Playbook — Lovable output → target architecture

What Lovable will hand us (its internal defaults): a Vite + React + TypeScript SPA, Tailwind + shadcn/ui, React Router, TanStack Query, mock data — possibly Supabase wiring if it decided persistence was needed.

Convert in this order; each step leaves the app runnable.

**Step 0 — Strip what doesn't apply.** Delete any Supabase/auth/analytics wiring Lovable added (single-user local app: no auth, no backend DB). Delete unused shadcn components. Confirm the app boots on mocks.

**Step 1 — Land the code.** Move the Lovable project into `app/`, client code under `src/client/`. Keep React Router (D4). Do not restyle, do not rename components.

**Step 2 — Verify the `OsFileStore` seam.** The blueprint told Lovable to route all file I/O through `OsFileStore` with an in-memory mock. Audit for leaks — any component fetching or holding file data outside the interface gets refactored onto it *before* the server exists. This is the only risky step; everything after is mechanical.

**Step 3 — Build the contracts package.** `src/shared/contracts/`: Zod schemas + remark parse/serialise per file contract (D2, D6), with fixtures and fast-check round-trip tests green before any UI touches it. Port the fixture content Lovable seeded its mocks with into real fixture `.md` files.

**Step 4 — Build the server.** Hono app implementing the D5 API surface over the contracts package; chokidar → SSE bridge (D8); single-process dev entry that mounts Vite middleware and opens the browser.

**Step 5 — Swap the store.** Implement `OsFileStore` over the REST API with TanStack Query; add the SSE invalidation hook; delete the in-memory mock. The UI should not know anything changed.

**Step 6 — Wire the handoffs.** Port the versioned handoff builders (`onboarding`, `profile-bootstrap`, `profile-corrections`) into `src/shared/handoff/` with byte-exact snapshot tests against the pinned formats in `file-contracts.md` §4.

**Step 7 — Root integration.** Replace the root `package.json` scripts (`dev` runs `app/`; delete `onboard`/preflight); update README run instructions; add Playwright smoke tests for the critical flows (D10).

**Definition of converted:** `git clone` → `npm install` → `npm run dev` → browser opens → onboarding chooser renders from real (empty) OS files → completing Bare Minimum writes real `context/*.md` → Copilot writing `handshake.json` flips the verification step live via SSE → morning standup renders from `context/active.md`.

---

## 4. Dependency Budget

The entire non-UI dependency surface, deliberately small:

| Dependency | Role | Why safe |
|---|---|---|
| `hono` + `@hono/node-server` | API server | Tiny, stable, typed |
| `unified` / `remark-parse` / `remark-stringify` | Markdown AST | The ecosystem standard; mdast is a stable spec |
| `zod` | Contracts | Already in Lovable output |
| `chokidar` | File watching | The de-facto watcher |
| `vite` | Dev server + build | Already in Lovable output |
| `vitest`, `fast-check`, `@playwright/test` | Tests (dev-only) | — |

Anything beyond this list needs a written reason in this document. Specifically banned: SSR frameworks, ORMs/databases, global state libraries, WebSocket libraries, Electron/Tauri.
