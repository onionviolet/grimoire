import { describe, it, expect } from 'vitest';
import {
    collectInstalledGameBananaIds,
    collectProfileGameBananaIds,
    resolveMissingMods,
    resolveModsAvailability,
} from './availability';
import type { PortableProfile } from '../../types/portableProfile';

function profileWith(mods: { source: string; submissionId?: number }[]): PortableProfile {
    return {
        format: 'mod-profile',
        schemaVersion: '1.0.0',
        game: {},
        exportedAt: '2026-07-28T00:00:00.000Z',
        exportedBy: { tool: 'grimoire', version: 'test' },
        profile: { name: 'test' },
        mods: mods.map((m, i) => ({
            source: m.source,
            ref: m.submissionId === undefined ? {} : { submissionId: m.submissionId, fileId: 1 },
            enabled: true,
            priority: i,
        })),
    } as PortableProfile;
}

describe('resolveModsAvailability', () => {
    it('reports unknown when the profile has never been revalidated', () => {
        expect(resolveModsAvailability({ mod_count: 12, mods_available: null })).toEqual({
            kind: 'unknown',
        });
    });

    it('treats an absent field the same as null (old server build)', () => {
        expect(resolveModsAvailability({ mod_count: 12 })).toEqual({ kind: 'unknown' });
    });

    it('never rounds unknown up to all-available', () => {
        // The whole point of the nullable field: a profile nobody has checked
        // is not a profile known to be healthy.
        const result = resolveModsAvailability({ mod_count: 12, mods_available: null });
        expect(result.kind).not.toBe('all');
    });

    it('reports all when every mod is still fetchable', () => {
        expect(resolveModsAvailability({ mod_count: 12, mods_available: 12 })).toEqual({
            kind: 'all',
            total: 12,
        });
    });

    it('reports partial when some mods are gone', () => {
        expect(resolveModsAvailability({ mod_count: 12, mods_available: 11 })).toEqual({
            kind: 'partial',
            available: 11,
            total: 12,
        });
    });

    it('reports partial with zero available when everything is gone', () => {
        expect(resolveModsAvailability({ mod_count: 3, mods_available: 0 })).toEqual({
            kind: 'partial',
            available: 0,
            total: 3,
        });
    });

    it('clamps a count that exceeds mod_count instead of showing 13 of 12', () => {
        expect(resolveModsAvailability({ mod_count: 12, mods_available: 13 })).toEqual({
            kind: 'all',
            total: 12,
        });
    });

    it('clamps a negative count to zero', () => {
        expect(resolveModsAvailability({ mod_count: 4, mods_available: -2 })).toEqual({
            kind: 'partial',
            available: 0,
            total: 4,
        });
    });

    it('handles an empty profile without claiming anything is missing', () => {
        expect(resolveModsAvailability({ mod_count: 0, mods_available: 0 })).toEqual({
            kind: 'all',
            total: 0,
        });
    });
});

describe('collectInstalledGameBananaIds', () => {
    it('collects plain installed mod ids', () => {
        const ids = collectInstalledGameBananaIds([{ gameBananaId: 1 }, { gameBananaId: 2 }]);
        expect([...ids].sort()).toEqual([1, 2]);
    });

    it('counts sources folded into a merged VPK as installed', () => {
        // The source rows are gone from the Installed list after a merge, but
        // the content is on disk: calling them missing would be wrong.
        const ids = collectInstalledGameBananaIds([
            { merged: { sources: [{ gameBananaId: 7 }, { gameBananaId: 8 }] } },
        ]);
        expect([...ids].sort()).toEqual([7, 8]);
    });

    it('ignores mods with no GameBanana identity', () => {
        const ids = collectInstalledGameBananaIds([{}, { merged: { sources: [{}] } }]);
        expect(ids.size).toBe(0);
    });
});

describe('collectProfileGameBananaIds', () => {
    it('returns distinct ids in first-appearance order', () => {
        const ids = collectProfileGameBananaIds(
            profileWith([
                { source: 'gamebanana', submissionId: 30 },
                { source: 'gamebanana', submissionId: 10 },
                { source: 'gamebanana', submissionId: 30 },
            ])
        );
        expect(ids).toEqual([30, 10]);
    });

    it('skips non-GameBanana entries, which we cannot match locally', () => {
        const ids = collectProfileGameBananaIds(
            profileWith([
                { source: 'local', submissionId: 99 },
                { source: 'gamebanana', submissionId: 5 },
            ])
        );
        expect(ids).toEqual([5]);
    });

    it('skips GameBanana entries with a malformed ref', () => {
        const ids = collectProfileGameBananaIds(profileWith([{ source: 'gamebanana' }]));
        expect(ids).toEqual([]);
    });
});

describe('resolveMissingMods', () => {
    it('reports the ids the user does not have', () => {
        expect(resolveMissingMods([1, 2, 3], new Set([2]))).toEqual({
            total: 3,
            missing: 2,
            missingIds: [1, 3],
        });
    });

    it('reports nothing missing when everything is installed', () => {
        expect(resolveMissingMods([1, 2], new Set([1, 2, 99]))).toEqual({
            total: 2,
            missing: 0,
            missingIds: [],
        });
    });

    it('handles a profile with no matchable mods', () => {
        expect(resolveMissingMods([], new Set([1]))).toEqual({
            total: 0,
            missing: 0,
            missingIds: [],
        });
    });

    it('is independent of upstream availability', () => {
        // A mod can be installed locally AND deleted from GameBanana. This
        // function must only answer the local question.
        expect(resolveMissingMods([42], new Set([42])).missing).toBe(0);
    });
});
