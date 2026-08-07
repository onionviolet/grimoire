import { ipcMain } from 'electron';
import { getActiveDeadlockPath } from '../services/settings';
import { runExclusiveModMutation } from '../services/mods';
import {
    deleteTempFileQuietly,
    setActiveDestination,
    takePendingToolDownload,
} from '../services/browserDownloadCapture';
import { importCustomModSource } from './mods';
import type { BrowserDestinationKind } from '../../../src/lib/browserCatalog';
import type { ResolveToolDownloadResult } from '../../../src/types/electron';

/**
 * IPC surface for the in-app browser's tool-download disclosure round trip
 * (D-08/D-09/D-11). Registers at import time, in the style of `ipc/servers.ts`.
 */

const VALID_KINDS: readonly BrowserDestinationKind[] = ['mod-host', 'reference', 'tool', 'community-feed'];

function isValidKind(value: unknown): value is BrowserDestinationKind {
    return typeof value === 'string' && (VALID_KINDS as readonly string[]).includes(value);
}

// The renderer pushes the derived active destination on every navigation
// event (Pattern 3), not just on shortcut click. A malformed or unrecognized
// kind is treated as null (no capture), never trusted as-is.
ipcMain.on('browser:set-active-destination', (_event, kind: unknown, origin: unknown, label: unknown) => {
    setActiveDestination(
        isValidKind(kind) ? kind : null,
        typeof origin === 'string' ? origin : null,
        typeof label === 'string' ? label : null
    );
});

/** Dependencies `resolvePendingToolDownload` needs beyond the shared pending
 *  map: the install call and the temp-file cleanup call, both injectable so
 *  the resolve contract is testable without `ipcMain` or a real mod library
 *  write (electron/main/ipc/mods.ts lines 1411-1450's isDestroyed-guard /
 *  handler-return-shape convention is otherwise followed as-is). */
export interface ResolvePendingToolDownloadDeps {
    install: (args: { vpkPath: string; name: string; nsfw: boolean }, deadlockPath: string) => Promise<unknown>;
    deleteTempFile: (path: string) => Promise<void>;
}

const defaultResolveDeps: ResolvePendingToolDownloadDeps = {
    // No file-copy, slot-allocation, or metadata write of its own: the
    // accepted branch reaches the mod library only through this shared entry
    // point, identical to drag-drop and custom import.
    install: (args, deadlockPath) =>
        runExclusiveModMutation(() => importCustomModSource(deadlockPath, args, [])),
    deleteTempFile: deleteTempFileQuietly,
};

/**
 * Resolve a pending tool download: accept routes it through the exact same
 * install path import-custom-mods uses (D-01/D-02/D-03); decline discards the
 * temp file. `takePendingToolDownload` removes the id from the pending map as
 * the FIRST action after a successful lookup, so a concurrent second resolve
 * for the same id (double-resolve, or a resolve arriving after `replacePending`
 * evicted the entry) always finds it absent and returns stale, never a second
 * import (T-06-07). The temp file is deleted exactly once, in the `finally`
 * below, on every path (accept, decline, error).
 */
export async function resolvePendingToolDownload(
    id: string,
    accepted: boolean,
    deps: ResolvePendingToolDownloadDeps = defaultResolveDeps
): Promise<ResolveToolDownloadResult> {
    const entry = takePendingToolDownload(id);
    if (!entry) return { ok: false, stale: true };

    try {
        if (!accepted) return { ok: false, stale: false };

        const deadlockPath = getActiveDeadlockPath();
        if (!deadlockPath) return { ok: false, error: 'No Deadlock path configured' };

        await deps.install({ vpkPath: entry.tempPath, name: entry.displayName, nsfw: false }, deadlockPath);
        return { ok: true };
    } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
    } finally {
        await deps.deleteTempFile(entry.tempPath);
    }
}

ipcMain.handle(
    'browser:resolve-tool-download',
    (_event, id: string, accepted: boolean): Promise<ResolveToolDownloadResult> =>
        resolvePendingToolDownload(id, accepted)
);
