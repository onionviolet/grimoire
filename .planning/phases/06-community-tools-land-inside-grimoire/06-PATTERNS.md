# Phase 6: Community Tools Land Inside Grimoire - Pattern Map

**Mapped:** 2026-08-07
**Files analyzed:** 8 (new + modified)
**Analogs found:** 8 / 8

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `src/pages/Browser.tsx` (modified: `SHORTCUTS` -> catalog with `kind`, active-kind push, disclosure banner) | component | request-response (UI state + IPC push) | itself (existing file, extend in place) | exact (self) |
| `src/lib/browserToolDownload.ts` (new, fork-only) | utility (IPC wrapper) | event-driven (push/subscribe) | `src/lib/browserImportHandoff.ts` (shape) + `src/lib/api.ts` `importCustomMods`/`onImportCustomModsProgress` (IPC wrapper idiom) | role-match, strong |
| `electron/main/services/browserDownloadCapture.ts` (new, fork-only) | service | event-driven (will-download) + file-I/O | `electron/main/services/browserContentFilter.ts` (`attachBrowserFilter`, session-scoped state module) | role-match, strong |
| `electron/main/ipc/browser.ts` (new, fork-only) | route/controller (ipcMain handlers) | request-response + event-driven (push) | `electron/main/ipc/mods.ts` (`import-custom-mods` handler + progress push pattern) | role-match, strong |
| `electron/main/index.ts` (modified: `will-download` handler grows a kind-conditional branch; wire `browserDownloadCapture` into `did-attach-webview`) | main-process wiring | event-driven | itself (existing `will-attach-webview`/`did-attach-webview`/`will-download` block, lines 355-406) | exact (self) |
| `electron/preload/index.ts` (modified: expose `onPendingToolDownload`, `resolvePendingToolDownload`, `setActiveBrowserDestinationKind`) | bridge (contextBridge surface) | event-driven (push) + request-response | `onVpkImpostorsFound` (lines 140-144) + `onImportCustomModsProgress` (lines 293-298) | exact |
| `src/types/electron.ts` / `src/lib/api.ts` (modified: add types + thin wrapper for the new channels) | type/utility | request-response | `ImportCustomModArgs`/`importCustomMods`/`onImportCustomModsProgress` (lines 291-529) | exact |
| `src/locales/en/translation.json` (modified: new `browser.*` keys for disclosure/refusal copy) | config (i18n catalog) | — | existing `browser.*` namespace (line ~3556) and `willCreate` phrasing (line 345) | exact |

No test files are listed as new/modified inputs from CONTEXT.md itself, but RESEARCH.md's Wave 0 gap table names three Vitest files the planner should schedule: `electron/main/services/browserDownloadCapture.test.ts`, `electron/main/ipc/browser.test.ts`, `src/pages/Browser.catalog.test.ts`. These are covered under Pattern Assignments below using the closest existing test analogs found.

## Pattern Assignments

### `src/pages/Browser.tsx` (component, request-response) — MODIFIED

**Analog:** itself (extend in place — this is the file CONTEXT.md explicitly says to extend rather than replace, per the Claude's-Discretion note leaning toward the smallest diff)

**Current catalog shape to extend** (lines 22-36):
```typescript
/** Shortcut destinations. These are a deliberately small set of useful and
 *  community-loved Deadlock stops, rather than a general bookmark manager. */
const SHORTCUTS: { label: string; url: string; nsfw?: boolean }[] = [
    { label: 'GameBanana', url: 'https://gamebanana.com/games/20948' },
    { label: 'Deadlock Forge', url: 'https://deadlockforge.net/' },
    { label: 'Deadlock Wiki', url: 'https://deadlocked.wiki/' },
    { label: 'deadlock-api', url: 'https://deadlock-api.com/' },
    { label: 'Deadlock.io', url: 'https://deadlock.io/' },
    { label: 'Deadlocker', url: 'https://www.deadlocker.gg/' },
    { label: 'r/DeadlockTheGame', url: 'https://www.reddit.com/r/DeadlockTheGame/' },
    { label: 'Deadlock Daily (memes)', url: 'https://www.deadlockdaily.com/' },
    { label: 'Goonlock (18+)', url: 'https://goonlock.com/', nsfw: true },
];

const HOME_URL = SHORTCUTS[0].url;
```
Extend each entry with `kind: 'mod-host' | 'reference' | 'tool' | 'community-feed'` per D-04/D-05. Keep `nsfw?` unchanged in shape.

**Existing nsfw-filter pattern to mirror for kind-derived logic** (lines 81-86):
```typescript
// Keep browser shortcuts consistent with the Browse content preference.
// "Blur" leaves the optional adult destination visible; "hide" removes it.
const visibleShortcuts = useMemo(
    () => SHORTCUTS.filter((shortcut) => !shortcut.nsfw || settings?.browseNsfwContentMode !== 'hide'),
    [settings?.browseNsfwContentMode],
);
```
Add a parallel `useMemo` that derives the active `kind` from `current`'s URL against the catalog (Pattern 3 in RESEARCH.md: derive from current URL on every nav event, not "last shortcut clicked").

**Existing nav-sync event wiring to piggyback the kind-push onto** (lines 105-147, especially `syncNav` at 109-117 and the `did-navigate`/`did-navigate-in-page` listeners at 137-138):
```typescript
const syncNav = () => {
    setCanBack(el.canGoBack());
    setCanForward(el.canGoForward());
    const url = el.getURL();
    if (url && url !== 'about:blank') {
        setCurrent(url);
        setAddress(url);
    }
};
...
el.addEventListener('did-navigate', syncNav);
el.addEventListener('did-navigate-in-page', syncNav);
```
Add the IPC push (via the new `src/lib/browserToolDownload.ts` wrapper) for the derived kind inside `syncNav`, right after `setCurrent(url)`.

**Existing handoff-banner pattern to mirror for the tool-download disclosure/refusal banner** (lines 80, 248-260):
```typescript
const handoff = useMemo(() => getGameBananaImportHandoff(current), [current]);
...
{handoff && (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-accent/30 bg-accent/10 px-3 py-2 text-xs text-text-secondary">
        <span><Tx k="browser.importHandoff.note" fallback="This GameBanana item can be reviewed and installed from Grimoire." /></span>
        <button
            type="button"
            onClick={() => navigate(handoff.route)}
            className="flex items-center gap-1.5 rounded-sm border border-accent/40 bg-bg-tertiary px-2 py-1 text-xs text-text-primary transition-colors hover:border-accent/70"
        >
            <Download size={13} />
            <Tx k="browser.importHandoff.action" fallback="Review in Browse" />
        </button>
    </div>
)}
```
The tool-download disclosure/refusal state should follow this exact visual shape: a `border-accent/30 bg-accent/10` banner for the accept path (opens `useConfirm`, per D-08), and reuse the existing `border-warning/40 bg-warning/10` failure banner style (lines 242-246) for the refusal case (D-10).

**Failure banner style to reuse for refusal (D-10)** (lines 242-246):
```typescript
{failure && (
    <p className="rounded-sm border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-text-secondary">
        {failure}
    </p>
)}
```

---

### `src/lib/browserToolDownload.ts` (utility/IPC wrapper, event-driven) — NEW, fork-only

**Analog 1 (handoff shape):** `src/lib/browserImportHandoff.ts` (full file, 34 lines)
```typescript
export function getGameBananaImportHandoff(url: string): {
  item: GameBananaItemRef;
  route: string;
} | null {
  const item = parseGameBananaItemUrl(url);
  if (!item) return null;
  return {
    item,
    route: `/browse?item=${encodeURIComponent(`${item.section}:${item.id}`)}`,
  };
}
```
Follow this file's spirit: a small, pure, easily-testable function per concern, not a grab-bag module.

**Analog 2 (thin IPC wrapper idiom):** `src/lib/api.ts` lines 518-529
```typescript
export async function importCustomMods(
  items: ImportCustomModArgs[]
): Promise<ImportCustomModsBatchResult> {
  return window.electronAPI.importCustomMods({ items });
}

/** Subscribe to batch-import progress. Returns an unsubscribe function. */
export function onImportCustomModsProgress(
  callback: (progress: ImportCustomModsProgress) => void
): () => void {
  return window.electronAPI.onImportCustomModsProgress(callback);
}
```
`browserToolDownload.ts` should export the equivalent pair: a push-subscription function (`onPendingToolDownload`) and a resolve function (`resolvePendingToolDownload`), each a thin pass-through to `window.electronAPI.*`, mirroring this exact naming and return-an-unsubscriber convention. Also export a `setActiveBrowserDestinationKind(kind)` pass-through called from `Browser.tsx`'s `syncNav`.

---

### `electron/main/services/browserDownloadCapture.ts` (service, event-driven + file-I/O) — NEW, fork-only

**Analog:** `electron/main/services/browserContentFilter.ts` (full file, 306 lines) — closest existing analog for "a small module holding session-scoped mutable state plus an `attach(session)` entry point called from `did-attach-webview`."

**State-module shape to copy** (lines 61-80):
```typescript
interface FilterState {
    enabled: boolean;
    userListPath?: string;
    domains: Set<string>;
    blocked: number;
    userListError: string | null;
    attachedSessions: Set<Session>;
    injectedNetworkFilterIds: number[];
}

const state: FilterState = {
    enabled: true,
    domains: new Set(BUILTIN_BLOCKLIST),
    blocked: 0,
    userListError: null,
    attachedSessions: new Set(),
    injectedNetworkFilterIds: [],
};
```
`browserDownloadCapture.ts` needs the same style of module-scoped state: `activeDestinationKind: BrowserShortcutKind | null` (set via an exported `setActiveDestinationKind()` called from the new `ipc/browser.ts` handler), plus a `Map<string, PendingToolDownload>` keyed by a fresh id per pending download (per the Security Domain's confused-deputy mitigation — never reuse ids).

**Attach-to-session entry point to mirror** (lines 255-304, `attachBrowserFilter`):
```typescript
export function attachBrowserFilter(session: Session): void {
    if (session) {
        state.attachedSessions.add(session);
    }
    ...
    syncBlockerState().catch((err) => console.warn('[Adblocker] Sync on attach failed:', err));
}
```
Export an equivalent `attachDownloadCapture(session: Session)` called once from `did-attach-webview` (main/index.ts), following the same "attach once per session, idempotent, never throws" contract.

**Identity gate to call unmodified (D-03):** `electron/main/services/vpk.ts` lines 168-181 (`checkVpkFile`) and 201-212 (`describeVpkRejection`):
```typescript
export function checkVpkFile(filePath: string): VpkFileCheck {
    let fd: number | null = null;
    try {
        const stat = statSync(filePath);
        if (!stat.isFile()) {
            return { valid: false, format: 'unknown', label: FORMAT_LABELS.unknown, reason: 'Not a file.' };
        }
        if (stat.size === 0) {
            return { valid: false, format: 'empty', label: FORMAT_LABELS.empty, reason: 'The file is empty.' };
        }
        fd = openSync(filePath, 'r');
        const head = Buffer.alloc(Math.min(16, stat.size));
        readSync(fd, head, 0, head.length, 0);
        return identifyVpkBytes(head);
    } catch (error) { ... }
}

export function describeVpkRejection(displayName: string, check: VpkFileCheck): string {
    if (check.format === 'vpk') {
        return `${displayName} is not a usable VPK: ${check.reason ?? 'unreadable header.'}`;
    }
    if (isUnpackableArchiveFormat(check.format)) {
        return `${displayName} is a ${check.label}, not a VPK. Deadlock cannot load it.`;
    }
    if (check.format === 'empty') {
        return `${displayName} is empty, not a VPK.`;
    }
    return `${displayName} is not a VPK (...). Deadlock cannot load it.`;
}
```
Call these directly on the temp path inside `item.once('done', ...)` (per RESEARCH.md Pattern 1/D-10) — do not reimplement magic-byte sniffing.

**`will-download` handler this service's exported function replaces the body of** (`electron/main/index.ts` lines 400-405, current unconditional behavior):
```typescript
// Downloads inside an embedded browser have no UI to manage them and
// would write to disk unattended, so hand them off too.
guest.session.on('will-download', (event, item) => {
    event.preventDefault();
    openExternalSafe(item.getURL());
});
```
This becomes a kind-conditional branch (RESEARCH.md Pattern 1) — the non-tool branch keeps this exact preventDefault+openExternalSafe body; the `kind === 'tool'` branch calls into the new service's `handleToolDownload(item)` instead, which must call `item.setSavePath()` synchronously before any async work (Pitfall 3).

---

### `electron/main/ipc/browser.ts` (route/controller, request-response + event-driven push) — NEW, fork-only

**Analog:** `electron/main/ipc/mods.ts` — the `import-custom-mods` handler and its progress-push convention (lines 1411-1447+):
```typescript
// import-custom-mods - batch local import.
//
// Progress is streamed to the requesting renderer via 'import-custom-mods-progress'
// so long copies aren't a frozen dialog.
ipcMain.handle(
    'import-custom-mods',
    async (event, args: ImportCustomModsBatchArgs): Promise<ImportCustomModsBatchResult> => {
        ...
        if (!event.sender.isDestroyed()) event.sender.send('import-custom-mods-progress', progress);
        ...
    }
);
```
`ipc/browser.ts` needs: (1) an `ipcMain.on`/small handler to receive the renderer's active-kind push (`browser:set-active-destination-kind`) calling into `browserDownloadCapture.setActiveDestinationKind`; (2) an `ipcMain.handle('browser:resolve-tool-download', ...)` for the confirm/cancel round-trip, calling `importCustomModSource`'s existing entry point (via the `import-custom-mods` IPC contract, i.e. reuse `importCustomMods`/`ImportCustomModArgs`, not a new install code path) on accept, and cleanup-only on cancel. The push side (`browser:pending-tool-download`) should use the same `event.sender.send(...)`-after-`isDestroyed()`-check guard shown above, called from `browserDownloadCapture`'s `item.once('done', ...)` callback once `checkVpkFile` has classified the temp file.

**Final destination call this handler reuses verbatim (D-01/D-02/D-03):** `electron/main/ipc/mods.ts` lines 1260-1397 (`importCustomModSource`) — already accepts `{ vpkPath, name, nsfw }` and does allocate+copy+metadata-stamp; call through the existing `import-custom-mods` channel/args shape (`ImportCustomModArgs` in `src/types/electron.ts` lines 302-312), not a bespoke import function.

---

### `electron/preload/index.ts` (bridge, event-driven push + request-response) — MODIFIED

**Analog:** the existing push-subscription pair for `vpk-impostors-found` (lines 140-144) and the batch-import progress push (lines 291-298):
```typescript
onVpkImpostorsFound: (callback: (reports: VpkImpostorReport[]) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, reports: VpkImpostorReport[]) => callback(reports);
    ipcRenderer.on('vpk-impostors-found', listener);
    return () => ipcRenderer.removeListener('vpk-impostors-found', listener);
},
...
importCustomMods: (args: ImportCustomModsBatchArgs) =>
    ipcRenderer.invoke('import-custom-mods', args),
onImportCustomModsProgress: (callback: (progress: ImportCustomModsProgress) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: ImportCustomModsProgress) =>
        callback(progress);
    ipcRenderer.on('import-custom-mods-progress', handler);
    return () => ipcRenderer.removeListener('import-custom-mods-progress', handler);
},
```
Add to the same bridge object, in the same style: `onPendingToolDownload` (mirrors `onVpkImpostorsFound`'s shape exactly — listener/unsubscribe pair), `resolvePendingToolDownload` (mirrors `importCustomMods`'s `invoke` shape), and `setActiveBrowserDestinationKind` (a fire-and-forget `ipcRenderer.send`, since there's no reply needed — no existing exact analog for a one-way `send`, but this is the standard preload idiom; grep the file for any existing `ipcRenderer.send(` call before inventing the wrapper shape if one exists).

---

### `src/types/electron.ts` / `src/lib/api.ts` (types + thin wrapper, request-response) — MODIFIED

**Analog:** `ImportCustomModArgs` and the `importCustomMods`/`onImportCustomModsProgress` pair, already cited above (`src/types/electron.ts` lines 302-312, `src/lib/api.ts` lines 518-529). Add a `PendingToolDownload` interface (`{ id: string; name: string; detectedKind: string }` shape per RESEARCH.md's Pattern 2) beside `ImportCustomModArgs`, and thin wrapper functions in `api.ts` beside `importCustomMods`/`onImportCustomModsProgress`, following their exact naming/shape convention (`onPendingToolDownload`, `resolvePendingToolDownload`).

---

### `src/locales/en/translation.json` (i18n catalog, config) — MODIFIED

**Analog:** existing `browser.*` namespace (around line 3556) and the "will write X" phrasing precedent at line 345:
```json
"willCreate": "Will create: {{name}}.vpk",
```
New keys (all under `browser.*`, per house style — every visible string is an i18n key, no em-dashes): a disclosure key parameterized like `willCreate` (e.g. `browser.toolDownload.disclosure": "Added to your mod library as {{name}}."` matching D-09's exact one-sentence phrasing), and a refusal key mirroring `describeVpkRejection`'s voice (D-10) — do not invent new rejection wording; parameterize the existing `vpk.ts` rejection string shape (detected type name) into the i18n key.

## Shared Patterns

### Guest hardening / permission-floor precedent (D-12)
**Source:** `electron/main/services/browserContentFilter.ts` lines 260-270 (`attachBrowserFilter`'s permission floor — deny-by-default except fullscreen, because there's no UI to evaluate an ad hoc prompt)
**Apply to:** `browserDownloadCapture.ts`'s design rationale — the "grant" for download capture is pre-decided by the catalog's `kind` field (app-declared), never requested at runtime by page content, exactly mirroring why the permission handler here is a blanket deny rather than a prompt.

### `openExternalSafe` — untouched non-tool path (D-11)
**Source:** `electron/main/index.ts` lines 167-172 (`openExternalSafe`) and 400-405 (current `will-download` handler)
**Apply to:** The `kind !== 'tool'` branch of the modified `will-download` handler must call this exact function unchanged; do not introduce a second external-open path.

### Identity gate (D-03)
**Source:** `electron/main/services/vpk.ts` `checkVpkFile`/`describeVpkRejection` (lines 168-212), consumed via `electron/main/services/extract.ts` `resolveInstallableVpk` (lines 373-392, already read in RESEARCH.md)
**Apply to:** Both `browserDownloadCapture.ts` (classifying the temp file before disclosure) and, if the accepted file turns out to be an archive-wrapping-one-VPK, the existing `importCustomModSource` path already re-applies this gate — no double implementation needed.

### Confirm hook (D-08)
**Source:** `src/components/common/confirmContext.ts` lines 37-41 (`useConfirm`)
**Apply to:** `Browser.tsx`'s disclosure step — call `useConfirm()({ title, message, variant: 'primary' })` on receiving a `pending-tool-download` push, exactly as any other destructive/consequential action in the app already does (see house pattern note in the file's own doc comment: "twelve destructive confirmations were `window.confirm`... this hook replaces them").

### Push-subscription pair convention
**Source:** `electron/preload/index.ts` lines 140-144 (`onVpkImpostorsFound`) and 293-298 (`onImportCustomModsProgress`); wrapped again in `src/lib/api.ts` lines 525-529 (`onImportCustomModsProgress`)
**Apply to:** Every new main-to-renderer push in this phase (`browser:pending-tool-download`) should use this exact three-layer shape: `ipcMain`/service emits via `event.sender.send(...)`, preload exposes `on<Name>(callback) -> unsubscribe`, `api.ts` re-exports a same-named thin wrapper for renderer code to import from `lib/api` rather than `window.electronAPI` directly.

## No Analog Found

None. Every file in scope has a strong same-repo analog; this phase's own stated design intent (RESEARCH.md: "every piece of 'don't hand-roll' here is something this exact codebase already built for a different entry point") holds — no file requires inventing a new architectural shape.

## Metadata

**Analog search scope:** `src/pages/`, `src/lib/`, `src/components/common/`, `electron/main/index.ts`, `electron/main/ipc/mods.ts`, `electron/main/services/vpk.ts`, `electron/main/services/extract.ts`, `electron/main/services/browserContentFilter.ts`, `electron/preload/index.ts`, `src/types/electron.ts`, `src/locales/en/translation.json`
**Files scanned:** 10 read directly (full or targeted ranges), all cross-referenced against RESEARCH.md's own already-verified line citations to avoid re-reading ranges already confirmed there
**Pattern extraction date:** 2026-08-07
