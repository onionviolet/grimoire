---
phase: 06-community-tools-land-inside-grimoire
plan: 04
subsystem: browser
tags: [reachability, catalog, vitest, docs]

# Dependency graph
requires:
  - "06-01: src/lib/browserCatalog.ts (frozen, kind-typed browser destination catalog)"
provides:
  - "docs/browser-destinations.md: dated, per-entry reachability record and re-runnable probe command"
  - "src/lib/browserCatalog.reachability.test.ts: opt-in (GRIMOIRE_CHECK_DESTINATIONS) probe importing BROWSER_DESTINATIONS directly"
  - "src/lib/browserCatalog.ts: Deadlock Wiki entry corrected from the squatted deadlocked.wiki to the real deadlock.wiki"
affects: []

# Actuals (#2632)
actuals:
  tokens: 4092
  tasks: 3
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Streaming fetch + bounded-byte-budget title extraction (TextDecoder over a ReadableStream reader) instead of downloading a full response body just to find a <title> tag"
    - "describe.skipIf gate on an env var for an opt-in, network-touching test suite that must never run in CI or the default pnpm test invocation"

key-files:
  created:
    - src/lib/browserCatalog.reachability.test.ts
    - docs/browser-destinations.md
  modified:
    - src/lib/browserCatalog.ts
    - src/lib/browserCatalog.test.ts

key-decisions:
  - "Deadlock Wiki corrected from https://deadlocked.wiki/ to https://deadlock.wiki/: deadlocked.wiki resolves through a JS-redirect 'Loading...' challenge shell to a redirect landing on TikTok (a squatted/hijacked domain), while deadlock.wiki is the real, actively maintained MediaWiki ('The Deadlock Wiki', 1,363 articles, content updated within the last week, Discord link). Confirmed by a human real-browser check after the automated probe flagged the disagreement as needing a human call."
  - "All 9 other catalog entries kept as-is: status 200, host unchanged, title plausibly matching the label on every probe."
  - "No crosshair-generator entry added (D-06 reconfirmed as intended state, not an oversight)."
  - "Goonlock's nsfw:true / kind:'community-feed' shape is unchanged."

requirements-completed: [REQ-browser-tool-catalog]

coverage:
  - id: D1
    description: "Every catalog destination probed once, with HTTP status, final resolved URL, page title, and a host-changed flag recorded in docs/browser-destinations.md alongside a keep/correct/remove/needs-a-human-call verdict"
    requirement: "REQ-browser-tool-catalog"
    verification:
      - kind: unit
        ref: "src/lib/browserCatalog.reachability.test.ts (opt-in, GRIMOIRE_CHECK_DESTINATIONS=1, run 4 times against the deadlocked.wiki/deadlock.wiki pair to resolve an inconsistent first result)"
        status: pass
      - kind: manual
        ref: "docs/browser-destinations.md, human real-browser corroboration of the deadlock.wiki correction"
        status: pass
    human_judgment: true
  - id: D2
    description: "The deadlocked.wiki vs deadlock.wiki check REQ-browser-tool-catalog explicitly names, with both results recorded rather than one asserted"
    requirement: "REQ-browser-tool-catalog"
    verification:
      - kind: unit
        ref: "src/lib/browserCatalog.reachability.test.ts's dedicated probe pair, docs/browser-destinations.md's 'deadlocked.wiki against deadlock.wiki' section"
        status: pass
    human_judgment: false
  - id: D3
    description: "Catalog corrected on the evidence: Deadlock Wiki entry repointed to the real wiki host, every other entry kept, no crosshair-generator entry added, Goonlock's nsfw/kind unchanged, HOME_DESTINATION_URL still resolves"
    requirement: "REQ-browser-tool-catalog"
    verification:
      - kind: unit
        ref: "src/lib/browserCatalog.test.ts (13 tests, including a new destinationForUrl(HOME_DESTINATION_URL) non-null assertion)"
        status: pass
      - kind: unit
        ref: "pnpm typecheck / pnpm lint / pnpm encoding:check / full pnpm exec vitest run (157 files, 1747 tests, 1 file skipped by design)"
        status: pass
    human_judgment: false

duration: ~35min
completed: 2026-08-07
status: complete
---

# Phase 06 Plan 04: Browser Destination Catalog Reachability Review Summary

**Every one of the 10 `BROWSER_DESTINATIONS` entries was loaded once, what came back was recorded in `docs/browser-destinations.md` with a proposed verdict, a human resolved the one entry the probe alone could not settle (Deadlock Wiki: the catalog's `deadlocked.wiki` turned out to be a squatted domain redirecting to TikTok, corrected to the real `deadlock.wiki`), and the whole check is re-runnable via an opt-in vitest suite that imports the live catalog rather than keeping its own URL list.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-08-07
- **Tasks:** 3 (Task 1 probe + record, Task 2 checkpoint:decision, Task 3 apply verdicts)
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

- `src/lib/browserCatalog.reachability.test.ts`: an opt-in (`GRIMOIRE_CHECK_DESTINATIONS`) reachability suite, skipped by default so the ordinary `pnpm test` run and CI never depend on nine third-party sites being up. Imports `BROWSER_DESTINATIONS` directly (no duplicated URL list; the file's own `https://` literal count is 2, both for the dedicated `deadlocked.wiki`/`deadlock.wiki` comparison pair). Streams each response through a bounded 8 KB byte budget to extract a `<title>` without downloading a full page body, records HTTP status / final URL / title / host-changed per entry, and prints a markdown-table-shaped row per probe so results transcribe straight into the doc.
- `docs/browser-destinations.md`: the dated, per-entry reachability record REQ-browser-tool-catalog and ROADMAP phase 6 success criterion 1 ask for. Ten-row table (Label, Declared kind, Requested URL, Status, Final URL, Page title, Host changed, Verdict), a dedicated section quoting both `deadlocked.wiki` and `deadlock.wiki` probe results, the D-06 no-crosshair-generator confirmation, and an Applied section recording the accepted verdicts and date.
- `src/lib/browserCatalog.ts`: the `Deadlock Wiki` entry's `url` corrected from `https://deadlocked.wiki/` to `https://deadlock.wiki/`. Every other field (`label`, `kind`, declaration order) is unchanged, and every other entry in the array is byte-for-byte unchanged.
- `src/lib/browserCatalog.test.ts`: added an explicit `destinationForUrl(HOME_DESTINATION_URL)` non-null assertion (13 tests total, up from 12), so a future removal touching the home entry fails loudly instead of silently orphaning `HOME_DESTINATION_URL`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Probe every destination once and record what came back** - `7ab1470` (feat)
2. **Task 2: Approve the keep, correct, and remove verdicts** - checkpoint:decision, no code; resolved by the coordinator's `accept-with-changes` decision (see Deviations/Decision below)
3. **Task 3: Apply the approved verdicts to the catalog** - `aad63d5` (fix)

**Plan metadata:** committed alongside this SUMMARY (worktree mode; STATE.md/ROADMAP.md excluded, owned centrally by the orchestrator).

## Files Created/Modified

- `src/lib/browserCatalog.reachability.test.ts` - Opt-in reachability probe: `firstBytes` (bounded stream read), `extractTitle`, `probe`, `printRow`, one `it()` per catalog entry plus a dedicated `deadlocked.wiki`/`deadlock.wiki` pair
- `docs/browser-destinations.md` - Dated reachability table, deadlocked.wiki/deadlock.wiki comparison, D-06 confirmation, Applied section
- `src/lib/browserCatalog.ts` - `Deadlock Wiki` entry's `url` corrected to `https://deadlock.wiki/`
- `src/lib/browserCatalog.test.ts` - Added `HOME_DESTINATION_URL` resolution assertion

## Decisions Made

- **Task 2 checkpoint resolution (coordinator, `accept-with-changes`):** all 9 mechanically-proposed `keep` verdicts accepted as written. The Deadlock Wiki entry (flagged `needs a human call` because the automated probe got inconsistent results: a `Loading...` JS-redirect challenge shell on 3 of 4 runs, an HTTP 410 to a parking-network-shaped host on the 4th) was resolved as **correct to `https://deadlock.wiki/`**. Corroborating evidence supplied by the coordinator: a real-browser check (not fetch/curl, which both probes here found unreliable against `deadlocked.wiki`'s bot-challenge behavior) confirmed `deadlock.wiki` is the real, active community wiki (1,363 articles, hero pages, content updated within the last week, Discord link), while `deadlocked.wiki`'s challenge shell redirects to TikTok, i.e. it is a squatted/hijacked domain.
- The reachability probe's title extraction is bounded to 8 KB by design (streamed, not `response.text()`), so a slow or huge page never costs more than a small bounded read. This means GameBanana's title (which sits at roughly byte 27,000) is honestly recorded as "not captured" by the automated probe; a separate unbounded fetch during this review confirmed the real title and that it matches the label, so this is a probe-budget artifact documented in `docs/browser-destinations.md`, not a content problem.
- Reddit serves a generic "Reddit" title (not the subreddit's own title) to a bare `fetch` without a browser-like session. This is expected Reddit behavior, not a sign the r/DeadlockTheGame entry is wrong; the final URL still resolves to the exact subreddit path.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - CLAUDE.md convention] Em-dash in `docs/browser-destinations.md` draft**
- **Found during:** Task 1, while drafting the deadlocked.wiki/deadlock.wiki comparison section
- **Issue:** One sentence used an em-dash ("... a parking-network-shaped host — a numbered `ww`-subdomain ..."), which CLAUDE.md's house style forbids everywhere, including docs.
- **Fix:** Reworded to parentheses instead of an em-dash.
- **Files modified:** `docs/browser-destinations.md`
- **Verification:** `pnpm encoding:check` and a targeted grep for the em-dash character confirmed none remain in either new file.
- **Committed in:** `7ab1470` (Task 1 commit; caught and fixed before that commit was made)

None beyond this: plan executed as written otherwise, including the Task 2 checkpoint stop/resume exactly as the plan's `autonomous: false` framing anticipated.

**Total deviations:** 1 auto-fixed (Rule 2 - house style)
**Impact on plan:** No scope creep.

## Issues Encountered

None. The reachability probe's inconsistent results against `deadlocked.wiki` were the expected kind of ambiguity the plan's Task 2 checkpoint exists to route to a human, not an execution problem.

## User Setup Required

None. `GRIMOIRE_CHECK_DESTINATIONS` is an opt-in developer/reviewer env var for re-running the probe later; it is never set in CI or a packaged build.

## Next Phase Readiness

- `docs/browser-destinations.md` gives ROADMAP phase 6 success criterion 1 its dated evidence, and the same check (`GRIMOIRE_CHECK_DESTINATIONS=1 pnpm exec vitest run src/lib/browserCatalog.reachability.test.ts`) can be re-run against the live catalog whenever someone wants to know whether it has rotted again.
- `BROWSER_DESTINATIONS` (consumed by 06-01 through 06-03) is unchanged in shape; only the Deadlock Wiki entry's `url` field changed. No downstream plan needs any code adjustment for this.

---
*Phase: 06-community-tools-land-inside-grimoire*
*Completed: 2026-08-07*

## Self-Check: PASSED

- FOUND: `src/lib/browserCatalog.reachability.test.ts`
- FOUND: `docs/browser-destinations.md`
- FOUND: commit `7ab1470`
- FOUND: commit `aad63d5`
