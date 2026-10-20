/** Thumbnails that arrive in shared files (share codes, interchange bundles)
 *  only load from GameBanana's image host, so a file can't make Grimoire
 *  contact a server of its author's choosing. */
export function isGameBananaImageUrl(url: unknown): url is string {
    if (typeof url !== 'string') return false;
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'https:' && parsed.hostname === 'images.gamebanana.com';
    } catch {
        return false;
    }
}
