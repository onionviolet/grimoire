import { describe, expect, it } from 'vitest';
import {
    BROWSER_DESTINATIONS,
    destinationForUrl,
    destinationKindForUrl,
    HOME_DESTINATION_URL,
    KIND_ORDER,
    type BrowserDestination,
} from './browserCatalog';

describe('BROWSER_DESTINATIONS', () => {
    it('is frozen, so no reader can observe a partially-populated catalog', () => {
        expect(Object.isFrozen(BROWSER_DESTINATIONS)).toBe(true);
    });

    it('has exactly ten entries, each carrying a kind', () => {
        expect(BROWSER_DESTINATIONS).toHaveLength(10);
        for (const entry of BROWSER_DESTINATIONS) {
            expect(entry.kind).toBeTruthy();
        }
    });

    it('orders kind groups mod-host, tool, reference, community-feed', () => {
        expect(KIND_ORDER).toEqual(['mod-host', 'tool', 'reference', 'community-feed']);
    });

    it('anchors HOME_DESTINATION_URL to the GameBanana entry by label, not index', () => {
        const gameBanana = BROWSER_DESTINATIONS.find((d) => d.label === 'GameBanana');
        expect(gameBanana).toBeDefined();
        expect(HOME_DESTINATION_URL).toBe(gameBanana?.url);
    });
});

describe('destinationForUrl / destinationKindForUrl', () => {
    it('returns null for an empty string', () => {
        expect(destinationForUrl('')).toBeNull();
        expect(destinationKindForUrl('')).toBeNull();
    });

    it('returns null for a malformed URL', () => {
        expect(destinationForUrl('not a url')).toBeNull();
        expect(destinationKindForUrl('not a url')).toBeNull();
    });

    it('returns null for an unlisted host', () => {
        expect(destinationForUrl('https://example.com/')).toBeNull();
    });

    it('resolves each of the ten entries to its own kind', () => {
        for (const entry of BROWSER_DESTINATIONS) {
            expect(destinationKindForUrl(entry.url)).toBe(entry.kind);
        }
    });

    it('resolves a deep path under a listed host to that host entry', () => {
        const match = destinationForUrl('https://gamebanana.com/games/20948/mods/999999');
        expect(match?.label).toBe('GameBanana');
    });

    it('treats a leading www. as equivalent to the bare host', () => {
        const match = destinationForUrl('https://www.deadlocker.gg/some/path');
        expect(match?.label).toBe('Deadlocker');
    });

    it('breaks a shared-host tie by longest path prefix, not declaration order', () => {
        const shortFirst: BrowserDestination[] = [
            { label: 'Short', url: 'https://example.com/tools', kind: 'reference' },
            { label: 'Long', url: 'https://example.com/tools/sub', kind: 'tool' },
        ];
        expect(destinationForUrl('https://example.com/tools/sub/page', shortFirst)?.label).toBe('Long');

        // Same two entries, declared in the opposite order: the longer-prefix
        // entry must still win, proving the rule is prefix length, not order.
        const longFirst: BrowserDestination[] = [shortFirst[1], shortFirst[0]];
        expect(destinationForUrl('https://example.com/tools/sub/page', longFirst)?.label).toBe('Long');
    });

    it('never merges two matching entries into a combined result', () => {
        const match = destinationForUrl('https://gamebanana.com/games/20948');
        expect(match).not.toBeNull();
        expect(Array.isArray(match)).toBe(false);
    });
});
