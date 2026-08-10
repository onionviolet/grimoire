---
phase: 06-community-tools-land-inside-grimoire
plan: 06
subsystem: ui
tags: [electron, react, zustand, react-router, vitest, browser-webview, download-capture]

# Dependency graph
requires:
  - phase: 06-community-tools-land-inside-grimoire
    provides: "06-01's will-download capture round trip (browserDownloadCapture.ts, onBrowserToolDownload, resolveToolDownload) and the page-scoped disclosure subscriber this plan relocates"
  - phase: 06-community-tools-land-inside-grimoire
    provides: "06-02's confirm/toast primitives (useConfirm, toastStore) reused unchanged by the app-scoped subscriber"
  - phase: 06-community-tools-land-inside-grimoire
    provides: "06-05's browser destination catalog, unmodified by this plan"
provides:
  - "App-scoped tool-download disclosure subscriber (useBrowserToolDownloadHandoff) called once from Layout.tsx, surviving navigation away from /browser"
  - "browserToolDownloadStore.ts: the refusal-banner seam between the app-scoped subscriber and the Browser page"
  - "sweepToolDownloadTempRoot / pendingToolDownloadPaths: startup sweep for the browser-downloads temp directory, wired into app.whenReady()"
  - "docs/browser-scope-boundary.md updated to state the disclosure's real lifetime and the temp directory's retention/safety rules"
affects: [browser-scope-boundary, gap-closure, phase-06-verification]

# Actuals (#2632)
actuals:
  tokens: 12849
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "App-scoped IPC subscriber called from Layout.tsx's component body, ahead of the loading early return, mirroring onOneClickInstall/onMultiVpkPick"
    - "Live-route-via-ref pattern: useLocation() feeds a ref rather than an effect dependency, so a route change never tears down and re-establishes a subscription"
    - "Small fork-only zustand store with no persistence as a seam between an app-scoped subscriber and a page-scoped render surface"
    - "Startup sweep pattern (mirrors sweepHeroPoseCache/runPoseCacheSweep): stated retention + safety rule, never throws, called once inside app.whenReady()"

key-files:
  created:
    - src/lib/useBrowserToolDownloadHandoff.tsx
    - src/lib/useBrowserToolDownloadHandoff.test.tsx
    - src/stores/browserToolDownloadStore.ts
  modified:
    - src/components/Layout.tsx
    - src/pages/Browser.tsx
    - electron/main/services/browserDownloadCapture.ts
    - electron/main/services/browserDownloadCapture.test.ts
    - electron/main/index.ts
    - docs/browser-scope-boundary.md

key-decisions:
  - "Moved the subscriber (app-scoped) rather than building a main-process replay/reconciliation of a still-pending disclosure; the only uncovered window (no renderer document at all) is closed by the startup sweep instead, since the pending map is in-memory-only and has nothing to replay after a restart by construction"
  - "Off-/browser refusal routes to an error toast rather than a third app-level banner beside AppUpdateBanner/VpkImpostorBanner, on the reading that D-10 ('a refusal is loud and visible, never a silent drop') is the governing intent and a banner on a page nobody is looking at is a silent drop"
  - "Sweep has no age threshold or size cap: the sweep runs from app.whenReady before any window loads a renderer, so no capture can be in flight, making every file present at process start provably orphaned"

patterns-established:
  - "Route-scoped UI state that must survive navigation gets read via a ref inside an app-scoped effect, never via a per-route effect's dependency array"

requirements-completed:
  - REQ-browser-produced-file-handoff
  - REQ-browser-navigation-gaps

coverage:
  - id: D1
    description: "Tool-download disclosure subscriber moved to Layout.tsx (app scoped); survives navigation away from /browser (CR-01 fix)"
    requirement: "REQ-browser-produced-file-handoff"
    verification:
      - kind: unit
        ref: "src/lib/useBrowserToolDownloadHandoff.test.tsx#does not resubscribe on a route change away from /browser, and a ready pushed after that navigation still reaches the confirm spy (CR-01)"
        status: pass
      - kind: unit
        ref: "src/lib/useBrowserToolDownloadHandoff.test.tsx (10 tests covering started/ready/refused/failed/replaced, on and off /browser)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Refusal routes to the store banner on /browser, and to an error toast on any other route"
    requirement: "REQ-browser-navigation-gaps"
    verification:
      - kind: unit
        ref: "src/lib/useBrowserToolDownloadHandoff.test.tsx#refused on /browser sets the store refusal and shows no toast"
        status: pass
      - kind: unit
        ref: "src/lib/useBrowserToolDownloadHandoff.test.tsx#refused off /browser leaves the store refusal null and shows exactly one error toast ending with the reason"
        status: pass
    human_judgment: false
  - id: D3
    description: "Startup sweep of the browser-downloads temp directory: deletes orphans, never a pending or protected path, never recurses, never follows a symlink"
    requirement: "REQ-browser-produced-file-handoff"
    verification:
      - kind: unit
        ref: "electron/main/services/browserDownloadCapture.test.ts (describe: sweepToolDownloadTempRoot (WR-05), 8 behavior cases + symlink bonus)"
        status: pass
      - kind: unit
        ref: "electron/main/services/browserDownloadCapture.test.ts#by default the protected set is whatever the live pending map holds"
        status: pass
    human_judgment: false
  - id: D4
    description: "docs/browser-scope-boundary.md updated: disclosure lifetime, retention/safety rule text matching the sweep's own head comment, and the uncovered window named"
    verification:
      - kind: other
        ref: "pnpm encoding:check (no em-dash) plus manual diff review of docs/browser-scope-boundary.md"
        status: pass
    human_judgment: true
    rationale: "Documentation accuracy against a prose specification is a judgment call about whether the wording actually matches the code, not something a test can assert"
  - id: D5
    description: "Guest hardening unchanged (T-06-33): the relocated subscriber introduces no new IPC channel, preload method, or webPreferences change"
    verification:
      - kind: unit
        ref: "electron/main/services/webviewHardening.test.ts, electron/main/services/browserContentFilter.permissionFloor.test.ts (32 tests, unmodified, re-run as wave gate)"
        status: pass
    human_judgment: false

# Metrics
duration: 20min
completed: 2026-08-08
status: complete
---

# Phase 06 Plan 06: App-scoped tool-download disclosure and temp-directory sweep Summary

**Moved the browser tool-download disclosure subscriber from a page-scoped `Browser.tsx` effect to an app-scoped hook called from `Layout.tsx`, added a startup sweep for the browser-downloads temp directory, and brought `docs/browser-scope-boundary.md` back in line with what the code now guarantees.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-08-08T04:29:55Z
- **Tasks:** 3
- **Files modified:** 9 (3 created, 6 modified)

## Accomplishments

- Closed CR-01: a user who clicks Build VPK, wanders to another page, and gets the `ready`/`refused`/`failed`/`replaced` push after leaving `/browser` now still sees the confirm dialog, the refusal (banner on `/browser`, error toast elsewhere), or the failure toast, instead of a silently dropped disclosure and an orphaned temp file.
- Closed WR-05: the browser-downloads temp directory is now swept at `app.whenReady()`, before any window loads a renderer, deleting every orphaned file while never touching a still-pending (unanswered) download.
- `docs/browser-scope-boundary.md` now states the disclosure's real lifetime, the sweep's retention and safety rules (in the same words as the sweep's own head comment, so the two records cannot drift), and names the one deliberately uncovered window (no renderer document attached at all).

## Task Commits

Each task was committed atomically:

1. **Task 1: Make the tool download disclosure app scoped so it survives navigation** - `34faab7` (feat)
2. **Task 2: Sweep the browser-downloads temp root at startup** - `8d421a7` (feat)
3. **Task 3: Make the scope boundary record match what the code now guarantees** - `d50fdfe` (docs)

_No separate plan-metadata commit: this plan runs in worktree/parallel-executor mode, so STATE.md/ROADMAP.md updates are deferred to the orchestrator after the wave merges._

## Files Created/Modified

- `src/stores/browserToolDownloadStore.ts` - New fork-only zustand store (no persistence): `refusal: string | null` + `setRefusal`, plus the imperative `setBrowserToolDownloadRefusal` helper mirroring `toastStore.ts`'s convention.
- `src/lib/useBrowserToolDownloadHandoff.tsx` - New app-scoped subscriber (`.tsx` for the `Tx`-carrying confirm request). Exports `useBrowserToolDownloadHandoff()` and the pure predicate `isBrowserRoute(pathname)`. Reads the live route through a ref (not an effect dependency) so a navigation never tears down and re-establishes the `onBrowserToolDownload` subscription.
- `src/lib/useBrowserToolDownloadHandoff.test.tsx` - New jsdom test: a real `MemoryRouter` navigation proves the CR-01 fix (subscribe count stays 1, a `ready` pushed post-navigation still reaches the confirm spy), plus every status branch (started/ready/refused/failed/replaced), the fallback name, accept/decline resolution, and the stale-id-after-replaced no-op.
- `src/components/Layout.tsx` - Calls `useBrowserToolDownloadHandoff()` once in the component body, after the multi-VPK subscription effect and before the loading early return.
- `src/pages/Browser.tsx` - Removed the page-scoped subscription effect, its refs, local `refusal` state, and the `useConfirm` call site; the danger-tone banner now reads from `useBrowserToolDownloadStore`.
- `electron/main/services/browserDownloadCapture.ts` - New exports `pendingToolDownloadPaths()` and `sweepToolDownloadTempRoot(root, protectedPaths?)`. The sweep reads only direct entries via `readdir` with `withFileTypes`, deletes only `isFile()` entries, never recurses, never throws, and defaults its protected set to the live pending map.
- `electron/main/services/browserDownloadCapture.test.ts` - New `sweepToolDownloadTempRoot (WR-05)` describe block: missing root, empty root, three orphans deleted, double-sweep idempotency, no recursion into a subdirectory, explicit protected path, default wiring via the real will-download harness, a failed unlink not aborting the remaining entries, and a non-Windows symlink guard.
- `electron/main/index.ts` - Imports `sweepToolDownloadTempRoot`/`toolDownloadTempRoot` and calls the sweep inside `app.whenReady()`, directly beneath the existing `sweepHeroPoseCache()` call (8-line diff to this shared file).
- `docs/browser-scope-boundary.md` - Download-manager row reworded to state why "nothing in between to manage" is now true; new "Disclosure lifetime and temp file retention" section naming the subscription location, the retention/safety rule (verbatim-matched to the sweep's head comment), and the uncovered window; Review cadence extended by one sentence.

## Decisions Made

- Took the "move the subscriber" route from `06-VERIFICATION.md`'s two offered options, explicitly declining a main-process replay/reconciliation of a still-pending disclosure. Recorded inline in the plan (`## Decision: move the subscriber, do not build a replay`): the residual window (no renderer document at all) is bounded, provably safe by the time-ordering of `app.whenReady()`, and correctly handled by deletion rather than a cross-session ask about a file the user may no longer connect to anything they did.
- Routed the off-`/browser` refusal to an error toast (not a third app-level banner) — smaller change to a shared file for a transient message, and consistent with D-10's "loud and visible, never silent."
- No age threshold or size cap on the sweep: the ordering guarantee from `app.whenReady()` (sweep runs before any renderer loads, so no capture is ever in flight during a sweep) makes every file present at process start provably orphaned, so a threshold would only delay a safe deletion.

## Deviations from Plan

None - plan executed as written. One judgment call worth naming: the plan's task 1 `<action>` specified the subscription effect's dependency array as `[confirm, t]`; `pnpm lint` flagged a missing-dependency warning on the unrelated nav-sync effect in `Browser.tsx` once `setRefusal` became a zustand action instead of a `useState` setter (zustand actions aren't recognized as stable by `react-hooks/exhaustive-deps`). Added `setRefusal` to that effect's own dependency array (a store action is referentially stable, so this is a no-op change in behavior) rather than suppressing the warning — this is a Rule 1 (bug/lint-correctness) auto-fix, not a deviation from the plan's scoped `[confirm, t]` requirement, which applies to the new hook's subscription effect, not the pre-existing nav-sync effect.

## Issues Encountered

- `Awaited<ReturnType<typeof readdir>>` inferred an ambiguous overload (`Dirent<string>[]` vs `Dirent<NonSharedBuffer>[]`) under this repo's `tsc` version, failing `pnpm typecheck`. Fixed by importing `type Dirent` from `node:fs` directly and passing `{ withFileTypes: true, encoding: 'utf8' }` to `readdir`, pinning the return type unambiguously.
- `vi.fn()` with no type parameter, when the returned mock was called directly by test code (`subscribeSpy(cb)`), produced `TS2348: Value of type 'Mock<Procedure | Constructable>' is not callable` under this repo's vitest v4. Fixed by giving `subscribeSpy` an explicit `vi.fn<(cb: ...) => void>()` signature.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Both `06-VERIFICATION.md` gaps this plan targeted (CR-01, WR-05) are closed with unit coverage; `06-VERIFICATION.md`/`06-REVIEW.md` should be re-run or annotated closed by the phase-level verifier.
- `docs/browser-scope-boundary.md`'s claims now match the code; no further doc drift expected from this plan's surface.
- Out of scope by explicit user decision and untouched: WR-01 (destinationForUrl segment-boundary tie break), WR-02 (empty thumbnailFetchTargets), WR-03 (normalizeUrl bare host:port), WR-04 (browser:resolve-tool-download runtime narrowing). The live Pimp My Hideout end-to-end path remains a `human_verification` / manual UAT row, not automated by this plan.

---
*Phase: 06-community-tools-land-inside-grimoire*
*Completed: 2026-08-08*

## Self-Check: PASSED

- All created/modified files confirmed present on disk (10/10).
- All three task commits confirmed present in `git log` (`34faab7`, `8d421a7`, `d50fdfe`).
