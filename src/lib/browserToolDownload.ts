import type { BrowserDestinationKind } from './browserCatalog';
import type { BrowserToolDownloadEvent, ResolveToolDownloadResult } from '../types/electron';

/**
 * Thin pass-throughs to `window.electronAPI` for the tool-download capture
 * round trip (D-08/D-09/D-11). Kept here rather than in `src/lib/api.ts`
 * because `api.ts` is shared and modified at the upstream boundary while this
 * file is fork-only, following the shape of `browserImportHandoff.ts`.
 */

/** Subscribe to the main process's pending-tool-download push. Returns an
 *  unsubscribe function, mirroring `onImportCustomModsProgress`. */
export function onBrowserToolDownload(
    callback: (event: BrowserToolDownloadEvent) => void
): () => void {
    return window.electronAPI.onBrowserToolDownload(callback);
}

/** Answer a pending tool download: `accepted` installs it through the
 *  existing import-custom-mods path, decline discards the temp file. */
export function resolveToolDownload(id: string, accepted: boolean): Promise<ResolveToolDownloadResult> {
    return window.electronAPI.resolveToolDownload(id, accepted);
}

/** Fire-and-forget: tell main which catalog destination (if any) the guest's
 *  current URL resolves to, so `will-download` knows whether to capture. */
export function setActiveBrowserDestination(kind: BrowserDestinationKind | null, origin: string | null): void {
    window.electronAPI.setActiveBrowserDestination(kind, origin);
}
