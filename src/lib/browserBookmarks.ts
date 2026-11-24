export interface BrowserBookmark {
    url: string;
    title: string;
    folder: string;
    onBar: boolean;
}

export const BROWSER_BOOKMARKS_KEY = 'grimoire:browser-bookmarks';

export function bookmarkUrl(value: string): string | null {
    try {
        const url = new URL(value.trim());
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
        return url.href;
    } catch {
        return null;
    }
}

export function readBrowserBookmarks(): BrowserBookmark[] {
    try {
        const parsed: unknown = JSON.parse(localStorage.getItem(BROWSER_BOOKMARKS_KEY) ?? '[]');
        if (!Array.isArray(parsed)) return [];
        const bookmarks = new Map<string, BrowserBookmark>();
        for (const item of parsed) {
            if (!item || typeof item.url !== 'string' || typeof item.title !== 'string') continue;
            const url = bookmarkUrl(item.url);
            if (!url || bookmarks.has(url)) continue;
            bookmarks.set(url, {
                url,
                title: item.title.trim() || new URL(url).hostname,
                folder: typeof item.folder === 'string' ? item.folder.trim() : '',
                onBar: item.onBar !== false,
            });
        }
        return [...bookmarks.values()];
    } catch {
        return [];
    }
}

export function writeBrowserBookmarks(bookmarks: BrowserBookmark[]): void {
    localStorage.setItem(BROWSER_BOOKMARKS_KEY, JSON.stringify(bookmarks));
}
