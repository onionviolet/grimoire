import { describe, expect, it } from 'vitest';
import {
    buildSoundInventory,
    categoriesPresent,
    classifySound,
    classifySoundToken,
    soundCategoryFromCatalog,
    countEnabledMods,
    countMods,
    entriesInCategory,
    soundEntriesInVpk,
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

    it('says unclassified rather than inventing a category', () => {
        expect(classifySoundToken('Something.Entirely.Unknown')).toBe('unclassified');
    });

    /**
     * The Stage 0 fixture. Every path here was read out of a real installed mod
     * in the dev build on 2026-07-30 (see the known-issue section of
     * docs/global-locker-foundry-ux-plan.md), not invented for the test, because
     * the defect being fixed came from rules written against imagined paths.
     */
    describe('the installed corpus', () => {
        it('files player melee under Melee, not under a category named after a folder', () => {
            // The whole `Shared` / `Shared melee` defect: this pool lives in a
            // directory literally called `shared`.
            expect(classifySoundToken('sounds/player/melee/shared/charged_melee_full.vsnd_c')).toBe('melee');
            expect(classifySoundToken('sounds/player/melee/shared/melee_parry_success.vsnd_c')).toBe('melee');
            expect(classifySoundToken('sounds/player/melee/heavy_swing_03.vsnd_c')).toBe('melee');
        });

        it('files item-modifier sounds under Items, which is where the Announcer shelf came from', () => {
            expect(classifySoundToken('sounds/mods/tech/refresher/refresher_cast.vsnd_c')).toBe('item');
            expect(classifySoundToken('sounds/mods/tech/magic_carpet/magiccarpet_lp.vsnd_c')).toBe('item');
            expect(classifySoundToken('sounds/mods/armor/colossus/colossus_cast.vsnd_c')).toBe('item');
            expect(classifySoundToken('sounds/mods/armor/trophy_collector/trophy_collector_proc.vsnd_c')).toBe('item');
            expect(classifySoundToken('soundevents/mods/armor.vsndevts_c')).toBe('item');
        });

        it('files neutral camp and creep sounds under NPC', () => {
            expect(classifySoundToken('sounds/npc/neutrals/vaults/vault_hit_heavy_01.vsnd_c')).toBe('npc');
            expect(classifySoundToken('soundevents/npc/neut_vaults.vsndevts')).toBe('npc');
            expect(classifySoundToken('XPTrooperCreepKill')).toBe('npc');
            expect(classifySoundToken('SexySinners-BreedToSucceed')).toBe('npc');
        });

        it('lets the directory beat a word in the filename', () => {
            // A music pack whose clips sit under `menu/shop`. Word-matching read
            // that as Interface or Items; it is neither.
            expect(classifySoundToken('sounds/music/menu/shop/bau_01.vsnd_c')).toBe('music');
            expect(classifySoundToken('sounds/music/match_intro/music_match_start_king_160bpm.vsnd_c')).toBe('music');
            // And a UI pack whose clips are songs.
            expect(classifySoundToken('sounds/ui/ui_pause_lp_greenroom.vsnd_c')).toBe('ui');
            expect(classifySoundToken('soundevents/ui.vsndevts_c')).toBe('ui');
        });

        it('keeps hero content where it was', () => {
            expect(classifySoundToken('sounds/vo/astro/astro_ally_shiv_multikill_03.vsnd_c')).toBe('voice');
            expect(classifySoundToken('sounds/abilities/vampirebat/a1_rake/vampirebat_rake_cast_02.vsnd_c')).toBe('ability');
            expect(classifySoundToken('soundevents/vo/generated_vo_hero_familiar.vsndevts_c')).toBe('voice');
        });

        it('still refuses to guess from a name alone', () => {
            expect(classifySoundToken('Pak92')).toBe('unclassified');
            expect(classifySoundToken('sounds/mystery/thing_01.vsnd_c')).toBe('unclassified');
        });
    });
});

describe('classification evidence', () => {
    /** The six mods that sat on the Announcer shelf, with what they really write. */
    const announcerShelf = [
        mod({
            id: 'jojo',
            name: 'JoJo Pillar man theme over Colossus loop',
            sourceSection: 'Sound',
            categoryName: 'In-Game Music',
            globalType: 'announcer',
        }),
        mod({ id: 'pak92', name: 'Pak92', sourceSection: 'Sound', globalType: 'announcer' }),
    ];

    const discoveredPaths = {
        jojo: [
            'sounds/mods/armor/colossus/colossus_cast.vsnd_c',
            'soundevents/mods/armor.vsndevts_c',
        ],
        pak92: ['sounds/mods/armor/trophy_collector/trophy_collector_proc.vsnd_c'],
    };

    it('classifies on what the VPK writes, not on how the download was filed', () => {
        const withEvidence = buildSoundInventory(announcerShelf, { discoveredPaths });
        expect(withEvidence.global.map((entry) => entry.categories)).toEqual([['item'], ['item']]);
    });

    it('falls back to the download category only when nothing was read', () => {
        const blind = buildSoundInventory(announcerShelf);
        // globalType: 'announcer' is all that is left to go on, and it is wrong,
        // which is exactly why the evidence above matters.
        expect(blind.global.map((entry) => entry.categories)).toEqual([['announcer'], ['announcer']]);
    });

    it('reports the discovered entries as the write set, so the row can name them', () => {
        const entry = buildSoundInventory(announcerShelf, { discoveredPaths }).global[0];
        expect(entry.paths).toEqual([
            'soundevents/mods/armor.vsndevts_c',
            'sounds/mods/armor/colossus/colossus_cast.vsnd_c',
        ]);
        expect(entry.fileCount).toBe(2);
    });

    it('leaves a mod unclassified when its VPK says nothing recognisable', () => {
        const entry = buildSoundInventory([mod({ id: 'odd', sourceSection: 'Sound' })], {
            discoveredPaths: { odd: ['sounds/whatever/thing.vsnd_c'] },
        }).global[0];
        expect(entry.categories).toEqual(['unclassified']);
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
        expect(entry.categories).toEqual(['unclassified']);
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

        expect(inventory.byHero.get('Vindicta')![0].categories).toEqual(['unclassified']);
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
        expect(categoriesPresent(seven)).toEqual(['ability', 'voice', 'unclassified']);
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

describe('soundEntriesInVpk', () => {
    // A real global music pack: the VPK carries the clips and the soundevent
    // manifest, plus whatever else the author happened to zip up.
    const listing = [
        'sounds/music/refresher_pickup.vsnd_c',
        'soundevents/soundevents_music.vsndevts_c',
        'materials/hud/killstreak.vtex_c',
        'readme.txt',
    ];

    it('keeps the sound entries and drops everything else', () => {
        expect(soundEntriesInVpk(listing)).toEqual([
            'soundevents/soundevents_music.vsndevts_c',
            'sounds/music/refresher_pickup.vsnd_c',
        ]);
    });

    it('normalizes separators and case, and de-duplicates', () => {
        expect(soundEntriesInVpk(['Sounds\\Music\\A.vsnd_c', 'sounds/music/a.vsnd_c'])).toEqual([
            'sounds/music/a.vsnd_c',
        ]);
    });

    it('reports nothing for a VPK with no sound content, rather than guessing', () => {
        expect(soundEntriesInVpk(['materials/hud/icon.vtex_c'])).toEqual([]);
    });
});

describe('classifySound', () => {
    it('says which path segment decided it, not just the answer', () => {
        expect(classifySound('sounds/mods/tech/refresher/refresher_cast.vsnd_c')).toEqual({
            category: 'item',
            reason: { kind: 'path', evidence: 'sounds/mods/' },
        });
    });

    it('reports a word hint as a word hint, so weak evidence reads as weak', () => {
        expect(classifySound('XPTrooperCreepKill')).toEqual({
            category: 'npc',
            reason: { kind: 'word', evidence: 'trooper' },
        });
    });

    it('reports unreadable rather than a reason it does not have', () => {
        expect(classifySound('Something.Entirely.Unknown')).toEqual({
            category: 'unclassified',
            reason: { kind: 'unreadable' },
        });
    });

    it('prefers the path rule over the word in the same token', () => {
        // `music` the word appears nowhere; `shop` and `menu` both do, and both
        // would win on words alone. The directory is the fact.
        expect(classifySound('sounds/music/menu/shop/bau_01.vsnd_c')).toEqual({
            category: 'music',
            reason: { kind: 'path', evidence: 'sounds/music/' },
        });
    });
});

describe('soundCategoryFromCatalog', () => {
    it('gives the base-game catalog a Melee group its engine grouping has no word for', () => {
        // The catalog files every melee sound under `gameplay`, a bag. The clip
        // path is the same evidence the Locker reads, so both surfaces land on
        // the same category and #5 DoD 10 holds without a second vocabulary.
        expect(
            soundCategoryFromCatalog({
                category: 'gameplay',
                source: 'player/melee',
                vsnd: ['sounds/player/melee/shared/charged_melee_full.vsnd'],
            })
        ).toEqual({ category: 'melee', reason: { kind: 'path', evidence: 'sounds/player/melee/' } });
    });

    it('falls back to the catalog family when no path reads, and says so', () => {
        expect(
            soundCategoryFromCatalog({ category: 'ui', source: 'somewhere_odd', vsnd: [] })
        ).toEqual({ category: 'ui', reason: { kind: 'word', evidence: 'ui' } });
    });

    it('does not turn the catalog shrug into a category', () => {
        expect(soundCategoryFromCatalog({ category: 'other', source: '', vsnd: [] })).toEqual({
            category: 'unclassified',
            reason: { kind: 'unreadable' },
        });
    });

    it('reads the clip path even when the catalog family already had an answer', () => {
        // `gameplay` would have been Weapon-ish; the tree says these are item
        // modifier sounds, and the tree wins.
        expect(
            soundCategoryFromCatalog({
                category: 'gameplay',
                source: 'mods/tech',
                vsnd: ['sounds/mods/tech/refresher/refresher_cast.vsnd'],
            }).category
        ).toBe('item');
    });
});
