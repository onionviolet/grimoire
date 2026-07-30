import { describe, expect, it } from 'vitest';
import { buildAssetClaimsIndex, normalizeAssetPath, type AssetClaimant } from './assetClaims';

const claimant = (
    id: string,
    entries: string[],
    overrides: Partial<AssetClaimant> = {}
): AssetClaimant => ({ id, enabled: true, priority: 1, entries, ...overrides });

// The real collision this index was built to describe, found by reading the
// installed VPKs during #5: two enabled mods writing one Refresher path.
const REFRESHER = 'sounds/mods/tech/refresher/refresher_cast.vsnd_c';

describe('normalizeAssetPath', () => {
    it('treats slash and case spellings as one asset', () => {
        expect(normalizeAssetPath('Sounds\\Mods\\A.vsnd_c')).toBe('sounds/mods/a.vsnd_c');
        expect(normalizeAssetPath('/sounds/mods/a.vsnd_c')).toBe('sounds/mods/a.vsnd_c');
    });
});

describe('buildAssetClaimsIndex', () => {
    it('gives the lowest-priority enabled claimant the path', () => {
        const index = buildAssetClaimsIndex(
            [REFRESHER],
            [
                claimant('pak93', [REFRESHER], { priority: 9 }),
                claimant('daftpunk', [REFRESHER], { priority: 3 }),
            ]
        );

        expect(index.winnerOf(REFRESHER)).toBe('daftpunk');
        expect(index.contested).toEqual([REFRESHER]);
    });

    it('never lets a disabled claimant win, or suppress one that can', () => {
        const index = buildAssetClaimsIndex(
            [REFRESHER],
            [
                claimant('disabled-but-first', [REFRESHER], { priority: 1, enabled: false }),
                claimant('enabled', [REFRESHER], { priority: 8 }),
            ]
        );

        expect(index.winnerOf(REFRESHER)).toBe('enabled');
        // Still a claimant: the panel shows it, it just does not win.
        expect(index.claimantsOf(REFRESHER)).toContain('disabled-but-first');
        // One enabled writer is not a conflict.
        expect(index.contested).toEqual([]);
    });

    it('reports no winner when every claimant is disabled', () => {
        const index = buildAssetClaimsIndex(
            [REFRESHER],
            [claimant('off', [REFRESHER], { enabled: false })]
        );

        expect(index.winnerOf(REFRESHER)).toBeNull();
    });

    it('breaks a priority tie the same way every time', () => {
        const order = ['b', 'a'].map((id) => claimant(id, [REFRESHER], { priority: 5 }));
        const reversed = [...order].reverse();

        expect(buildAssetClaimsIndex([REFRESHER], order).winnerOf(REFRESHER)).toBe(
            buildAssetClaimsIndex([REFRESHER], reversed).winnerOf(REFRESHER)
        );
    });

    it('answers in the caller spelling, matching on the normalized one', () => {
        const index = buildAssetClaimsIndex(
            ['Sounds\\Mods\\Tech\\Refresher\\Refresher_Cast.vsnd_c'],
            [claimant('a', [REFRESHER])]
        );

        expect(index.winnerOf('SOUNDS/MODS/TECH/REFRESHER/REFRESHER_CAST.VSND_C')).toBe('a');
    });

    it('ignores paths outside the requested scope', () => {
        const index = buildAssetClaimsIndex(
            [REFRESHER],
            [claimant('a', [REFRESHER, 'sounds/ui/click.vsnd_c'])]
        );

        expect(index.paths).toEqual([REFRESHER]);
    });

    it('indexes everything a claimant writes when no scope is given', () => {
        // The Locker asks this way: it has no selection, only an inventory.
        const index = buildAssetClaimsIndex(
            [],
            [claimant('a', [REFRESHER]), claimant('b', ['sounds/ui/click.vsnd_c'])]
        );

        expect(index.paths).toEqual([REFRESHER, 'sounds/ui/click.vsnd_c']);
        expect(index.contested).toEqual([]);
    });

    it('counts a claimant once for a path it lists twice', () => {
        const index = buildAssetClaimsIndex(
            [],
            [claimant('a', [REFRESHER, 'Sounds/Mods/Tech/Refresher/Refresher_Cast.vsnd_c'])]
        );

        expect(index.claimantsOf(REFRESHER)).toEqual(['a']);
        expect(index.contested).toEqual([]);
    });
});
