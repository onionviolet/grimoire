/**
 * Chat Wheel preview dressing: the game's own wheel art, when the user's pak
 * provides it (Phase 11, REQ-cw-game-asset-dressing).
 *
 * This module owns no decoding. It asks the existing Foundry catalog for
 * texture entries (`getTextures`, a `vpkmerge catalog texture --search` call
 * over the base pak) and hands the chosen entry to `ensureFullImage`, the same
 * decoder that backs the Foundry lightbox and texture export. Both already
 * cache under the pak build fingerprint, so a second visit costs one stat.
 *
 * What the spike established about the art (see 11-02-SUMMARY.md):
 *   - The stock icon set lives at `panorama/images/hud/ping/ping_icon_<name>.svg`
 *     (named by `scripts/ping_wheel_messages.vdata`, which ChatLane embeds).
 *     Those are compiled `.vsvg_c` entries, not `.vtex_c`, so the texture
 *     catalog never lists them. The vendored ChatLane icon set in
 *     `src/lib/chatWheelIcons.ts` carries the same eleven names, so the preview
 *     already wears the stock icons without touching the pak.
 *   - Neither ChatLane nor the vdata names a wheel backplate texture; the
 *     in-game ring is Panorama layout and style. Whether a `.vtex_c` backplate
 *     exists at all is therefore decided against the user's pak at runtime by
 *     `pickChatWheelBackplate`, and "none" is a normal answer.
 *
 * Every failure path resolves null. The IPC layer and the renderer hook both
 * treat null as "render the pure-SVG wheel unchanged".
 */
import { ensureFullImage, getTextures } from './foundryCatalog';
import type { TextureEntry } from '../../../src/types/foundry';
import type { ChatWheelDressing } from '../../../src/types/chatWheelDressing';

/** Where the HUD's panorama images live in the pak. The wheel is HUD, so a
 *  candidate anywhere else (a prop model's `wheel`, a hero's `ping` VFX) is
 *  rejected outright rather than ranked. */
const HUD_IMAGE_ROOT = 'panorama/images/hud/';

/** Catalog search terms, each matched by the CLI against the entry label. */
const SEARCH_TERMS: readonly string[] = ['wheel', 'ping'];

/** Cap per search so a pathological pak cannot turn a preview into a scan. */
const SEARCH_LIMIT = 200;

/** Tokens that make a wheel-named HUD image read as the ring itself rather
 *  than an ornament on it. Each present token adds to the rank. */
const BACKPLATE_TOKENS: readonly string[] = ['bg', 'background', 'backplate', 'base', 'ring', 'frame', 'circle', 'plate'];

function fileStem(entryPath: string): string {
    const name = entryPath.slice(entryPath.lastIndexOf('/') + 1).toLowerCase();
    return name.replace(/\.vtex_c$/, '');
}

/**
 * Rank the catalog's answers and pick the one most likely to be the wheel's
 * backplate, or null when nothing qualifies. Pure and exported for tests.
 *
 * Qualifying: a `.vtex_c` under `panorama/images/hud/` whose filename contains
 * `wheel` and is not an icon. Ranking among qualifiers: `chat` outranks `ping`
 * (the chat wheel is what the page previews), then backplate-ish tokens, then
 * path order so the choice is deterministic for a given pak.
 */
export function pickChatWheelBackplate(entries: readonly TextureEntry[]): TextureEntry | null {
    const ranked = entries
        .filter((entry) => {
            const path = entry.path.toLowerCase();
            if (!path.startsWith(HUD_IMAGE_ROOT) || !path.endsWith('.vtex_c')) return false;
            const stem = fileStem(path);
            return stem.includes('wheel') && !stem.includes('icon');
        })
        .map((entry) => {
            const stem = fileStem(entry.path);
            let score = 0;
            if (stem.includes('chat')) score += 3;
            if (stem.includes('ping')) score += 2;
            if (BACKPLATE_TOKENS.some((token) => stem.includes(token))) score += 2;
            return { entry, score };
        })
        .sort((a, b) => b.score - a.score || a.entry.path.localeCompare(b.entry.path));
    return ranked[0]?.entry ?? null;
}

/**
 * Search the base pak's texture catalog for the wheel backplate and decode it
 * through the Foundry full-image cache. Resolves null when no Deadlock path is
 * given, when the catalog engine is unavailable, when nothing qualifies, or
 * when the decode fails; it never throws, because the caller's only fallback
 * is the wheel it was already drawing.
 */
export async function resolveChatWheelDressing(deadlockPath: string | null): Promise<ChatWheelDressing | null> {
    if (!deadlockPath) return null;
    try {
        const byPath = new Map<string, TextureEntry>();
        for (const search of SEARCH_TERMS) {
            const entries = await getTextures(deadlockPath, { search, limit: SEARCH_LIMIT });
            for (const entry of entries) byPath.set(entry.path, entry);
        }
        const backplate = pickChatWheelBackplate([...byPath.values()]);
        if (!backplate) return null;
        const backplateUrl = await ensureFullImage(deadlockPath, backplate.category, backplate.path);
        if (!backplateUrl) return null;
        return { backplateUrl, entryPath: backplate.path };
    } catch (err) {
        console.warn(`[chatWheelDressing] falling back to the SVG wheel: ${err instanceof Error ? err.message : String(err)}`);
        return null;
    }
}
