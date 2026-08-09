import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildFoundryForgeVpk, describeFoundryBuild, forgeAndExportFoundryVpk, reviewFoundryForge } from './foundryForge';
import type { FoundryForgeEdit, FoundryForgeRequest } from '../../../src/types/foundry';
import { runVpkmerge } from './modMerger';
import { parseVpkDirectory } from './vpk';
import { buildRecolorVpk } from './foundryRecolor';

// The end-to-end three-kind case drives every builder through the merged
// output. Mock the per-kind builders and the engine so the test asserts the
// orchestration (one source path per edit, in precedence order) rather than
// re-running real bakes or touching the filesystem beyond the forge temp.
vi.mock('./foundryCatalog', () => ({
    buildHeroSoundSwapVpk: vi.fn(async () => ({ vpkPath: '/tmp/sound.vpk', suggestedName: 'sound.vpk' })),
    cleanupHeroSoundSwapBuild: vi.fn(async () => {}),
}));
vi.mock('./foundryTextureReplace', () => ({
    buildTextureReplacementVpk: vi.fn(async () => ({ vpkPath: '/tmp/texture.vpk', suggestedName: 'texture.vpk' })),
    cleanupTextureReplacementBuild: vi.fn(async () => {}),
}));
vi.mock('./foundryRecolor', () => ({
    buildRecolorVpk: vi.fn(async () => ({ vpkPath: '/tmp/recolor.vpk', cleanup: async () => {} })),
}));
vi.mock('./modMerger', () => ({
    runVpkmerge: vi.fn(async () => {}),
    verifyVpkOutput: vi.fn(async () => {}),
}));
vi.mock('./vpk', () => ({
    parseVpkDirectory: vi.fn(() => [
        'materials/hero/ult.vtex_c',
        'particles/hero/ult.vpcf_c',
        'sounds/dash.vsnd_c',
        'textures/hero/dash.vtex_c',
    ]),
}));

beforeEach(() => {
    vi.clearAllMocks();
});

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

const recolorEdit: FoundryForgeEdit = {
    id: 'recolor', kind: 'recolor', precedence: 3,
    request: {
        heroName: 'Hero', mode: 'hue', hue: 280, saturation: 1, brightness: 1,
        entries: ['PARTICLES/HERO/ULT.VPCF_C', 'particles/hero/ult.vpcf_c', 'Materials\\Hero\\Ult.VTEX_C'],
    },
};

describe('reviewFoundryForge', () => {
    it('normalizes source paths and reports the deliberate highest-precedence winner', () => {
        const review = reviewFoundryForge([textureEdit, soundEdit]);

        expect(review.writeSet).toEqual(['sounds/dash.vsnd_c']);
        expect(review.collisionWinners).toEqual([{ file: 'sounds/dash.vsnd_c', editId: 'sound' }]);
    });

    it("derives a recolor edit's entries from request.entries and normalizes them", () => {
        const review = reviewFoundryForge([recolorEdit]);

        expect(review.writeSet).toEqual(['materials/hero/ult.vtex_c', 'particles/hero/ult.vpcf_c']);
        expect(review.collisionWinners).toEqual([]);
    });

    it('resolves a recolor/texture collision by precedence, then by stage order', () => {
        const textureAtSamePath = {
            ...textureEdit,
            request: { ...textureEdit.request, entryPath: 'particles/HERO/ult.vpcf_c', name: 'Ult texture' },
        };

        // Higher precedence wins regardless of kind.
        expect(reviewFoundryForge([recolorEdit, { ...textureAtSamePath, precedence: 4 }]).collisionWinners)
            .toEqual([{ file: 'particles/hero/ult.vpcf_c', editId: 'visual' }]);
        expect(reviewFoundryForge([{ ...textureAtSamePath, precedence: 1 }, recolorEdit]).collisionWinners)
            .toEqual([{ file: 'particles/hero/ult.vpcf_c', editId: 'recolor' }]);
        // Equal precedence: the later staged edit is the deliberate last writer.
        expect(reviewFoundryForge([recolorEdit, { ...textureAtSamePath, precedence: 3 }]).collisionWinners)
            .toEqual([{ file: 'particles/hero/ult.vpcf_c', editId: 'visual' }]);
    });
});

describe('describeFoundryBuild', () => {
    const request: FoundryForgeRequest = {
        name: 'My build',
        edits: [textureEdit, soundEdit],
        confirmation: { writeSet: ['sounds/dash.vsnd_c'], collisionWinners: [{ file: 'sounds/dash.vsnd_c', editId: 'sound' }] },
    };

    it('records the main-derived write set, not anything the renderer supplied', () => {
        // A renderer that under-reports its write set must not be able to make
        // the stored provenance disagree with what the VPK actually owns.
        const provenance = describeFoundryBuild({
            ...request,
            confirmation: { writeSet: ['lies/only.vtex_c'], collisionWinners: [] },
        });

        expect(provenance.writeSet).toEqual(['sounds/dash.vsnd_c']);
    });

    it('describes one part per edit, carrying that part\'s own normalized entries', () => {
        const provenance = describeFoundryBuild(request);

        expect(provenance.parts).toEqual([
            {
                kind: 'texture',
                title: 'Dash',
                entries: ['sounds/dash.vsnd_c'],
                category: 'ability-icon',
                heroName: undefined,
                sourceFileName: 'dash.png',
            },
            {
                kind: 'sound',
                title: 'Dash audio',
                entries: ['sounds/dash.vsnd_c'],
                heroName: 'Hero',
                event: undefined,
                sourceFileName: 'dash.mp3',
            },
        ]);
    });

    it('retains the request so the build can be rebuilt without re-authoring', () => {
        expect(describeFoundryBuild(request).reforge).toEqual(request);
    });

    it('describes a recolor part with its own normalized entries and no category or source file', () => {
        const recolorRequest: FoundryForgeRequest = {
            name: 'Recolor only',
            edits: [recolorEdit],
            confirmation: {
                writeSet: ['materials/hero/ult.vtex_c', 'particles/hero/ult.vpcf_c'],
                collisionWinners: [],
            },
        };

        expect(describeFoundryBuild(recolorRequest).parts).toEqual([
            {
                kind: 'recolor',
                title: 'Hero',
                entries: ['particles/hero/ult.vpcf_c', 'materials/hero/ult.vtex_c'],
                heroName: 'Hero',
            },
        ]);
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

    it('merges one source path per edit across sound, texture and recolor, keeping built aligned with the request', async () => {
        // Distinct entry paths on purpose: this asserts alignment (one source
        // per edit, in precedence order), not collision resolution.
        const request: FoundryForgeRequest = {
            name: 'Three kinds',
            edits: [
                { ...textureEdit, request: { ...textureEdit.request, entryPath: 'textures/hero/dash.vtex_c', name: 'Dash texture' } },
                soundEdit,
                recolorEdit,
            ],
            confirmation: {
                writeSet: [
                    'materials/hero/ult.vtex_c',
                    'particles/hero/ult.vpcf_c',
                    'sounds/dash.vsnd_c',
                    'textures/hero/dash.vtex_c',
                ],
                collisionWinners: [],
            },
        };

        const result = await buildFoundryForgeVpk('C:/game', request);

        // Precedence 1 texture, 2 sound, 3 recolor: the merged VPK receives one
        // source per edit in that order, and the recolor part is among them.
        expect(runVpkmerge).toHaveBeenCalledWith([
            expect.stringMatching(/foundry_dir\.vpk$/),
            '/tmp/texture.vpk',
            '/tmp/sound.vpk',
            '/tmp/recolor.vpk',
        ]);
        expect(buildRecolorVpk).toHaveBeenCalledWith('C:/game', request.edits[2].request);
        await result.cleanup();
    });

    it('keeps built aligned with the request across every edit kind, so a fourth kind added without a built push goes red here', async () => {
        // One edit for every member of the FoundryForgeEdit union today, on
        // distinct paths so the count below is about alignment (one source per
        // edit), never collision resolution.
        const request: FoundryForgeRequest = {
            name: 'Alignment',
            edits: [
                soundEdit,
                { ...textureEdit, request: { ...textureEdit.request, entryPath: 'textures/hero/dash.vtex_c', name: 'Dash texture' } },
                recolorEdit,
            ],
            confirmation: {
                writeSet: [
                    'materials/hero/ult.vtex_c',
                    'particles/hero/ult.vpcf_c',
                    'sounds/dash.vsnd_c',
                    'textures/hero/dash.vtex_c',
                ],
                collisionWinners: [],
            },
        };

        await buildFoundryForgeVpk('C:/game', request);

        // If a future kind were added without a `built` push, built[index]
        // would desync from request.edits[index] below and either throw before
        // the merge or hand the engine the wrong sources. The exact array is
        // the alignment check: one real source per edit, in precedence order.
        expect(runVpkmerge).toHaveBeenCalledTimes(1);
        const sources = vi.mocked(runVpkmerge).mock.calls[0][0].slice(1);
        expect(sources).toHaveLength(request.edits.length);
        expect(sources).toEqual(['/tmp/texture.vpk', '/tmp/sound.vpk', '/tmp/recolor.vpk']);
    });

    it('invokes the recolor part cleanup and leaves the shared bake cache file in place', async () => {
        const bakeDir = await fs.mkdtemp(join(tmpdir(), 'grimoire-recolor-bake-'));
        const bakePath = join(bakeDir, 'bake_dir.vpk');
        await fs.writeFile(bakePath, 'recolored bytes');
        const cleanup = vi.fn(async () => {});
        vi.mocked(buildRecolorVpk).mockResolvedValueOnce({ vpkPath: bakePath, cleanup });
        try {
            const request: FoundryForgeRequest = {
                name: 'Recolor cache',
                edits: [recolorEdit],
                confirmation: {
                    writeSet: ['materials/hero/ult.vtex_c', 'particles/hero/ult.vpcf_c'],
                    collisionWinners: [],
                },
            };
            vi.mocked(parseVpkDirectory).mockReturnValueOnce(['materials/hero/ult.vtex_c', 'particles/hero/ult.vpcf_c']);

            const result = await buildFoundryForgeVpk('C:/game', request);

            // The forge runs every part cleanup in `finally`...
            expect(cleanup).toHaveBeenCalledTimes(1);
            await result.cleanup();
            // ...and that cleanup must not delete the shared per-hero bake:
            // the Locker Apply and Export buttons read this exact file, and a
            // recolor forge must leave it in place for them.
            expect(await fs.stat(bakePath).catch(() => null)).not.toBeNull();
        } finally {
            await fs.rm(bakeDir, { recursive: true, force: true }).catch(() => {});
        }
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
