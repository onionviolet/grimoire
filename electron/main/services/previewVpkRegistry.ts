/**
 * Handles for temporary VPK builds that exist only to be looked at.
 *
 * The Foundry build tray can be previewed on the live 3D model, which means the
 * pose pipeline has to merge a VPK that no installed mod owns. The renderer must
 * not name that file: `resolveSources` feeds whatever it gets straight into
 * vpkmerge, so a renderer-supplied absolute path would be an arbitrary-file read
 * dressed up as a preview. Main builds the VPK, registers it here, and hands
 * back an opaque id; the pose pipeline trades the id back for the path.
 *
 * Nothing here ever writes to the addons folder. A registered preview lives in
 * the build temp and is removed when it is released or superseded.
 */
import { randomUUID } from 'crypto';

interface PreviewEntry {
    vpkPath: string;
    cleanup: () => Promise<void>;
}

const previews = new Map<string, PreviewEntry>();

export function registerPreviewVpk(vpkPath: string, cleanup: () => Promise<void>): string {
    const id = `preview-${randomUUID()}`;
    previews.set(id, { vpkPath, cleanup });
    return id;
}

/** The on-disk VPK for a registered preview, or null if the id is unknown
 *  (released, superseded, or never issued). Callers treat null as "no source",
 *  which degrades to previewing the installed stack alone. */
export function resolvePreviewVpk(id: string): string | null {
    return previews.get(id)?.vpkPath ?? null;
}

/** Drop a preview and remove its build temp. Idempotent: releasing an id twice,
 *  or one that was never registered, is a no-op rather than an error, because
 *  the renderer releases on unmount and cannot know what main already cleaned. */
export async function releasePreviewVpk(id: string): Promise<void> {
    const entry = previews.get(id);
    if (!entry) return;
    previews.delete(id);
    await entry.cleanup().catch(() => {});
}

/** Release everything. Used on app quit so a preview cannot outlive the session
 *  that opened it. */
export async function releaseAllPreviewVpks(): Promise<void> {
    const ids = [...previews.keys()];
    await Promise.all(ids.map((id) => releasePreviewVpk(id)));
}

/** Test/diagnostic view of what is currently registered. */
export function registeredPreviewCount(): number {
    return previews.size;
}
