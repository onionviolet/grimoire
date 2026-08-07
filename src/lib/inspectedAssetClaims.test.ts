import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FoundryAssetSource, FoundryAssetSourcesInspection } from '../types/foundry';

const inspect = vi.fn<(paths: string[]) => Promise<FoundryAssetSourcesInspection>>();

vi.mock('./api', () => ({
    foundryInspectAssetSources: (paths: string[]) => inspect(paths),
}));

import {
    assetClaims,
    inspectAssetClaims,
    invalidateAssetClaims,
    peekAssetClaims,
} from './inspectedAssetClaims';

function source(over: Partial<FoundryAssetSource> & Pick<FoundryAssetSource, 'modId'>): FoundryAssetSource {
    return {
        modName: over.modId,
        enabled: true,
        priority: 1,
        provenance: 'Downloaded',
        entries: [],
        wins: [],
        managed: true,
        auditionable: [],
        ...over,
    };
}

const PATH_A = 'sounds/mods/tech/refresher/refresher_cast.vsnd_c';
const PATH_B = 'sounds/player/melee/shared/charged_melee_full.vsnd_c';

/** Two enabled mods fighting over PATH_A, one of them also holding PATH_B. */
const INSPECTION: FoundryAssetSourcesInspection = {
    paths: [PATH_A, PATH_B],
    sources: [
        source({ modId: 'daft', modName: 'Daft Punk Refresher', priority: 2, entries: [PATH_A], wins: [] }),
        source({ modId: 'pak93', modName: 'Pak93', priority: 5, entries: [PATH_A, PATH_B], wins: [PATH_B] }),
        source({ modId: 'off', modName: 'Disabled pack', enabled: false, priority: 1, entries: [PATH_A] }),
    ],
    winners: { [PATH_A]: 'daft', [PATH_B]: 'pak93' },
    unreadableMods: [],
};

beforeEach(() => {
    invalidateAssetClaims();
    inspect.mockReset();
    inspect.mockResolvedValue(INSPECTION);
});

describe('the inspected asset-claims cache', () => {
    it('projects claimants, winners, and winner names off one inspection', async () => {
        const index = await assetClaims([PATH_A, PATH_B]);
        expect(index.claimantsFor(PATH_A).map((s) => s.modId)).toEqual(['daft', 'pak93', 'off']);
        expect(index.winnerFor(PATH_A)?.modId).toBe('daft');
        expect(index.winnerNameFor(PATH_A)).toBe('Daft Punk Refresher');
        expect(index.winnerNameFor('sounds/nobody/claims/this.vsnd_c')).toBeNull();
    });

    it('counts contested paths, so no view has to work it out itself', async () => {
        const index = await assetClaims([PATH_A, PATH_B]);
        // PATH_A has two enabled claimants; PATH_B has one. The disabled pack
        // writes nothing, so it never makes a path contested.
        expect(index.contestedPaths()).toEqual([PATH_A]);
        expect(index.claimedPaths()).toEqual([PATH_A, PATH_B].sort());
    });

    it('normalizes the lookup key the same way the main process does', async () => {
        const index = await assetClaims([PATH_A]);
        expect(index.winnerFor(PATH_A.toUpperCase().replace(/\//g, '\\'))?.modId).toBe('daft');
    });
});

describe('caching', () => {
    it('asks once per path set, however the caller spells it', async () => {
        await assetClaims([PATH_A, PATH_B]);
        await assetClaims([PATH_B, PATH_A, PATH_A]);
        await inspectAssetClaims([PATH_A, PATH_B]);
        expect(inspect).toHaveBeenCalledTimes(1);
    });

    it('shares one in-flight call between concurrent askers', async () => {
        const both = await Promise.all([assetClaims([PATH_A]), assetClaims([PATH_A])]);
        expect(inspect).toHaveBeenCalledTimes(1);
        expect(both[0]).toBe(both[1]);
    });

    it('serves a resolved answer synchronously, which is what makes browsing instant', async () => {
        expect(peekAssetClaims([PATH_A])).toBeNull();
        await assetClaims([PATH_A]);
        expect(peekAssetClaims([PATH_A])?.winnerFor(PATH_A)?.modId).toBe('daft');
    });

    it('drops everything when mod state changes', async () => {
        await assetClaims([PATH_A]);
        invalidateAssetClaims();
        expect(peekAssetClaims([PATH_A])).toBeNull();
        await assetClaims([PATH_A]);
        expect(inspect).toHaveBeenCalledTimes(2);
    });

    it('does not cache an answer that a mid-flight toggle already invalidated', async () => {
        const pending = assetClaims([PATH_A]);
        invalidateAssetClaims();
        await pending;
        // The caller still gets its answer; the next reader does not inherit it.
        expect(peekAssetClaims([PATH_A])).toBeNull();
    });

    it('does not cache a failure', async () => {
        inspect.mockRejectedValueOnce(new Error('no Deadlock path configured'));
        await expect(assetClaims([PATH_A])).rejects.toThrow('no Deadlock path configured');
        inspect.mockResolvedValue(INSPECTION);
        await expect(assetClaims([PATH_A])).resolves.toBeTruthy();
        expect(inspect).toHaveBeenCalledTimes(2);
    });
});
