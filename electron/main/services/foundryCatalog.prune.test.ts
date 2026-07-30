import { describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
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
vi.mock('./deadlock', () => ({ getCitadelPath: vi.fn() }));
vi.mock('./heroSoundCodenames', () => ({ soundCodenameForHero: vi.fn() }));
vi.mock('./vpk', () => ({ parseVpkEntryIndex: vi.fn() }));

const { foundryBuildSnapshotsRoot, pruneStaleFingerprints, thumbsRoot } = await import('./foundryCatalog');

describe('Foundry build cache pruning', () => {
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
