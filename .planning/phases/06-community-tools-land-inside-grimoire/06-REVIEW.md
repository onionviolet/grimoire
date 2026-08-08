---
phase: 06-community-tools-land-inside-grimoire
reviewed: 2026-08-07T00:00:00Z
depth: standard
files_reviewed: 20
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
  - src/lib/browserCatalog.reachability.test.ts
  - src/lib/browserCatalog.test.ts
  - src/lib/browserCatalog.ts
  - src/lib/browserToolDownload.ts
  - src/locales/en/translation.json
  - src/locales/manifest.json
  - src/pages/Browser.tsx
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

**Reviewed:** 2026-08-07T00:00:00Z
**Depth:** standard
**Files Reviewed:** 20
**Status:** issues_found

## Summary

This phase adds the in-app browser's tool-download capture/disclosure round
trip (`will-download` capture, temp-file classification against the VPK
identity gate, a confirm-then-install handoff into the existing custom-mod
import path) plus the guest-webview hardening it depends on
(`webviewHardening.ts`), and refactors that hardening + a prior "always open
externally" download handler out of `electron/main/index.ts` into two
testable services. The hardening module, the pending-download confused-deputy
protections (`takePendingToolDownload`/`replacePending`), and the origin
re-check in `shouldCaptureToolDownload` are all sound and well covered by
their unit tests, which genuinely exercise the invariants the code comments
claim (single-pending eviction, stale-id resolution, VPK-only capture, the
nine webview-hardening invariants, the permission floor).

The most significant problem is architectural: the confirm/disclosure round
trip that this phase's own docs describe as having "nothing in between for a
user to manage" is wired to a page-scoped React effect (`Browser.tsx`) rather
than an app-scoped one (the pattern the rest of the codebase already uses for
equivalent flows, e.g. `onOneClickInstall`/`onMultiVpkPick` in `Layout.tsx`).
Navigating away from the Browser route while a capture is in flight tears
down the only subscriber to `onBrowserToolDownload`, so a download that
reaches classification after that point is silently lost: no confirm dialog,
no refusal banner, no toast, and an orphaned temp file with no cleanup path.
The remaining findings are smaller correctness/consistency gaps: a
non-segment-aware path-prefix match that is currently dormant but is wired
into the same-origin capture gate, a dropped best-effort side effect on the
browser-tool install path, an address-bar regex misclassification, and no
startup sweep of the temp download directory.

## Critical Issues

### CR-01: Tool-download disclosure is lost if the user navigates away from the Browser page while a capture is in flight

**File:** `src/pages/Browser.tsx:205-281`

**Issue:** The entire tool-download disclosure round trip — the confirm
dialog for `'ready'`, the danger-tone banner for `'refused'`, the toast for
`'failed'`, and the stale-id bookkeping for `'replaced'` — is handled by a
`useEffect` inside the `Browser` page component, which subscribes via
`onBrowserToolDownload` and unsubscribes on unmount:

```tsx
useEffect(() => {
    return onBrowserToolDownload((event) => {
        // ...'started' / 'ready' (confirm) / 'refused' / 'failed' / 'replaced'
    });
}, [confirm, t]);
```

`Browser` is a child route rendered under the persistent `Layout` (see
`src/App.tsx`), so navigating to any other page (Installed, Locker, Settings,
...) unmounts it and removes this listener. The capture pipeline itself lives
at session scope in the main process
(`electron/main/services/browserDownloadCapture.ts`,
`attachBrowserDownloadCapture`) and is independent of whether the Browser
page is mounted — `will-download` fires on the guest session regardless.

If a captured download's classification (`classifyToolDownload`, run inside
the `DownloadItem`'s `'done'` handler) completes *after* the user has
navigated away from `/browser`, main process pushes `'ready'` (or
`'refused'`/`'failed'`) over `browser:tool-download`, but nothing is listening
any more. The event is not replayed when the user later returns to the page
(`ipcRenderer.on` is a plain event emitter; there is no queue or "last
event" replay). Concretely, for the `'ready'` case:

- The confirm dialog required before anything is added to the mod library
  (D-08/D-09) never appears.
- The entry stays in `browserDownloadCapture.ts`'s `state.pending` map,
  and its temp file stays on disk under
  `<userData>/browser-downloads/<uuid>.download`, until either another tool
  download supersedes it (`replacePending` evicts and deletes it) or the app
  restarts (the map is in-memory only, so a restart drops the reference but
  — see WR-05 below — nothing on startup deletes the orphaned file either).

This directly contradicts what this phase's own scope document asserts is
the invariant: `docs/browser-scope-boundary.md` states a captured download
"is either handed to the mod library after an explicit confirmation... or...
handed to the system browser. There is nothing in between for a user to
manage." A download stuck in the pending map with a lost disclosure is
exactly the missing "in between" state that document says does not exist.

Contrast with the codebase's own established pattern for equivalent
confirm-required async flows: `onOneClickInstall` and `onMultiVpkPick` are
both subscribed in `src/components/Layout.tsx` (the persistent route
wrapper), not in a page component, specifically so they survive navigation.

**Fix:** Move the `onBrowserToolDownload` subscription (and the toast/confirm
handling it drives) out of `Browser.tsx` and into `Layout.tsx` (or another
component that stays mounted for the app's lifetime), mirroring how
`onOneClickInstall`/`onMultiVpkPick` are already wired. The `useConfirm()`
hook and `showToast`/`dismissToast` helpers are already usable from
`Layout.tsx`'s tree, so this requires no new dependency — just relocating the
effect (and the two refs it uses) to a component that isn't torn down when
the user leaves `/browser`.

## Warnings

### WR-01: `destinationForUrl`'s path-prefix match is not segment-boundary aware, and it feeds the tool-download capture gate

**File:** `src/lib/browserCatalog.ts:93-112`

**Issue:** The tie-break rule for two catalog entries sharing a host picks
the entry whose `pathname` is "the longest prefix" of the visited pathname,
implemented with a raw `String.prototype.startsWith()`:

```ts
if (!visited.pathname.startsWith(entry.pathname)) continue;
```

This has no segment-boundary check, so a catalog entry declared at
`/pimpmyhideout` would also match a visited path of `/pimpmyhideout2` or
`/pimpmyhideoutV2-beta` — different pages that merely share the literal
string prefix, not a real sub-path. Today's ten-entry catalog has no two
entries on the same host, so this is dormant. But it is not just a display
concern: `Browser.tsx`'s `syncNav` calls `destinationForUrl(url)` and pushes
the resolved `kind`/`label` via `setActiveBrowserDestination`, and
`shouldCaptureToolDownload` (`browserDownloadCapture.ts`) gates capture on
`active.kind === 'tool'`. A future catalog addition that shares a host with
the existing `tool`-kind entry (e.g. a second `xkitkatcat.github.io/...`
page, or any future `tool` entry sharing a host with a `reference`/
`community-feed` entry) could have its `kind` misattributed by this
prefix-only match, silently widening or narrowing the download-capture
grant for pages the user did not actually navigate to.

**Fix:** Match on path segments, not raw string prefix, e.g. require the
next character after the matched prefix to be `/`, the end of string, or
absent:

```ts
function isPathPrefix(entryPath: string, visitedPath: string): boolean {
    if (!visitedPath.startsWith(entryPath)) return false;
    const boundary = visitedPath[entryPath.length];
    return entryPath.endsWith('/') || boundary === undefined || boundary === '/';
}
```

### WR-02: Browser-tool-download install path silently drops the adopted-thumbnail fetch that the equivalent import path performs

**File:** `electron/main/ipc/browser.ts:45-52`

**Issue:** `defaultResolveDeps.install` calls `importCustomModSource` with an
empty, throwaway array for `thumbnailFetchTargets`:

```ts
install: (args, deadlockPath) =>
    runExclusiveModMutation(() => importCustomModSource(deadlockPath, args, [])),
```

`importCustomModSource` (`electron/main/ipc/mods.ts`) pushes onto whatever
array it's given whenever the just-imported file's embedded Grimoire
adoption metadata reveals a `gameBananaId` with no thumbnail. The
`'import-custom-mods'` batch handler collects this same array and fires
`fireAdoptedThumbnailFetches(thumbnailFetchTargets)` after the batch
completes; the browser-tool-download path never does, because the literal
`[]` passed here is discarded once the call returns. The comment on
`resolvePendingToolDownload` claims the accepted branch "reaches the mod
library only through this shared entry point, identical to drag-drop and
custom import" — that's true for the copy/metadata/imprint-flag side of
`importCustomModSource`, but not for this one queued side effect.

**Fix:** Either thread a real (even if immediately-fired) array through and
call `fireAdoptedThumbnailFetches` on it after `deps.install` resolves, or
document explicitly that browser-tool-download installs intentionally skip
adopted-thumbnail fetching (and why) rather than silently no-op-ing via a
discarded array.

### WR-03: Address bar `normalizeUrl` misclassifies a bare `host:port` as an existing URI scheme

**File:** `src/pages/Browser.tsx:44-58`

**Issue:**

```ts
function normalizeUrl(input: string): string | null {
    const raw = input.trim();
    if (!raw) return null;
    const candidate = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
    try {
        const parsed = new URL(candidate);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
        return parsed.href;
    } catch {
        return null;
    }
}
```

The scheme-detection regex `/^[a-z][a-z0-9+.-]*:/i` matches any
`letter-then-alnum/+.-` run followed by a colon — which also matches a bare
hostname with an explicit port, e.g. `localhost:8080` or
`mywiki.example:8443`. Typing either into the address bar is treated as
"already has a scheme," so `new URL('localhost:8080')` is parsed with
`protocol === 'localhost:'`, fails the http/https check, and the user gets
"That does not look like a web address" for an input that plainly is one.

**Fix:** Only treat `raw` as already-schemed when the part before the colon
is a *known* scheme (`http`/`https`), or check for `://` rather than a bare
`:` before deciding not to prepend `https://`:

```ts
const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
```
(This also naturally rejects `javascript:`/other non-http schemes into the
`https://javascript:alert(1)` bucket, which then fails to parse as a sane
host and is rejected anyway — no regression versus the current explicit
protocol check.)

### WR-04: `browser:resolve-tool-download` / `browser:set-active-destination` under-validate their non-`kind` arguments

**File:** `electron/main/ipc/browser.ts:20-33`, `87-91`

**Issue:** `browser:set-active-destination` type-checks `kind` against
`VALID_KINDS` but only shallow-`typeof`-checks `origin`/`label` as strings
(any string is accepted, including garbage that doesn't parse as an origin).
`browser:resolve-tool-download`'s handler takes `id: string, accepted:
boolean` straight from the renderer with no runtime narrowing at all:

```ts
ipcMain.handle(
    'browser:resolve-tool-download',
    (_event, id: string, accepted: boolean): Promise<ResolveToolDownloadResult> =>
        resolvePendingToolDownload(id, accepted)
);
```

If a non-string `id` or non-boolean `accepted` ever reaches this handler
(e.g. from a future caller, or a renderer-side type error that TypeScript
doesn't catch across the IPC boundary at runtime), `takePendingToolDownload`
does a `Map.get(id)` with a non-string key (always misses, harmless) but
`!accepted` on a non-boolean falls through to JS truthiness rather than
failing loudly. Low practical risk today (the only caller is
`browserToolDownload.ts`'s typed wrapper), but it's an inconsistency with the
defensive posture the same file applies one function up
(`isValidKind`/`typeof origin === 'string'`).

**Fix:** Apply the same `typeof` narrowing used in the `set-active-destination`
handler to `id`/`accepted` before calling `resolvePendingToolDownload`.

### WR-05: `browser-downloads` temp directory is never swept on startup

**File:** `electron/main/services/browserDownloadCapture.ts:86-92`, `247-256`

**Issue:** `toolDownloadTempRoot`/`attachBrowserDownloadCapture` create
`<userData>/browser-downloads/` on first attach but nothing ever removes
stale contents from it. Every path that normally clears an entry
(`deleteTempFileQuietly` on refuse/decline/accept/replace) only runs for
downloads whose lifecycle actually completes while the app is running. A
temp file left behind by an app crash, a forced quit mid-download, or the
lost-disclosure scenario in CR-01 (until the next tool download happens to
supersede it) will sit in that directory indefinitely across app restarts —
nothing scans or prunes it on the next launch the way, for example, the
extraction temp dirs elsewhere in the codebase are cleaned up per-operation
via `finally`.

**Fix:** Sweep `browser-downloads` on startup (e.g. alongside the other
startup recovery/backfill calls in `electron/main/index.ts`), removing any
file whose name isn't in the current in-memory pending map (which, on a
fresh process, is always empty, so a simple "delete everything in this
directory older than N minutes" or "delete everything, since the map never
survives a restart" sweep is sufficient).

## Info

### IN-01: `BrowserToolDownloadEvent.id` is generated but semantically unused for three of five statuses

**File:** `electron/main/services/browserDownloadCapture.ts:217, 227`

**Issue:** `'failed'` and `'refused'` events are pushed with
`id: randomUUID()`, but that id is never correlated with anything (no
pending-map entry exists yet at the point either is pushed, and
`Browser.tsx`'s handlers for `'refused'`/`'failed'` never read `event.id`).
`BrowserToolDownloadEvent.id` is typed as a required field, which makes it
look load-bearing for every status when it's actually only meaningful for
`'ready'` and `'replaced'`.

**Fix:** Either make `id` optional on the type and omit it for `'failed'`/
`'refused'`, or add a short comment at the type declaration noting it's
present-but-unused for those two statuses, so a future reader doesn't
assume it round-trips to something.

---

_Reviewed: 2026-08-07T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
