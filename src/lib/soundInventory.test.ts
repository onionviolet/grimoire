import { describe, expect, it } from 'vitest';
import {
    buildSoundInventory,
    categoriesPresent,
    classifySoundToken,
    countEnabledMods,
    countMods,
    entriesInCategory,
    isSoundContent,
    overlappingClaims,
} from './soundInventory';
import type { Mod } from '../types/mod';

/** A minimally valid installed mod; every test overrides only what it means. */
function mod(overrides: Partial<Mod> & { id: string }): Mod {
    return {
        name: overrides.id,
        fileName: `${overrides.id}_dir.vpk`,
        path: `C:/addons/${overrides.id}_dir.vpk`,
        metaKey: `${overrides.id}_dir.vpk`,
        enabled: true,
        priority: 1,
        size: 1024,
        installedAt: '2026-07-29T00:00:00.000Z',
        ...overrides,
    };
}

describe('isSoundContent', () => {
    it('accepts every shape of sound mod, including ones it cannot describe', () => {
        expect(isSoundContent(mod({ id: 'a', sourceSection: 'Sound' }))).toBe(true);
        expect(
            isSoundContent(
                mod({
                    id: 'b',
                    abilitySounds: {
                        dominantHero: 'Seven',
                        perHero: [],
                        shipsHeroVsndevts: false,
                        abilitySoundFiles: 3,
                        voSoundFiles: 0,
                    },
                })
            )
        ).toBe(true);
        expect(isSoundContent(mod({ id: 'c', globalType: 'announcer' }))).toBe(true);
        expect(isSoundContent(mod({ id: 'd', lockerSounds: { sounds: [], rebuiltAt: '' } }))).toBe(true);
    });

    it('rejects a skin', () => {
        expect(isSoundContent(mod({ id: 'skin', sourceSection: 'Mod' }))).toBe(false);
    });
});

describe('classifySoundToken', () => {
    it('reads Valve naming rather than guessing', () => {
        expect(classifySoundToken('Seven.Ability.Storm.Cast')).toBe('ability');
        expect(classifySoundToken('sounds/vo/gigawatt/line_01.vsnd')).toBe('voice');
        expect(classifySoundToken('sounds/weapons/hero_gun/fire_01.vsnd')).toBe('weapon');
        expect(classifySoundToken('sounds/player/footsteps/step_02.vsnd')).toBe('movement');
        expect(classifySoundToken('Announcer.FirstBlood')).toBe('announcer');
        expect(classifySoundToken('Music.Killstreak.T3')).toBe('music');
        expect(classifySoundToken('sounds/ui/click.vsnd')).toBe('ui');
    });

    it('says other rather than inventing a category', () => {
        expect(classifySoundToken('Something.Entirely.Unknown')).toBe('other');
    });
});

describe('buildSoundInventory', () => {
    it('emits one entry per (mod, hero) so a multi-hero mod lands on both shelves', () => {
        const inventory = buildSoundInventory([
            mod({
                id: 'multi',
                sourceSection: 'Sound',
                abilitySounds: {
                    dominantHero: 'Seven',
                    perHero: [
                        { hero: 'Seven', slots: { 1: 4, 4: 2 }, unclassified: 0, voFiles: 0, total: 6 },
                        { hero: 'Haze', slots: {}, unclassified: 0, voFiles: 3, total: 3 },
                    ],
                    shipsHeroVsndevts: false,
                    abilitySoundFiles: 6,
                    voSoundFiles: 3,
                },
            }),
        ]);

        expect([...inventory.byHero.keys()].sort()).toEqual(['Haze', 'Seven']);
        const seven = inventory.byHero.get('Seven')![0];
        expect(seven.slots).toEqual([1, 4]);
        expect(seven.categories).toEqual(['ability']);
        expect(seven.fileCount).toBe(6);
        expect(inventory.byHero.get('Haze')![0].categories).toEqual(['voice']);
        expect(inventory.global).toHaveLength(0);
        expect(inventory.all).toHaveLength(2);
    });

    it('keeps a mod with no hero on the global shelf with its global category', () => {
        const inventory = buildSoundInventory([
            mod({ id: 'ann', sourceSection: 'Sound', globalType: 'announcer' }),
            mod({ id: 'ks', sourceSection: 'Sound', categoryName: 'Killstreak Music' }),
        ]);

        expect(inventory.byHero.size).toBe(0);
        expect(inventory.global.map((entry) => entry.categories[0]).sort()).toEqual([
            'announcer',
            'music',
        ]);
    });

    it('lists an untagged third-party VPK rather than dropping it', () => {
        const inventory = buildSoundInventory([
            mod({ id: 'mystery', sourceSection: 'Sound', isUnknown: true }),
        ]);

        const entry = inventory.global[0];
        expect(entry.provenance).toBe('third-party');
        expect(entry.categories).toEqual(['other']);
        // Nothing is known about what it writes, and the model says so instead
        // of inventing a path.
        expect(entry.paths).toEqual([]);
        expect(entry.fileCount).toBe(0);
    });

    it('carries a forged swap\u2019s recorded event and normalized paths', () => {
        const inventory = buildSoundInventory([
            mod({
                id: 'forged',
                soundSwap: {
                    heroCodename: 'gigawatt',
                    event: 'Gigawatt.LightningBall.Damage',
                    audioFileName: 'zap.mp3',
                    loop: 'auto',
                    pool: 'all',
                    reforge: {
                        heroName: 'Seven',
                        audioPath: 'C:/me/zap.mp3',
                        assignments: [
                            { clipPath: 'Sounds\\Abilities\\Gigawatt\\Ball_01.vsnd_c', audioPath: 'C:/me/zap.mp3' },
                            { clipPath: 'sounds/abilities/gigawatt/ball_01.vsnd_c', audioPath: 'C:/me/zap.mp3' },
                        ],
                    },
                },
            }),
        ]);

        const entry = inventory.byHero.get('Seven')![0];
        expect(entry.provenance).toBe('forged');
        expect(entry.managed).toBe(true);
        expect(entry.events).toEqual(['Gigawatt.LightningBall.Damage']);
        // Both assignments normalize to the same entry, so the count is 1.
        expect(entry.paths).toEqual(['sounds/abilities/gigawatt/ball_01.vsnd_c']);
        expect(entry.categories).toEqual(['ability']);
    });

    it('includes the Locker sound VPK, one entry per hero it covers', () => {
        const inventory = buildSoundInventory([
            mod({
                id: 'locker-sounds',
                lockerSounds: {
                    rebuiltAt: '2026-07-29T00:00:00.000Z',
                    sounds: [
                        {
                            heroName: 'Seven',
                            heroCodename: 'gigawatt',
                            slot: 4,
                            clipPaths: ['sounds/abilities/gigawatt/ult.vsnd_c'],
                            source: { fileName: 'src.vpk', sha256AtApplyTime: 'x' },
                            addedAt: '2026-07-29T00:00:00.000Z',
                        },
                        {
                            heroName: 'Haze',
                            heroCodename: 'haze',
                            slot: 1,
                            clipPaths: ['sounds/abilities/haze/one.vsnd_c'],
                            source: { fileName: 'src.vpk', sha256AtApplyTime: 'x' },
                            addedAt: '2026-07-29T00:00:00.000Z',
                        },
                    ],
                },
            }),
        ]);

        expect(inventory.byHero.get('Seven')![0].provenance).toBe('locker');
        expect(inventory.byHero.get('Seven')![0].slots).toEqual([4]);
        expect(inventory.byHero.get('Haze')![0].paths).toEqual(['sounds/abilities/haze/one.vsnd_c']);
    });

    it('keeps a hand-tagged mod on that hero even when nothing else is known', () => {
        const inventory = buildSoundInventory([
            mod({ id: 'tagged', sourceSection: 'Sound', lockerHero: 'Vindicta' }),
        ]);

        expect(inventory.byHero.get('Vindicta')![0].categories).toEqual(['other']);
    });

    it('collapses the roster alias so one hero is one shelf', () => {
        const inventory = buildSoundInventory([
            mod({ id: 'a', sourceSection: 'Sound', lockerHero: 'The Doorman' }),
            mod({ id: 'b', sourceSection: 'Sound', lockerHero: 'Doorman' }),
        ]);

        expect([...inventory.byHero.keys()]).toEqual(['Doorman']);
        expect(inventory.byHero.get('Doorman')).toHaveLength(2);
    });

    it('sorts enabled first, then by load order', () => {
        const inventory = buildSoundInventory([
            mod({ id: 'later', sourceSection: 'Sound', lockerHero: 'Seven', enabled: true, priority: 9 }),
            mod({ id: 'off', sourceSection: 'Sound', lockerHero: 'Seven', enabled: false, priority: 1 }),
            mod({ id: 'winner', sourceSection: 'Sound', lockerHero: 'Seven', enabled: true, priority: 2 }),
        ]);

        expect(inventory.byHero.get('Seven')!.map((entry) => entry.modId)).toEqual([
            'winner',
            'later',
            'off',
        ]);
    });

    it('ignores mods that are not sound content at all', () => {
        const inventory = buildSoundInventory([mod({ id: 'skin', sourceSection: 'Mod', lockerHero: 'Seven' })]);
        expect(inventory.all).toHaveLength(0);
    });
});

describe('list helpers', () => {
    const inventory = buildSoundInventory([
        mod({
            id: 'ability-and-voice',
            sourceSection: 'Sound',
            abilitySounds: {
                dominantHero: 'Seven',
                perHero: [{ hero: 'Seven', slots: { 2: 1 }, unclassified: 0, voFiles: 2, total: 3 }],
                shipsHeroVsndevts: false,
                abilitySoundFiles: 1,
                voSoundFiles: 2,
            },
        }),
        mod({ id: 'voice-only', sourceSection: 'Sound', enabled: false, lockerHero: 'Seven' }),
    ]);
    const seven = inventory.byHero.get('Seven')!;

    it('lists an entry under every category it covers', () => {
        expect(entriesInCategory(seven, 'ability').map((e) => e.modId)).toEqual(['ability-and-voice']);
        expect(entriesInCategory(seven, 'voice').map((e) => e.modId)).toEqual(['ability-and-voice']);
        expect(categoriesPresent(seven)).toEqual(['ability', 'voice', 'other']);
    });

    it('counts distinct mods, not entries', () => {
        expect(countMods(seven)).toBe(2);
        expect(countEnabledMods(seven)).toBe(1);
    });
});

describe('overlappingClaims', () => {
    const swap = (id: string, enabled: boolean, clip: string) =>
        mod({
            id,
            enabled,
            soundSwap: {
                heroCodename: 'gigawatt',
                event: `E.${id}`,
                audioFileName: 'a.mp3',
                loop: 'auto',
                pool: 'all',
                reforge: {
                    heroName: 'Seven',
                    audioPath: 'C:/a.mp3',
                    assignments: [{ clipPath: clip, audioPath: 'C:/a.mp3' }],
                },
            },
        });

    it('reports a path two enabled entries both claim', () => {
        const seven = buildSoundInventory([
            swap('one', true, 'sounds/abilities/gigawatt/ball_01.vsnd_c'),
            swap('two', true, 'Sounds/Abilities/Gigawatt/Ball_01.vsnd_c'),
        ]).byHero.get('Seven')!;

        const overlaps = overlappingClaims(seven);
        expect(overlaps).toHaveLength(1);
        expect(overlaps[0].path).toBe('sounds/abilities/gigawatt/ball_01.vsnd_c');
        expect(overlaps[0].entryKeys).toHaveLength(2);
    });

    it('ignores a disabled claimant: a disabled VPK owns nothing', () => {
        const seven = buildSoundInventory([
            swap('one', true, 'sounds/abilities/gigawatt/ball_01.vsnd_c'),
            swap('two', false, 'sounds/abilities/gigawatt/ball_01.vsnd_c'),
        ]).byHero.get('Seven')!;

        expect(overlappingClaims(seven)).toEqual([]);
    });

    it('never reports an overlap between entries with no recorded paths', () => {
        const seven = buildSoundInventory([
            mod({ id: 'a', sourceSection: 'Sound', lockerHero: 'Seven' }),
            mod({ id: 'b', sourceSection: 'Sound', lockerHero: 'Seven' }),
        ]).byHero.get('Seven')!;

        expect(overlappingClaims(seven)).toEqual([]);
    });
});
