---
phase: 06-community-tools-land-inside-grimoire
plan: 07
subsystem: browser
tags: [electron-ipc, vitest, i18n-reuse, gap-closure, cr-review-fix]

# Dependency graph
requires:
  - phase: 06-01
    provides: the will-download capture tracer slice (allocateToolDownloadTempPath, classifyToolDownload, the pending map)
  - phase: 06-06
    provides: the resolve/refuse IPC round trip (resolvePendingToolDownload, browser:resolve-tool-download) and the app-scoped useBrowserToolDownloadHandoff subscriber
provides:
  - "A captured browser-tool download that the user accepts actually installs: allocateToolDownloadTempPath now names the temp file with a .vpk suffix, which importCustomModSource's file-type check accepts."
  - "A regression test (mods.toolDownloadImportSeam.test.ts) that calls the real allocateToolDownloadTempPath and the real importCustomModSource against each other, closing the gap where only a mock of one side was ever tested."
  - "An accept-time resolve failure now reaches the same refusal surfaces (the /browser danger banner, or an error toast elsewhere) that a main-process refusal already used."
affects: [browser-tool-download-follow-ups, upstream-boundary-map]

actuals:
  tokens: 6114
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Fork-only fix on the naming side of a shared contract, leaving both upstream-boundary files (mods.ts, extract.ts) at zero diff for the whole plan."
    - "Wide mock wall in front of a large ipc module (electron/main/ipc/mods.ts), mocking every relative import except the two files (../services/extract and, necessarily, ../services/vpk) that hold the real identity gate, so the seam test exercises the real gate rather than a mock of it."
    - "route-aware refusal routed through one local helper (routeRefusalSentence) shared by both the 'refused' and accept-time-failure branches of a single subscriber, reading the live route through a ref at call time."

key-files:
  created:
    - electron/main/ipc/mods.toolDownloadImportSeam.test.ts
  modified:
    - electron/main/services/browserDownloadCapture.ts
    - electron/main/services/browserDownloadCapture.test.ts
    - src/lib/useBrowserToolDownloadHandoff.tsx
    - src/lib/useBrowserToolDownloadHandoff.test.tsx

key-decisions:
  - "Fixed the naming side of the capture/install contract (allocateToolDownloadTempPath's suffix), not the gate side (importCustomModSource's file-type check), per the plan's Decision section: lossless because classifyToolDownload already runs the real identity gate before any entry reaches state.pending, and it costs zero diff on the two upstream-boundary files."
  - "Left electron/main/services/vpk.ts unmocked in the new seam test alongside ../services/extract, beyond what the plan's literal mock-wall instruction named. extract.ts's './vpk' import and mods.ts's '../services/vpk' import resolve to the same absolute file, and Vitest mocks are keyed by resolved module id rather than by importer, so mocking vpk.ts from mods.ts's side would have silently replaced checkVpkFile for extract.ts's real identity-gate call too, defeating the test's whole purpose. vpk.ts is electron-free (fs/crypto only, same as extract.ts) so leaving it real costs nothing."

requirements-completed:
  - REQ-browser-produced-file-handoff
  - REQ-browser-navigation-gaps

coverage:
  - id: D1
    description: "A captured tool download the user accepts is copied by the real allocateToolDownloadTempPath + importCustomModSource seam rather than failing on a file-type check"
    requirement: REQ-browser-produced-file-handoff
    verification:
      - kind: unit
        ref: "electron/main/ipc/mods.toolDownloadImportSeam.test.ts#a real VPK at a real-allocator-produced path reaches the slot-allocation sentinel, not the file-type sentence"
        status: pass
      - kind: unit
        ref: "electron/main/ipc/mods.toolDownloadImportSeam.test.ts#negative control: the same bytes at the previously shipped .download suffix are rejected by the file-type check"
        status: pass
      - kind: unit
        ref: "electron/main/ipc/mods.toolDownloadImportSeam.test.ts#identity-gate control: non-VPK bytes at a real-allocator-produced path are still refused, not by the sentinel"
        status: pass
    human_judgment: false
  - id: D2
    description: "allocateToolDownloadTempPath still allocates fresh, collision-free, suggested-filename-independent paths after the suffix change"
    requirement: REQ-browser-produced-file-handoff
    verification:
      - kind: unit
        ref: "electron/main/services/browserDownloadCapture.test.ts#allocateToolDownloadTempPath returns distinct paths for two calls with the same suggested filename"
        status: pass
      - kind: unit
        ref: "electron/main/services/browserDownloadCapture.test.ts#allocateToolDownloadTempPath is independent of the suggested filename: no extension still yields the same shape of path"
        status: pass
    human_judgment: false
  - id: D3
    description: "An accept-time failure surfaces on the /browser danger banner (on route) or an error toast (off route), matching a refusal's existing surfaces; decline, stale, and success stay silent; a rejected resolve is caught rather than becoming an unhandled rejection"
    requirement: REQ-browser-navigation-gaps
    verification:
      - kind: unit
        ref: "src/lib/useBrowserToolDownloadHandoff.test.tsx#an accept-time resolve failure (WR-01) on /browser sets the store refusal to the prefix plus the error text, and shows no toast"
        status: pass
      - kind: unit
        ref: "src/lib/useBrowserToolDownloadHandoff.test.tsx#an accept-time resolve failure (WR-01) off /browser shows exactly one error toast ending with the error text, and leaves the store refusal null"
        status: pass
      - kind: unit
        ref: "src/lib/useBrowserToolDownloadHandoff.test.tsx#an accept-time resolve failure (WR-01) a stale result produces zero toasts and a null refusal"
        status: pass
      - kind: unit
        ref: "src/lib/useBrowserToolDownloadHandoff.test.tsx#an accept-time resolve failure (WR-01) declining produces zero toasts and a null refusal even though the result is non-ok"
        status: pass
      - kind: unit
        ref: "src/lib/useBrowserToolDownloadHandoff.test.tsx#an accept-time resolve failure (WR-01) a rejected resolve promise produces exactly one error toast off /browser whose message ends with the thrown message"
        status: pass
      - kind: unit
        ref: "src/lib/useBrowserToolDownloadHandoff.test.tsx#an accept-time resolve failure (WR-01) a successful accept produces zero toasts and a null refusal"
        status: pass
    human_judgment: false
  - id: D4
    description: "The live Pimp My Hideout dev-slot check confirming a real Build VPK click now lands in the mod library"
    verification: []
    human_judgment: true
    rationale: "Explicit non-goal in this plan (manual/UAT row by 06-01's own decision), but worth running once now that CR-01's fix has landed since this exact click is what CR-01 would have failed."

duration: ~15min
completed: 2026-08-08
status: complete
---

# Phase 06 Plan 07: Close CR-01/WR-01 gap-closure findings Summary

**Renamed the browser-tool-download capture's temp-file suffix from `.download` to `.vpk` so an accepted download actually reaches the shared install function, added a seam test that calls the real allocator and the real installer against each other, and made an accept-time install failure surface through the same banner/toast a refusal already uses.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-08-08
- **Tasks:** 2
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments

- Fixed CR-01: `allocateToolDownloadTempPath` now names a captured download's temp file `${randomUUID()}.vpk` instead of `${randomUUID()}.download`, so `importCustomModSource`'s file-type check (unchanged, unedited) accepts it and the accepted branch reaches the copy-into-slot step instead of throwing "Selected file is not a .vpk or supported archive" on every single accepted download.
- Added `electron/main/ipc/mods.toolDownloadImportSeam.test.ts`, a fork-only test that calls the real `allocateToolDownloadTempPath` and the real `importCustomModSource` against each other (not a mock of one side, which is how CR-01 shipped unnoticed), with a positive case, a negative control against the pre-fix suffix, and an identity-gate control proving the extension never becomes evidence about the bytes.
- Fixed WR-01: an accept-time failure from `resolveToolDownload` (no Deadlock path configured, an install throw, or an IPC round-trip rejection) now routes through the same `routeRefusalSentence` helper the `refused` branch already used, showing the danger-tone banner on `/browser` or an error toast elsewhere. Decline, a stale (superseded) result, and success all stay silent by design and are each covered by a dedicated test.
- Zero diff on `electron/main/ipc/mods.ts` and `electron/main/services/extract.ts` across the whole plan (verified by `git diff --stat` against the plan's base commit), matching the plan's Decision to fix the naming side of the contract rather than the shared gate side.

## Task Commits

Each task was committed atomically:

1. **Task 1: Make the captured temp path a path the shared install function will accept, and prove the seam** - `120ec99` (fix)
2. **Task 2: Make an accept-time failure as loud as a refusal already is** - `175646c` (fix)

_Both tasks were `tdd="true"`, but each was a small, targeted fix-plus-regression-test against existing code rather than a fresh RED/GREEN cycle: the failing behavior already existed in production (CR-01 threw on every accept; WR-01 discarded every accept-time failure), so the new/updated tests were written to fail against the pre-fix code and pass after the fix, verified inline during development rather than as separate RED/GREEN commits. No plan-level `type: tdd` gate applies (this plan's frontmatter type is `execute`)._

## Files Created/Modified

- `electron/main/services/browserDownloadCapture.ts` - `allocateToolDownloadTempPath`'s suffix changed to `.vpk`; head comment rewritten to state the suffix is an addressing detail, not a claim about the bytes; `sweepToolDownloadTempRoot`'s head comment example corrected to match
- `electron/main/services/browserDownloadCapture.test.ts` - the two suffix assertions in the `allocateToolDownloadTempPath` describe updated to `.vpk`; one new assertion added for suggested-filename independence with no extension
- `electron/main/ipc/mods.toolDownloadImportSeam.test.ts` (new) - the CR-01 seam test: real allocator + real installer, positive case, pre-fix-suffix negative control, non-VPK-bytes identity-gate control
- `src/lib/useBrowserToolDownloadHandoff.tsx` - added `routeRefusalSentence` local helper inside the subscription callback; `refused` branch now calls it; `ready` branch's discarded `await resolveToolDownload(...)` replaced with a `try`/`catch`-wrapped result handled by `if (accepted && !result.ok && !result.stale)`
- `src/lib/useBrowserToolDownloadHandoff.test.tsx` - new describe block covering on-route/off-route accept failure, stale, decline, resolve-rejection, and success, reusing the existing harness

## Decisions Made

- Fixed the naming side (`allocateToolDownloadTempPath`), not the gate side (`importCustomModSource`'s file-type check), per the plan's own Decision section: `classifyToolDownload` already runs the real magic-byte identity gate before any download reaches `state.pending`, so naming the allocation with a `.vpk` suffix states something already guaranteed true, and it costs zero diff on the two upstream-boundary files (`mods.ts`, `extract.ts`).
- In the new seam test, left `electron/main/services/vpk.ts` unmocked alongside `../services/extract`, in addition to what the plan's literal mock-wall instruction named. Vitest keys `vi.mock` by resolved module id, and `extract.ts`'s `./vpk` import resolves to the exact same file as `mods.ts`'s `../services/vpk` import; mocking it from either side mocks it for both. Mocking it would have replaced `checkVpkFile` with a bare `vi.fn()` for `extract.ts`'s real identity-gate call too, turning every assertion in the file into an assertion about a stub instead of the real gate this test exists to prove. `vpk.ts` is electron-free (only `fs`, `./heroSoundCodenames`, `./workers`, all side-effect-free at import time), so leaving it real cost nothing and matches the read_first note that "no transitive module is loaded at all beyond `extract.ts`'s own dependency set."

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Left `../services/vpk` unmocked in the new seam test, beyond the plan's literal "except `../services/extract`" instruction**
- **Found during:** Task 1 (writing `mods.toolDownloadImportSeam.test.ts`)
- **Issue:** The plan's mock-wall rule named only `../services/extract` as exempt from mocking. `mods.ts` also imports `../services/vpk` directly at module scope. Since Vitest's `vi.mock` intercepts by resolved absolute module path (not by which file wrote the import statement), mocking `../services/vpk` from `mods.ts`'s import would have also replaced the module `extract.ts` imports as `./vpk` — the same physical file — silently breaking the real identity gate (`checkVpkFile`) that `resolveInstallableVpk` depends on. This would have made every "valid VPK" assertion in the test meaningless (a mocked `checkVpkFile()` returning `undefined` throws a `TypeError` before the file-type distinction the test exists to prove is ever reached), while contradicting nothing the plan's own read_first note said ("no transitive module is loaded at all beyond `extract.ts`'s own dependency set" — `vpk.ts` is part of that dependency set).
- **Fix:** Did not add a `vi.mock('../services/vpk', ...)` call. Both `mods.ts`'s direct import and `extract.ts`'s transitive import of `vpk.ts` load for real, matching `extract.test.ts`'s own stated convention that these two files are electron-free and run unmocked.
- **Files modified:** `electron/main/ipc/mods.toolDownloadImportSeam.test.ts` (the file was authored with this exemption from the start, so there is no separate "undo a mock" diff to show)
- **Verification:** All three tests in the new file pass, including the identity-gate control, which specifically exercises the real `checkVpkFile` distinguishing VPK bytes from ZIP bytes at two allocator-produced paths.
- **Committed in:** `120ec99` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary for the seam test to test what it claims to test (the real identity gate, not a mock of it). No scope creep: no other file, mock, or assertion was touched beyond what the plan specified.

## Issues Encountered

None beyond the deviation above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The flagship capability of this phase (ROADMAP Success Criterion 3, "the file reaches the mod library") now works end to end for a captured browser-tool download, proven by a test that exercises the real seam rather than a mock of one side.
- An accept-time failure is now attributable: the user is told what happened, on whichever route they are standing on, in the same voice a refusal already used.
- Carried-forward findings out of scope for this plan (per its own Non-goals section): WR-02 (`destinationForUrl` path prefix not segment-boundary aware), WR-03 (dropped adopted-thumbnail fetch on the browser install path), WR-04 (`normalizeUrl` misclassifies bare host:port), WR-05 (`browser:resolve-tool-download` does not runtime-narrow its arguments), IN-01 (unused event id on `failed`/`refused`). None were touched while passing through the same files.
- The live Pimp My Hideout dev-slot check (clicking Build VPK on the real hosted tool) remains a manual/UAT row per 06-01's decision, but is now worth running once since this plan's fix is precisely what that check would have caught failing before.

---
*Phase: 06-community-tools-land-inside-grimoire*
*Completed: 2026-08-08*
