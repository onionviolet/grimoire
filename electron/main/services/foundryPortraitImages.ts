/**
 * Staging store for portrait-editor output.
 *
 * The Foundry staging contract (`prepareVisualStagedEdit` -> `VisualReplacementDraft`)
 * records an absolute PNG **path**, because a staged edit must survive review and
 * be re-read at forge time. The portrait editor authors its image in the renderer
 * (canvas), so the baked PNG has to land on disk before it can be staged.
 *
 * This module is that landing spot and nothing more. It never installs, enables,
 * or reorders a mod, and it never touches the game directory: it writes a
 * validated PNG into a bounded cache under userData and hands back the path the
 * existing staging contract already expects.
 *
 *   userData/foundry-portrait-edits/<sha256-of-bytes>.png
 *
 * Content-addressed, so re-staging the same crop reuses one file instead of
 * growing the cache, and the pruner keeps the directory under an explicit budget
 * (oldest-first by mtime, same shape as the mod-clip cache).
 */
import { promises as fs } from 'fs';
import { createHash } from 'crypto';
import { join } from 'path';
import { app } from 'electron';

/** PNG signature. The editor bakes PNG; anything else is rejected rather than
 *  written under a `.png` name that the forge would later fail to read. */
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Refuse an absurd payload outright: a card-sized PNG is well under this. */
const MAX_IMAGE_BYTES = 32 * 1024 * 1024;

/** Explicit cache budget for the staging directory (lane D's cache-budget rule
 *  applies here too: state the bound rather than growing without one). */
const KEEP_BYTES = 64 * 1024 * 1024;

export function portraitEditsRoot(): string {
    return join(app.getPath('userData'), 'foundry-portrait-edits');
}

/**
 * Decode a `data:image/png;base64,...` URL into PNG bytes.
 *
 * Pure and exported so the validation is testable without an Electron app: an
 * unexpected media type, malformed base64, an oversized payload, or bytes that
 * are not actually a PNG all throw here rather than producing a broken file.
 */
export function decodePortraitPngDataUrl(dataUrl: string): Buffer {
    const match = /^data:image\/png;base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl.trim());
    if (!match) throw new Error('The portrait editor produced something that is not a PNG data URL.');
    const bytes = Buffer.from(match[1].replace(/\s+/g, ''), 'base64');
    if (bytes.length === 0) throw new Error('The portrait editor produced an empty image.');
    if (bytes.length > MAX_IMAGE_BYTES) {
        throw new Error(`The portrait image is larger than the ${Math.round(MAX_IMAGE_BYTES / (1024 * 1024))} MB staging limit.`);
    }
    if (!bytes.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC)) {
        throw new Error('The portrait image is not a PNG.');
    }
    return bytes;
}

/**
 * Write a baked portrait PNG into the staging cache and return its absolute
 * path, ready to hand to `prepareVisualStagedEdit` as `imagePath`.
 */
export async function writeFoundryPortraitImage(dataUrl: string): Promise<string> {
    const bytes = decodePortraitPngDataUrl(dataUrl);
    const dir = portraitEditsRoot();
    await fs.mkdir(dir, { recursive: true });
    const target = join(dir, `${createHash('sha256').update(bytes).digest('hex')}.png`);
    // Content-addressed: an identical crop staged twice is one file. Rewriting is
    // harmless and repairs a truncated earlier write.
    await fs.writeFile(target, bytes);
    await prunePortraitEdits();
    return target;
}

/** One previously staged portrait image, offered back as an intake source. */
export interface StagedPortraitImage {
    path: string;
    /** The PNG re-encoded as a data URL, so the renderer can show and re-crop it
     *  without a privileged scheme for a handful of card-sized files. */
    dataUrl: string;
    mtimeMs: number;
}

/**
 * The most recently staged portrait images, newest first.
 *
 * The Foundry editor previously required a file drop every single time, while
 * the Locker's picker could reuse images it already had. This is the reuse half:
 * the staging cache is already a content-addressed record of every image the
 * user framed, so offering it back costs no new store.
 *
 * Read-only, and bounded by `limit` so a large cache cannot turn into a large
 * IPC payload.
 */
export async function listFoundryPortraitImages(limit = 12): Promise<StagedPortraitImage[]> {
    try {
        const dir = portraitEditsRoot();
        const names = await fs.readdir(dir);
        const stats = await Promise.all(
            names
                .filter((name) => name.toLowerCase().endsWith('.png'))
                .map(async (name) => {
                    const path = join(dir, name);
                    const info = await fs.stat(path).catch(() => null);
                    return info?.isFile() ? { path, mtimeMs: info.mtimeMs } : null;
                })
        );
        const newest = stats
            .filter((entry): entry is NonNullable<typeof entry> => !!entry)
            .sort((a, b) => b.mtimeMs - a.mtimeMs)
            .slice(0, Math.max(0, limit));
        const loaded = await Promise.all(
            newest.map(async (entry) => {
                const bytes = await fs.readFile(entry.path).catch(() => null);
                if (!bytes) return null;
                return {
                    path: entry.path,
                    dataUrl: `data:image/png;base64,${bytes.toString('base64')}`,
                    mtimeMs: entry.mtimeMs,
                };
            })
        );
        return loaded.filter((entry): entry is StagedPortraitImage => !!entry);
    } catch {
        // A missing cache root just means nothing has been staged yet.
        return [];
    }
}

/** Keep the staging cache under its budget, newest-first. Best effort: a missing
 *  root or an in-use file must never fail a staging attempt. */
export async function prunePortraitEdits(keepBytes = KEEP_BYTES): Promise<void> {
    try {
        const dir = portraitEditsRoot();
        const names = await fs.readdir(dir);
        const stats = await Promise.all(
            names.map(async (name) => {
                const path = join(dir, name);
                const info = await fs.stat(path).catch(() => null);
                return info?.isFile() ? { path, size: info.size, mtime: info.mtimeMs } : null;
            })
        );
        const live = stats
            .filter((entry): entry is NonNullable<typeof entry> => !!entry)
            .sort((a, b) => b.mtime - a.mtime);
        let total = 0;
        for (const entry of live) {
            total += entry.size;
            if (total > keepBytes) await fs.rm(entry.path, { force: true });
        }
    } catch {
        /* best-effort: a missing cache root is fine */
    }
}
