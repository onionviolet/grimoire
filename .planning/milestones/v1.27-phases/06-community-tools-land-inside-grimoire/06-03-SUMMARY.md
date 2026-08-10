---
phase: 06-community-tools-land-inside-grimoire
plan: 03
subsystem: security
tags: [electron, webview, will-attach-webview, permission-floor, vitest, tdd]

# Dependency graph
requires:
  - phase: 06-01
    provides: "The will-download capture path (browserDownloadCapture.ts) that changed the guest's download handling and this plan proves did not weaken its hardening"
provides:
  - "electron/main/services/webviewHardening.ts: hardenGuestWebPreferences(webPreferences, params), the single fork-only function holding the nine guest-hardening invariants, with GUEST_PARTITION exported"
  - "electron/main/services/webviewHardening.test.ts: 10 tests pinning every one of the nine invariants, importable with no electron runtime"
  - "electron/main/services/browserContentFilter.permissionFloor.test.ts: characterization test pinning attachBrowserFilter's blanket permission deny (fullscreen excepted) across both the request and check handlers"
affects: [06-02, 06-04, 06-05]

# Actuals (#2632)
actuals:
  tokens: 3400
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Fork-only service module with no module-level electron import, only structurally-typed local interfaces, so a security-critical unit stays testable in a bare node environment"
    - "Characterization test as a separate file from an existing test file, built against a plain-object stub session, when the existing file's convention is pure-helper-only testing"

key-files:
  created:
    - electron/main/services/webviewHardening.ts
    - electron/main/services/webviewHardening.test.ts
    - electron/main/services/browserContentFilter.permissionFloor.test.ts
  modified:
    - electron/main/index.ts

key-decisions:
  - "hardenGuestWebPreferences's two parameter interfaces (GuestWebPreferences, GuestAttachParams) declare no index signature: an index signature would make the concrete Electron WebPreferences/WebViewAttributes types (which lack one) structurally unassignable at the will-attach-webview call site, failing typecheck"
  - "REQ-browser-produced-file-handoff is NOT marked complete by this plan despite appearing in this plan's frontmatter requirements: 06-01-SUMMARY.md explicitly left it open pending a human-driven live verification (D3) of the real Pimp My Hideout tool, and 06-01 itself did not mark it complete for the same reason. This plan proves one constraint of that requirement (hardening does not weaken) with tests; it does not resolve D3. Marking the requirement complete from a parallel hardening-only plan while the primary functional verification is still open would misstate the requirement's true status."

patterns-established:
  - "A security invariant enforced by a comment alone is treated as unproven; the fix is a test that fails when the comment's claim is removed, not a stronger comment"

requirements-completed: []

coverage:
  - id: D1
    description: "The nine will-attach-webview guest hardening invariants (preload delete, seven forced booleans, partition pin, non-http(s) src rewrite to about:blank including case-insensitive scheme match) live in one fork-only, unit-tested function with no override parameter"
    requirement: "REQ-browser-produced-file-handoff"
    verification:
      - kind: unit
        ref: "electron/main/services/webviewHardening.test.ts (10 tests)"
        status: pass
      - kind: unit
        ref: "pnpm typecheck / pnpm lint / pnpm encoding:check"
        status: pass
    human_judgment: false
  - id: D2
    description: "electron/main/index.ts's will-attach-webview listener body is a single hardenGuestWebPreferences call plus its surrounding comment, not a second copy of the assignments; net line-count reduction confirmed"
    verification:
      - kind: unit
        ref: "git diff --stat electron/main/index.ts (2 insertions, 20 deletions)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Removing any single invariant (verified with sandbox) from webviewHardening.ts makes the test suite fail, confirming the guarantee is enforced by a test rather than asserted by a comment"
    verification:
      - kind: unit
        ref: "Manual removal of the sandbox = true line, observed 2 test failures, restored, re-verified 10/10 pass"
        status: pass
    human_judgment: false
  - id: D4
    description: "The browser partition's permission floor (blanket deny except fullscreen, both request and check handlers, idempotent across double-attach) is pinned by a characterization test with browserContentFilter.ts left unmodified"
    requirement: "REQ-browser-produced-file-handoff"
    verification:
      - kind: unit
        ref: "electron/main/services/browserContentFilter.permissionFloor.test.ts (22 tests: 9 denied permissions x 2 handlers, fullscreen x 2 handlers, double-attach)"
        status: pass
      - kind: unit
        ref: "git diff --stat electron/main/services/browserContentFilter.ts (empty)"
        status: pass
    human_judgment: false

duration: ~25min
completed: 2026-08-07
status: complete
---

# Phase 06 Plan 03: Webview Hardening Extraction and Permission-Floor Pin Summary

**`will-attach-webview`'s nine guest-privilege invariants moved out of `electron/main/index.ts` into a fork-only, unit-tested `hardenGuestWebPreferences` function, and `attachBrowserFilter`'s blanket permission deny is now pinned by a 22-case characterization test that leaves the service itself untouched.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-08-07
- **Tasks:** 2
- **Files modified:** 4 (3 created, 1 modified)

## Accomplishments

- `electron/main/services/webviewHardening.ts`: new fork-only module exporting `GUEST_PARTITION` (`'persist:grimoire-browser'`) and `hardenGuestWebPreferences(webPreferences, params)`, a verbatim move of the nine invariants (`delete webPreferences.preload`, seven forced booleans, `params.partition` pin, non-`http(s)` `src` rewrite to `about:blank`). Takes exactly two arguments, no override parameter.
- `electron/main/services/webviewHardening.test.ts`: 10 tests, importing only `vitest` and `./webviewHardening`, proving the module runs with no electron runtime. Includes a single-pass test asserting all nine invariants together so a failure names which one regressed.
- `electron/main/index.ts`'s `will-attach-webview` listener body is now one statement (`hardenGuestWebPreferences(webPreferences, params)`); the surrounding "why the main process is the authority" comment and the entire `did-attach-webview` block are untouched. Net line-count reduction confirmed via `git diff --stat` (2 insertions, 20 deletions).
- `electron/main/services/browserContentFilter.permissionFloor.test.ts`: a stub-session characterization test asserting `attachBrowserFilter` installs a request handler that grants only `fullscreen` and a check handler that answers the same way, across 9 named denied permissions, and that attaching twice does not change the answer. `browserContentFilter.ts` itself is unmodified (`git diff --stat` empty).
- Manually verified the guarantee is test-enforced, not comment-enforced: temporarily commented out the `sandbox = true` assignment, observed 2 of 10 tests fail, restored the line, re-confirmed 10/10 pass.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract the guest hardening into one tested function**
   - `a048389` (test) - RED: failing `webviewHardening.test.ts` against the not-yet-created module
   - `f8e6343` (feat) - GREEN: `webviewHardening.ts` created, `electron/main/index.ts` delegates to it
2. **Task 2: Pin the browser partition's permission floor** - `dc3636b` (test)

**Plan metadata:** committed alongside this SUMMARY (worktree mode; STATE.md/ROADMAP.md excluded, owned centrally by the orchestrator).

## Files Created/Modified

- `electron/main/services/webviewHardening.ts` - `GUEST_PARTITION` constant and `hardenGuestWebPreferences(webPreferences, params)`, the single authority for guest privilege invariants
- `electron/main/services/webviewHardening.test.ts` - 10 tests covering all nine behaviours plus one combined-invariants assertion
- `electron/main/services/browserContentFilter.permissionFloor.test.ts` - 22 tests characterizing the existing permission floor via a stub session
- `electron/main/index.ts` - `will-attach-webview` listener body reduced to a single delegating call; import added for `hardenGuestWebPreferences`

## Decisions Made

- `GuestWebPreferences`/`GuestAttachParams` are declared as narrow structural interfaces with no index signature. An index signature was tried first (per the plan's suggested fallback pattern) but broke `pnpm typecheck`: Electron's real `WebPreferences` type has no index signature, so it is not structurally assignable to a parameter type that requires one. Removing the index signature (Rule 1 - the plan's own type-narrowing guidance corrected to match Electron's actual type shape) fixed it with no behavior change.
- `REQ-browser-produced-file-handoff` is left unmarked in this plan's `requirements-completed` and no `requirements mark-complete` was run. This plan proves the "hardening does not weaken" constraint of that requirement with tests, but `06-01-SUMMARY.md` records the requirement's live-tool verification (D3) as still open, deferred to human/UAT. Marking the requirement complete from this hardening-only plan would misstate that open item; the traceability row should flip only once D3 (or 06-02's fuller functional coverage) closes it out.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Index-signature interfaces broke typecheck at the `will-attach-webview` call site**
- **Found during:** Task 1, after wiring `electron/main/index.ts` to call `hardenGuestWebPreferences`
- **Issue:** `pnpm typecheck` failed with `Argument of type 'WebPreferences' is not assignable to parameter of type 'GuestWebPreferences'. Index signature for type 'string' is missing in type 'WebPreferences'.` The initial interfaces carried a `[key: string]: unknown` index signature, which Electron's real `WebPreferences`/params types do not have.
- **Fix:** Removed the index signature from both `GuestWebPreferences` and `GuestAttachParams`, keeping only the named optional fields the function actually reads or writes.
- **Files modified:** `electron/main/services/webviewHardening.ts`
- **Verification:** `pnpm typecheck` exits 0; all 10 `webviewHardening.test.ts` tests still pass
- **Committed in:** `f8e6343` (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - type-correctness fix, no behavior change)
**Impact on plan:** No scope creep. The fix makes the module's types match Electron's actual API surface, which is exactly the constraint the plan's own type-narrowing instruction anticipated.

## Issues Encountered

None beyond the type-narrowing deviation above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `hardenGuestWebPreferences` and `GUEST_PARTITION` are the single source of truth for guest privileges; any future plan touching webview attachment (06-05 or later) should call this function rather than re-adding assignments to `electron/main/index.ts`.
- The permission-floor characterization test in this plan is a regression guard, not new behavior; it does not need to be revisited unless Electron adds a new permission type, in which case the `DENIED_PERMISSIONS` list in `browserContentFilter.permissionFloor.test.ts` is the one place to update.
- **Carried forward:** `REQ-browser-produced-file-handoff`'s traceability row stays `Pending` until 06-01's deferred human verification (D3) or 06-02's fuller functional test coverage closes it out. This plan's tests cover only the hardening-does-not-weaken half of that requirement.

---
*Phase: 06-community-tools-land-inside-grimoire*
*Completed: 2026-08-07*

## Self-Check: PASSED

- FOUND: `electron/main/services/webviewHardening.ts`
- FOUND: `electron/main/services/webviewHardening.test.ts`
- FOUND: `electron/main/services/browserContentFilter.permissionFloor.test.ts`
- FOUND: commit `a048389`
- FOUND: commit `f8e6343`
- FOUND: commit `dc3636b`
