import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { describe, expect, it, vi } from 'vitest';
import { buildFoundryForgeVpk, forgeAndExportFoundryVpk, reviewFoundryForge } from './foundryForge';
import type { FoundryForgeEdit, FoundryForgeRequest } from '../../../src/types/foundry';

/** Foundry build temps are named so they can be counted; a leaked directory is
 *  the exact residue "atomic cancel" promises never to leave behind. */
async function countForgeTemps(): Promise<number> {
    const entries = await fs.readdir(tmpdir()).catch(() => [] as string[]);
    return entries.filter((entry) => entry.startsWith('grimoire-foundry-forge-')).length;
}

const soundEdit: FoundryForgeEdit = {
    id: 'sound', kind: 'sound', precedence: 2,
    request: {
        heroCodename: 'hero', heroName: 'Hero', name: 'Dash audio', audioPath: 'dash.mp3',
        assignments: [{ clipPath: 'SOUNDS/dash.vsnd', audioPath: 'dash.mp3' }],
    },
};

const textureEdit: FoundryForgeEdit = {
    id: 'visual', kind: 'texture', precedence: 1,
    request: { entryPath: 'Sounds\\Dash.VSND_C', imagePath: 'dash.png', name: 'Dash', category: 'ability-icon' },
};

describe('reviewFoundryForge', () => {
    it('normalizes source paths and reports the deliberate highest-precedence winner', () => {
        const review = reviewFoundryForge([textureEdit, soundEdit]);

        expect(review.writeSet).toEqual(['sounds/dash.vsnd_c']);
        expect(review.collisionWinners).toEqual([{ file: 'sounds/dash.vsnd_c', editId: 'sound' }]);
    });
});

describe('buildFoundryForgeVpk', () => {
    it('refuses a stale confirmation and leaves no build temp behind', async () => {
        const before = await countForgeTemps();
        const request: FoundryForgeRequest = {
            name: 'Stale',
            edits: [textureEdit, soundEdit],
            // What the renderer displayed no longer matches what these edits
            // write, so the reviewed write set was never actually reviewed.
            confirmation: { writeSet: ['sounds/other.vsnd_c'], collisionWinners: [] },
        };

        await expect(buildFoundryForgeVpk('C:/game', request)).rejects.toThrow('stale');
        expect(await countForgeTemps()).toBe(before);
    });

    it('refuses a confirmation whose collision winner disagrees with the request', async () => {
        const before = await countForgeTemps();
        const request: FoundryForgeRequest = {
            name: 'Wrong winner',
            edits: [textureEdit, soundEdit],
            confirmation: {
                writeSet: ['sounds/dash.vsnd_c'],
                collisionWinners: [{ file: 'sounds/dash.vsnd_c', editId: 'visual' }],
            },
        };

        await expect(buildFoundryForgeVpk('C:/game', request)).rejects.toThrow('stale');
        expect(await countForgeTemps()).toBe(before);
    });
});

describe('forgeAndExportFoundryVpk', () => {
    const request: FoundryForgeRequest = {
        name: ' My: Forge ',
        edits: [soundEdit],
        confirmation: { writeSet: ['sounds/dash.vsnd_c'], collisionWinners: [] },
    };

    it('removes the build temp when the user cancels the save dialog', async () => {
        const cleanup = vi.fn().mockResolvedValue(undefined);
        const exportVpk = vi.fn().mockResolvedValue({ exported: false });

        const result = await forgeAndExportFoundryVpk(
            request,
            async () => ({ vpkPath: '/tmp/forge/foundry_dir.vpk', cleanup }),
            exportVpk,
        );

        expect(result).toEqual({ exported: false });
        expect(cleanup).toHaveBeenCalledTimes(1);
        // A cancel is not an error, so the suggested name still had to be safe.
        expect(exportVpk).toHaveBeenCalledWith('/tmp/forge/foundry_dir.vpk', 'My- Forge_dir.vpk');
    });

    it('removes the build temp when the export itself fails partway', async () => {
        const cleanup = vi.fn().mockResolvedValue(undefined);

        await expect(forgeAndExportFoundryVpk(
            request,
            async () => ({ vpkPath: '/tmp/forge/foundry_dir.vpk', cleanup }),
            async () => { throw new Error('disk full'); },
        )).rejects.toThrow('disk full');

        expect(cleanup).toHaveBeenCalledTimes(1);
    });

    it('never lets a cleanup failure rewrite a successful export', async () => {
        const result = await forgeAndExportFoundryVpk(
            request,
            async () => ({ vpkPath: '/tmp/forge/foundry_dir.vpk', cleanup: async () => { throw new Error('locked'); } }),
            async () => ({ exported: true, path: 'C:/mods/My Forge_dir.vpk' }),
        );

        expect(result).toEqual({ exported: true, path: 'C:/mods/My Forge_dir.vpk' });
    });
});
