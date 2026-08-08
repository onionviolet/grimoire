---
phase: 06-community-tools-land-inside-grimoire
verified: 2026-08-07T22:00:00Z
status: gaps_found
score: 3/5 must-haves verified
behavior_unverified: 1
overrides_applied: 0
gaps:
  - truth: "Before that file is written anywhere, the user is told what it is and where it will go, and a file that is not a VPK Grimoire can identify is refused with a stated reason (ROADMAP Phase 6 Success Criterion 3)"
    status: partial
    reason: >
      The happy-path mechanism (checkVpkFile identity gate before any confirm,
      useConfirm disclosure, danger-tone refusal banner naming the detected
      type) is implemented and unit-tested correctly. But the disclosure
      round trip is wired to a page-scoped React effect in src/pages/
      Browser.tsx rather than an app-scoped one (e.g. Layout.tsx, the pattern
      the codebase already uses for onOneClickInstall/onMultiVpkPick). If a
      captured download's classification completes in the main process after
      the user has navigated away from /browser, the useEffect that owns the
      only onBrowserToolDownload subscription has already been torn down by
      unmount. The 'ready'/'refused' push is a plain ipcRenderer event with
      no queue or replay, so it is silently dropped: no confirm dialog, no
      refusal banner, no toast, and the temp file under
      <userData>/browser-downloads/ is orphaned until another tool download
      happens to supersede it. This is documented as CR-01 in 06-REVIEW.md
      (a Critical finding) and remains unfixed in the current tree — verified
      directly by reading src/pages/Browser.tsx (the effect at lines 205-281
      is still inside the Browser component, not Layout.tsx) and confirming
      no fix commit exists after cc7fb59 (the review-report commit, HEAD).
      This directly contradicts docs/browser-scope-boundary.md's own claim
      that a captured download has "nothing in between for a user to
      manage" — the orphaned pending-map entry with a lost disclosure is
      exactly that missing state.
    artifacts:
      - path: "src/pages/Browser.tsx"
        issue: "onBrowserToolDownload subscribed in a page-scoped useEffect (lines 205-281), unmounted on navigation away from /browser, with no replay of a terminal status pushed after unmount"
      - path: "electron/main/services/browserDownloadCapture.ts"
        issue: "pushToolDownloadEvent has no queue/buffer for a status pushed while no renderer listener is attached; the pending map entry that would have been disclosed survives only until replaced or the app restarts"
    missing:
      - "Move the onBrowserToolDownload subscription (and the confirm/toast/banner handling it drives) from src/pages/Browser.tsx into a persistently-mounted component (e.g. src/components/Layout.tsx), mirroring onOneClickInstall/onMultiVpkPick, so a disclosure survives navigation away from the Browser route"
      - "Alternatively (if the page-scoped design is intentional), a startup/return-to-page reconciliation that re-surfaces a still-pending disclosure for a download the user has not yet answered, plus the WR-05 startup sweep for orphaned temp files noted in 06-REVIEW.md"
human_verification:
  - test: "Click Pimp My Hideout in the Browser page's Tools group, build something on the real hosted tool, click its Build VPK button, and observe whether a confirm dialog appears naming the captured file"
    expected: "A confirm dialog titled \"Add this download to your mod library?\" appears within a few seconds of the click, naming the file; choosing \"Add to library\" lands the mod on the Installed page as an ordinary third-party mod with no Foundry tray/My changes entry; nothing appears in the OS Downloads folder"
    why_human: "The code path (will-download capture -> setSavePath -> checkVpkFile -> useConfirm -> import-custom-mods) is built and unit-tested end to end, but whether Pimp My Hideout's live, third-party page actually triggers Electron's will-download event the way RESEARCH.md predicted has never been directly observed. 06-01-SUMMARY.md documents two automated CDP attempts by the orchestrator that were inconsistent and inconclusive (a 5+ minute hang, then a silent no-op), never reaching the confirm dialog; the user explicitly chose to defer this specific live check to manual/UAT verification rather than continue automating it against an external site outside Grimoire's control. This is a state-transition/runtime-behavior truth (ROADMAP Success Criterion 2) that presence-and-wiring checks cannot settle."
behavior_unverified_items:
  - truth: "Clicking Build VPK on Pimp My Hideout inside Grimoire's browser produces a file Grimoire can act on without the user leaving the app or opening a file manager (ROADMAP Phase 6 Success Criterion 2)"
    test: "Drive the real Pimp My Hideout tool inside a running Grimoire dev build (GRIMOIRE_DEV_SLOT=3), click Build VPK, and watch for Grimoire's confirm dialog and the resulting Installed-page entry"
    expected: "will-download fires for the guest's client-side-built blob, the file lands in <userData>/browser-downloads/, checkVpkFile identifies it, useConfirm discloses it, and accepting installs it as an ordinary third-party mod"
    why_human: "Requires a human driving the real external tool inside a live dev build; the mechanism is proven only by strong circumstantial evidence (Electron docs, corroborating GitHub issues, this codebase's own working handler on the identical session/attach pattern) plus passing unit tests of every unit in the chain, not by direct observation of this specific external tool actually firing the event."
---

# Phase 06: Community Tools Land Inside Grimoire Verification Report

**Phase Goal:** A community web tool that builds a mod inside the in-app browser hands its output to Grimoire instead of the system Downloads folder, and the destination list becomes a checked catalog rather than a hardcoded array that rots
**Verified:** 2026-08-07
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth (ROADMAP Success Criterion) | Status | Evidence |
|---|---|---|---|
| 1 | Pimp My Hideout is reachable from the browser's destination list, and every other entry has been loaded once and either kept, corrected, or removed, with the result recorded | VERIFIED | `src/lib/browserCatalog.ts` has a `tool`-kind entry for Pimp My Hideout; `docs/browser-destinations.md` records a dated (2026-08-07), per-entry probe table for all 10 entries with HTTP status, final URL, title, and verdict; the `deadlocked.wiki` vs `deadlock.wiki` comparison required by REQ-browser-tool-catalog is present with both probe results quoted, resolved by human decision to correct to `deadlock.wiki` (the catalog entry was changed accordingly); D-06 (no crosshair generator) is recorded as a decision with reasoning. `src/lib/browserCatalog.test.ts` and `src/lib/browserCatalog.reachability.test.ts` pass. |
| 2 | Clicking `Build VPK` on Pimp My Hideout inside Grimoire's browser produces a file Grimoire can act on without the user leaving the app or opening a file manager | PRESENT_BEHAVIOR_UNVERIFIED | The full mechanism (`will-download` capture in `browserDownloadCapture.ts`, `setSavePath` as the first synchronous statement, `checkVpkFile` classification, `useConfirm` disclosure, `import-custom-mods` install) is built and unit-tested (88 tests pass across the phase's test files). But 06-01-SUMMARY.md explicitly records that the live, human-driven confirmation against the real hosted tool was **deferred, not completed**: two automated CDP attempts by the orchestrator were inconsistent and inconclusive, and the user chose to defer this specific check to manual/UAT. No test or log in the tree demonstrates the real tool's `Build VPK` button actually triggering `will-download`. See Human Verification below. |
| 3 | Before that file is written anywhere, the user is told what it is and where it will go, and a file that is not a VPK Grimoire can identify is refused with a stated reason | FAILED (partial) | The happy-path mechanism is real and unit-tested: `classifyToolDownload` runs `checkVpkFile` before any pending-map entry exists, a refusal deletes the temp file and pushes a reason via `describeVpkRejection` before any confirm could show, and the `useConfirm` disclosure names the mod library and file (D-08/D-09). **However**, 06-REVIEW.md's CR-01 (Critical, unfixed) demonstrates that the disclosure round trip is wired to a page-scoped `useEffect` in `src/pages/Browser.tsx` (verified: still true in the current tree, lines 205-281), not an app-scoped one. Navigating away from `/browser` while a capture is classifying tears down the only subscriber; a `ready`/`refused` push that arrives afterward is silently dropped (no dialog, no banner, no toast), and the temp file is orphaned. This is a demonstrated code defect (static, not merely hypothetical), and it directly contradicts `docs/browser-scope-boundary.md`'s own claim of "nothing in between for a user to manage." See Gaps below. |
| 4 | The webview is no less hardened after the download path changes than before: the guest still has no preload, no Node, its own partition, and an http(s)-only `src` | VERIFIED | `electron/main/services/webviewHardening.ts`'s `hardenGuestWebPreferences` holds all nine invariants (preload delete, seven forced booleans, partition pin, http(s)-only src rewrite), takes no override parameter, and is the single call site in `will-attach-webview` (`electron/main/index.ts:362-363`). `webviewHardening.test.ts` (10 tests) fails if any invariant is removed (manually confirmed per 06-03-SUMMARY.md). `browserContentFilter.permissionFloor.test.ts` (22 tests) pins the blanket permission deny. `browserDownloadCapture.ts` registers only a session-level `will-download` listener; it touches no `webPreferences`, no partition, no permission handler. |
| 5 | A destination declares what kind of thing it is, so a handoff keys off that kind rather than a hardcoded URL match | VERIFIED | `BrowserDestinationKind` is a required field on every `BrowserDestination` (no optional, no default); `shouldCaptureToolDownload` in `browserDownloadCapture.ts` gates capture on `active.kind === 'tool'` (pushed from the renderer via `destinationForUrl(url)?.kind`), and `groupDestinationsByKind`/the Browser page's rendering key off the same field. No hardcoded URL match drives either the capability grant or the UI grouping. |

**Score:** 3/5 truths verified (1 present, behavior-unverified; 1 failed)

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `src/lib/browserCatalog.ts` | Frozen, kind-typed catalog | VERIFIED | 10 entries, `kind` required, `KIND_ORDER`, `HOME_DESTINATION_URL` via label lookup, `destinationForUrl`, `groupDestinationsByKind`, `visibleDestinations` all present and exported |
| `src/lib/browserCatalog.test.ts` | Catalog unit tests | VERIFIED | Present, passes (part of 88 total) |
| `src/lib/browserCatalog.reachability.test.ts` | Opt-in reachability probe | VERIFIED | `describe.skipIf(!process.env.GRIMOIRE_CHECK_DESTINATIONS)`, imports `BROWSER_DESTINATIONS` directly |
| `src/lib/browserToolDownload.ts` | Renderer IPC wrappers | VERIFIED | `onBrowserToolDownload`, `resolveToolDownload`, `setActiveBrowserDestination` thin pass-throughs |
| `electron/main/services/browserDownloadCapture.ts` | will-download capture service | VERIFIED | `shouldCaptureToolDownload`, `setSavePath` as first sync statement, `replacePending`, `classifyToolDownload`, `attachBrowserDownloadCapture` idempotent |
| `electron/main/services/browserDownloadCapture.test.ts` | Capture service tests | VERIFIED | Passes |
| `electron/main/ipc/browser.ts` | IPC surface | VERIFIED | `browser:set-active-destination`, `browser:resolve-tool-download`, `resolvePendingToolDownload` exported and testable |
| `electron/main/ipc/browser.test.ts` | IPC resolve-contract tests | VERIFIED | 9 tests covering confused-deputy contract |
| `electron/main/services/webviewHardening.ts` | Extracted hardening function | VERIFIED | `hardenGuestWebPreferences`, `GUEST_PARTITION`, no electron runtime import |
| `electron/main/services/webviewHardening.test.ts` | Hardening tests | VERIFIED | 10 tests, importable in bare node environment |
| `electron/main/services/browserContentFilter.permissionFloor.test.ts` | Permission floor characterization | VERIFIED | 22 tests, `browserContentFilter.ts` untouched |
| `docs/browser-destinations.md` | Dated per-entry catalog review | VERIFIED | 10-row table, deadlocked.wiki/deadlock.wiki section, D-06 section, Applied section |
| `docs/browser-scope-boundary.md` | Bounded control-set decision record | VERIFIED | Controls-exist/controls-absent tables, Home section, review-cadence section |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `electron/main/index.ts` `did-attach-webview` | `browserDownloadCapture.attachBrowserDownloadCapture` | direct call, single listener | WIRED | Confirmed at `electron/main/index.ts:389`; `will-download` block replaced, not duplicated |
| `electron/main/index.ts` `will-attach-webview` | `webviewHardening.hardenGuestWebPreferences` | direct call | WIRED | Confirmed at `electron/main/index.ts:362-363`; body reduced to one call, `git diff --stat` for the extraction task showed 20 deletions / 2 insertions per 06-03-SUMMARY.md |
| `src/pages/Browser.tsx` `syncNav`/mount/unmount | `setActiveBrowserDestination` (kind, origin, label) | IPC send on every nav event | WIRED | Confirmed: pushed on mount (home), on every `did-navigate`/`did-navigate-in-page`, and `(null, null, null)` on unmount |
| `electron/main/ipc/browser.ts` resolve handler | `import-custom-mods` install path (`importCustomModSource`) | shared function call, no bespoke import logic | WIRED | Confirmed: `defaultResolveDeps.install` calls `importCustomModSource` directly; no file copy/metadata write of its own |
| `src/pages/Browser.tsx` `onBrowserToolDownload` subscription | Confirm dialog / refusal banner / toasts | page-scoped `useEffect`, unmounts with the route | **PARTIALLY WIRED — CR-01** | Wired correctly while the Browser page stays mounted; **not** wired for a terminal status pushed after the user navigates away (see gap above). This is the one key link this phase's own goal statement ("hands its output to Grimoire") depends on holding in every case, not only the happy path. |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|---|---|---|---|---|
| REQ-browser-tool-catalog | 06-01, 06-04, 06-05 | Destinations become a maintained, kind-typed, reviewed catalog | SATISFIED | Catalog exists, is kind-typed, was reviewed and dated (docs/browser-destinations.md), and renders grouped by kind |
| REQ-browser-produced-file-handoff | 06-01, 06-02, 06-03 | A community tool's file reaches Grimoire's library instead of the system Downloads folder | PARTIALLY SATISFIED | Mechanism built and unit-tested; live confirmation against the real tool deferred to human/UAT (Success Criterion 2); disclosure reliability gap under navigation-away (CR-01, Success Criterion 3) |
| REQ-browser-navigation-gaps | 06-05 | The browser's bounded control set is a recorded decision | SATISFIED | `docs/browser-scope-boundary.md` records existing and deliberately-absent controls with reasons, and the Home anchor is a named lookup rather than an array index |

No orphaned requirements: REQUIREMENTS.md maps exactly these three IDs to Phase 6, and all three appear in at least one plan's `requirements` frontmatter field.

### Anti-Patterns Found

No `TBD`, `FIXME`, `XXX`, `TODO`, `HACK`, or `PLACEHOLDER` markers found in any file this phase created or modified (`src/lib/browserCatalog.ts`, `src/lib/browserToolDownload.ts`, `electron/main/services/browserDownloadCapture.ts`, `electron/main/ipc/browser.ts`, `electron/main/services/webviewHardening.ts`, `src/pages/Browser.tsx`, `docs/browser-destinations.md`, `docs/browser-scope-boundary.md`).

### Additional Findings (from 06-REVIEW.md, not gating but relevant)

06-REVIEW.md (already committed at `cc7fb59`) recorded four Warnings beyond CR-01, none of which are must-haves or ROADMAP success criteria, and none fixed as of this verification:

- **WR-01**: `destinationForUrl`'s path-prefix tie-break is not segment-boundary aware (`String.prototype.startsWith`), currently dormant (no two catalog entries share a host) but feeds the tool-download capture gate — a future catalog addition sharing a host with the `tool` entry could be misattributed.
- **WR-02**: The browser-tool-download install path passes an empty `thumbnailFetchTargets` array to `importCustomModSource`, silently skipping the adopted-thumbnail fetch the equivalent `import-custom-mods` batch path performs.
- **WR-03**: The address bar's `normalizeUrl` scheme-detection regex (`/^[a-z][a-z0-9+.-]*:/i`) misclassifies a bare `host:port` (e.g. `localhost:8080`) as already-schemed, producing a confusing "not a web address" error for valid input.
- **WR-04**: `browser:resolve-tool-download`'s IPC handler does not runtime-narrow `id`/`accepted` the way the sibling `set-active-destination` handler does.
- **WR-05**: `<userData>/browser-downloads/` is never swept on startup, so an orphaned temp file (including one orphaned by CR-01) persists indefinitely across restarts.

These are recorded for completeness; they do not change the gaps_found status, which rests on CR-01 alone among the must-have-relevant findings.

### Human Verification Required

1 item (see frontmatter `human_verification`): the live confirmation that Pimp My Hideout's `Build VPK` button actually triggers Grimoire's capture path end to end, deferred by explicit user decision in 06-01.

### Gaps Summary

One gap blocks a clean pass: **CR-01**, the tool-download disclosure round trip is subscribed in a page-scoped effect (`src/pages/Browser.tsx`) rather than an app-scoped one, so a download that finishes classifying after the user has navigated away from `/browser` is silently lost — no dialog, no banner, no toast, an orphaned temp file. This is a real, demonstrated (not hypothetical) violation of ROADMAP Success Criterion 3's "the user is told" clause under a specific, plausible timing (the tracer plan's own Task 2 human-verification checklist notes the tool's build step can take real user time, during which nothing stops a user from switching pages), and it directly contradicts `docs/browser-scope-boundary.md`'s own "nothing in between for a user to manage" claim. The fix the code review proposes (move the subscription to `Layout.tsx`, mirroring `onOneClickInstall`/`onMultiVpkPick`) is scoped and small, but it is unbuilt as of this verification (`HEAD` at `cc7fb59`, the review-report commit itself, with no subsequent fix commit).

Separately, ROADMAP Success Criterion 2 (the live tool actually produces a captured file) remains genuinely unverified rather than proven — this is expected and by design (the user explicitly deferred it to UAT), not a defect, and is recorded as a human-verification item rather than a gap.

---

_Verified: 2026-08-07_
_Verifier: Claude (gsd-verifier)_
