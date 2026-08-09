import { describe, expect, it } from 'vitest';
import { recolorApplyConsequence } from './recolorApplyConsequence';
import type {
    FoundryAssetSource,
    FoundryAssetSourcesInspection,
} from '../../types/foundry';

const source = (overrides: Partial<FoundryAssetSource> & Pick<FoundryAssetSource, 'modId'>): FoundryAssetSource => ({
    modName: overrides.modId,
    enabled: true,
    priority: 10,
    provenance: 'Third-party',
    entries: [],
    wins: [],
    managed: false,
    lockerManaged: false,
    auditionable: [],
    ...overrides,
});

const inspection = (overrides: Partial<FoundryAssetSourcesInspection> = {}): FoundryAssetSourcesInspection => ({
    paths: [],
    sources: [],
    winners: {},
    unreadableMods: [],
    ...overrides,
});

describe('recolorApplyConsequence', () => {
    it('yields no owners and contested false when nothing claims any path', () => {
        const result = recolorApplyConsequence(
            ['particles/x.vpcf_c'],
            inspection({
                paths: ['particles/x.vpcf_c'],
                sources: [],
                winners: { 'particles/x.vpcf_c': null },
            }),
        );
        expect(result.contested).toBe(false);
        expect(result.owners).toEqual([]);
        expect(result.contestedPaths).toEqual([]);
        expect(result.paths).toEqual(['particles/x.vpcf_c']);
    });

    it('reports one enabled third-party owner carrying exactly its two wins when it wins two paths', () => {
        const result = recolorApplyConsequence(['a.vtex_c', 'b.vtex_c'], inspection({
            paths: ['a.vtex_c', 'b.vtex_c'],
            sources: [
                source({
                    modId: 'party',
                    modName: 'Third-party pack',
                    wins: ['a.vtex_c', 'b.vtex_c'],
                }),
            ],
            winners: { 'a.vtex_c': 'party', 'b.vtex_c': 'party' },
        }));
        expect(result.contested).toBe(true);
        expect(result.owners).toEqual([
            { modId: 'party', modName: 'Third-party pack', provenance: 'Third-party', wins: ['a.vtex_c', 'b.vtex_c'] },
        ]);
        expect(result.contestedPaths).toEqual(['a.vtex_c', 'b.vtex_c']);
    });

    it('excludes a disabled mod that claims paths but wins none', () => {
        const result = recolorApplyConsequence(['a.vtex_c'], inspection({
            paths: ['a.vtex_c'],
            sources: [
                source({ modId: 'off', modName: 'Disabled mod', enabled: false, wins: [] }),
            ],
            winners: { 'a.vtex_c': null },
        }));
        expect(result.contested).toBe(false);
        expect(result.owners).toEqual([]);
    });

    it('does not contest the user against Grimoire own previously applied managed colors VPK on re-apply', () => {
        const result = recolorApplyConsequence(['a.vtex_c'], inspection({
            paths: ['a.vtex_c'],
            sources: [
                source({
                    modId: 'locker:colors',
                    modName: 'Locker colors',
                    provenance: 'Third-party',
                    lockerManaged: true,
                    wins: ['a.vtex_c'],
                }),
            ],
            winners: { 'a.vtex_c': 'locker:colors' },
        }));
        expect(result.contested).toBe(false);
        expect(result.owners).toEqual([]);
    });

    it('keeps exactly one contesting owner when a lockerManaged source and an enabled downloaded winner both win', () => {
        const result = recolorApplyConsequence(['a.vtex_c'], inspection({
            paths: ['a.vtex_c'],
            sources: [
                source({
                    modId: 'locker:colors',
                    modName: 'Locker colors',
                    lockerManaged: true,
                    wins: ['a.vtex_c'],
                }),
                source({
                    modId: 'downloaded',
                    modName: 'Downloaded mod',
                    provenance: 'Downloaded',
                    wins: ['a.vtex_c'],
                }),
            ],
            winners: { 'a.vtex_c': 'downloaded' },
        }));
        expect(result.contested).toBe(true);
        expect(result.owners).toHaveLength(1);
        expect(result.owners[0].modId).toBe('downloaded');
    });

    it('surfaces unreadable mod names regardless of whether anything is contested', () => {
        const result = recolorApplyConsequence(['a.vtex_c'], inspection({
            paths: ['a.vtex_c'],
            sources: [],
            winners: { 'a.vtex_c': null },
            unreadableMods: [{ modId: 'opaque', modName: 'Opaque VPK', enabled: true }],
        }));
        expect(result.unreadable).toEqual(['Opaque VPK']);
        expect(result.contested).toBe(false);
    });

    it('returns contesting owners ordered by name with a deduplicated contested path union', () => {
        const result = recolorApplyConsequence(['a.vtex_c', 'b.vtex_c', 'c.vtex_c'], inspection({
            paths: ['a.vtex_c', 'b.vtex_c', 'c.vtex_c'],
            sources: [
                source({
                    modId: 'zulu',
                    modName: 'Zulu pack',
                    wins: ['c.vtex_c'],
                }),
                source({
                    modId: 'alpha',
                    modName: 'Alpha pack',
                    wins: ['a.vtex_c', 'b.vtex_c'],
                }),
                source({
                    modId: 'dupe',
                    modName: 'Dupe pack',
                    wins: ['a.vtex_c'],
                }),
            ],
            winners: { 'a.vtex_c': 'alpha', 'b.vtex_c': 'alpha', 'c.vtex_c': 'zulu' },
        }));
        expect(result.owners.map((owner) => owner.modName)).toEqual(['Alpha pack', 'Dupe pack', 'Zulu pack']);
        expect(result.contestedPaths).toEqual(['a.vtex_c', 'b.vtex_c', 'c.vtex_c']);
    });

    it('refuses to disclose an empty write set when entries were requested', () => {
        expect(() =>
            recolorApplyConsequence(
                ['a.vtex_c'],
                inspection({ paths: [], sources: [], winners: {} }),
            ),
        ).toThrow(/could not be confirmed/);
    });
});
