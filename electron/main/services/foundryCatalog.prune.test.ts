import { describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const harness = { userData: '' };
vi.mock('electron', () => ({
    app: { getPath: () => harness.userData },
    protocol: { handle: vi.fn() },
    net: {},
}));
vi.mock('./modMerger', () => ({ runVpkmerge: vi.fn(), runVpkmergeStdout: vi.fn(), verifyVpkOutput: vi.fn() }));
vi.mock('./audioConversion', () => ({ prepareAudioForMint: vi.fn() }));
vi.mock('./deadlock', () => ({ getCitadelPath: () => join(harness.userData, 'game') }));
vi.mock('./heroSoundCodenames', () => ({ soundCodenameForHero: vi.fn() }));
vi.mock('./vpk', () => ({ parseVpkEntryIndex: vi.fn() }));

const { foundryBuildSnapshotsRoot, pruneStaleFingerprints, thumbsRoot } = await import('./foundryCatalog');
const { inspectionCache, retainInspectionCache } = await import('./assetInspection');
const { runVpkmergeStdout } = await import('./modMerger');

describe('Foundry build cache pruning', () => {
    it('preserves current inspection/ability output under the shared canonical build root', async () => {
        const root = mkdtempSync(join(tmpdir(), 'grimoire-inspection-prune-'));
        harness.userData = root;
        mkdirSync(join(root, 'game'));
        const pak = join(root, 'game', 'pak01_dir.vpk');
        writeFileSync(pak, Buffer.alloc(42));
        utimesSync(pak, 123, 123);
        vi.mocked(runVpkmergeStdout).mockClear();
        try {
            const cache = await inspectionCache('game', 'ability:example:1');
            expect(cache.key).toBe('42-123-0');
            expect(runVpkmergeStdout).not.toHaveBeenCalled();
            writeFileSync(join(cache.dir, 'ability.glb'), 'active model');
            writeFileSync(join(cache.dir, 'sprite.png'), 'active particle texture');
            const stale = join(thumbsRoot(), '42-previous-build'); mkdirSync(stale, { recursive: true });
            await pruneStaleFingerprints('42-123-0');
            expect(existsSync(join(cache.dir, 'ability.glb'))).toBe(true);
            expect(existsSync(join(cache.dir, 'sprite.png'))).toBe(true);
            expect(existsSync(stale)).toBe(false);
        } finally { rmSync(root, { recursive: true, force: true }); }
    });
    it('retains an old-build export until release, then normal pruning can remove it', async () => {
        const root = mkdtempSync(join(tmpdir(), 'grimoire-active-prune-'));
        harness.userData = root;
        const active = join(thumbsRoot(), '42-123-456', `inspect-${'a'.repeat(64)}`);
        mkdirSync(active, { recursive: true }); writeFileSync(join(active, 'ability.glb'), 'in progress');
        const release = retainInspectionCache(active);
        try {
            await pruneStaleFingerprints('43-124-0');
            expect(existsSync(join(active, 'ability.glb'))).toBe(true);
            release(); await pruneStaleFingerprints('43-124-0');
            expect(existsSync(active)).toBe(false);
        } finally { release(); rmSync(root, { recursive: true, force: true }); }
    });
    it('removes stale thumbnail fingerprints without deleting the prior build snapshot', async () => {
        const root = mkdtempSync(join(tmpdir(), 'grimoire-foundry-prune-'));
        harness.userData = root;
        const staleThumb = join(thumbsRoot(), 'previous');
        const currentThumb = join(thumbsRoot(), 'current');
        const previousSnapshot = join(foundryBuildSnapshotsRoot(), 'previous.jsonl.gz');
        mkdirSync(staleThumb, { recursive: true });
        mkdirSync(currentThumb, { recursive: true });
        mkdirSync(foundryBuildSnapshotsRoot(), { recursive: true });
        writeFileSync(join(staleThumb, 'texture.png'), 'old', { flag: 'w' });
        writeFileSync(join(currentThumb, 'texture.png'), 'current', { flag: 'w' });
        writeFileSync(previousSnapshot, 'snapshot', { flag: 'w' });

        await pruneStaleFingerprints('current');

        expect(existsSync(staleThumb)).toBe(false);
        expect(existsSync(currentThumb)).toBe(true);
        expect(existsSync(previousSnapshot)).toBe(true);
        rmSync(root, { recursive: true, force: true });
    });
});
