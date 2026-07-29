import { describe, expect, it } from 'vitest';
import {
  changeFilterOf,
  collectFoundryChanges,
  countFoundryChangesByHero,
  filterFoundryChanges,
  scopeFoundryChangesToHero,
  groupFoundryChanges,
  sortFoundryChanges,
} from './changeList';
import type { Mod } from '../../types/mod';

function mod(overrides: Partial<Mod>): Mod {
  return {
    id: 'mod-1',
    name: 'A change',
    fileName: 'pak01_dir.vpk',
    path: 'C:/game/addons/pak01_dir.vpk',
    metaKey: 'pak01_dir.vpk',
    enabled: true,
    priority: 1,
    size: 10,
    installedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  } as Mod;
}

describe('collectFoundryChanges', () => {
    it('reads a sound swap write set from its recorded assignments', () => {
        const rows = collectFoundryChanges([mod({
            id: 'sound-mod',
            lockerHero: 'Abrams',
            soundSwap: {
                heroCodename: 'bull',
                event: 'Abrams.Charge',
                audioFileName: 'horn.mp3',
                loop: 'auto',
                pool: 'all',
                reforge: {
                    heroName: 'Abrams',
                    audioPath: 'C:/audio/horn.mp3',
                    assignments: [{ clipPath: 'sounds/Abrams/Charge_01.vsnd', audioPath: 'C:/audio/horn.mp3' }],
                },
            },
        })]);
        expect(rows).toHaveLength(1);
        // The catalog names the source `.vsnd`; ownership is the compiled entry.
        expect(rows[0]).toMatchObject({
            kind: 'sound',
            entries: ['sounds/abrams/charge_01.vsnd_c'],
            heroName: 'Abrams',
            partOfBuild: false,
        });
    });

    it('gives an installed build one row per part, each with its own paths', () => {
        const rows = collectFoundryChanges([mod({
            id: 'build-mod',
            foundryBuild: {
                writeSet: ['panorama/images/heroes/bull.png', 'sounds/abrams/charge_01.vsnd_c'],
                parts: [
                    { kind: 'texture', title: 'Abrams portrait', entries: ['panorama/images/heroes/bull.png'], category: 'hero-image', heroName: 'Abrams' },
                    { kind: 'sound', title: 'Charge horn', entries: ['sounds/abrams/charge_01.vsnd_c'], heroName: 'Abrams', event: 'Abrams.Charge' },
                ],
            },
        })]);
        expect(rows.map((row) => row.kind)).toEqual(['texture', 'sound']);
        expect(rows.map((row) => row.id)).toEqual(['build-mod#0', 'build-mod#1']);
        // Both rows are the same VPK, so the UI must be able to say so.
        expect(rows.every((row) => row.partOfBuild)).toBe(true);
        expect(rows[0].entries).toEqual(['panorama/images/heroes/bull.png']);
    });

    it('keeps a build with no recorded parts, carrying its whole write set', () => {
        const rows = collectFoundryChanges([mod({
            id: 'bare-build',
            foundryBuild: { writeSet: ['materials/icons/a.vtex_c'], parts: [] },
        })]);
        expect(rows).toHaveLength(1);
        expect(rows[0].entries).toEqual(['materials/icons/a.vtex_c']);
        expect(rows[0].partOfBuild).toBe(false);
    });

    it('ignores mods with no Foundry provenance', () => {
        expect(collectFoundryChanges([mod({ id: 'downloaded', gameBananaId: 42 })])).toEqual([]);
    });

    it('normalizes a legacy texture replacement path to the ownership key', () => {
        const rows = collectFoundryChanges([mod({
            id: 'legacy',
            textureReplacement: { entryPath: 'Panorama\\Images\\Heroes\\Bull.png', imageFileName: 'mine.png', category: 'hero-image' },
        })]);
        expect(rows[0].entries).toEqual(['panorama/images/heroes/bull.png']);
        expect(changeFilterOf(rows[0])).toBe('hero-image');
    });
});

describe('filterFoundryChanges', () => {
    const rows = collectFoundryChanges([
        mod({
            id: 'a',
            name: 'Portrait swap',
            textureReplacement: { entryPath: 'panorama/images/heroes/bull.png', imageFileName: 'mine.png', category: 'hero-image', heroName: 'Abrams' },
        }),
        mod({
            id: 'b',
            name: 'Icon swap',
            textureReplacement: { entryPath: 'materials/icons/dash.vtex_c', imageFileName: 'dash.png', category: 'ability-icon' },
        }),
    ]);

    it('narrows to one catalog shelf', () => {
        expect(filterFoundryChanges(rows, { filter: 'hero-image' }).map((row) => row.id)).toEqual(['a']);
    });

    it('matches the exact game path, so a pasted entry finds its change', () => {
        expect(filterFoundryChanges(rows, { query: 'materials/icons/dash' }).map((row) => row.id)).toEqual(['b']);
    });

    it('matches the hero and the source filename too', () => {
        expect(filterFoundryChanges(rows, { query: 'abrams' }).map((row) => row.id)).toEqual(['a']);
        expect(filterFoundryChanges(rows, { query: 'dash.png' }).map((row) => row.id)).toEqual(['b']);
    });
});

describe('sortFoundryChanges', () => {
    const rows = collectFoundryChanges([
        mod({ id: 'old', name: 'B change', enabled: false, installedAt: '2026-01-01T00:00:00.000Z', textureReplacement: { entryPath: 'a/one.png', imageFileName: 'x.png', category: 'other' } }),
        mod({ id: 'new', name: 'A change', enabled: true, installedAt: '2026-06-01T00:00:00.000Z', textureReplacement: { entryPath: 'a/two.png', imageFileName: 'y.png', category: 'other' } }),
    ]);

    it('puts the newest install first', () => {
        expect(sortFoundryChanges(rows, 'recent').map((row) => row.mod.id)).toEqual(['new', 'old']);
    });

    it('sorts by name and by enabled state', () => {
        expect(sortFoundryChanges(rows, 'name').map((row) => row.title)).toEqual(['A change', 'B change']);
        expect(sortFoundryChanges(rows, 'enabled').map((row) => row.mod.id)).toEqual(['new', 'old']);
    });

    it('does not mutate the input', () => {
        const before = rows.map((row) => row.id);
        sortFoundryChanges(rows, 'name');
        expect(rows.map((row) => row.id)).toEqual(before);
    });

    it('sorts an unparseable install date last rather than scrambling the list', () => {
        const undated = collectFoundryChanges([mod({ id: 'undated', installedAt: 'not a date', textureReplacement: { entryPath: 'a/three.png', imageFileName: 'z.png', category: 'other' } })]);
        const sorted = sortFoundryChanges([...rows, ...undated], 'recent');
        expect(sorted.at(-1)!.mod.id).toBe('undated');
    });
});

describe('groupFoundryChanges', () => {
    it('shelves by hero and pushes unscoped changes to the end', () => {
        const rows = collectFoundryChanges([
            mod({ id: 'global', textureReplacement: { entryPath: 'a/one.png', imageFileName: 'x.png', category: 'other' } }),
            mod({ id: 'zed', textureReplacement: { entryPath: 'a/two.png', imageFileName: 'y.png', category: 'other', heroName: 'Zed' } }),
            mod({ id: 'abrams', textureReplacement: { entryPath: 'a/three.png', imageFileName: 'z.png', category: 'other', heroName: 'Abrams' } }),
        ]);
        expect(groupFoundryChanges(rows).map(([scope]) => scope)).toEqual(['Abrams', 'Zed', '']);
    });
});

describe('per-hero scoping and counts', () => {
    const mods = [
        mod({
            id: 'abrams-sound',
            lockerHero: 'Abrams',
            soundSwap: { event: 'ability.one', heroCodename: 'atlas', audioFileName: 'a.mp3', reforge: { assignments: [{ clipPath: 'sounds/a.vsnd' }] } },
        } as Partial<Mod>),
        mod({
            id: 'abrams-texture',
            lockerHero: 'Abrams',
            textureReplacement: { entryPath: 'panorama/atlas.png', imageFileName: 'b.png', category: 'hero-image' },
        } as Partial<Mod>),
        mod({
            id: 'mina-texture',
            lockerHero: 'Mina',
            textureReplacement: { entryPath: 'panorama/mina.png', imageFileName: 'c.png', category: 'hero-image' },
        } as Partial<Mod>),
        mod({
            id: 'unscoped-texture',
            textureReplacement: { entryPath: 'panorama/ui.png', imageFileName: 'd.png', category: 'other' },
        } as Partial<Mod>),
    ];

    it('scopes to one hero and excludes changes that belong to no hero', () => {
        const scoped = scopeFoundryChangesToHero(collectFoundryChanges(mods), 'Abrams');
        expect(scoped.map((entry) => entry.id).sort()).toEqual(['abrams-sound', 'abrams-texture']);
    });

    it('counts per hero from the same rows My changes lists', () => {
        const counts = countFoundryChangesByHero(mods);
        expect(counts.get('Abrams')).toBe(2);
        expect(counts.get('Mina')).toBe(1);
    });

    it('does not attribute an unscoped change to any hero', () => {
        const counts = countFoundryChangesByHero(mods);
        // Four rows collected, three attributed: the unscoped one is nobody's.
        expect([...counts.values()].reduce((sum, n) => sum + n, 0)).toBe(3);
    });

    it('agrees with the scoped list, so a badge cannot promise a row the workshop will not show', () => {
        const counts = countFoundryChangesByHero(mods);
        for (const hero of ['Abrams', 'Mina']) {
            expect(counts.get(hero)).toBe(scopeFoundryChangesToHero(collectFoundryChanges(mods), hero).length);
        }
    });
});
