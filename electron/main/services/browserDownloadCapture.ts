import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { app, type DownloadItem, type Session, type WebContents } from 'electron';
import { checkVpkFile, describeVpkRejection } from './vpk';
import { getMainWindow, openExternalSafe } from '../index';
import type { BrowserDestinationKind } from '../../../src/lib/browserCatalog';
import type { BrowserToolDownloadEvent } from '../../../src/types/electron';

/**
 * `will-download` capture for the in-app browser's `kind: 'tool'` destination
 * (D-11/D-13). Shaped after `browserContentFilter.ts`: a small module holding
 * session-scoped mutable state plus an attach(session) entry point called
 * from `did-attach-webview`.
 *
 * Every non-tool destination, and any address-bar-typed URL, keeps today's
 * unconditional `preventDefault()` + `openExternalSafe()` behavior (D-11);
 * only a download that both (a) fires while the active destination's
 * declared kind is 'tool' AND (b) the guest's LIVE top-level URL origin still
 * equals the origin the renderer pushed alongside that kind gets redirected
 * into Grimoire's own temp directory (T-06-01).
 */

/** The active in-app-browser destination, as pushed by the renderer on every
 *  navigation event (`browser:set-active-destination`). Derived from the
 *  live URL on every nav, never "last shortcut clicked" (Pattern 3). `label`
 *  is the catalog entry's display label, carried alongside kind/origin so a
 *  download's in-flight/replaced toast can name its source without a second
 *  catalog lookup in the main process. */
interface ActiveDestination {
    kind: BrowserDestinationKind | null;
    origin: string | null;
    /** Optional so call sites/fixtures that only care about kind/origin
     *  (e.g. `shouldCaptureToolDownload`'s existing tests) need not supply it. */
    label?: string | null;
}

interface PendingToolDownload {
    id: string;
    tempPath: string;
    displayName: string;
}

interface CaptureState {
    activeDestination: ActiveDestination;
    /** Keyed by a fresh randomUUID() per completed, classified download.
     *  Never reused (T-06-04's confused-deputy mitigation). */
    pending: Map<string, PendingToolDownload>;
    attachedSessions: Set<Session>;
}

const state: CaptureState = {
    activeDestination: { kind: null, origin: null, label: null },
    pending: new Map(),
    attachedSessions: new Set(),
};

/** The only writer of the active-destination state. Called from
 *  `ipc/browser.ts`'s `browser:set-active-destination` handler. */
export function setActiveDestination(
    kind: BrowserDestinationKind | null,
    origin: string | null,
    label: string | null
): void {
    state.activeDestination = { kind, origin, label };
}

/**
 * Pure predicate: should this download be captured into Grimoire's mod
 * library rather than handed off to the system browser? True only when the
 * active destination's declared kind is 'tool' AND the guest's live
 * top-level URL origin still equals the origin the renderer pushed alongside
 * that kind. This is the defence against a tool page redirecting elsewhere
 * and inheriting its capture grant (T-06-01).
 */
export function shouldCaptureToolDownload(active: ActiveDestination, liveGuestUrl: string): boolean {
    if (active.kind !== 'tool' || !active.origin) return false;
    try {
        return new URL(liveGuestUrl).origin === active.origin;
    } catch {
        return false;
    }
}

/** Grimoire-owned temp root for captured tool downloads, under the current
 *  process's own userData directory (so it is per-slot isolated, never the
 *  shared OS Downloads folder). Takes the root as a parameter so it is
 *  testable without `app`. */
export function toolDownloadTempRoot(userDataDir: string): string {
    return join(userDataDir, 'browser-downloads');
}

/** A fresh, collision-free temp path under `root`, independent of the
 *  suggested filename (Pitfall 4): two Build VPK clicks in one session must
 *  allocate two distinct paths, never silently overwrite one pending file
 *  with another. */
export function allocateToolDownloadTempPath(root: string, _suggestedFilename: string): string {
    return join(root, `${randomUUID()}.download`);
}

/** A safe display name for the disclosure/refusal copy: trims, strips any
 *  path separators (a blob download's suggested filename is untrusted input),
 *  and falls back when the result is empty or has no extension. */
export function displayNameForDownload(suggestedFilename: string, fallback: string): string {
    const trimmed = (suggestedFilename ?? '').trim();
    const basename = trimmed.split(/[/\\]/).pop() ?? '';
    if (!basename || !/\.[^./\\]+$/.test(basename)) return fallback;
    return basename;
}

/** Classify a completed temp download against the shared VPK identity gate
 *  (D-03). Never reimplements magic-byte sniffing: `checkVpkFile` is the one
 *  place that happens. */
export function classifyToolDownload(
    tempPath: string,
    displayName: string
): { ok: true } | { ok: false; reason: string } {
    const check = checkVpkFile(tempPath);
    if (check.valid) return { ok: true };
    return { ok: false, reason: describeVpkRejection(displayName, check) };
}

/** Delete a temp file, tolerating "already gone". Exported so `ipc/browser.ts`
 *  reuses the same cleanup rather than a second unlink-and-ignore path. */
export async function deleteTempFileQuietly(path: string): Promise<void> {
    try {
        await unlink(path);
    } catch {
        // Already deleted, or the download never fully wrote a file. Nothing
        // else to clean up.
    }
}

/** Look up and remove a pending entry in one step, so every resolve path
 *  (accept, decline, stale) removes the id from the map exactly once. */
export function takePendingToolDownload(id: string): PendingToolDownload | null {
    const entry = state.pending.get(id);
    if (!entry) return null;
    state.pending.delete(id);
    return entry;
}

/** Every id currently pending disclosure. Exists for introspection (tests,
 *  diagnostics); production code never needs to enumerate the map, only to
 *  take a single entry by id. */
export function pendingToolDownloadIds(): string[] {
    return [...state.pending.keys()];
}

/** Enforces the single-pending-download invariant: only one tool download's
 *  disclosure can be unanswered at a time (UI-SPEC zero-one-many row). Before
 *  accepting a newly classified download, evicts whatever was pending,
 *  deleting its temp file and pushing `replaced` naming the tool that
 *  superseded it, so a resolve arriving later for the evicted id finds it
 *  absent from the map and returns stale (T-06-07's confused-deputy
 *  mitigation: `takePendingToolDownload` cannot tell "never issued" apart
 *  from "superseded", and does not need to). */
export async function replacePending(entry: PendingToolDownload, tool: string): Promise<void> {
    for (const [previousId, previous] of state.pending) {
        state.pending.delete(previousId);
        await deleteTempFileQuietly(previous.tempPath);
        pushToolDownloadEvent({ status: 'replaced', id: previousId, tool });
    }
    state.pending.set(entry.id, entry);
}

function pushToolDownloadEvent(payload: BrowserToolDownloadEvent): void {
    const win = getMainWindow();
    if (win && !win.isDestroyed() && !win.webContents.isDestroyed()) {
        win.webContents.send('browser:tool-download', payload);
    }
}

/** The guest's live top-level URL, or '' when it cannot be read (treated as
 *  unmatched by `shouldCaptureToolDownload`, never as a free pass). The
 *  initiating WebContents is `will-download`'s third callback argument, not a
 *  method on DownloadItem itself. */
function liveGuestUrl(webContents: WebContents): string {
    try {
        return webContents.getURL();
    } catch {
        return '';
    }
}

/** The label to show in the in-flight/replaced toasts: the catalog label the
 *  renderer last pushed alongside the active destination, or the guest URL's
 *  host when no label is known (e.g. it arrived null/empty). Captured once,
 *  synchronously, at `will-download` time rather than read lazily out of
 *  `state.activeDestination` later, since the guest can navigate away while
 *  this download is still writing (RESEARCH Pattern 3). */
function toolLabelFor(active: ActiveDestination, liveUrl: string): string {
    if (active.label) return active.label;
    try {
        return new URL(liveUrl).host;
    } catch {
        return '';
    }
}

/** Registers the async classify-and-disclose continuation for a download
 *  whose save path has already been set. Split out from the will-download
 *  listener so `item.setSavePath(...)` can be the literal, unqualified first
 *  statement of the tool branch below (Pitfall 3) with nothing async or
 *  IPC-shaped preceding it. `tool` is captured at will-download time (see
 *  `toolLabelFor`) and threaded through to the eventual `replaced` push. */
function registerToolDownloadCompletion(item: DownloadItem, tempPath: string, tool: string): void {
    const displayName = displayNameForDownload(item.getFilename(), 'Browser download');

    item.once('done', async (_event, downloadState) => {
        if (downloadState !== 'completed') {
            // Cancelled, interrupted, or any other non-completed terminal
            // state: no confirm was ever shown, and none can be now, so the
            // renderer only needs to know the in-flight toast is done.
            await deleteTempFileQuietly(tempPath);
            pushToolDownloadEvent({ status: 'failed', id: randomUUID() });
            return;
        }

        const classification = classifyToolDownload(tempPath, displayName);
        if (!classification.ok) {
            // Refused before any pending-map entry exists (this line runs
            // before `replacePending` below), so a refused download can
            // never reach the confirm dialog (D-10).
            await deleteTempFileQuietly(tempPath);
            pushToolDownloadEvent({ status: 'refused', id: randomUUID(), reason: classification.reason });
            return;
        }

        const id = randomUUID();
        // Evicts whatever was pending (at most one entry) before this one
        // becomes the pending download, so the single-pending invariant
        // holds even across two Build VPK clicks in one session.
        await replacePending({ id, tempPath, displayName }, tool);
        pushToolDownloadEvent({ status: 'ready', id, name: displayName });
    });
}

/**
 * Attach the capture handler to the browser partition's session. Idempotent
 * by `attachedSessions.has(session)`, mirroring `attachBrowserFilter`'s
 * attach-once contract: re-entering the Browser page re-runs
 * `did-attach-webview` but never registers a second `will-download` listener,
 * so one download is handled exactly once.
 */
export function attachBrowserDownloadCapture(session: Session): void {
    if (state.attachedSessions.has(session)) return;
    state.attachedSessions.add(session);

    const root = toolDownloadTempRoot(app.getPath('userData'));
    try {
        mkdirSync(root, { recursive: true });
    } catch (err) {
        console.warn('[BrowserDownloadCapture] Failed to create temp root:', err);
    }

    session.on('will-download', (event, item, webContents) => {
        if (!shouldCaptureToolDownload(state.activeDestination, liveGuestUrl(webContents))) {
            // Unchanged from today's behavior (D-11, D-12): every destination
            // that is not a declared 'tool', and any address-bar-typed URL,
            // is handed off to the system browser exactly as before.
            event.preventDefault();
            openExternalSafe(item.getURL());
            return;
        }

        // FIRST synchronous statement of the tool branch (Pitfall 3): no
        // await, .then, or IPC round trip precedes this call, so Chromium
        // never gets a chance to apply its default (silent,
        // OS-Downloads-folder) save behavior first.
        item.setSavePath(allocateToolDownloadTempPath(root, item.getFilename()));
        const tool = toolLabelFor(state.activeDestination, liveGuestUrl(webContents));
        registerToolDownloadCompletion(item, item.getSavePath(), tool);
        // Pushed last, after the save path is set and the completion
        // listener is registered, so the renderer's in-flight toast can
        // never precede Chromium actually starting to write the bytes.
        pushToolDownloadEvent({ status: 'started', id: randomUUID(), tool });
    });
}
