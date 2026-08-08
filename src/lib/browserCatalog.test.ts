import { describe, expect, it } from 'vitest';
import {
    BROWSER_DESTINATIONS,
    destinationForUrl,
    destinationKindForUrl,
    groupDestinationsByKind,
    HOME_DESTINATION_URL,
    KIND_ORDER,
    visibleDestinations,
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

    it('resolves HOME_DESTINATION_URL to a live catalog entry, proving it was not orphaned by a review-driven removal', () => {
        expect(destinationForUrl(HOME_DESTINATION_URL)).not.toBeNull();
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

describe('visibleDestinations', () => {
    const entries: BrowserDestination[] = [
        { label: 'Safe', url: 'https://safe.example.com/', kind: 'reference' },
        { label: 'Adult', url: 'https://adult.example.com/', kind: 'community-feed', nsfw: true },
    ];

    it('omits every nsfw entry when mode is hide', () => {
        const result = visibleDestinations(entries, 'hide');
        expect(result.map((e) => e.label)).toEqual(['Safe']);
    });

    it('keeps nsfw entries when mode is blur', () => {
        const result = visibleDestinations(entries, 'blur');
        expect(result.map((e) => e.label)).toEqual(['Safe', 'Adult']);
    });

    it('keeps nsfw entries for any mode other than hide, including undefined', () => {
        expect(visibleDestinations(entries, undefined).map((e) => e.label)).toEqual(['Safe', 'Adult']);
        expect(visibleDestinations(entries, 'show').map((e) => e.label)).toEqual(['Safe', 'Adult']);
    });
});

describe('groupDestinationsByKind', () => {
    it('returns an empty array for an empty input, not four empty groups', () => {
        expect(groupDestinationsByKind([])).toEqual([]);
    });

    it('returns exactly one group when the input has only one kind', () => {
        const entries: BrowserDestination[] = [
            { label: 'A', url: 'https://a.example.com/', kind: 'reference' },
            { label: 'B', url: 'https://b.example.com/', kind: 'reference' },
        ];
        const groups = groupDestinationsByKind(entries);
        expect(groups).toHaveLength(1);
        expect(groups[0].kind).toBe('reference');
        expect(groups[0].entries.map((e) => e.label)).toEqual(['A', 'B']);
    });

    it('returns groups in KIND_ORDER order regardless of input order', () => {
        const entries: BrowserDestination[] = [
            { label: 'Ref', url: 'https://ref.example.com/', kind: 'reference' },
            { label: 'Community', url: 'https://community.example.com/', kind: 'community-feed' },
            { label: 'Tool', url: 'https://tool.example.com/', kind: 'tool' },
            { label: 'Host', url: 'https://host.example.com/', kind: 'mod-host' },
        ];
        const groups = groupDestinationsByKind(entries);
        expect(groups.map((g) => g.kind)).toEqual(
            KIND_ORDER.filter((kind) => entries.some((e) => e.kind === kind))
        );
        expect(groups.map((g) => g.kind)).toEqual(['mod-host', 'tool', 'reference', 'community-feed']);
    });

    it('keeps entries in input order within a group', () => {
        const entries: BrowserDestination[] = [
            { label: 'Second', url: 'https://second.example.com/', kind: 'reference' },
            { label: 'First', url: 'https://first.example.com/', kind: 'reference' },
        ];
        const groups = groupDestinationsByKind(entries);
        expect(groups[0].entries.map((e) => e.label)).toEqual(['Second', 'First']);
    });

    it('produces no group object at all for a kind with no entries', () => {
        const entries: BrowserDestination[] = [
            { label: 'Only', url: 'https://only.example.com/', kind: 'tool' },
        ];
        const groups = groupDestinationsByKind(entries);
        expect(groups).toHaveLength(1);
        expect(groups.some((g) => g.kind === 'mod-host')).toBe(false);
        expect(groups.some((g) => g.kind === 'reference')).toBe(false);
        expect(groups.some((g) => g.kind === 'community-feed')).toBe(false);
    });

    it('is idempotent: grouping an already-grouped-and-reflattened list produces the same result', () => {
        const once = groupDestinationsByKind(BROWSER_DESTINATIONS);
        const reflattened = once.flatMap((g) => g.entries);
        const twice = groupDestinationsByKind(reflattened);
        expect(twice).toEqual(once);
    });

    it('groups the real catalog into all four kinds after nsfw hide filtering', () => {
        const groups = groupDestinationsByKind(visibleDestinations(BROWSER_DESTINATIONS, 'hide'));
        expect(groups.map((g) => g.kind)).toEqual(['mod-host', 'tool', 'reference', 'community-feed']);
        for (const group of groups) {
            expect(group.entries.every((e) => !e.nsfw)).toBe(true);
        }
    });
});
