/**
 * Source-image thumbnails for the Foundry alternatives gallery.
 *
 * A visual Foundry change records the user's own source image: a build keeps the
 * absolute path in its re-forge request (`FoundryForgeEdit` -> `imagePath`), so a
 * preview of "what this alternative actually is" can be derived rather than
 * guessed from a label. This module is the only thing that turns such a path into
 * something the renderer can display.
 *
 * It deliberately does **not** invent a second cache or a second protocol. The
 * PNGs land in a reserved subtree of the existing Foundry thumbnail root and are
 * served by the existing `grimoire-foundry:` handler:
 *
 *   userData/foundry-thumbs/_sources/img/<sha256>.png
 *
 * Two consequences that are the whole point of doing it this way: the renderer
 * still cannot read arbitrary files (it receives a scheme URL for a file main
 * chose to cache, never a path it can forge), and `pruneStaleFingerprints` skips
 * this subtree because it is keyed by the user's files, not by a pak build.
 *
 * **Cache budget (explicit, per the lane's requirement).**
 *   - 128 px longest edge, matching the catalog grid's `THUMB_SIZE`.
 *   - At most 256 cached PNGs and 32 MB total, whichever binds first. Pruned
 *     newest-first, so the oldest-touched entries go.
 *   - A source file over 32 MB is not thumbnailed at all: the gallery falls back
 *     to the kind icon rather than decoding an absurd input.
 * At 128 px a thumbnail is a few KB, so the file count is the bound that
 * realistically binds and 32 MB is headroom, not a target.
 */
import { promises as fs } from 'fs';
import { createHash } from 'crypto';
import { join } from 'path';
import { nativeImage } from 'electron';
import { FOUNDRY_SOURCE_THUMB_DIR, FOUNDRY_THUMB_SCHEME, thumbsRoot } from './foundryCatalog';

/** Longest edge of a generated thumbnail, in px. */
export const SOURCE_THUMB_SIZE = 128;

/** Largest source image we will decode. Bigger inputs are refused outright. */
export const MAX_SOURCE_BYTES = 32 * 1024 * 1024;

/** Cache bounds. Whichever binds first wins. */
export const KEEP_BYTES = 32 * 1024 * 1024;
export const KEEP_FILES = 256;

/** Second path segment: the protocol handler wants exactly three components. */
const SOURCE_THUMB_CATEGORY = 'img';

export function sourceThumbsDir(): string {
    return join(thumbsRoot(), FOUNDRY_SOURCE_THUMB_DIR, SOURCE_THUMB_CATEGORY);
}

/**
 * Cache identity for one source file: its path plus the size and mtime of the
 * bytes we thumbnailed. Re-saving an image under the same name therefore produces
 * a new key instead of serving a stale preview of the previous content, which is
 * the same invalidation rule `ensureModClip` uses for audio.
 */
export function sourceThumbKey(path: string, size: number, mtimeMs: number): string {
    return createHash('sha256').update(`${path}|${size}|${Math.trunc(mtimeMs)}`).digest('hex');
}

export function sourceThumbUrl(file: string): string {
    return `${FOUNDRY_THUMB_SCHEME}://t/${encodeURIComponent(FOUNDRY_SOURCE_THUMB_DIR)}/${encodeURIComponent(
        SOURCE_THUMB_CATEGORY
    )}/${encodeURIComponent(file)}`;
}

export interface CachedThumbFile {
    path: string;
    size: number;
    mtime: number;
}

/**
 * Which cached files have to go to stay inside the budget. Pure, so the bound is
 * testable without an Electron app or a real cache on disk: entries are ranked
 * newest-first and everything past either limit is returned for deletion.
 */
export function planSourceThumbPrune(
    entries: readonly CachedThumbFile[],
    keepBytes: number = KEEP_BYTES,
    keepFiles: number = KEEP_FILES
): string[] {
    const ranked = [...entries].sort((a, b) => b.mtime - a.mtime);
    const doomed: string[] = [];
    let total = 0;
    ranked.forEach((entry, index) => {
        total += entry.size;
        if (index >= keepFiles || total > keepBytes) doomed.push(entry.path);
    });
    return doomed;
}

/** Apply the budget to the real cache directory. Best effort throughout: a
 *  missing root or an undeletable file must never fail a preview. */
export async function pruneSourceThumbs(
    keepBytes: number = KEEP_BYTES,
    keepFiles: number = KEEP_FILES
): Promise<void> {
    try {
        const dir = sourceThumbsDir();
        const names = await fs.readdir(dir);
        const stats = await Promise.all(
            names.map(async (name) => {
                const path = join(dir, name);
                const info = await fs.stat(path).catch(() => null);
                return info?.isFile() ? { path, size: info.size, mtime: info.mtimeMs } : null;
            })
        );
        const live = stats.filter((entry): entry is CachedThumbFile => entry !== null);
        for (const path of planSourceThumbPrune(live, keepBytes, keepFiles)) {
            await fs.rm(path, { force: true }).catch(() => undefined);
        }
    } catch {
        /* best-effort: a missing cache root is fine */
    }
}

/**
 * Thumbnail one absolute source-image path and return its `grimoire-foundry:`
 * URL, or null when there is nothing honest to show (file gone, too large, or
 * not a decodable image). Null is a normal answer: the gallery falls back to the
 * kind icon rather than rendering a broken frame.
 */
export async function ensureSourceThumbnail(sourcePath: string): Promise<string | null> {
    if (typeof sourcePath !== 'string' || sourcePath.trim() === '') return null;

    const info = await fs.stat(sourcePath).catch(() => null);
    if (!info || !info.isFile() || info.size === 0 || info.size > MAX_SOURCE_BYTES) return null;

    const file = `${sourceThumbKey(sourcePath, info.size, info.mtimeMs)}.png`;
    const dir = sourceThumbsDir();
    const target = join(dir, file);

    const cached = await fs.stat(target).catch(() => null);
    if (cached?.isFile() && cached.size > 0) {
        // Touch so the budget prunes by last use rather than by first decode.
        const now = new Date();
        await fs.utimes(target, now, now).catch(() => undefined);
        return sourceThumbUrl(file);
    }

    const image = nativeImage.createFromPath(sourcePath);
    if (image.isEmpty()) return null;
    const { width, height } = image.getSize();
    // Resize on the longest edge only, so Electron preserves the aspect ratio and
    // a small icon is never upscaled into a blurry square.
    const resized =
        width >= height
            ? image.resize({ width: Math.min(width, SOURCE_THUMB_SIZE), quality: 'good' })
            : image.resize({ height: Math.min(height, SOURCE_THUMB_SIZE), quality: 'good' });
    const bytes = resized.toPNG();
    if (!bytes || bytes.length === 0) return null;

    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(target, bytes);
    await pruneSourceThumbs();
    return sourceThumbUrl(file);
}
