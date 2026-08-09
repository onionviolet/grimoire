import { describe, expect, it } from 'vitest';
import { inspectFoundryAssetSources, normalizeFoundryAssetPath } from './foundryAssetSources';

const mod = (id: string, enabled: boolean, priority: number) => ({ id, name: id, enabled, priority });

describe('Foundry asset sources', () => {
    it('normalizes exact paths and picks the lower enabled priority as winner', () => {
        const result = inspectFoundryAssetSources(['/Panorama\\Images\\hero.png'], [
            { mod: mod('downloaded', true, 20), entries: ['panorama/images/hero.png'], metadata: { gameBananaId: 1 } },
            { mod: mod('forged', true, 5), entries: ['PANORAMA/IMAGES/HERO.PNG'], metadata: { textureReplacement: {} } },
            { mod: mod('disabled', false, 1), entries: ['panorama/images/hero.png'] },
        ]);
        expect(normalizeFoundryAssetPath('\\A\\B')).toBe('a/b');
        expect(result.winners['panorama/images/hero.png']).toBe('forged');
        expect(result.sources.map((source) => source.modId)).toEqual(['forged', 'downloaded', 'disabled']);
    });

    it('shows enabled and disabled exact owners, provenance, winners, and unreadable uncertainty', () => {
        const result = inspectFoundryAssetSources(['materials/icons/a.vtex_c'], [
            { mod: mod('downloaded', true, 20), entries: ['materials/icons/a.vtex_c'], metadata: { gameBananaId: 1 } },
            { mod: mod('forged', true, 5), entries: ['MATERIALS/ICONS/A.VTEX_C'], metadata: { textureReplacement: {} } },
            { mod: mod('third-party', false, 1), entries: ['materials/icons/a.vtex_c'] },
            { mod: mod('opaque', true, 3), entries: null },
        ]);
        expect(result.winners).toEqual({ 'materials/icons/a.vtex_c': 'forged' });
        expect(result.sources.map((source) => [source.modId, source.provenance, source.wins]))
            .toEqual([['forged', 'Forged', ['materials/icons/a.vtex_c']], ['downloaded', 'Downloaded', []], ['third-party', 'Third-party', []]]);
        expect(result.sources.map((source) => source.managed)).toEqual([true, true, false]);
        expect(result.unreadableMods).toEqual([{ modId: 'opaque', modName: 'opaque', enabled: true }]);
    });

    it('offers an audition only for compiled sound entries', () => {
        const result = inspectFoundryAssetSources([
            'sounds/hero/a.vsnd_c',
            'soundevents/hero/x.vsndevts_c',
            'materials/icons/a.vtex_c',
        ], [
            {
                mod: mod('swap', true, 4),
                entries: ['SOUNDS/HERO/A.VSND_C', 'soundevents/hero/x.vsndevts_c', 'materials/icons/a.vtex_c'],
                metadata: { soundSwap: {} },
            },
        ]);
        expect(result.sources[0].auditionable).toEqual(['sounds/hero/a.vsnd_c']);
    });

    it('uses normalized paths as the serialized ownership key, including duplicate VPK spellings', () => {
        const result = inspectFoundryAssetSources([
            'materials/icons/a.vtex_c',
            '/MATERIALS\\ICONS\\A.VTEX_C',
            'materials/icons/b.vtex_c',
        ], [
            {
                mod: mod('third-party', true, 9),
                entries: [
                    'MATERIALS/ICONS/A.VTEX_C',
                    'materials\\icons\\a.vtex_c',
                    'materials/icons/b.vtex_c',
                    'materials/icons/not-requested.vtex_c',
                ],
            },
        ]);

        expect(result).toEqual({
            paths: ['materials/icons/a.vtex_c', 'materials/icons/b.vtex_c'],
            sources: [{
                modId: 'third-party',
                modName: 'third-party',
                enabled: true,
                priority: 9,
                provenance: 'Third-party',
                entries: ['materials/icons/a.vtex_c', 'materials/icons/b.vtex_c'],
                wins: ['materials/icons/a.vtex_c', 'materials/icons/b.vtex_c'],
                managed: false,
                lockerManaged: false,
                auditionable: [],
            }],
            winners: {
                'materials/icons/a.vtex_c': 'third-party',
                'materials/icons/b.vtex_c': 'third-party',
            },
            unreadableMods: [],
        });
        // The IPC payload contains no Maps, Sets, Errors, or class instances.
        expect(JSON.parse(JSON.stringify(result))).toEqual(result);
    });

    it('marks Locker-managed artifacts without reclassifying their provenance', () => {
        const result = inspectFoundryAssetSources(['panorama/images/heroes/bull.png'], [
            { mod: mod('colors', true, 1), entries: ['panorama/images/heroes/bull.png'], metadata: { lockerColors: {} } },
            { mod: mod('cosmetics', true, 2), entries: ['panorama/images/heroes/bull.png'], metadata: { lockerCosmetics: {} } },
            { mod: mod('third-party', true, 3), entries: ['panorama/images/heroes/bull.png'] },
            { mod: mod('forged-build', true, 4), entries: ['panorama/images/heroes/bull.png'], metadata: { foundryBuild: {} } },
        ]);
        const byId = new Map(result.sources.map((source) => [source.modId, source]));
        expect(byId.get('colors')?.lockerManaged).toBe(true);
        expect(byId.get('cosmetics')?.lockerManaged).toBe(true);
        expect(byId.get('third-party')?.lockerManaged).toBe(false);
        // A user-forged mod must stay contesting, so it is never lockerManaged.
        expect(byId.get('forged-build')?.lockerManaged).toBe(false);
        // The new flag must not be mistaken for a reclassification: provenance
        // is unchanged for every candidate.
        expect(byId.get('colors')?.provenance).toBe('Third-party');
        expect(byId.get('cosmetics')?.provenance).toBe('Third-party');
        expect(byId.get('third-party')?.provenance).toBe('Third-party');
        expect(byId.get('forged-build')?.provenance).toBe('Forged');
    });
});
