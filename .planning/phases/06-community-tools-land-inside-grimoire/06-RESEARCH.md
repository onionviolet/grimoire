# Phase 6: Community Tools Land Inside Grimoire - Research

**Researched:** 2026-08-07
**Domain:** Electron `<webview>` download interception, `will-download`/`DownloadItem` API, main-process/renderer IPC round-trips, VPK identity gating
**Confidence:** HIGH on the core technical unknown (D-13's mechanism); MEDIUM on Pimp My Hideout's exact client-side download implementation (could not inspect its live JS bundle this session)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Standing instruction for every decision below:** optimize for the least code that still fully satisfies the requirement, and prefer the cheap side of the upstream boundary (fork-only files) over touching a shared-and-modified file, because upstream (`Slush97/grimoire`) may build something similar and every edit to a shared file is paid for again at the next absorption.

**File destination: install path, not Foundry**

- **D-01:** A browser-produced VPK enters through the existing install path — the same path `importCustomModSource` (`electron/main/ipc/mods.ts`) already uses for drag-drop and custom import — and is treated as a third-party mod, not a Foundry authored edit. Reversibility: costly. Rationale: re-routing later into Foundry's reviewed write set means widening the shared `FoundryForgeEdit` union (`src/types/foundry.ts`) to a kind with no `entryPath`/`precedence`, and reworking `foundryForge.ts`'s collision-review model, which is built around edits Grimoire itself authors, not an opaque already-built VPK it received.
- **D-02:** Undo and ownership follow the install path's existing story exactly: disable or delete like any other third-party mod. No Foundry "My changes" entry, no forge/reforge record, no entry in the Foundry build tray.
- **D-03:** `resolveInstallableVpk` (`electron/main/services/extract.ts`) is the identity gate reused here, the same one bare `.vpk` drag-drop and direct downloads already go through. No new validation logic is written.

**Catalog shape and entry review**

- **D-04:** Each `SHORTCUTS` entry gains a `kind` field: `'mod-host' | 'reference' | 'tool' | 'community-feed'`. The existing `nsfw` flag stays as-is, unchanged in shape. Download-capture logic (D-10) keys off `kind === 'tool'`, not a URL match.
- **D-05:** Recommended default `kind` for the current 9 entries plus the new one, pending the live per-URL review the requirement itself calls for: GameBanana -> `mod-host`; Deadlock Forge, Deadlock Wiki, deadlock-api, Deadlock.io, Deadlocker -> `reference`; r/DeadlockTheGame, Deadlock Daily (memes) -> `community-feed`; Goonlock (18+) -> `community-feed`, `nsfw: true` (unchanged); Pimp My Hideout (new) -> `tool`.
- **D-06:** No crosshair-generator entry is added to the catalog. Grimoire ships its own Crosshair Designer, and the requirement itself frames a second answer to the same question as a UX cost, not a feature.
- **D-07:** The actual "load each entry once, keep/correct/remove, record the result" pass — including checking `deadlocked.wiki` against the `deadlock.wiki` domain search results actually return — is execution work for this phase, not a decision made in this discussion.

**Pre-write disclosure and refusal**

- **D-08:** The pre-write prompt reuses `useConfirm` (`src/components/common/confirmContext.ts`), the shared confirm hook the UI-consistency pass already standardized on. No bespoke modal.
- **D-09:** The disclosure names the detected file kind (from `checkVpkFile`) and the exact destination in one sentence — "added to your mod library as `<name>`" — matching the Foundry tray's existing "this will write X" phrasing. No manual save-path choice is offered; where the file goes is decided, not asked, consistent with D-01/D-02.
- **D-10:** A downloaded file `checkVpkFile` cannot identify as a VPK is refused before any confirm step, with a stated reason in the same voice as `vpk.ts`'s existing rejection messages. No retry mechanism is built.

**Capture trust boundary**

- **D-11:** Download capture (intercepting `will-download` to save into a Grimoire-controlled path instead of `shell.openExternal`) applies only when the current destination's catalog `kind` is `'tool'`. Every other destination, and any URL typed into the address bar, keeps today's behavior unchanged: `preventDefault` + `openExternalSafe`.
- **D-12:** This mirrors the existing permission-floor philosophy in `browserContentFilter.ts` — a blanket deny by default because there is no UI to evaluate an ad hoc prompt from an arbitrary page — except here the "grant" is pre-decided by a catalog entry the app itself declared as a tool, not requested at runtime by page content.
- **D-13:** The mechanism to research and confirm in planning: on `will-download`, call the `DownloadItem`'s `setSavePath()` to a Grimoire-controlled temp path and let Chromium's download manager write the bytes, rather than trying to read the file out of the guest's JS context. This was a strong recommendation from codebase scouting, not a locked fact — **this research confirms it holds** (see Summary above).

### Claude's Discretion

- Exact IPC channel/event shape for round-tripping the pending-download disclosure from main process to renderer and back (main cannot show `useConfirm`'s UI itself). This research recommends a design — see Pattern 2/3 and Open Question 2 below.
- Whether the new catalog lives as a plain array-with-kind in `Browser.tsx` (current shape, extended) or moves to its own fork-only module — lean toward the smallest diff that satisfies D-04 unless the file grows unwieldy.
- Copy/wording for the disclosure and refusal messages (all i18n keys per house style).

### Deferred Ideas (OUT OF SCOPE)

- **A crosshair-generator catalog entry.** Explicitly declined (D-06): Grimoire's own Crosshair Designer already answers this need, and a second answer to the same question is the UX cost the requirement warns about, not a feature to add.
- **A general download manager or file-picker for browser-produced files.** Out of scope by design (D-09): the destination is decided by the app, not chosen by the user per download.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REQ-browser-tool-catalog | `SHORTCUTS` in `src/pages/Browser.tsx` becomes a maintained catalog with a declared `kind` per entry; every existing entry loaded once and kept/corrected/removed | Architecture Patterns (Recommended Project Structure), Validation Architecture test map. No new mechanism needed — pure data/UI change per D-04/D-05/D-07 |
| REQ-browser-produced-file-handoff | A client-side-built file from a `kind: 'tool'` destination reaches Grimoire's mod library with pre-write disclosure, refusing anything `checkVpkFile` cannot identify | Full System Architecture Diagram, Patterns 1-3, Common Pitfalls 1-4, Code Examples, Security Domain — this is the core of the research |
| REQ-browser-navigation-gaps | The existing back/forward/reload/home/address-bar surface stays deliberately bounded; no tabs, zoom, find-in-page, or extensions | No new research needed — this requirement is satisfied by *not* building anything new; Validation Architecture notes it as manual-only ("record the boundary held") |
</phase_requirements>

## Summary

The phase's central open question — whether `will-download` fires, and whether `DownloadItem.setSavePath()` works, for a `blob:` URL download triggered by a synthetic `<a download>` click inside a hardened, preload-less `<webview>` guest — resolves in favor of D-13's recommendation. Three independent lines of evidence converge: (1) Electron's own `will-download` documentation describes it as a session-level event fired whenever "Electron is about to download `item`," with no scheme restriction `[CITED: electronjs.org/docs/latest/api/session]`; (2) two closed Electron GitHub issues (#5938, #34373) both confirm that the classic `Blob` + `URL.createObjectURL` + `<a download>` synthetic-click pattern *does* route through Electron's native download pipeline — strongly enough that one reporter's app was rejected from the Mac App Store specifically because Electron silently wrote the blob-sourced export into the Downloads folder, which is only possible if the browser-level download manager (the same one `will-download` intercepts) handled it `[CITED: github.com/electron/electron/issues/5938]`; and (3) this codebase's *own* existing handler, `guest.session.on('will-download', ...)` in `electron/main/index.ts:402`, is already listening on exactly this guest's session (`persist:grimoire-browser`, attached in `did-attach-webview`) and is presumed working today for the current preventDefault+openExternal behavior — this is the strongest evidence of all, because it is empirical proof against this exact partition/attach pattern, not a generic claim from an unrelated app `[VERIFIED: electron/main/index.ts:402-405]`.

The one genuine risk this research surfaces and that the CONTEXT.md D-13 note did not: some modern web apps use the **File System Access API** (`window.showSaveFilePicker()`) instead of the classic blob-anchor pattern for "download as" flows. That API does **not** go through Electron's download manager at all — it opens a native OS save dialog and writes via a `FileSystemWritableFileStream`, bypassing `will-download` entirely, and Chromium additionally blocks it from cross-origin/embedded contexts without an explicit permission grant `[CITED: github.com/electron/electron pull/51042 discussion of File System Access API scoping]`. If Pimp My Hideout uses this API rather than the classic pattern, D-13's mechanism silently does not fire, and the button would appear to do nothing (or throw a `SecurityError` visible in devtools) rather than fail loudly. This could not be confirmed against the live site this session (its JS is bundled/rendered client-side and not readable via a text fetch); **the planner must add a verification step early in execution** (see Common Pitfalls #1 and Open Questions) that loads the real page in a dev slot and confirms which mechanism its `Build VPK` button uses before committing to the full D-13 flow.

**Primary recommendation:** Implement D-13 as designed — listen on `guest.session.on('will-download')`, call `item.setSavePath()` synchronously inside the handler to a Grimoire-controlled temp path, and defer the pre-write disclosure to the `item.once('done', ...)` callback once the temp file is confirmed written and `checkVpkFile` has classified it. Do not call `event.preventDefault()` for `kind === 'tool'` downloads (that is what forces the OS-level save today; per-download redirection instead uses `setSavePath`). Verify Pimp My Hideout's actual download mechanism against a running dev slot before writing the full flow, as the very first execution task.

## Architectural Responsibility Map

Grimoire is an Electron desktop app, not a client/server web app. The "tiers" below map to Electron's process model: **Browser/Client** = the sandboxed `<webview>` guest content (never trusted, no privileged surface) and the app's own renderer UI; **API/Backend** = the Electron main process (the only process with file-system, session, and download-manager access); **Database/Storage** = the on-disk addons folder and `mods-cache.db` metadata store the main process already owns.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Destination catalog data (`kind`, url, label, nsfw) | Browser/Client (renderer, `Browser.tsx`) | — | Pure UI data; no privileged access needed. Stays fork-only (D-04 discretion note leans toward keeping it in `Browser.tsx`) |
| Active-destination-kind tracking for the download gate (D-11) | API/Backend (main) | Browser/Client (renderer pushes the value) | Only main can act on `will-download`; only renderer knows which catalog entry is current. Requires a small IPC push on every navigation — see Common Pitfalls #2 |
| `will-download` interception + `setSavePath` redirection | API/Backend (main, `electron/main/index.ts`) | — | Guest webview content has no Node, no preload; only main process code can reach `session.on('will-download')` |
| File identity gate (`checkVpkFile`, `resolveInstallableVpk`) | API/Backend (main) | — | Already main-only; reused as-is per D-03 |
| Pre-write disclosure UI (`useConfirm`) | Browser/Client (renderer) | API/Backend (main initiates via IPC push, since main cannot render UI) | `useConfirm` is a React hook; main can only ask the renderer to show it and await the renderer's answer |
| Mod library write (install into addons folder) | API/Backend (main, `importCustomModSource`) | Database/Storage (addons folder + `mods-cache.db` metadata) | Existing install path, reused verbatim per D-01/D-02/D-03 |
| Webview guest hardening (`will-attach-webview`) | API/Backend (main, sole authority) | Browser/Client (guest obeys what main assigns) | The guest's own `webPreferences`/`partition` attributes are never trusted — main re-asserts them on every attach |

## Standard Stack

No new libraries are introduced by this phase. Everything needed already exists in the codebase:

### Core (existing, reused)
| Component | Location | Purpose | Why reused |
|---|---|---|---|
| Electron `session.on('will-download')` + `DownloadItem` | Electron 35 built-in (`electron` 35.7.5, verified installed) | Intercept and redirect a guest-initiated download | Built into the Electron runtime this app already ships; no package to add |
| `checkVpkFile` / `resolveInstallableVpk` | `electron/main/services/vpk.ts:168`, `electron/main/services/extract.ts:373` | Identity-gate a downloaded file before treating it as installable | Existing, tested, shared by drag-drop/custom-import/direct-download (D-03) |
| `importCustomModSource` via `import-custom-mods` IPC channel | `electron/main/ipc/mods.ts:1260`, `1427` | Copy an accepted VPK into the addons folder as a tracked mod | Existing install path (D-01) |
| `useConfirm` | `src/components/common/confirmContext.ts` | Pre-write disclosure prompt | Existing shared confirm hook (D-08) |
| `getGameBananaImportHandoff` pattern | `src/lib/browserImportHandoff.ts` | Precedent for "explicit user action gates a browser-to-app handoff" | Existing pattern to mirror, not extend directly (different trigger shape) |

### Supporting
| Component | Purpose | When to Use |
|---|---|---|
| A small new IPC channel pair (main<->renderer push/response) | Round-trip the pending-download disclosure and the active-destination-kind signal | New, minimal — see Code Examples |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `will-download` + `setSavePath` | Injecting a script into the guest via `webview.executeJavaScript` to intercept the blob and pass bytes to main via `webview.send`/`ipc-message` | Requires either a preload on the guest (explicitly forbidden by Constraint 4) or `executeJavaScript` injection, which is fragile against the target site's own script and does not compose with `contextIsolation`/no-preload; `will-download` needs neither |
| `will-download` + `setSavePath` | `preventDefault()` + manually `fetch()`/`got()` the `item.getURL()` in main (the pattern shown in Electron's own docs example) | Electron's own docs example uses this pattern, but it only works for network-fetchable URLs. A `blob:` URL is scoped to the renderer/guest's Blob URL Store and is **not** resolvable by a Node-side HTTP client — this alternative cannot work for Pimp My Hideout's client-side-built file at all |

**Installation:** None — no new packages.

## Package Legitimacy Audit

No external packages are introduced by this phase. All mechanisms used (`session.on('will-download')`, `DownloadItem`, IPC) are part of the already-installed `electron` 35.7.5 dependency and existing in-repo services. **Packages removed due to [SLOP] verdict:** none. **Packages flagged as suspicious [SUS]:** none.

## Architecture Patterns

### System Architecture Diagram

```
User clicks "Build VPK" inside <webview> guest (Pimp My Hideout, kind='tool')
        │
        ▼
Guest page JS: new Blob([...]) -> URL.createObjectURL(blob) -> synthetic <a download> click
        │  (entirely inside the sandboxed, preload-less, no-Node guest — no privileged API used)
        ▼
Chromium's browser-process Download Manager decides "this is a download"
        │
        ▼
 guest.session.on('will-download', (event, item) => { ... })   [main process, electron/main/index.ts]
        │
        ├─ if activeDestinationKind !== 'tool'  ──────────────────► event.preventDefault(); openExternalSafe(item.getURL())  (unchanged today's behavior — D-11)
        │
        └─ if activeDestinationKind === 'tool'
                 │
                 ▼
           item.setSavePath(<grimoire temp dir>/<uuid>.download)   (synchronous, inside the handler — no preventDefault call)
                 │
                 ▼
           item.once('done', (event, state) => { ... })
                 │
                 ├─ state !== 'completed' ──► discard, surface a toast (interrupted/cancelled)
                 │
                 └─ state === 'completed'
                        │
                        ▼
                  checkVpkFile(tempPath)   [electron/main/services/vpk.ts]
                        │
                        ├─ invalid ──► delete temp file; push IPC event with describeVpkRejection() text; renderer shows refusal banner (D-10) — NO confirm shown
                        │
                        └─ valid
                               │
                               ▼
                        push IPC event to renderer: "pending tool download ready" { name, tempPath, detectedKind }
                               │
                               ▼
                        renderer: useConfirm({ message: 'added to your mod library as <name>' })  (D-08/D-09)
                               │
                        ┌──────┴──────┐
                        │             │
                     Cancel        Confirm
                        │             │
                        ▼             ▼
              delete temp file   invoke import-custom-mods IPC
              (no import)        with { vpkPath: tempPath, name, nsfw }
                                       │
                                       ▼
                              importCustomModSource (existing path, D-01/D-02/D-03)
                              -> resolveInstallableVpk -> allocateEnabledVpkPath -> copyIntoModSlot
                                       │
                                       ▼
                              mod library (addons folder + mods-cache.db metadata)
```

### Recommended Project Structure

No new top-level folders. New code lands in the existing files this phase already touches:

```
electron/main/
  index.ts                       # will-download handler grows a kind-conditional branch (D-11); shared/upstream file — keep the diff minimal
  services/browserDownloadCapture.ts   # NEW, fork-only: temp-path allocation, checkVpkFile call, IPC push, active-kind state — keeps the diff to index.ts small
  ipc/browser.ts                 # NEW, fork-only: IPC handlers for the disclosure round-trip and active-destination-kind push
src/
  pages/Browser.tsx              # SHORTCUTS -> catalog with `kind`; pushes active kind to main on navigation; renders the tool-download disclosure banner
  lib/browserToolDownload.ts     # NEW, fork-only: thin IPC wrapper (mirrors browserImportHandoff.ts's shape)
```

Keeping the new logic in fork-only files (`services/browserDownloadCapture.ts`, `ipc/browser.ts`, `lib/browserToolDownload.ts`) and touching `electron/main/index.ts` only for the minimal `will-download` branch and the `did-attach-webview` wiring matches the phase's standing instruction to prefer the cheap side of the upstream boundary — `electron/main/index.ts` is shared-and-modified per `docs/upstream-boundary-map.md`.

### Pattern 1: `setSavePath` inside `will-download`, not `preventDefault` + manual fetch
**What:** Redirect Chromium's own download write, rather than reading bytes out of the guest.
**When to use:** Whenever the source URL might be `blob:`-scoped (client-side-built content) rather than a real network resource.
**Example:**
```typescript
// Source: electronjs.org/docs/latest/api/download-item (setSavePath), adapted —
// the docs' own default example uses preventDefault+fetch, which does NOT work
// for blob: URLs; this app needs the setSavePath variant instead.
guest.session.on('will-download', (event, item) => {
    if (activeDestinationKind() !== 'tool') {
        event.preventDefault();
        openExternalSafe(item.getURL());
        return;
    }
    const tempPath = allocateBrowserDownloadTempPath(item.getFilename());
    item.setSavePath(tempPath); // must be called synchronously in this handler
    item.once('done', (_event, state) => {
        if (state !== 'completed') { cleanupTempFile(tempPath); return; }
        handleCompletedToolDownload(tempPath); // checkVpkFile + IPC push, see below
    });
});
```

### Pattern 2: Main-initiated confirm round-trip (main cannot render `useConfirm` itself)
**What:** Main pushes a "pending download ready" event; renderer resolves it with `useConfirm` and invokes back.
**When to use:** Any main-process flow needing a renderer-rendered confirmation before completing an action that started in main.
**Example:**
```typescript
// electron/preload/index.ts — follows the existing onImportCustomModsProgress /
// onVpkImpostorsFound push pattern already used in this file.
onPendingToolDownload: (listener: (payload: PendingToolDownload) => void) => {
    const wrapped = (_e: unknown, payload: PendingToolDownload) => listener(payload);
    ipcRenderer.on('browser:pending-tool-download', wrapped);
    return () => ipcRenderer.removeListener('browser:pending-tool-download', wrapped);
},
resolvePendingToolDownload: (id: string, accepted: boolean) =>
    ipcRenderer.invoke('browser:resolve-tool-download', id, accepted),
```

### Pattern 3: Active-destination-kind derived from current URL, not "last shortcut clicked"
**What:** Main needs to know, at the moment `will-download` fires, whether the currently-loaded page belongs to a catalog `kind: 'tool'` entry.
**When to use:** Any time the phase computes which destination a download belongs to.
**Why not "remember which shortcut button was clicked":** the guest can navigate on its own (in-page links, redirects) without the user touching a shortcut button again. `Browser.tsx` already re-syncs `current` on every `did-navigate`/`did-navigate-in-page` (see `syncNav` in the existing file) — recompute the kind from `current`'s URL against the catalog on every one of those events and push it to main, rather than setting it once per shortcut click.

### Anti-Patterns to Avoid
- **Reading blob bytes via `webview.executeJavaScript`:** requires injecting privileged-feeling code into the guest and duplicating FileReader logic; unnecessary once `setSavePath` is confirmed to work, and it is not a "no preload, no Node" solution in spirit even if technically the guest keeps its own webPreferences unmodified.
- **Calling `item.setSavePath()` after an `await`:** the API is documented as usable only inside the `will-download` callback; doing async work (e.g. an IPC round-trip to ask the renderer something) before calling it risks Chromium already having applied a default path or shown a dialog. Do the redirection synchronously; do any async decision-making (disclosure, refusal) *after*, using `item.once('done', ...)`.
- **Trusting `item.getFilename()` as a display name without also verifying the header:** for a `blob:` download, the filename is only ever what the `download` attribute said (or a Chromium-generated fallback) — never present it as-is without a fallback (e.g. `Foundry mod` per the existing `buildTray.defaultName` house pattern) matching the "Will create: {{name}}.vpk" phrasing precedent.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Determining whether a downloaded file is really a VPK | A new extension/magic-byte check | `checkVpkFile` / `resolveInstallableVpk` (D-03) | Already handles archives-that-are-really-one-VPK, empty files, and produces the exact rejection copy D-10 wants |
| Copying an accepted file into the addons folder with slot allocation | New file-placement logic | `importCustomModSource` via `import-custom-mods` (D-01) | Already handles overflow-folder spillover, metadata stamping, and imprint reconciliation |
| A destructive-confirmation modal | A bespoke dialog component | `useConfirm` (D-08) | Already the house pattern; a new modal would be visually inconsistent and untranslated |
| Fetching a `blob:`-scoped download's bytes from the main process | A custom Node-side blob resolver / IPC byte-streaming pipe | `DownloadItem.setSavePath()` | Chromium's browser process already has direct access to the blob store for the session that created it; re-implementing that access from Node is solving a problem Electron already solved |

**Key insight:** every piece of "don't hand-roll" here is something this exact codebase already built for a *different* entry point (drag-drop, GameBanana download, custom import) — the phase's only new work is the interception and disclosure plumbing that gets a browser-produced file to reuse those entry points, not any new file-handling logic.

## Common Pitfalls

### Pitfall 1: Pimp My Hideout might not use the classic blob+`<a download>` pattern
**What goes wrong:** If the site uses `window.showSaveFilePicker()` (File System Access API) instead, `will-download` never fires — D-13's entire mechanism silently does nothing, and the button either throws a `SecurityError` (File System Access API is commonly blocked in cross-origin embedded/iframe-like contexts without an explicit permission) or opens a native OS picker Grimoire cannot see or redirect.
**Why it happens:** Both patterns are legitimate ways for a client-side web app to "download" a Blob in 2024+ browsers; the File System Access API has become more common for tools built recently.
**How to avoid:** Before writing the full flow, load the real Pimp My Hideout page in a dev slot's `<webview>`, click Build VPK, and watch whether `will-download` fires (`console.log` in the handler is enough) versus whether a native save dialog / `SecurityError` appears instead. This should be the first execution task in this phase's plan, gating the rest of the D-13-dependent work.
**Warning signs:** No `will-download` log line despite the button visibly "doing something" in the guest; a devtools console error mentioning `showSaveFilePicker` or `SecurityError`.

### Pitfall 2: Main process has no inherent knowledge of "which catalog entry is current"
**What goes wrong:** `will-download` fires in main; the catalog and its `kind` field live in the renderer (`Browser.tsx`, fork-only). Without an explicit signal, main cannot know whether the currently-loaded guest page is the `kind: 'tool'` entry.
**Why it happens:** The existing code has no concept of "current catalog kind" anywhere — today's handler treats every download identically.
**How to avoid:** Add a small IPC push from renderer to main every time the guest's current URL changes (piggyback on the existing `syncNav`/`did-navigate` handling in `Browser.tsx`), computing the kind by matching the current URL's host against the catalog. Keep the catalog itself single-sourced in the renderer; do not duplicate it into `electron/main/index.ts`.
**Warning signs:** A download from a non-tool destination gets captured by mistake (or vice versa) because main's notion of "current kind" is stale — e.g., set once on shortcut click and never updated on subsequent in-page navigation.

### Pitfall 3: Async work before `setSavePath()` inside the handler
**What goes wrong:** If the handler does `await checkVpkFile(...)` or an IPC round-trip *before* calling `item.setSavePath()`, Electron may have already begun applying its default save behavior (silent default-Downloads-folder write, since `preventDefault()` is not being called in the tool-download branch).
**Why it happens:** `setSavePath` is documented as usable only within the synchronous `will-download` callback.
**How to avoid:** Call `item.setSavePath(tempPath)` as the very first synchronous action in the tool-download branch; do all asynchronous decision-making (identity check, disclosure) after, driven off `item.once('done', ...)`.
**Warning signs:** Files unexpectedly appearing in the OS Downloads folder instead of Grimoire's temp path.

### Pitfall 4: Filename collisions / missing extension on the temp path
**What goes wrong:** `item.getFilename()` for a blob download reflects only the `download` attribute's value (or a Chromium-generated fallback like `download` with no extension); using it directly as the temp file name risks collisions across repeated builds or an extension-less file that later code assumes has one.
**Why it happens:** `checkVpkFile` reads magic bytes, not extension, so this only matters for the temp file's own housekeeping, not for validity — but a repeated "Build VPK" click producing the same suggested filename twice in one session would otherwise silently overwrite an unconfirmed pending temp file.
**How to avoid:** Allocate the temp path with a generated unique component (e.g. a uuid or timestamp), independent of `item.getFilename()`; use the original filename only for display purposes in the disclosure text.
**Warning signs:** A second "Build VPK" click before the first disclosure is answered silently replaces the first pending file.

## Code Examples

### Reading the existing `will-download` handler being modified
```typescript
// Source: electron/main/index.ts:400-405 (VERIFIED — read this session)
// Downloads inside an embedded browser have no UI to manage them and
// would write to disk unattended, so hand them off too.
guest.session.on('will-download', (event, item) => {
    event.preventDefault();
    openExternalSafe(item.getURL());
});
```

### The identity gate this phase reuses unmodified
```typescript
// Source: electron/main/services/extract.ts:373-392 (VERIFIED — read this session)
export async function resolveInstallableVpk(
    filePath: string,
    workDir: string,
    displayName = basename(filePath)
): Promise<{ path: string; unwrappedFrom?: string }> {
    const check = checkVpkFile(filePath);
    if (check.valid) return { path: filePath };
    if (isUnpackableArchiveFormat(check.format)) {
        const inner = await unwrapInnerVpks(filePath, workDir, check.format, new Set());
        if (inner.length === 1) return { path: inner[0].path, unwrappedFrom: check.label };
        throw new Error(
            `${displayName} is a ${check.label}, not a VPK, and it does not contain exactly one VPK to install instead.`
        );
    }
    throw new Error(describeVpkRejection(displayName, check));
}
```

### The install-path shape this phase's confirmed download feeds
```typescript
// Source: src/types/electron.ts:302-312 (VERIFIED — read this session)
export interface ImportCustomModArgs {
    vpkPath: string;
    name: string;
    thumbnailDataUrl?: string;
    nsfw?: boolean;
}

/** Batch local import: one entry per picked file, imported in array order. */
export interface ImportCustomModsBatchArgs {
    items: ImportCustomModArgs[];
}
```
A confirmed browser-tool download becomes a single-item call: `importCustomMods([{ vpkPath: tempPath, name, nsfw }])` (`src/lib/api.ts:518-522`, VERIFIED — read this session), reusing the exact renderer-side wrapper already used by drag-drop/custom-import.

### The confirm hook this phase reuses (D-08)
```typescript
// Source: src/components/common/confirmContext.ts:14-41 (VERIFIED — read this session)
export interface ConfirmRequest {
  title: ReactNode;
  message?: ReactNode;
  items?: readonly string[];
  confirmLabel?: ReactNode;
  cancelLabel?: ReactNode;
  variant?: 'primary' | 'danger';
}
export type ConfirmFn = (request: ConfirmRequest) => Promise<boolean>;
export function useConfirm(): ConfirmFn { /* ... */ }
```

### House phrasing precedent for "this will write X" (D-09)
```json
// Source: src/locales/en/translation.json:345 (VERIFIED — read this session)
"willCreate": "Will create: {{name}}.vpk",
```
The new disclosure copy should follow this same shape (e.g. an i18n key under the existing `browser.*` namespace at `src/locales/en/translation.json:3556`, VERIFIED present this session) — "added to your mod library as `<name>`" per D-09, parameterized the same way.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Web apps trigger downloads exclusively via `<a download>` + blob URLs | Some modern web apps use the File System Access API (`showSaveFilePicker`) for a native "Save As" experience | Chromium ~86+ (2020), adoption ongoing | This phase must verify which one Pimp My Hideout uses — see Pitfall 1; the two are not interchangeable from Electron's interception point of view |

**Deprecated/outdated:** None specific to this phase's stack — `will-download`/`DownloadItem` is the current, actively maintained Electron API (present unchanged in Electron 35, the version this app ships).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Pimp My Hideout's "Build VPK" button uses the classic `Blob` + `URL.createObjectURL` + `<a download>` synthetic-click pattern (not the File System Access API) | Summary, Pitfall 1 | If wrong, D-13's mechanism does not fire at all and the whole download-capture flow needs a different approach (or the requirement becomes unsatisfiable for this specific tool without a guest-side script injection, which would contradict Constraint 4's spirit) |
| A2 | `setSavePath()` behaves identically for `blob:`-sourced `DownloadItem`s as for network-sourced ones (no scheme-specific code path in Electron's DownloadManager that would special-case blob downloads to bypass `will-download` or reject `setSavePath`) | Summary, Pattern 1 | If wrong, the redirection silently fails and the file lands in the OS default Downloads folder instead of Grimoire's temp path; would surface immediately in manual testing as "file didn't show up in Grimoire" |
| A3 | The historical webview/`will-download` GitHub issues (#4352, #10027, both from 2016-2017) describe bugs already avoided by this codebase's existing pattern (listening on `guest.session` obtained from `did-attach-webview`, not on `webContents` directly) rather than a still-present limitation in Electron 35 | Summary | Low risk — the existing `guest.session.on('will-download')` handler in this codebase already relies on this working today for the current preventDefault+openExternal behavior, which is itself evidence against the old bug still applying |

**If this table is empty:** N/A — see above; none of these block planning, but A1 should be resolved by an early execution-time verification task rather than assumed away.

## Open Questions

1. **What download mechanism does Pimp My Hideout's live JS actually use?**
   - What we know: The site is a static GitHub Pages app (`https://xkitkatcat.github.io/pimpmyhideout/`); could not locate its source repository or inspect its bundled JS via the tools available this session (WebFetch could not render the JS-driven page content, and no public source repo was found under a `pimpmyhideout` name).
   - What's unclear: Whether it uses the classic blob-anchor pattern or the File System Access API.
   - Recommendation: First execution task — load the page in a `GRIMOIRE_DEV_SLOT` build, click Build VPK, and observe (via a temporary `console.log` in the `will-download` handler, or the dev-driver's `eval`) whether the event fires. This is a cheap, fast, conclusive check that should happen before the rest of the plan's tasks are built out.

2. **Exact shape of the active-destination-kind signal from renderer to main.**
   - What we know: CONTEXT.md leaves the exact IPC channel/event shape to Claude's discretion; this research recommends deriving kind from the current URL on every navigation event, not from "last shortcut clicked" (Pattern 3).
   - What's unclear: Whether to push kind as a string on every navigation, or have main ask (`invoke`) the renderer synchronously at `will-download` time. Given `will-download` fires from an async main-process event and IPC `invoke` round-trips are async, a main-held "last known kind" pushed proactively by the renderer is simpler than a request-response inside the handler.
   - Recommendation: Renderer pushes kind on every `did-navigate`/`did-navigate-in-page` (already-observed events); main stores it in a simple in-memory variable scoped to the guest's `did-attach-webview` closure.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Electron | `will-download`/`DownloadItem` API | Yes | 35.7.5 (verified via installed `electron/package.json`) | — |
| `<webview>` tag support | Guest hosting | Yes | Enabled via `webviewTag: true` in `electron/main/index.ts:295` (VERIFIED — read this session) | — |
| `pnpm exec electron-vite dev` / `GRIMOIRE_DEV_SLOT` | Manual verification of Pitfall 1 / Open Question 1 | Yes | Per `CLAUDE.md`'s documented dev-driver workflow | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.9 (`vitest.config.ts`, VERIFIED — read this session) |
| Config file | `vitest.config.ts` (node environment, no DOM — VERIFIED) |
| Quick run command | `pnpm exec vitest run <path/to/file>.test.ts` |
| Full suite command | `pnpm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-browser-tool-catalog | Catalog entries carry a valid `kind`; nsfw filtering still works per entry | unit | `pnpm exec vitest run src/pages/Browser.catalog.test.ts` | ❌ Wave 0 |
| REQ-browser-produced-file-handoff | `checkVpkFile` rejects a non-VPK temp download with the stated-reason copy before any confirm is shown | unit | `pnpm exec vitest run electron/main/services/browserDownloadCapture.test.ts` | ❌ Wave 0 |
| REQ-browser-produced-file-handoff | Active-destination-kind is correctly derived from the current URL on navigation (Pattern 3) | unit | `pnpm exec vitest run electron/main/services/browserDownloadCapture.test.ts` | ❌ Wave 0 |
| REQ-browser-produced-file-handoff | End-to-end: a confirmed download reaches `import-custom-mods` with the right `vpkPath`/`name`/`nsfw` | integration (mocked IPC) | `pnpm exec vitest run electron/main/ipc/browser.test.ts` | ❌ Wave 0 |
| REQ-browser-navigation-gaps | No new controls added beyond back/forward/reload/home/address-bar/open-externally | manual-only (this is a "record the boundary held," not a code-testable behavior) | — | n/a |

### Sampling Rate
- **Per task commit:** `pnpm exec vitest run <changed test file>`
- **Per wave merge:** `pnpm test`
- **Phase gate:** `pnpm test` green before `/gsd-verify-work`, plus the manual dev-slot check from Open Question 1 recorded as evidence

### Wave 0 Gaps
- [ ] `electron/main/services/browserDownloadCapture.test.ts` — covers the `checkVpkFile`-gated temp-download handling and active-kind derivation (REQ-browser-produced-file-handoff)
- [ ] `electron/main/ipc/browser.test.ts` — covers the disclosure round-trip IPC handlers
- [ ] `src/pages/Browser.catalog.test.ts` — covers the catalog shape and nsfw filtering (REQ-browser-tool-catalog)
- [ ] No framework install needed — Vitest is already configured and covers both `electron/` and `src/`

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | N/A — no auth surface touched by this phase |
| V3 Session Management | No | N/A |
| V4 Access Control | No | N/A — no user-role distinctions |
| V5 Input Validation | Yes | `checkVpkFile` magic-byte validation (existing, reused, D-03) is the input-validation control for the one new untrusted input this phase accepts: an arbitrary byte stream written by a Chromium download to a Grimoire-controlled temp path |
| V6 Cryptography | No | N/A — no crypto introduced |
| V12 File and Resources | Yes (informal — ASVS 4.0 renumbers, but the category is "file handling") | Temp file is written to a Grimoire-controlled path (not user-writable, not an OS Downloads folder shared with other apps); deleted on refusal/cancel; never executed |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A malicious page (any site loaded into the `<webview>`, not just Pimp My Hideout) attempts to trigger an unwanted download and have it silently accepted | Spoofing / Tampering | D-11: capture only applies when the active destination's catalog `kind === 'tool'`; every other destination and any address-bar-typed URL keeps today's `preventDefault` + `openExternalSafe`. The catalog itself is app-declared, not page-requested (D-12 mirrors `browserContentFilter.ts`'s permission-floor precedent: the "grant" is pre-decided by Grimoire, never requested at runtime by page content) |
| A `kind: 'tool'` destination page (compromised, or simply buggy) causes a non-VPK file to be downloaded and silently treated as trusted | Tampering / Elevation of Privilege | `checkVpkFile` gate (D-03/D-10): refused before any confirm step, with a stated reason; never executed or copied anywhere on rejection |
| Widening the guest's privileges to solve the byte-extraction problem (e.g. adding a preload, enabling Node, or relaxing `sandbox`) | Elevation of Privilege | Explicitly out of scope (phase Notes, Constraint 4); D-13's `setSavePath()` mechanism requires none of these — the guest never needs elevated capability, because the browser process (not the guest) performs the write |
| A confused-deputy scenario where main imports a temp file the user never actually confirmed (e.g. a stale pending-download ID reused) | Spoofing | The disclosure round-trip should key each pending download by a fresh id (not reused across downloads) and discard/ignore a resolve call for an id that no longer matches the current pending temp file |

## Sources

### Primary (HIGH confidence)
- `electron/main/index.ts` (this repo) — `will-attach-webview`, `did-attach-webview`, existing `will-download` handler — read directly this session
- `electron/main/services/extract.ts`, `electron/main/services/vpk.ts`, `electron/main/ipc/mods.ts`, `src/types/electron.ts`, `src/lib/api.ts`, `src/components/common/confirmContext.ts`, `src/lib/browserImportHandoff.ts`, `electron/main/services/browserContentFilter.ts`, `src/pages/Browser.tsx`, `src/locales/en/translation.json`, `vitest.config.ts`, `package.json` — all read directly this session
- Installed `electron` package version (35.7.5) — read via `node -e "require('electron/package.json').version"` this session

### Secondary (MEDIUM confidence)
- [Electron `session` docs — `will-download` event](https://www.electronjs.org/docs/latest/api/session/) - fetched this session, quoted verbatim
- [Electron `DownloadItem` docs — `setSavePath`/`getFilename`/`getURL`/`done`](https://github.com/electron/electron/blob/main/docs/api/download-item.md) - fetched this session, quoted verbatim
- [electron/electron#5938 — "Export file with Electron - temporary file in download folder"](https://github.com/electron/electron/issues/5938) - confirms blob+`<a download>` routes through Electron's real download pipeline
- [electron/electron#34373 — "can't download the blob:http file"](https://github.com/electron/electron/issues/34373) - corroborating report of the same pattern (base64 -> Blob -> createObjectURL -> anchor click)
- [electron/electron PR #51042 — File System Access API save-picker scoping discussion](https://github.com/electron/electron/pull/51042) - context for the File System Access API alternative and its cross-origin restrictions

### Tertiary (LOW confidence)
- [electron/electron#4352 — "Webview tag can't prevent default on will-download"](https://github.com/electron/electron/issues/4352) and [electron/electron#10027 — "will-download not triggered in a webview"](https://github.com/electron/electron/issues/10027) - both from 2016-2017, closed, pre-date this codebase's current attach/session pattern; read as historical context, not as current-behavior evidence (superseded in confidence by this codebase's own working handler)
- Pimp My Hideout's actual client-side implementation — could not be inspected this session (see Open Question 1); anything about its exact download mechanism is unverified and must be confirmed at execution time

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - nothing new to install; all reused components read directly from the working tree this session
- Architecture (D-13 mechanism): HIGH for the general Electron behavior (docs + two corroborating issue reports + this codebase's own working precedent); MEDIUM for its applicability to this one specific external tool, pending live verification
- Pitfalls: HIGH - each pitfall traces to either a documented API constraint or a concrete GitHub issue

**Research date:** 2026-08-07
**Valid until:** 30 days (stable Electron API surface; the one time-sensitive unknown is Pimp My Hideout's own implementation, which could change independently of this app at any time)
