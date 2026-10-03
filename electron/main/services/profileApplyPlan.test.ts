import { describe, expect, it } from 'vitest';
import type { Profile, ProfileMod } from '../../../src/types/electron';
import type { Mod } from '../../../src/types/mod';
import { assertProfileReview, buildProfileApplyPlan } from './profileApplyPlan';
import type { VpkIndexMeta } from './profileResolver';

const mod = (id: string, extra: Partial<Mod> = {}): Mod => ({
    id, metaKey: id, fileName: `${id}.vpk`, name: id, path: `/mods/${id}.vpk`,
    enabled: false, priority: 1, size: 12, ...extra,
} as Mod);
const profile = (mods: Partial<ProfileMod>[]): Profile => ({
    id: 'profile', name: 'Setup', createdAt: '2026-10-03', updatedAt: '2026-10-03',
    mods: mods.map((entry) => ({ fileName: 'old.vpk', enabled: true, priority: 1, ...entry })),
});
const plan = (saved: Profile, mods: Mod[], metadata: Record<string, VpkIndexMeta> = {}) =>
    buildProfileApplyPlan(saved, mods, (key) => metadata[key]);

describe('profile apply review', () => {
    it('matches renamed local/Foundry files by hash and counts changes without mutating the scan', () => {
        const mods = [mod('renamed'), mod('other', { enabled: true })];
        const before = structuredClone(mods);
        const result = plan(profile([{ sha256: 'a'.repeat(64) }]), mods, { renamed: { sha256: 'a'.repeat(64) } });
        expect(result.preview.issues).toEqual([]);
        expect(result.preview.enableCount).toBe(1);
        expect(result.preview.disableCount).toBe(1);
        expect(result.matches.has('renamed')).toBe(true);
        expect(mods).toEqual(before);
    });

    it('requires explicit review when a local slot now holds different bytes', () => {
        const result = plan(profile([{ sha256: 'a'.repeat(64) }]), [mod('other', { fileName: 'old.vpk' })],
            { other: { sha256: 'b'.repeat(64) } });
        expect(result.preview.issues[0].status).toBe('replaced');
        expect(result.matches.size).toBe(0);
        expect(() => assertProfileReview(result.preview)).toThrow('fresh review');
    });

    it('reports missing mods instead of silently accepting an empty apply', () => {
        const result = plan(profile([{ gameBananaId: 1, gameBananaFileId: 2 }]), []);
        expect(result.preview.issues[0].status).toBe('missing');
        expect(() => assertProfileReview(result.preview)).toThrow();
    });

    it('shows updated archive/file identities as changed, keeping a resolvable match for review', () => {
        const result = plan(profile([{ gameBananaId: 1, gameBananaFileId: 2, sha256: 'a' }]), [mod('updated')],
            { updated: { gameBananaId: 1, gameBananaFileId: 3, sha256: 'b' } });
        expect(result.preview.issues[0].status).toBe('changed');
        expect(result.preview.issues[0].modId).toBe('updated');
        expect(() => assertProfileReview(result.preview, result.preview.reviewToken)).not.toThrow();
    });

    it('does not choose an arbitrary sibling when the saved index and filename cannot distinguish it', () => {
        const result = plan(profile([{ gameBananaId: 1, gameBananaFileId: 2 }]), [mod('a'), mod('b')], {
            a: { gameBananaId: 1, gameBananaFileId: 2, vpkIndex: 0 },
            b: { gameBananaId: 1, gameBananaFileId: 2, vpkIndex: 1 },
        });
        expect(result.preview.issues[0].status).toBe('ambiguous');
        expect(result.matches.size).toBe(0);
    });

    it('rejects a stale review after a toggle, content change or profile edit', () => {
        const saved = profile([{ fileName: 'a.vpk' }]);
        const mods = [mod('a')];
        const first = plan(saved, mods).preview;
        for (const changed of [
            plan(saved, [mod('a', { enabled: true })]).preview,
            plan(saved, mods, { a: { sha256: 'different' } }).preview,
            plan({ ...saved, autoexecCommands: ['fps_max 60'] }, mods).preview,
        ]) expect(() => assertProfileReview(changed, first.reviewToken)).toThrow('fresh review');
    });

    it('does not make a missing disabled entry block an otherwise complete profile', () => {
        const result = plan(profile([{ enabled: false }]), []);
        expect(result.preview.issues).toEqual([]);
        expect(() => assertProfileReview(result.preview)).not.toThrow();
    });
});
