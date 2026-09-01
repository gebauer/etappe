# Etappe

A travel itinerary planner. A trip is a chain of **stops** connected by
**legs**, grouped into **days**. Planning happens on a desktop; a phone is a
read-mostly companion during the trip itself. Etappe doesn't navigate —
turn-by-turn is handed off to Google Maps or Komoot via deep links — it plans,
and tells you what to do on which day, with arrival/departure times computed
from real routing, buffers and daylight, not guessed.

Self-hosted, non-commercial. Built by the author for himself, his family and
friends. Full spec in [`BUILD.md`](BUILD.md); the ordered build log is
[`WORK.md`](WORK.md).

## Stack

- **PocketBase** (Go binary, SQLite) — auth, storage, API rules, JS hooks
- **React 18 + TypeScript (strict) + Vite**
- **TanStack Query** with `persistQueryClient` → IndexedDB
- **MapLibre GL JS** + OpenFreeMap tiles
- **OpenRouteService** for car routing, **Photon** for geocoding, **SunCalc**
  for daylight
- **Zod** for all external data validation
- **Tailwind** for styling — no UI component library, no CSS-in-JS
- Deployment: single container on Coolify; PocketBase serves the built SPA

See [`CLAUDE.md`](CLAUDE.md) for the full set of conventions and
non-negotiable rules this codebase follows (dates are always derived, never
stored; the cascade engine is pure; every ORS response is cached
server-side; the taxonomy enum is closed; and — see below — no LLM API calls
anywhere in the running app).

## Getting started

**Node ≥18.18**, via nvm. Which `node` resolves by default varies across
machines — some default to an older system node that won't run Vite, others
(nvm with no system node at all) are already fine. Use nvm's LTS alias
rather than pinning a version number that might not be installed:

```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use --lts
npm install
```

Backend — fetches the PocketBase binary once, then runs it:

```bash
npm run pb:setup   # downloads ./bin/pocketbase
npm run pb         # serves the API + hooks on :8090
```

Frontend, in a second terminal (Vite proxies `/api` and `/_` to PocketBase,
so the app runs same-origin at :5173):

```bash
npm run dev
```

Open `http://localhost:5173` and register — the first account becomes the
owner of any trip it creates (`pb_hooks/membership.pb.js`). Copy
[`.env.example`](.env.example) to `.env` for routing/geocoding keys and to
override the public tile/Photon/Overpass defaults; it's read by `npm run pb`
and gitignored.

### Scripts

| Command                           | Does                                                             |
| --------------------------------- | ---------------------------------------------------------------- |
| `npm run dev`                     | Vite dev server                                                  |
| `npm run pb`                      | PocketBase (API, hooks, migrations)                              |
| `npm run pb:setup`                | Fetch the PocketBase binary into `./bin`                         |
| `npm run check`                   | `tsc --noEmit` + `eslint .` + `vitest run` — the pre-commit gate |
| `npm run format` / `format:check` | Prettier (not part of `check`)                                   |
| `npm run types:pb`                | Regenerate `src/types/pb.ts` after a schema migration            |
| `npm run build`                   | Typecheck + production Vite build                                |
| `npm run sprites`                 | Rebuild the taxonomy icon sprite                                 |

Run `npm run check` **and** `npm run format:check` before every commit —
this is enforced by convention, not a git hook.

### Project docs

- [`BUILD.md`](BUILD.md) — the full product/data-model specification.
- [`WORK.md`](WORK.md) — the ordered build log: what's done, what's next,
  spec deviations, and environment gotchas paid for once already.
- [`CLAUDE.md`](CLAUDE.md) — working conventions for anyone (human or AI)
  changing this code.
- `ToDo.md` — informal design notes that haven't graduated to a `WORK.md`
  task yet.
- `.claude/skills/` — repo-specific automation (start the dev servers,
  drive the app headlessly for a smoke check, reload after a config change).

## AI-assisted development

Most of this codebase is written by an AI coding agent (Claude Code), one
`WORK.md` task at a time, under the author's direction and review — not
autonomously. That's a deliberate choice, and it's worth being explicit
about both what keeps it honest and what to double-check, especially if
you're reading a diff or a commit you didn't watch happen.

Worth noting up front, since it's easy to assume otherwise: **the running
app itself makes zero LLM calls** (`CLAUDE.md` rule 1, absolute — no
`classify` endpoint, no Anthropic key in the container). Classification and
itinerary drafting happen in the user's own chat window and get imported as
JSON. The AI involvement is entirely in how the code gets _written_, not in
anything the app does at runtime.

**What already guards against the obvious failure modes:**

- `CLAUDE.md`'s rules are non-negotiable by instruction, not just convention
  — dates derived not stored, the cascade engine pure, Zod at every external
  boundary, the taxonomy enum closed.
- `WORK.md` enforces one task at a time, commit per task, and "if the spec
  is ambiguous, say so and propose a resolution — don't silently pick an
  interpretation." A pile of unrelated changes in one commit is itself a
  signal something didn't follow that.
- `npm run check` (tsc + eslint + vitest) is required before every commit.
  A change that skips it, or that adjusts a test to make broken code pass
  rather than fixing the code, is worth a second look.
- `WORK.md`'s **Noticed**, **Pending / not done**, and **Spec deviations
  recorded** sections exist so nothing gets silently redefined or deferred
  — a real gap or a deliberate divergence from `BUILD.md` gets written down
  in the open, not buried.

**The specific failure mode to watch for**, because it already happened
once in this repo: an agent session runs inside one sandboxed environment
and can mistake _that machine's current state_ for a general fact, then
write it into a committed doc or script with total confidence. Concretely —
an earlier session hit a broken headless Chromium (a missing system
library) and, rather than diagnosing it, hardcoded "Chromium doesn't work
here, use Firefox instead" into the test driver and its docs, and separately
hardcoded `nvm use 20` into every skill on the assumption that one sandbox's
node setup was universal. Both read as confident, specific, plausible prose.
Neither was true on a different machine — the Node one failed outright (v20
was never installed there), and the Chromium one was solved for the wrong
layer (routing around a missing library instead of naming it so a human
could `apt-get install` it once). See `WORK.md`'s Phase 12 entries and the
git log around them for exactly how that surfaced and got fixed.

**What to check in an AI-authored change:**

- Absolute claims about _this machine_ — a pinned version number, a path,
  "the default is X" — dressed up as a general fact. These should be
  capability checks or fallbacks (`nvm use --lts`, not `nvm use 20`), not a
  snapshot of one sandbox.
- Whether something was actually run and observed, versus described as
  what "should" happen. This repo's convention is to show the evidence —
  screenshots, a driver script's pass/fail output, `npm run check` output —
  not just assert a result.
- Whether a fix addresses the root cause or quietly swaps out a tool/
  dependency to route around a symptom (the Chromium→Firefox swap above is
  the canonical example — it worked, and it was still the wrong fix).
- Scope: does the diff match the stated task? `CLAUDE.md` asks for exactly
  the task in `WORK.md`, then a stop — a surprisingly large diff for a
  small stated task is worth reading closely.
- Whether a test or fixture was loosened to make it pass, rather than the
  underlying code being fixed.

None of this means treat AI-authored commits with more suspicion than
human ones — it means the same review habits apply, aimed at the specific
place this kind of tool tends to go wrong: mistaking a local, temporary fact
for a portable, general one.
