---
phase: 06-community-tools-land-inside-grimoire
reviewed: 2026-08-07T00:00:00Z
depth: standard
files_reviewed: 24
files_reviewed_list:
  - docs/browser-destinations.md
  - docs/browser-scope-boundary.md
  - electron/main/index.ts
  - electron/main/ipc/browser.test.ts
  - electron/main/ipc/browser.ts
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
  critical: 1
  warning: 5
  info: 1
  total: 7
status: issues_found
---

# Phase 06: Code Review Report

**Reviewed:** 2026-08-07
**Depth:** standard
**Files Reviewed:** 24
**Status:** issues_found

## Summary

This is a re-review of the full phase-06 file union (all six plans, including
the 06-06 gap-closure plan) against the prior `06-REVIEW.md`. Two specific
prior findings were checked for real closure, not just "new code exists":

- **Prior CR-01 (disclosure subscriber was page-scoped, dropped on
  navigation) — CONFIRMED CLOSED.** `useBrowserToolDownloadHandoff` now lives
  in `src/lib/useBrowserToolDownloadHandoff.tsx` and is called exactly once
  from `src/components/Layout.tsx` (not `Browser.tsx`). It reads the current
  route through a ref (`pathnameRef`) rather than resubscribing on navigation,
  so the effect's dependency array (`[confirm, t]`) never changes across a
  route change. `useBrowserToolDownloadHandoff.test.tsx` drives a real
  `MemoryRouter` navigation away from `/browser` mid-flow and asserts (a) the
  subscription is not re-established (`subscribeSpy` called once) and (b) a
  `'ready'` event pushed after the navigation still reaches the confirm
  dialog. This is genuine regression coverage, not just presence of new code.
- **Prior WR-05 (no sweep for orphaned browser-download temp files) —
  CONFIRMED CLOSED.** `sweepToolDownloadTempRoot` is invoked from
  `app.whenReady()` in `electron/main/index.ts:540`, before `createWindow()`
  and before any webview can attach a download-capture session, and only
  deletes plain files (`dirent.isFile()`) that are absent from the live
  pending-map protected set, never recursing and never touching a directory
  or symlink. `browserDownloadCapture.test.ts`'s `sweepToolDownloadTempRoot
  (WR-05)` block exercises the missing-root, empty-root, multi-file,
  double-sweep, subdirectory-survival, explicit-protected-path, live-pending-
  path, unlink-failure, and (platform-permitting) symlink-survival cases.

Both fixes are real and the associated tests exercise the actual regression,
not a superficial rename.

However, tracing the accept path of the tool-download capture feature itself
end-to-end (the flagship capability this phase adds) into
`electron/main/ipc/mods.ts` surfaces a new blocker that was not present (or
not previously found) in the prior review: the temp file the capture path
allocates can never pass the shared import function's own file-type gate, so
accepting a captured download always fails, silently, from the user's point
of view. Several Warning/Info items from the prior review (path-prefix
matching, the dropped adopted-thumbnail fetch, the address-bar scheme regex,
IPC argument under-validation, and the unused event id) remain open in the
current code and are carried forward below with their current line numbers.

## Narrative Findings (AI reviewer)

### Critical Issues

#### CR-01: Accepting a captured browser-tool download always throws "Selected file is not a .vpk or supported archive"

**File:** `electron/main/services/browserDownloadCapture.ts:98-100` and `electron/main/ipc/mods.ts:1279-1284`

**Issue:** `allocateToolDownloadTempPath` always names the captured temp file
`${randomUUID()}.download`:

```ts
// electron/main/services/browserDownloadCapture.ts:98-100
export function allocateToolDownloadTempPath(root: string, _suggestedFilename: string): string {
    return join(root, `${randomUUID()}.download`);
}
```

`resolvePendingToolDownload` (`electron/main/ipc/browser.ts:64-85`) passes
that exact path through as `vpkPath` on accept:

```ts
await deps.install({ vpkPath: entry.tempPath, name: entry.displayName, nsfw: false }, deadlockPath);
```

`importCustomModSource`, the shared install function this reaches (the same
one drag-drop/custom-import use), gates purely on file extension before it
ever inspects file contents:

```ts
// electron/main/ipc/mods.ts:1279-1284
const lower = vpkPath.toLowerCase();
const isVpk = lower.endsWith('.vpk');
if (!isVpk && !isArchive(vpkPath)) {
    throw new Error('Selected file is not a .vpk or supported archive (.zip, .7z, .rar)');
}
```

`isArchive` (`electron/main/services/extract.ts:56-59`) is likewise
extension-only (`.zip`/`.7z`/`.rar`). A path ending in `.download` satisfies
neither check, so this throws immediately — before `resolveInstallableVpk`
(the function that actually sniffs magic bytes) is ever called. Every
accepted tool download therefore throws inside `importCustomModSource`, is
caught by `resolvePendingToolDownload`'s `try/catch`, and resolves to
`{ ok: false, error: 'Selected file is not a .vpk or supported archive (.zip, .7z, .rar)' }`
— even though `classifyToolDownload` (which does read magic bytes, via
`checkVpkFile`) already proved the file is a real, valid VPK before the
`'ready'` disclosure was ever shown to the user. The install is guaranteed to
fail for every accepted download, on every platform, through every code path
that reaches this line.

This slipped through the existing tests because
`electron/main/ipc/browser.test.ts` mocks `./mods`'s `importCustomModSource`
entirely (`vi.mock('./mods', () => ({ importCustomModSource: vi.fn() }))`),
and `browserDownloadCapture.test.ts` never calls the real install function —
so the seam between the capture path's temp-file naming and the shared
import function's extension gate is never exercised end-to-end by any test.

**Fix:** Give the allocated temp path a `.vpk` extension — the only content
`classifyToolDownload` ever lets reach `state.pending`, so this is a
lossless rename, not a format change:

```ts
export function allocateToolDownloadTempPath(root: string, _suggestedFilename: string): string {
    return join(root, `${randomUUID()}.vpk`);
}
```

Update the JSDoc/tests that currently assert a `.download` suffix
accordingly, and add an integration-style test that calls the *real*
`importCustomModSource` (not a mock) against a path shaped like this
function's output, so this seam cannot regress silently again.

### Warnings

#### WR-01: An accept-time failure (including CR-01's, or "No Deadlock path configured") is silently swallowed in the renderer

**File:** `src/lib/useBrowserToolDownloadHandoff.tsx:96`

**Issue:** The confirm-and-resolve continuation ignores the result of
`resolveToolDownload`:

```ts
if (staleDownloadIdsRef.current.delete(event.id)) return;
await resolveToolDownload(event.id, accepted);
```

`ResolveToolDownloadResult` (`src/types/electron.ts:361-367`) carries `ok`,
`stale?`, and `error?`, and `resolvePendingToolDownload` populates `error` on
every failure branch (no configured Deadlock path, an install throw, or — per
CR-01 above — the extension-gate throw). None of it reaches the user: no
toast, no banner update. The confirm dialog closes, the temp file is deleted
(the `finally` in `resolvePendingToolDownload` always runs regardless of
outcome), and nothing else visibly happens — from the user's point of view
the mod they just confirmed simply never appears, with no explanation. This
contradicts the same file's own documented intent for the will-download-time
refusal ("D-10: a refusal is loud and visible, never a silent drop"), which
is honored for `'refused'` but not for this resolve-time failure path. It is
also a large part of why CR-01 is hard to notice in manual testing: an accept
looks like a no-op rather than a loud, attributable failure.

**Fix:** Surface a failed, non-stale result the same way `'refused'` is
surfaced (banner on `/browser`, toast elsewhere):

```ts
const result = await resolveToolDownload(event.id, accepted);
if (accepted && !result.ok && !result.stale) {
    const sentence = `${t('browser.toolDownload.refusedPrefix', 'Not added: ')}${result.error ?? ''}`;
    if (isBrowserRoute(pathnameRef.current)) {
        setBrowserToolDownloadRefusal(sentence);
    } else {
        showToast(sentence, { tone: 'error', duration: 9000 });
    }
}
```

#### WR-02 (carried forward, still open): `destinationForUrl`'s path-prefix match is not segment-boundary aware, and it feeds the tool-download capture gate

**File:** `src/lib/browserCatalog.ts:93-112`

**Issue:** Unchanged since the prior review. The shared-host tie-break rule
matches on raw string prefix:

```ts
if (!visited.pathname.startsWith(entry.pathname)) continue;
```

with no segment-boundary check, so a catalog entry declared at
`/pimpmyhideout` would also match a visited path of `/pimpmyhideout2`. Today's
ten-entry catalog has no two entries sharing a host, so this is dormant, but
`Browser.tsx`'s `syncNav` feeds this function's result straight into
`setActiveBrowserDestination`, and `shouldCaptureToolDownload` gates the
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

**File:** `electron/main/services/browserDownloadCapture.ts:302, 312`

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

_Reviewed: 2026-08-07_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
