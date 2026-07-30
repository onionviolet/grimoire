import { describe, expect, it } from 'vitest';
import {
    CATEGORY_ORDER,
    classifyDownloadCategory,
    classifySound,
    refineCatalogTerm,
    soundTermLabel,
    SOUND_TERM_LABEL,
    type SoundTerm,
} from './soundVocabulary';

describe('classifySound reports the reason, not just the verdict', () => {
    it('reads the tree before it reads the words', () => {
        // Word-matching would see `menu` and `shop` and call this Interface or
        // Items. The tree says music, and the tree is real evidence.
        const music = classifySound('sounds/music/menu/shop/bau_01.vsnd_c');
        expect(music.category).toBe('music');
        expect(music.rule).toBe('path');
    });

    it('files the whole player melee tree under Melee, reason included', () => {
        // The entire "Shared / Shared melee" defect: this path contains the word
        // `shared`, which once invented a category of its own.
        const melee = classifySound('sounds/player/melee/shared/charged_melee_full.vsnd_c');
        expect(melee.category).toBe('melee');
        expect(melee.rule).toBe('path');
        expect(melee.evidence).toContain('melee');
    });

    it('reads item-modifier sounds as items, which is what moved six mods off Announcer', () => {
        const item = classifySound('sounds/mods/tech/refresher/refresher_cast.vsnd_c');
        expect(item).toMatchObject({ category: 'item', rule: 'path' });
    });

    it('falls back to word-matching and says so', () => {
        const named = classifySound('some_pack/announcer_first_blood.vsnd_c');
        expect(named).toMatchObject({ category: 'announcer', rule: 'name' });
    });

    it('says it could not tell rather than guessing a bucket', () => {
        const nothing = classifySound('pak92/asset_0031.vsnd_c');
        expect(nothing).toMatchObject({ category: 'unclassified', rule: 'none' });
    });
});

describe('the download category is the weakest tier', () => {
    it('reads what it can, and marks it as a download label', () => {
        expect(classifyDownloadCategory('Killsounds')).toMatchObject({
            category: 'npc',
            rule: 'downloadCategory',
        });
        expect(classifyDownloadCategory('UI Sounds')).toMatchObject({ category: 'ui' });
    });

    it('does not turn a naming habit into a content type', () => {
        // `shared` and `generic` used to become categories here.
        expect(classifyDownloadCategory('Shared').category).toBe('unclassified');
        expect(classifyDownloadCategory('Generic').category).toBe('unclassified');
        expect(classifyDownloadCategory(undefined).category).toBe('unclassified');
    });
});

describe('the base-game catalog maps into the same vocabulary', () => {
    it('splits Melee out of the coarse gameplay group, from the paths it already had', () => {
        const refined = refineCatalogTerm('gameplay', [
            'sounds/player/melee/shared/charged_melee_full.vsnd_c',
            'sounds/player/melee/shared/charged_melee_swing.vsnd_c',
        ]);
        expect(refined.term).toBe('melee');
        expect(refined.reason?.rule).toBe('path');
    });

    it('leaves a mixed randomizer pool where the engine put it', () => {
        const refined = refineCatalogTerm('gameplay', [
            'sounds/player/melee/shared/charged_melee_full.vsnd_c',
            'sounds/weapons/hero_generic/pistol_fire_01.vsnd_c',
        ]);
        expect(refined.term).toBe('gameplay');
        expect(refined.reason).toBeNull();
    });

    it('will not move a row on a word alone', () => {
        // `melee` appears in the filename but no path rule fires, so the engine's
        // own grouping stands. A hint is not enough to break up a real group.
        expect(refineCatalogTerm('gameplay', ['sounds/misc/melee_whoosh_01.vsnd_c']).term).toBe('gameplay');
    });

    it('leaves the groups that already name a term alone', () => {
        for (const term of ['ui', 'music', 'item', 'npc', 'ambience', 'voice', 'catalogOther'] as SoundTerm[]) {
            expect(refineCatalogTerm(term, ['sounds/player/melee/x.vsnd_c']).term).toBe(term);
        }
    });
});

describe('one word list', () => {
    it('labels every term exactly once', () => {
        for (const category of CATEGORY_ORDER) {
            expect(soundTermLabel(category)).toBeTruthy();
        }
        expect(soundTermLabel('gameplay')).toBe('Gameplay');
    });

    it('keeps the base game residue distinct from the work queue', () => {
        // Both read "Other"-ish to a user, but they mean different things and
        // must not be merged: one is nobody's to fix, the other is ours.
        expect(SOUND_TERM_LABEL.catalogOther).toBe('Other');
        expect(SOUND_TERM_LABEL.unclassified).toBe('Needs classification');
    });
});
