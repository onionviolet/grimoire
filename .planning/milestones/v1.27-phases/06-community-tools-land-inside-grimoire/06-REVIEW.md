---
phase: 06-community-tools-land-inside-grimoire
reviewed: 2026-08-08T00:00:00Z
depth: standard
files_reviewed: 24
files_reviewed_list:
  - docs/browser-destinations.md
  - docs/browser-scope-boundary.md
  - electron/main/index.ts
  - electron/main/ipc/browser.test.ts
  - electron/main/ipc/browser.ts
  - electron/main/ipc/mods.toolDownloadImportSeam.test.ts
  - electron/main/ipc/mods.ts
  - electron/main/services/browserContentFilter.permissionFloor.test.ts
  - electron/main/services/browserDownloadCapture.test.ts
  - electron/main/services/browserDownloadCapture.ts
  - electron/main/services/webviewHardening.test.ts
  - electron/main/services/webviewHardening.ts
  - electron/preload/index.ts
  - src/components/Layout.tsx
  - src/lib/browserCatalog.reachability.test.ts
  - src/lib/browserCatalog.test.ts
  - src/lib/browserCatalog.ts
  - src/lib/browserToolDownload.ts
  - src/lib/useBrowserToolDownloadHandoff.test.tsx
  - src/lib/useBrowserToolDownloadHandoff.tsx
  - src/locales/en/translation.json
  - src/locales/manifest.json
  - src/pages/Browser.tsx
  - src/stores/browserToolDownloadStore.ts
  - src/stores/toastStore.ts
  - src/types/electron.ts
findings:
  critical: 0
  warning: 4
  info: 1
  total: 5
status: issues_found
---

# Phase 06: Code Review Report

**Reviewed:** 2026-08-08
**Depth:** standard
**Files Reviewed:** 24
**Status:** issues_found

## Summary

This is the third-pass review of phase 06, specifically verifying plan 06-07's
closure of the prior review's CR-01 and WR-01, and re-checking the previously
carried-forward WR-02/WR-03/WR-04/WR-05/IN-01 items for continued presence.
Both targeted fixes are genuine and both hold up under an adversarial re-read:

- **Prior CR-01 (accepted tool downloads always failed the shared install gate
  because `allocateToolDownloadTempPath` named the captured temp file with a
  `.download` suffix, which `importCustomModSource`'s extension-only gate in
  `electron/main/ipc/mods.ts` rejects before it ever reads a byte) —
  CONFIRMED CLOSED.** `allocateToolDownloadTempPath` (`electron/main/services/
  browserDownloadCapture.ts:117-119`) now allocates `${randomUUID()}.vpk`.
  The stated 06-07 constraint that `electron/main/ipc/mods.ts` and
  `electron/main/services/extract.ts` carry zero source diff actually holds:
  `git diff <prior-review-commit>..HEAD -- electron/main/ipc/mods.ts
  electron/main/services/extract.ts` is empty, so the fix genuinely lives only
  on the naming side, not the gate side. The new
  `electron/main/ipc/mods.toolDownloadImportSeam.test.ts` is a real end-to-end
  regression test, not a mock sandwich: it imports the real
  `importCustomModSource` from `./mods` and the real
  `allocateToolDownloadTempPath` from `../services/browserDownloadCapture`,
  mocks every other `ipc/mods.ts` dependency (30 modules) but deliberately
  leaves `../services/extract` and its transitive `./vpk` import real, and
  asserts three real outcomes: (1) a VPK written at a real-allocator-produced
  path reaches a distinctive "reached allocateEnabledVpkPath" sentinel
  (proving it passed both the extension check and the magic-byte identity
  gate) and does **not** throw the pre-fix file-type sentence; (2) a negative
  control at the old `.download` suffix still reproduces the original
  failure, proving the test would have caught the regression; (3) non-VPK
  bytes at a real-allocator-produced path are still refused by the identity
  gate, not waved through by extension alone. All three assertions, plus the
  full seam/capture/handoff test suites, pass (`pnpm exec vitest run` against
  the seven files touching this seam: 116 passed, 1 platform-skipped).
- **Prior WR-01 (an accept-time install failure — including CR-01's own, or
  "No Deadlock path configured" — was silently swallowed with no toast or
  banner) — CONFIRMED CLOSED.** `useBrowserToolDownloadHandoff.tsx`'s `'ready'`
  branch now captures `resolveToolDownload`'s result (wrapping the call in a
  try/catch so even an IPC-transport rejection cannot escape as an unhandled
  promise rejection inside the void async IIFE), and surfaces exactly the
  intended subset: `if (accepted && !result.ok && !result.stale)`. Traced
  against every reachable shape of `ResolveToolDownloadResult`: decline
  (`accepted` false) never surfaces regardless of the result shape; a stale
  result never surfaces regardless of `accepted`; success never surfaces; an
  accepted-and-failed-and-non-stale result (no Deadlock path, an `install`
  throw, or a rejected IPC promise) surfaces via the same
  `routeRefusalSentence` helper `'refused'` already uses (banner on
  `/browser`, toast elsewhere), reusing the existing "Not added: " prefix
  contract. `useBrowserToolDownloadHandoff.test.tsx`'s new `describe('an
  accept-time resolve failure (WR-01)')` block drives every one of those
  six shapes (on-route/off-route surfacing, stale, decline, a rejected
  promise, and success) and every assertion holds against the real source.

The five items carried forward from the prior review remain genuinely
unchanged in the current code (confirmed by re-reading each cited file/line,
not assumed from the prior report): WR-02 (path-prefix segment boundary),
WR-03 (dropped adopted-thumbnail fetch on the tool-download install path),
WR-04 (address-bar scheme regex misclassifies `host:port`), and WR-05 (IPC
argument under-validation on `browser:resolve-tool-download`) are listed
below as Warnings; IN-01 (unused event id on `'failed'`/`'refused'`) is
listed as Info. None of these were touched by plan 06-07's diff (confirmed
via `git diff`), and per this task's scope they are not blockers for this
phase — they are restated here only so the record does not silently imply
they were re-verified as fixed.

No new Critical or Warning issues were found in the 06-07 diff itself
(`browserDownloadCapture.ts`, its test, `useBrowserToolDownloadHandoff.tsx`,
its test) or in a fresh adversarial pass over the rest of the file list.

## Structural Findings (fallow)

None provided for this review pass.

## Narrative Findings (AI reviewer)

### Warnings

#### WR-02 (carried forward, still open): `destinationForUrl`'s path-prefix match is not segment-boundary aware, and it feeds the tool-download capture gate

**File:** `src/lib/browserCatalog.ts:93-112`

**Issue:** Unchanged since the prior review. The shared-host tie-break rule
matches on raw string prefix (`visited.pathname.startsWith(entry.pathname)`)
with no segment-boundary check, so a future catalog entry declared at, say,
`/pimpmyhideout` would also match a visited path of `/pimpmyhideout2`.
Today's ten-entry catalog has no two entries sharing a host, so this is
dormant, but `Browser.tsx`'s `syncNav` feeds this function's result straight
into `setActiveBrowserDestination`, and `shouldCaptureToolDownload` gates the
tool-download capture grant on the resolved `kind`. A future catalog entry
sharing a host with the existing `tool` entry could have its kind
misattributed by this prefix-only match, silently widening or narrowing the
download-capture grant.

**Fix:** Require a segment boundary after the matched prefix:

```ts
function isPathPrefix(entryPath: string, visitedPath: string): boolean {
    if (!visitedPath.startsWith(entryPath)) return false;
    const boundary = visitedPath[entryPath.length];
    return entryPath.endsWith('/') || boundary === undefined || boundary === '/';
}
```

#### WR-03 (carried forward, still open): Browser-tool-download install path silently drops the adopted-thumbnail fetch that the equivalent import path performs

**File:** `electron/main/ipc/browser.ts:45-52`

**Issue:** Unchanged since the prior review. `defaultResolveDeps.install`
calls `importCustomModSource` with a throwaway empty array:

```ts
install: (args, deadlockPath) =>
    runExclusiveModMutation(() => importCustomModSource(deadlockPath, args, [])),
```

`importCustomModSource` pushes onto whatever array it is given whenever the
just-imported file's embedded adoption metadata reveals a `gameBananaId` with
no thumbnail; the `'import-custom-mods'` batch handler collects this array
and fires `fireAdoptedThumbnailFetches` on it afterward, but the
browser-tool-download path discards the array (`[]`) the moment the call
returns, so that fetch never happens for a tool-captured mod.

**Fix:** Thread a real array through and call `fireAdoptedThumbnailFetches`
on it after `deps.install` resolves, or explicitly document that
browser-tool-download installs intentionally skip adopted-thumbnail
fetching.

#### WR-04 (carried forward, still open): Address bar `normalizeUrl` misclassifies a bare `host:port` as an existing URI scheme

**File:** `src/pages/Browser.tsx:44-58`

**Issue:** Unchanged since the prior review.

```ts
const candidate = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
```

matches any `letter-then-alnum/+.-` run followed by a colon, including a bare
hostname with a port, e.g. `localhost:8080`. That input is treated as
"already has a scheme," `new URL('localhost:8080')` parses with
`protocol === 'localhost:'`, fails the http/https check, and the user sees
"That does not look like a web address" for an input that plainly is one.

**Fix:**

```ts
const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
```

#### WR-05 (carried forward, still open): `browser:resolve-tool-download` / `browser:set-active-destination` under-validate their non-`kind` arguments

**File:** `electron/main/ipc/browser.ts:20-33, 87-91`

**Issue:** Unchanged since the prior review. `browser:set-active-destination`
type-checks `kind` against `VALID_KINDS` but only shallow-`typeof`-checks
`origin`/`label`. `browser:resolve-tool-download`'s handler takes `id:
string, accepted: boolean` straight from the renderer with no runtime
narrowing at all:

```ts
ipcMain.handle(
    'browser:resolve-tool-download',
    (_event, id: string, accepted: boolean): Promise<ResolveToolDownloadResult> =>
        resolvePendingToolDownload(id, accepted)
);
```

Low practical risk today (the only caller is `browserToolDownload.ts`'s typed
wrapper), but it is an inconsistency with the defensive posture the same file
applies one function up.

**Fix:** Apply the same `typeof` narrowing used in `set-active-destination`
to `id`/`accepted` before calling `resolvePendingToolDownload`.

### Info

#### IN-01 (carried forward, still open): `BrowserToolDownloadEvent.id` is generated but semantically unused for `'failed'`/`'refused'`

**File:** `electron/main/services/browserDownloadCapture.ts:321, 331`

**Issue:** Unchanged since the prior review.

```ts
pushToolDownloadEvent({ status: 'failed', id: randomUUID() });
...
pushToolDownloadEvent({ status: 'refused', id: randomUUID(), reason: classification.reason });
```

Neither id is ever correlated with a pending-map entry (none exists yet at
either push site) or read by the renderer
(`useBrowserToolDownloadHandoff.tsx`'s `'refused'`/`'failed'` branches never
reference `event.id`). `id` is a required field on the type, so it reads as
load-bearing when it is filler for these two statuses.

**Fix:** Either make `id` optional on the `'failed'`/`'refused'` variants (a
`status`-discriminated union), or add a short comment at each call site
noting the id is unused for these statuses.

---

_Reviewed: 2026-08-08_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
