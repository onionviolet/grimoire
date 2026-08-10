---
phase: 06-community-tools-land-inside-grimoire
plan: 01
subsystem: browser
tags: [electron, will-download, downloaditem, ipc, vpk, react, i18n]

# Dependency graph
requires: []
provides:
  - "src/lib/browserCatalog.ts: frozen, kind-typed browser destination catalog (mod-host/reference/tool/community-feed)"
  - "electron/main/services/browserDownloadCapture.ts: will-download capture for kind='tool' destinations via DownloadItem.setSavePath"
  - "electron/main/ipc/browser.ts: browser:set-active-destination / browser:resolve-tool-download IPC surface"
  - "src/lib/browserToolDownload.ts: renderer-side wrappers for the tool-download round trip"
affects: [06-02, 06-03, 06-04]

# Actuals (#2632)
actuals:
  tokens: 12000
  tasks: 2
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Session-scoped mutable state + attach(session) entry point, mirrored from browserContentFilter.ts's attachBrowserFilter shape"
    - "Main-initiated confirm round trip: main pushes a pending-download event, renderer resolves via useConfirm and invokes back"
    - "Active-destination-kind derived from the live URL on every nav event, not from the last shortcut clicked"

key-files:
  created:
    - src/lib/browserCatalog.ts
    - src/lib/browserCatalog.test.ts
    - src/lib/browserToolDownload.ts
    - electron/main/services/browserDownloadCapture.ts
    - electron/main/services/browserDownloadCapture.test.ts
    - electron/main/ipc/browser.ts
  modified:
    - electron/main/index.ts
    - electron/main/ipc/mods.ts
    - electron/preload/index.ts
    - src/types/electron.ts
    - src/pages/Browser.tsx
    - src/locales/en/translation.json
    - src/locales/manifest.json

key-decisions:
  - "DownloadItem has no getWebContents() in Electron 35; will-download's third callback argument (webContents) is the correct source for the guest's live URL (Rule 1 API correction, not a design change)"
  - "importCustomModSource exported from ipc/mods.ts (one-word diff) so ipc/browser.ts reuses the exact install path rather than a second import function"
  - "Task 2's live human-verification step is DEFERRED, not completed or failed — see Deviations"

patterns-established:
  - "Pattern: capture-vs-handoff gate keyed on a renderer-pushed (kind, origin) pair, re-validated per download against the guest's live top-level URL origin, so an in-tool redirect can never inherit a capture grant"

requirements-completed: [REQ-browser-tool-catalog]

coverage:
  - id: D1
    description: "Browser destination catalog: SHORTCUTS replaced by a frozen, kind-typed BROWSER_DESTINATIONS with all 10 entries reviewed and a Pimp My Hideout tool entry added"
    requirement: "REQ-browser-tool-catalog"
    verification:
      - kind: unit
        ref: "src/lib/browserCatalog.test.ts (14 tests)"
        status: pass
      - kind: unit
        ref: "pnpm typecheck / pnpm lint / pnpm i18n:check / pnpm encoding:check"
        status: pass
    human_judgment: false
  - id: D2
    description: "will-download capture, checkVpkFile identity gate, useConfirm disclosure, and import-custom-mods install path for a kind='tool' destination's download (code path built and unit-tested)"
    requirement: "REQ-browser-produced-file-handoff"
    verification:
      - kind: unit
        ref: "electron/main/services/browserDownloadCapture.test.ts (14 tests: shouldCaptureToolDownload, allocateToolDownloadTempPath, displayNameForDownload, classifyToolDownload, attachBrowserDownloadCapture idempotency)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The real Pimp My Hideout tool's Build VPK button actually lands a file in Grimoire's mod library end to end (Task 2's checkpoint)"
    requirement: "REQ-browser-produced-file-handoff"
    verification: []
    human_judgment: true
    rationale: "Requires a human driving the real external tool inside a live dev build and observing the confirm dialog / Installed-page result. Two automated CDP attempts by the orchestrator were inconsistent and inconclusive (a 5+ minute hang with no visible dialog, then a click that returned immediately with zero network/console activity) and did not reach Grimoire's useConfirm dialog. The user chose to defer this check to manual/UAT verification rather than continue automating it. Nothing was proven broken; the mechanism is unverified, not failed."

duration: ~50min (approximate — explicit start timestamp not captured this session)
completed: 2026-08-07
status: complete
---

# Phase 06 Plan 01: Browser Tool-Download Capture Summary

**A `kind: 'tool'` browser destination's download is redirected by `DownloadItem.setSavePath()` into Grimoire's own temp directory, identity-gated by `checkVpkFile`, disclosed via `useConfirm`, and installed through the existing `import-custom-mods` path — implemented and unit-tested end to end; live confirmation against the real Pimp My Hideout tool is deferred to human/UAT verification.**

## Performance

- **Duration:** ~50 min (approximate)
- **Completed:** 2026-08-07T16:47:37-05:00
- **Tasks:** 2 (Task 1 complete and verified; Task 2 implementation-complete, live verification deferred)
- **Files modified:** 13

## Accomplishments

- `src/lib/browserCatalog.ts`: the flat `SHORTCUTS` array in `Browser.tsx` is now a frozen, 10-entry catalog with a required `kind` on every entry (`mod-host` / `reference` / `tool` / `community-feed`), plus `destinationForUrl`/`destinationKindForUrl` with host+longest-path-prefix matching and a new `Pimp My Hideout` (`kind: 'tool'`) entry.
- `electron/main/services/browserDownloadCapture.ts`: `will-download` capture for `kind: 'tool'` destinations — `item.setSavePath()` is the literal first synchronous statement of the tool branch, gated by an origin-matching predicate (`shouldCaptureToolDownload`) so a redirect away from a tool page cannot inherit its capture grant. Every non-tool destination keeps today's unconditional `preventDefault()` + `openExternalSafe()` exactly as before.
- `electron/main/ipc/browser.ts`: `browser:set-active-destination` push handler and `browser:resolve-tool-download` round trip, routing an accepted download through the existing `importCustomModSource` install path — no bespoke import logic, no file copy or metadata write of its own.
- `src/pages/Browser.tsx`: pushes the derived destination kind/origin to main on every nav event (mount, `did-navigate`, `did-navigate-in-page`, and unmount cleanup), and shows the `useConfirm` disclosure on a `ready` event or an error-tone toast on `refused`.
- `will-attach-webview` in `electron/main/index.ts` is byte-for-byte unchanged (verified via `git diff`); only the `will-download` block inside `did-attach-webview` was replaced with `attachBrowserDownloadCapture(guest.session)`.

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end tool download, one path only** - `4d24946` (feat)
2. **Task 2: Confirm the real tool's Build VPK lands in Grimoire** - not a code task; a `checkpoint:human-verify` gate. No separate commit — see Deviations below for its disposition.

**Plan metadata:** committed alongside this SUMMARY (worktree mode; STATE.md/ROADMAP.md excluded, owned centrally by the orchestrator).

## Files Created/Modified

- `src/lib/browserCatalog.ts` - Frozen `BROWSER_DESTINATIONS` catalog, `KIND_ORDER`, `HOME_DESTINATION_URL`, `destinationForUrl`/`destinationKindForUrl`
- `src/lib/browserCatalog.test.ts` - 14 tests: empty/malformed/unlisted URL, all 10 entries, deep-path resolution, shared-host tie-break, `www.` normalization, frozen check
- `src/lib/browserToolDownload.ts` - Thin renderer-side pass-throughs (`onBrowserToolDownload`, `resolveToolDownload`, `setActiveBrowserDestination`)
- `electron/main/services/browserDownloadCapture.ts` - `will-download` capture service: state, `shouldCaptureToolDownload`, temp-path allocation, `classifyToolDownload`, `attachBrowserDownloadCapture`
- `electron/main/services/browserDownloadCapture.test.ts` - 14 tests: origin-gate predicate, temp-path allocation/collision, display-name fallback, VPK classification against real fixture bytes, attach idempotency
- `electron/main/ipc/browser.ts` - `browser:set-active-destination` / `browser:resolve-tool-download` handlers
- `electron/main/index.ts` - Exports `openExternalSafe`; wires `attachBrowserDownloadCapture` into `did-attach-webview`; adds `import './ipc/browser'`
- `electron/main/ipc/mods.ts` - `importCustomModSource` exported (one-word diff) for reuse by `ipc/browser.ts`
- `electron/preload/index.ts` - Exposes `onBrowserToolDownload`, `resolveToolDownload`, `setActiveBrowserDestination`
- `src/types/electron.ts` - `BrowserToolDownloadStatus`, `BrowserToolDownloadEvent`, `ResolveToolDownloadResult` types + `ElectronAPI` methods
- `src/pages/Browser.tsx` - Catalog-driven shortcuts, active-destination push, tool-download disclosure/refusal handling
- `src/locales/en/translation.json` / `src/locales/manifest.json` - `browser.toolDownload.*` keys (title, message, confirm, cancel, fallbackName, refusedPrefix)

## Decisions Made

- `DownloadItem` has no `getWebContents()` method in Electron 35.7.5 (the version this app ships); `will-download`'s listener signature is `(event, item, webContents)`, so the guest's live URL is read from the third callback argument instead. Functionally identical to what RESEARCH.md intended, just the correct API surface.
- `importCustomModSource` in `electron/main/ipc/mods.ts` was exported (previously module-private) so `ipc/browser.ts` reuses the exact same install path as drag-drop and custom import, rather than writing a second import function.
- Task 2's live human-verification step is closed out as **deferred**, not passed or failed (see Deviations).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `DownloadItem.getWebContents()` does not exist in Electron 35**
- **Found during:** Task 1, while implementing `browserDownloadCapture.ts`'s live-URL read
- **Issue:** RESEARCH.md's code sketch assumed `item.getWebContents()?.getURL()`. `pnpm typecheck` failed: `Property 'getWebContents' does not exist on type 'DownloadItem'.`
- **Fix:** Read the guest's live URL from `will-download`'s third callback argument (`webContents`) instead, which Electron's type defs confirm is the actual signature (`(event, item, webContents) => void`). Behavior is identical to what was intended.
- **Files modified:** `electron/main/services/browserDownloadCapture.ts`
- **Verification:** `pnpm typecheck` passes; `shouldCaptureToolDownload`/`attachBrowserDownloadCapture` unit tests pass
- **Committed in:** `4d24946` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - API correction)
**Impact on plan:** No scope creep; the fix makes the implementation match the intended behavior against the Electron version actually installed.

### Task 2: Live Verification (Deferred, not passed or failed)

Task 2 is a `checkpoint:human-verify` gate asking a human to drive the real `https://xkitkatcat.github.io/pimpmyhideout/` page inside a running Grimoire dev build, click its `Build VPK` button, and confirm three things: (a) a confirm dialog appears naming the captured file, (b) choosing "Add to library" installs it as an ordinary third-party mod with no Foundry tray/My-changes entry, and (c) a real GameBanana download link still opens externally, unaffected.

**This was not completed.** The orchestrator made a good-faith automated attempt to drive the real tool via direct CDP attachment to its `<webview>` guest target:
- First attempt: the app hung for 5+ minutes at 0% CPU with no dialog visible anywhere.
- Second attempt (after reload): the Build VPK click returned immediately with zero network activity and zero console output.

Neither run reached Grimoire's `useConfirm` dialog. The orchestrator separately confirmed (by inspecting the tool's own JS bundle) that Pimp My Hideout uses the ordinary `Blob` + `<a download>` pattern, not the File System Access API — so RESEARCH.md's Pitfall 1 (the one documented failure mode that would explain a silently-inert click) does not apply, and the hang's root cause remains unexplained. The user was consulted and chose to defer this specific check to manual/UAT verification rather than keep automating it against an external, third-party site outside Grimoire's control.

**Status: genuinely unverified — not proven broken, not proven working.** The code path it would exercise (`will-download` capture → `setSavePath` → `checkVpkFile` → `useConfirm` → `import-custom-mods`) is the exact path Task 1 built and unit-tested; what remains unconfirmed is specifically whether Pimp My Hideout's live page triggers `will-download` the way RESEARCH.md's evidence (Electron docs, two corroborating GitHub issues, and this codebase's own pre-existing working handler on the identical session/attach pattern) predicts.

**Open item for a human to close out**, using the exact steps already given in the plan:
1. `GRIMOIRE_DEV_SLOT=3 GRIMOIRE_DEV_NO_BACKGROUNDING=1 pnpm dev`
2. `GRIMOIRE_DEV_SLOT=3 node scripts/dev-driver.mjs route browser`
3. Click the `Pimp My Hideout` shortcut, build something, click `Build VPK`
4. Confirm the `useConfirm` dialog appears naming the file, choosing "Add to library" lands it on Installed as an ordinary mod, and a real GameBanana download link still opens externally with no dialog

## Issues Encountered

None beyond the deferred Task 2 checkpoint documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The catalog, capture service, IPC round trip, and disclosure UI are all in place and unit-tested; plans 06-02 through 06-04 (kind-grouped rendering, in-flight/replaced toasts, the `will-attach-webview` regression test) can build on this without re-deriving the mechanism.
- **Blocker/concern carried forward:** Task 2's live confirmation against the real Pimp My Hideout tool is still open. Until a human runs the steps above and reports back, D-13's mechanism is proven only by strong circumstantial evidence (RESEARCH.md), not by direct observation of this specific external tool.

---
*Phase: 06-community-tools-land-inside-grimoire*
*Completed: 2026-08-07*

## Self-Check: PASSED

- FOUND: `src/lib/browserCatalog.ts`
- FOUND: `src/lib/browserCatalog.test.ts`
- FOUND: `src/lib/browserToolDownload.ts`
- FOUND: `electron/main/services/browserDownloadCapture.ts`
- FOUND: `electron/main/services/browserDownloadCapture.test.ts`
- FOUND: `electron/main/ipc/browser.ts`
- FOUND: commit `4d24946`

This PASSED verdict covers Task 1's built and automated-tested code only (unit tests, `pnpm typecheck`, `pnpm lint`, `pnpm i18n:check`, `pnpm encoding:check`, and the full suite — all green). It does **not** cover Task 2: the live confirmation that the real Pimp My Hideout tool's Build VPK button lands a file in Grimoire is explicitly **pending human verification**, not claimed as passed — see "Task 2: Live Verification (Deferred, not passed or failed)" above.
