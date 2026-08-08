---
phase: 06-community-tools-land-inside-grimoire
verified: 2026-08-08T01:00:00Z
status: human_needed
score: 4/5 must-haves verified
behavior_unverified: 1
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 3/5
  gaps_closed:
    - "Before that file is written anywhere, the user is told what it is and where it will go, and a file that is not a VPK Grimoire can identify is refused with a stated reason (ROADMAP Phase 6 Success Criterion 3) — CR-01 (page-scoped subscriber dropped the disclosure on navigation away from /browser) closed by 06-06's app-scoped useBrowserToolDownloadHandoff hook; the accept-time install failure (a second defect the 06-08 re-review found, CR-01/WR-01 in 06-REVIEW.md's second pass) closed by 06-07's .vpk temp-file suffix fix and accept-time failure surfacing."
  gaps_remaining: []
  regressions: []
behavior_unverified_items:
  - truth: "Clicking Build VPK on Pimp My Hideout inside Grimoire's browser produces a file Grimoire can act on without the user leaving the app or opening a file manager (ROADMAP Phase 6 Success Criterion 2)"
    test: "Drive the real Pimp My Hideout tool inside a running Grimoire dev build (GRIMOIRE_DEV_SLOT=<n>), click Build VPK, and watch for Grimoire's confirm dialog and the resulting Installed-page entry"
    expected: "will-download fires for the guest's client-side-built blob, the file lands in <userData>/browser-downloads/, checkVpkFile identifies it, useConfirm discloses it, and accepting installs it as an ordinary third-party mod"
    why_human: "Requires a human driving the real external tool inside a live dev build; deferred to manual/UAT by explicit user decision recorded in 06-01. Not automatable against a third-party site. Every unit in the chain (capture, classify, disclose, accept-install) is now individually proven, including a real end-to-end seam test (mods.toolDownloadImportSeam.test.ts) that calls the real allocator and the real install function against each other, but no test or log in the tree demonstrates the live xkitkatcat.github.io page's Build VPK button actually firing Electron's will-download event."
human_verification:
  - test: "Click Pimp My Hideout in the Browser page's Tools group, build something on the real hosted tool, click its Build VPK button, and observe whether a confirm dialog appears naming the captured file, then confirm it installs on Installed"
    expected: "A confirm dialog titled \"Add this download to your mod library?\" appears within a few seconds of the click, naming the file; choosing \"Add to library\" lands the mod on the Installed page as an ordinary third-party mod with no Foundry tray/My changes entry; nothing appears in the OS Downloads folder; walking away from /browser before the build finishes still surfaces the dialog wherever you land"
    why_human: "State-transition/runtime-behavior truth (ROADMAP Success Criterion 2) against a live third-party site that presence-and-wiring checks cannot settle. Explicitly deferred to manual/UAT by user decision in 06-01, not automated by any later plan, and 06-07's own SUMMARY notes this check is now worth running once since its fix is exactly what would have made it fail before."
---

# Phase 06: Community Tools Land Inside Grimoire Verification Report

**Phase Goal:** A community web tool that builds a mod inside the in-app browser hands its output to Grimoire instead of the system Downloads folder, and the destination list becomes a checked catalog rather than a hardcoded array that rots
**Verified:** 2026-08-08
**Status:** human_needed
**Re-verification:** Yes — after gap closure (06-06 for CR-01/WR-05, 06-07 for the CR-01/WR-01 pair a second re-review found)

## Goal Achievement

### Observable Truths

| # | Truth (ROADMAP Success Criterion) | Status | Evidence |
|---|---|---|---|
| 1 | Pimp My Hideout is reachable from the browser's destination list, and every other entry has been loaded once and either kept, corrected, or removed, with the result recorded | VERIFIED | `src/lib/browserCatalog.ts` carries a `tool`-kind Pimp My Hideout entry among 10 total. `docs/browser-destinations.md` records a dated (2026-08-07), per-entry probe table for all 10 entries with HTTP status, final URL, title, host-changed flag and verdict; the `deadlocked.wiki` vs `deadlock.wiki` comparison REQ-browser-tool-catalog names is present with both probe results and a resolved human decision (corrected to `deadlock.wiki`, a squatted-domain redirect to TikTok on the old entry); D-06 (no crosshair generator) is recorded as a decision with its reason. `src/lib/browserCatalog.test.ts` (25 tests) and `src/lib/browserCatalog.reachability.test.ts` (opt-in, skipped by default) pass. |
| 2 | Clicking `Build VPK` on Pimp My Hideout inside Grimoire's browser produces a file Grimoire can act on without the user leaving the app or opening a file manager | PRESENT_BEHAVIOR_UNVERIFIED | Every unit of the mechanism is now individually proven, including a real end-to-end seam test: `electron/main/ipc/mods.toolDownloadImportSeam.test.ts` calls the real `allocateToolDownloadTempPath` and the real `importCustomModSource` against each other and proves a captured-and-accepted download reaches the slot-allocation step rather than throwing on the file-type check (this is the exact defect the second re-review found and 06-07 fixed). But the live, human-driven confirmation that the real hosted tool's `Build VPK` button actually fires `will-download` remains deferred to manual/UAT by explicit user decision in 06-01, and no test or log demonstrates it. See Human Verification below — this is the correct routing per the phase's own stated instruction, not a failed criterion. |
| 3 | Before that file is written anywhere, the user is told what it is and where it will go, and a file that is not a VPK Grimoire can identify is refused with a stated reason | VERIFIED | Previously FAILED in the initial verification (CR-01: the disclosure subscriber was a page-scoped `useEffect` in `src/pages/Browser.tsx` that was torn down on navigation away from `/browser`, silently dropping a `ready`/`refused` push). 06-06 moved the subscriber into `src/lib/useBrowserToolDownloadHandoff.tsx`, called once from `src/components/Layout.tsx`'s component body ahead of its `if (loading)` early return (confirmed by direct read: `useBrowserToolDownloadHandoff()` at line 161, `if (loading)` at line 241) — its lifetime is now the renderer document's lifetime, not the route's mount. This is proven by a genuine behavioral test, not mere presence: `useBrowserToolDownloadHandoff.test.tsx`'s CR-01 regression case navigates a real `MemoryRouter` away from `/browser`, asserts the subscribe count stays 1, and delivers a `ready` event that still reaches the confirm spy after the navigation. A second defect (the temp file was named with a neutral `.download` suffix that `importCustomModSource`'s file-type gate rejected before reading a byte, so every *accepted* download actually failed to install) was found by a second re-review and closed by 06-07: `allocateToolDownloadTempPath` now names the file `${randomUUID()}.vpk`, proven by the real-function seam test described under truth 2. `checkVpkFile`/`resolveInstallableVpk` (magic-byte reads) are unchanged and still the only things that decide what the bytes are; the extension is never evidence, confirmed by the seam test's identity-gate control (non-VPK bytes at a real allocator-produced path still refused). Independently re-ran: `pnpm exec vitest run` for the whole suite (162 files, 1834 tests, 12 skipped) and the seven browser-subsystem test files individually — all pass. |
| 4 | The webview is no less hardened after the download path changes than before: the guest still has no preload, no Node, its own partition, and an http(s)-only `src` | VERIFIED | `electron/main/services/webviewHardening.ts`'s `hardenGuestWebPreferences` holds all nine invariants (preload delete, seven forced booleans, partition pin, http(s)-only src rewrite), takes exactly two parameters (no override), and is the single call site in `will-attach-webview` (`electron/main/index.ts:362-363`, confirmed by direct read). `webviewHardening.test.ts` (10 tests) and `browserContentFilter.permissionFloor.test.ts` (22 tests) both re-run clean and unmodified since 06-03. `browserDownloadCapture.ts` and the app-scoped hook added since touch no `webPreferences`, no partition, and no permission handler — confirmed by reading both files in full. `GUEST_PARTITION` (`persist:grimoire-browser`) matches the `partition` attribute on the `<webview>` element in `src/pages/Browser.tsx`. |
| 5 | A destination declares what kind of thing it is, so a handoff keys off that kind rather than a hardcoded URL match | VERIFIED | `BrowserDestinationKind` is a required field on every `BrowserDestination`. `shouldCaptureToolDownload` gates capture on `active.kind === 'tool'` (pushed from the renderer via `destinationForUrl(url)?.kind`); `groupDestinationsByKind` and `src/pages/Browser.tsx`'s kind-grouped rendering key off the same field. No hardcoded URL match drives either the capability grant or the UI grouping. |

**Score:** 4/5 truths verified (1 present, behavior-unverified — routed to human verification, not a gap)

### Deferred / Carried-Forward Items (not gaps for this phase)

Per explicit user decision recorded in `06-06-PLAN.md`'s and `06-07-PLAN.md`'s Non-goals sections, and confirmed unchanged by the second re-review's `06-REVIEW.md`, five findings remain open but out of scope for this phase's success criteria:

- WR-02: `destinationForUrl`'s path-prefix tie-break is not segment-boundary aware (dormant — no two catalog entries currently share a host).
- WR-03: the browser-tool-download install path passes an empty `thumbnailFetchTargets` array, skipping the adopted-thumbnail fetch the batch import path performs.
- WR-04: the address bar's `normalizeUrl` scheme regex misclassifies a bare `host:port` input.
- WR-05: `browser:resolve-tool-download`'s IPC handler does not runtime-narrow `id`/`accepted`.
- IN-01: `BrowserToolDownloadEvent.id` is generated but unused for the `failed`/`refused` statuses.

None of these map to a ROADMAP success criterion or a must-have truth; they are not re-litigated here per the task's own instruction.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `src/lib/browserCatalog.ts` | Frozen, kind-typed catalog | VERIFIED | 10 entries, `kind` required, `KIND_ORDER`, `HOME_DESTINATION_URL` via label lookup (throws if orphaned), `destinationForUrl`, `groupDestinationsByKind`, `visibleDestinations` all present |
| `src/lib/browserCatalog.test.ts` / `.reachability.test.ts` | Catalog unit + opt-in reachability tests | VERIFIED | Both present, pass |
| `src/lib/browserToolDownload.ts` | Renderer IPC wrappers | VERIFIED | `onBrowserToolDownload`, `resolveToolDownload`, `setActiveBrowserDestination` |
| `electron/main/services/browserDownloadCapture.ts` | will-download capture + sweep | VERIFIED | `shouldCaptureToolDownload`, `setSavePath` as first sync statement, `replacePending`, `classifyToolDownload`, `allocateToolDownloadTempPath` (`.vpk` suffix), `sweepToolDownloadTempRoot`, `pendingToolDownloadPaths`, `attachBrowserDownloadCapture` idempotent |
| `electron/main/ipc/browser.ts` | IPC surface | VERIFIED | `browser:set-active-destination`, `browser:resolve-tool-download`, `resolvePendingToolDownload` |
| `electron/main/services/webviewHardening.ts` | Extracted hardening function | VERIFIED | `hardenGuestWebPreferences`, `GUEST_PARTITION`, no electron runtime import |
| `electron/main/services/browserContentFilter.permissionFloor.test.ts` | Permission floor characterization | VERIFIED | 22 tests, `browserContentFilter.ts` untouched |
| `docs/browser-destinations.md` | Dated per-entry catalog review | VERIFIED | 10-row table, deadlocked.wiki/deadlock.wiki section, D-06 section, Applied section |
| `docs/browser-scope-boundary.md` | Bounded control-set decision record | VERIFIED | Controls-exist/controls-absent tables, disclosure-lifetime + retention/safety-rule section (matches sweep's own head comment), Home section, review-cadence section |
| `src/lib/useBrowserToolDownloadHandoff.tsx` | App-scoped disclosure subscriber | VERIFIED | Called once from `Layout.tsx` ahead of the loading early return; route read via ref so navigation never resubscribes |
| `src/lib/useBrowserToolDownloadHandoff.test.tsx` | Subscriber tests | VERIFIED | Includes the CR-01 regression case (navigate away, still receives `ready`) and the WR-01 accept-failure block |
| `src/stores/browserToolDownloadStore.ts` | Refusal-banner seam | VERIFIED | `useBrowserToolDownloadStore`, `setBrowserToolDownloadRefusal`, fork-only, no persistence |
| `electron/main/ipc/mods.toolDownloadImportSeam.test.ts` | Real-function install seam test (CR-01) | VERIFIED | Calls real `allocateToolDownloadTempPath` + real `importCustomModSource`; positive case, pre-fix-suffix negative control, identity-gate control; `git diff --stat` on `mods.ts`/`extract.ts` confirmed empty since before 06-06 |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `electron/main/index.ts` `did-attach-webview` | `attachBrowserDownloadCapture` | direct call, single listener | WIRED | Confirmed at source read |
| `electron/main/index.ts` `will-attach-webview` | `hardenGuestWebPreferences` | direct call | WIRED | Confirmed at source read; body is one statement |
| `electron/main/index.ts` `app.whenReady()` | `sweepToolDownloadTempRoot` | direct call, fire-and-forget `void` | WIRED | Confirmed beside the existing `sweepHeroPoseCache()` call |
| `src/components/Layout.tsx` | `useBrowserToolDownloadHandoff()` | hook call in component body | WIRED | Called before the `if (loading)` early return, mirroring `onOneClickInstall`/`onMultiVpkPick` |
| `src/pages/Browser.tsx` refusal banner | `useBrowserToolDownloadStore` | zustand selector | WIRED | Banner JSX unchanged, now fed from the store instead of local state |
| `electron/main/ipc/browser.ts` resolve handler | `import-custom-mods` install path (`importCustomModSource`) | shared function call | WIRED and PROVEN | Now proven end to end, not just wired: the seam test shows an accepted download reaches the copy-into-slot step rather than failing the file-type gate (the defect the second re-review found) |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|---|---|---|---|---|
| REQ-browser-tool-catalog | 06-01, 06-04, 06-05 | Destinations become a maintained, kind-typed, reviewed catalog | SATISFIED | Catalog exists, kind-typed, dated review recorded, renders grouped by kind |
| REQ-browser-produced-file-handoff | 06-01, 06-02, 06-03, 06-06, 06-07 | A community tool's file reaches Grimoire's library instead of the system Downloads folder | SATISFIED | Mechanism built, unit-tested, and now proven end to end via a real-function seam test; disclosure survives navigation (proven by a behavioral regression test); only the live third-party click remains a deferred human-verification item, per explicit design |
| REQ-browser-navigation-gaps | 06-05, 06-06, 06-07 | The browser's bounded control set is a recorded decision | SATISFIED | `docs/browser-scope-boundary.md` records existing/absent controls with reasons, the disclosure's app-scoped lifetime, the sweep's retention/safety rule, and the one uncovered window (no renderer document) with its mitigation |

No orphaned requirements: REQUIREMENTS.md maps exactly these three IDs to Phase 6, and all three appear in at least one plan's `requirements` frontmatter field.

**Note (non-blocking):** `.planning/REQUIREMENTS.md`'s Traceability table (line ~171) still shows `REQ-browser-tool-catalog | Phase 6 | Pending` while the other two Phase 6 rows say `Complete`. `06-01-SUMMARY.md` and `06-04-SUMMARY.md` both list `requirements-completed: [REQ-browser-tool-catalog]`, and this verification confirms the requirement is in fact satisfied. This looks like a sync step that was not run after 06-04, not a code gap; worth a one-line fix to `REQUIREMENTS.md` when this phase ships.

### Anti-Patterns Found

No `TBD`, `FIXME`, `XXX`, `TODO`, `HACK`, or `PLACEHOLDER` markers found in any file this phase created or modified across all seven plans, including 06-06's and 06-07's additions (`useBrowserToolDownloadHandoff.tsx`, `browserToolDownloadStore.ts`, `mods.toolDownloadImportSeam.test.ts`, `browserDownloadCapture.ts`, `docs/browser-scope-boundary.md`).

### Independent Test Execution

Re-ran (not trusted from SUMMARY claims) as part of this verification:

- `pnpm exec vitest run electron/main/ipc/mods.toolDownloadImportSeam.test.ts electron/main/services/browserDownloadCapture.test.ts electron/main/ipc/browser.test.ts src/lib/useBrowserToolDownloadHandoff.test.tsx src/lib/browserCatalog.test.ts electron/main/services/webviewHardening.test.ts electron/main/services/browserContentFilter.permissionFloor.test.ts` — 116 passed, 1 skipped.
- `pnpm exec vitest run` (whole suite) — 162 files / 1834 tests passed, 12 skipped, 0 failed.
- `pnpm typecheck` — clean.
- `pnpm lint` — clean.
- `pnpm i18n:check` — `OK: all 2591 referenced keys exist`, exit 0 (the `browser.catalog.groups.*` keys appear in the informational "unused" list because they are looked up via a `Record` rather than a literal string; this is a pre-existing checker limitation, not a missing key — they are exercised in `src/pages/Browser.tsx`).
- `pnpm encoding:check` — clean (634 files scanned).
- `git diff --stat cc7fb59..HEAD -- electron/main/ipc/mods.ts electron/main/services/extract.ts` — empty, confirming both 06-06 and 06-07 kept their stated promise of zero diff on the shared upstream-boundary files.

### Human Verification Required

1 item (see frontmatter `human_verification`): the live confirmation that Pimp My Hideout's real, hosted `Build VPK` button actually triggers Grimoire's capture path end to end. This was explicitly deferred to manual/UAT by user decision in 06-01 and is not automatable against a third-party site; per this verification's own instructions it is routed here rather than counted as a failed criterion. Every code unit on the path it would exercise is now individually proven, including a real end-to-end install seam test that would have caught the exact CR-01 defect the second re-review found.

### Gaps Summary

No gaps. The one gap the initial verification found (CR-01: the disclosure subscriber was page-scoped and silently dropped a terminal status pushed after the user navigated away from `/browser`) was closed by 06-06 and confirmed by an independent test run and source read here. A second, distinct defect found by a subsequent code-review pass (an accepted download's temp file used a `.download` suffix that `importCustomModSource`'s file-type gate rejected before reading a byte, so every accepted download actually failed silently to install) was closed by 06-07, also confirmed here by an independent test run and a real end-to-end seam test that exercises the actual install function rather than a mock of it.

The remaining open item, ROADMAP Success Criterion 2's live third-party tool check, was never a code defect: it is a deliberately deferred manual/UAT step against a site outside Grimoire's control, and it stays a human-verification item rather than a gap.

---

_Verified: 2026-08-08_
_Verifier: Claude (gsd-verifier)_
