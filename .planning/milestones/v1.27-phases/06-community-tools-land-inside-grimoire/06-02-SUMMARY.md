---
phase: 06-community-tools-land-inside-grimoire
plan: 02
subsystem: browser
tags: [electron, will-download, downloaditem, ipc, vpk, react, i18n, toast]

# Dependency graph
requires:
  - phase: 06-community-tools-land-inside-grimoire (plan 01)
    provides: "browserDownloadCapture.ts's will-download capture, checkVpkFile identity gate, useConfirm disclosure, ipc/browser.ts's browser:set-active-destination / browser:resolve-tool-download surface"
provides:
  - "electron/main/services/browserDownloadCapture.ts: failed status for a non-completed DownloadItem, replacePending() single-pending-download enforcement, started status pushed synchronously at will-download time, pendingToolDownloadIds() introspection"
  - "electron/main/ipc/browser.ts: resolvePendingToolDownload(id, accepted, deps) with install/deleteTempFile injected as dependencies, unit-tested confused-deputy contract"
  - "src/pages/Browser.tsx: danger-tone refusal banner (D-10), in-flight downloading toast, replaced toast with stale-id no-op handling for an already-open confirm"
  - "setActiveDestination/setActiveBrowserDestination widened to (kind, origin, label) end to end (main service, ipc, preload, types, renderer wrapper, all call sites)"
  - "src/stores/toastStore.ts: dismissToast imperative helper (mirrors showToast)"
affects: [06-03, 06-04]

# Actuals (#2632)
actuals:
  tokens: 12150
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Tool label captured synchronously at will-download time (not read lazily from state.activeDestination later), since the guest can navigate away while a download is still writing"
    - "Single-pending-download invariant enforced by replacePending() looping over and evicting every existing entry (at most one) before inserting the new one, so takePendingToolDownload's absent-id result covers both 'never issued' and 'superseded' without needing to distinguish them"
    - "Renderer-side stale-id tracking (a Set of ids evicted by 'replaced') as a no-op guard on an already-open confirm dialog's eventual answer, since useConfirm exposes no external close/cancel primitive"

key-files:
  created:
    - electron/main/ipc/browser.test.ts
  modified:
    - electron/main/services/browserDownloadCapture.ts
    - electron/main/services/browserDownloadCapture.test.ts
    - electron/main/ipc/browser.ts
    - electron/preload/index.ts
    - src/lib/browserToolDownload.ts
    - src/pages/Browser.tsx
    - src/stores/toastStore.ts
    - src/types/electron.ts
    - src/locales/en/translation.json
    - src/locales/manifest.json

key-decisions:
  - "item.once('done', ...) made an async callback that awaits deleteTempFileQuietly/replacePending directly (dropping the earlier fire-and-forget `void deleteTempFileQuietly(...)`), so tests can await the full completion chain deterministically. Electron does not care whether a 'done' listener returns a promise; behavior toward Chromium is unchanged."
  - "tool label for started/replaced is captured once, synchronously, at will-download time via toolLabelFor(state.activeDestination, liveGuestUrl(webContents)) rather than read lazily inside the async 'done' callback, since the guest can navigate (and revoke the active destination) while the download is still writing."
  - "resolvePendingToolDownload only injects install and deleteTempFile as dependencies (matching the plan's literal instruction), not takePendingToolDownload or getActiveDeadlockPath; browser.test.ts seeds the real shared pending map via the exported replacePending() so the confused-deputy contract (double-resolve, never-issued, superseded-by-replacement) is proven against the actual module state, not a parallel fake."
  - "Added an imperative dismissToast() helper to toastStore.ts (mirroring the existing showToast() helper) because the plan's action text requires dismissing the in-flight toast via dismissToast from a non-component call site, and no such export existed yet. Not in the plan's declared <files> list for either task; treated as Rule 2 (auto-add missing critical functionality) since the described behavior is inoperable without it."

patterns-established:
  - "Pattern: a confirm() dialog that cannot be force-closed from outside useConfirm is handled by marking its id 'stale' in a ref-held Set; the eventual answer becomes a no-op read-and-discard rather than an IPC call, instead of trying to reach into ConfirmProvider's internal state."

requirements-completed: [REQ-browser-produced-file-handoff]

coverage:
  - id: D1
    description: "A refusal (ZIP/7z/RAR/empty/unrecognized) is refused before any confirm-map entry exists, deletes the temp file, and the pushed reason equals describeVpkRejection() verbatim (no rewrap/truncation); the danger-tone refusal banner renders below the existing failure paragraph with no truncate/line-clamp/nowrap classes and clears on nav"
    requirement: "REQ-browser-produced-file-handoff"
    verification:
      - kind: unit
        ref: "electron/main/services/browserDownloadCapture.test.ts > 'will-download tool capture: refusal and failure paths (D-10)' (5 tests)"
        status: pass
      - kind: other
        ref: "grep -n \"state-danger\" src/pages/Browser.tsx — single match, banner block only, no truncate/line-clamp/whitespace-nowrap"
        status: pass
    human_judgment: false
  - id: D2
    description: "A DownloadItem that finishes in any non-'completed' state deletes its temp file, pushes 'failed', and never shows a confirm dialog (no 'ready'/'refused' for the same download)"
    requirement: "REQ-browser-produced-file-handoff"
    verification:
      - kind: unit
        ref: "electron/main/services/browserDownloadCapture.test.ts > 'a non-completed terminal state deletes the temp file, pushes failed, and never shows a confirm dialog'"
        status: pass
    human_judgment: false
  - id: D3
    description: "Only one pending tool-download disclosure exists at a time: a second capture evicts the first (its temp file deleted, 'replaced' pushed naming the tool), and a resolve arriving later for the evicted id returns { ok:false, stale:true } with no import"
    requirement: "REQ-browser-produced-file-handoff"
    verification:
      - kind: unit
        ref: "electron/main/services/browserDownloadCapture.test.ts > 'replace-newest: only one pending tool download disclosure at a time' + 'pushes started as the last statement of the tool branch, before any file classification runs'"
        status: pass
      - kind: unit
        ref: "electron/main/ipc/browser.test.ts > 'resolving a pending id superseded by replacePending returns stale and imports nothing'"
        status: pass
    human_judgment: false
  - id: D4
    description: "resolvePendingToolDownload(id, accepted, deps)'s full confused-deputy contract: never-issued id, decline, accept (install called exactly once with the recorded vpkPath/name), double-resolve (stale the second time, imports exactly once total), install throw surfaced as { ok:false, error }, and no-Deadlock-path short circuit — every path deletes the temp file exactly once via the injected deleteTempFile"
    requirement: "REQ-browser-produced-file-handoff"
    verification:
      - kind: unit
        ref: "electron/main/ipc/browser.test.ts > 'resolvePendingToolDownload' describe block (7 tests) + IPC registration tests (2 tests)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Renderer handling of 'started' (in-flight 'Downloading from {{tool}}...' toast, dismissed the moment a terminal status arrives) and 'replaced' (info toast naming the new tool; the superseded id is marked stale so an already-open confirm's eventual answer is a no-op instead of a second resolveToolDownload call) — the click-to-dialog interval is visibly never silent"
    verification: []
    human_judgment: true
    rationale: "This is renderer visual/timing behavior (toast appearance/dismissal timing, confirm-dialog staleness on screen). This repo has no DOM/render-test infrastructure (Vitest runs in a node environment; see CLAUDE.md's 'no render coverage anywhere'), so it cannot be proven by an automated test here. UI-SPEC.md explicitly flags both the in-flight toast and the zero-one-many replacement row as 🧪 backstop, needing an execution-time check rather than a unit test. Verified by full read-through of the effect's logic and by the unit-tested backend contract (D3/D4) that the toast copy/behavior is wired to; a human should confirm the actual toast/dialog behavior against a live GRIMOIRE_DEV_SLOT build."

duration: ~55min
completed: 2026-08-07
status: complete
---

# Phase 06 Plan 02: Tool-Download Refusal, Replace-Newest, and In-Flight Feedback Summary

**D-10's refusal banner, a replace-newest single-pending-download policy with a unit-proven confused-deputy contract, and never-silent started/replaced toasts, completing the tool-download contract plan 06-01's tracer left open.**

## Performance

- **Duration:** ~55 min
- **Completed:** 2026-08-07T18:28:00Z
- **Tasks:** 2 (both complete and verified)
- **Files modified:** 11 (10 modified, 1 created)

## Accomplishments

- **Task 1 (D-10, refusal):** `browserDownloadCapture.ts`'s `item.once('done', ...)` now handles every terminal `DownloadState`: a classification failure deletes the temp file and pushes `refused` with `describeVpkRejection()`'s exact sentence *before* any pending-map entry could exist, and a non-`'completed'` state (cancelled/interrupted) deletes the temp file and pushes `failed` (previously silent). `Browser.tsx` renders a danger-tone refusal banner (`border-state-danger/40 bg-state-danger/10 text-state-danger`) directly below the existing `failure` paragraph, as a plain wrapping paragraph with no truncation, clearing on every nav event so a stale refusal never follows the user to another page.
- **Task 2 (replace-newest, never-silent):** `replacePending()` enforces the single-pending-download invariant: before a newly classified download becomes pending, it evicts whatever was pending (deleting its temp file, pushing `replaced` naming the tool that superseded it). `will-download` now pushes `started` as the last statement of the tool branch (after `setSavePath` and completion-listener registration), so `Browser.tsx` can show an in-flight `Downloading from {{tool}}...` toast the instant a capture begins. `setActiveDestination`/`setActiveBrowserDestination` widened to `(kind, origin, label)` end to end (service, IPC, preload, types, renderer wrapper, every call site) so `started`/`replaced` can name their source without a second catalog lookup in the main process.
- **`electron/main/ipc/browser.ts`'s resolve handler** extracted into an exported, independently-testable `resolvePendingToolDownload(id, accepted, deps)` with the install call and temp-file delete injected; `ipcMain.handle` is now a thin wrapper. New `electron/main/ipc/browser.test.ts` (9 tests) proves the full confused-deputy contract by seeding the real shared pending map (via the exported `replacePending`), not a parallel fake.
- Every `BrowserToolDownloadStatus` member (`started`/`ready`/`refused`/`failed`/`replaced`) is both emitted in `browserDownloadCapture.ts` and handled in `Browser.tsx`'s `onBrowserToolDownload` effect.

## Task Commits

Each task was committed atomically:

1. **Task 1: Refuse a non-VPK visibly, before any confirm** - `87131e3` (feat)
2. **Task 2: One pending download at a time, never a silent interval** - `2dc31d0` (feat)

**Plan metadata:** committed alongside this SUMMARY (worktree mode; STATE.md/ROADMAP.md excluded, owned centrally by the orchestrator).

## Files Created/Modified

- `electron/main/services/browserDownloadCapture.ts` - `failed` status push, `replacePending()`, `toolLabelFor()`, `pendingToolDownloadIds()`, `started` push, `setActiveDestination` widened with `label`
- `electron/main/services/browserDownloadCapture.test.ts` - 8 new tests: refusal/failure round trip via a stubbed `DownloadItem`/`will-download` listener, `started`-before-classification ordering, replace-newest eviction
- `electron/main/ipc/browser.ts` - `resolvePendingToolDownload(id, accepted, deps)` exported with injected `install`/`deleteTempFile`; `browser:set-active-destination` reads the third `label` arg
- `electron/main/ipc/browser.test.ts` - new file, 9 tests covering the full resolve contract plus IPC registration
- `electron/preload/index.ts` - `setActiveBrowserDestination` sends the third `label` arg
- `src/lib/browserToolDownload.ts` - `setActiveBrowserDestination` wrapper widened
- `src/pages/Browser.tsx` - refusal banner, `refusal` state, `downloadingToastIdRef`/`staleDownloadIdsRef`, `started`/`replaced` handling, all `setActiveBrowserDestination` call sites widened
- `src/stores/toastStore.ts` - `dismissToast()` imperative helper (mirrors `showToast()`)
- `src/types/electron.ts` - `setActiveBrowserDestination` signature widened; `BrowserToolDownloadEvent`/`BrowserToolDownloadStatus` doc comments updated to reflect full emit/handle coverage
- `src/locales/en/translation.json` / `src/locales/manifest.json` - `browser.toolDownload.interrupted`, `.downloading`, `.replaced`

## Decisions Made

- `item.once('done', ...)` is now an `async` callback that `await`s `deleteTempFileQuietly`/`replacePending` directly instead of firing them with `void`, so the file-deletion/eviction/push sequence is deterministic and testable end to end. Electron does not require (or inspect) the listener's return value, so this is behavior-neutral toward the real DownloadItem lifecycle.
- Tool labels for `started`/`replaced` are captured synchronously at `will-download` time (`toolLabelFor(state.activeDestination, liveGuestUrl(webContents))`), not read lazily out of `state.activeDestination` inside the async `done` callback, because the guest can navigate away (revoking the active destination) while the download is still writing.
- `resolvePendingToolDownload` injects only `install`/`deleteTempFile` as dependencies (matching the plan's literal text), not `takePendingToolDownload`/`getActiveDeadlockPath`. `browser.test.ts` seeds the real shared pending map via the exported `replacePending()`, so the double-resolve/never-issued/superseded-by-replacement tests exercise the actual module state rather than a second, parallel fake map.
- Added `dismissToast()` to `src/stores/toastStore.ts` (see Deviations below).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added `dismissToast()` imperative helper to `toastStore.ts`**
- **Found during:** Task 2, implementing the `started`→`ready`/`refused`/`failed` toast-dismissal handling in `Browser.tsx`
- **Issue:** The plan's action text requires "hold the returned toast id in a ref so it can be dismissed via `dismissToast` the moment `ready`, `refused` or `failed` arrives for that download." `toastStore.ts` exported an imperative `showToast()` helper for non-component call sites but no equivalent `dismissToast()` — only the in-store `dismissToast` method existed, unreachable outside a component via `useToastStore`. Without this export the described behavior is literally not implementable from `Browser.tsx`'s effect.
- **Fix:** Added `export function dismissToast(id: number): void { useToastStore.getState().dismissToast(id); }`, mirroring `showToast()`'s existing pattern exactly.
- **Files modified:** `src/stores/toastStore.ts` (not in either task's declared `<files>` list)
- **Verification:** `pnpm typecheck` and `pnpm lint` pass; `Browser.tsx`'s `started`/`ready`/`refused`/`failed`/`replaced` branches all compile and call it correctly.
- **Committed in:** `2dc31d0` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 - missing critical functionality)
**Impact on plan:** Minimal, single-function addition mirroring an existing pattern in a file the plan didn't anticipate needing to touch. No scope creep — required for the plan's own explicitly stated behavior to compile and function.

## Issues Encountered

None beyond the deviation above. Task 1's synchronously-pushed `started` event (added in Task 2) required updating Task 1's own refusal/failure tests to filter it out of their terminal-event assertions — not a defect, just Task 2 changing what Task 1's tests observe; fixed inline as part of Task 2's own commit.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The tool-download contract is now complete and unit-tested: refusal, single-pending enforcement, and the full started/ready/refused/failed/replaced status lifecycle are all emitted and handled, with a proven confused-deputy contract on the resolve path.
- **Carried forward from plan 06-01, still open:** live confirmation against the real Pimp My Hideout tool (D3 in 06-01's SUMMARY) remains deferred to human/UAT verification — this plan did not attempt to close that out, since it was scoped to the refusal/replacement/feedback contract around the tracer, not the tracer's own live-tool checkpoint.
- **New, plan-06-02-specific item for a human to close out:** D5 above (the `started`/`replaced` toast timing and the stale-confirm no-op behavior) is implementation-complete and backend-proven by unit tests, but the actual on-screen toast appearance/dismissal timing and the "answer a stale dialog does nothing" behavior have not been driven against a live `GRIMOIRE_DEV_SLOT` build. Steps: `GRIMOIRE_DEV_SLOT=3 GRIMOIRE_DEV_NO_BACKGROUNDING=1 pnpm dev`, `GRIMOIRE_DEV_SLOT=3 node scripts/dev-driver.mjs route browser`, click `Pimp My Hideout`, click `Build VPK` twice in quick succession before answering the first disclosure, and confirm: (a) a `Downloading from Pimp My Hideout...` toast appears and disappears, (b) a `Replaced with a newer download from Pimp My Hideout.` toast appears on the second click, and (c) answering the now-stale first dialog (if still visibly open) does not install anything.
- Plans 06-03/06-04 can build on this without re-deriving the tool-download mechanism; the full `BrowserToolDownloadStatus` union is stable and every member is both emitted and handled.

---
*Phase: 06-community-tools-land-inside-grimoire*
*Completed: 2026-08-07*

## Self-Check: PASSED

- FOUND: `electron/main/ipc/browser.test.ts`
- FOUND: `electron/main/ipc/browser.ts`
- FOUND: `electron/main/services/browserDownloadCapture.ts`
- FOUND: `electron/main/services/browserDownloadCapture.test.ts`
- FOUND: `src/pages/Browser.tsx`
- FOUND: `src/stores/toastStore.ts`
- FOUND: commit `87131e3`
- FOUND: commit `2dc31d0`
