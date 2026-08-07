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
ipcMain.on('browser:set-active-destination', (_event, kind: unknown, origin: unknown) => {
    setActiveDestination(isValidKind(kind) ? kind : null, typeof origin === 'string' ? origin : null);
});

// Resolve a pending tool download: accept routes it through the exact same
// install path import-custom-mods uses (D-01/D-02/D-03); decline discards the
// temp file. Every path removes the id from the pending map exactly once
// (takePendingToolDownload does the lookup-and-delete atomically) and deletes
// the temp file exactly once (the `finally` below).
ipcMain.handle(
    'browser:resolve-tool-download',
    async (_event, id: string, accepted: boolean): Promise<ResolveToolDownloadResult> => {
        const entry = takePendingToolDownload(id);
        if (!entry) return { ok: false, stale: true };

        try {
            if (!accepted) return { ok: false, stale: false };

            const deadlockPath = getActiveDeadlockPath();
            if (!deadlockPath) return { ok: false, error: 'No Deadlock path configured' };

            // No file-copy, slot-allocation, or metadata write of its own:
            // the accepted branch reaches the mod library only through this
            // shared entry point, identical to drag-drop and custom import.
            await runExclusiveModMutation(() =>
                importCustomModSource(
                    deadlockPath,
                    { vpkPath: entry.tempPath, name: entry.displayName, nsfw: false },
                    []
                )
            );
            return { ok: true };
        } catch (err) {
            return { ok: false, error: err instanceof Error ? err.message : String(err) };
        } finally {
            await deleteTempFileQuietly(entry.tempPath);
        }
    }
);
