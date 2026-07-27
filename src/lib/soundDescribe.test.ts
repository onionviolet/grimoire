// Pins the search gap this module exists to close.
//
// The regression it guards: the Global sounds tab matched only label / event /
// source, so `charged_melee_full` (a clip filename that IS in the index, under
// `Player.Melee.Hold.Shared`) returned no results. Clip names are the identifier
// modders actually hold, so any future filter rewrite must keep matching them.

import { describe, expect, it } from 'vitest';
import { clipBasename, describeSound, matchesSound, primaryClipName } from './soundDescribe';

/** The real row, as `catalog globalsounds --json` emits it. */
const HEAVY_MELEE_HOLD = {
    event: 'Player.Melee.Hold.Shared',
    source: 'player',
    category: 'gameplay',
    label: 'Player Melee Hold Shared',
    vsnd: ['sounds/player/melee/shared/charged_melee_full.vsnd'],
};

describe('clip names', () => {
    it('strips directory and extension', () => {
        expect(clipBasename('sounds/player/melee/shared/charged_melee_full.vsnd')).toBe(
            'charged_melee_full'
        );
        expect(clipBasename('sounds/ui/ui_chat_msg_received_01.vsnd_c')).toBe(
            'ui_chat_msg_received_01'
        );
    });

    it('reports the first clip of a pool as the primary', () => {
        expect(primaryClipName(['sounds/a/one_01.vsnd', 'sounds/a/one_02.vsnd'])).toBe('one_01');
        expect(primaryClipName([])).toBeNull();
    });
});

describe('search matching', () => {
    it('finds a row by its clip filename (the reported miss)', () => {
        expect(matchesSound(HEAVY_MELEE_HOLD, 'charged_melee_full')).toBe(true);
    });

    it('finds it by a path fragment', () => {
        expect(matchesSound(HEAVY_MELEE_HOLD, 'player/melee/shared')).toBe(true);
    });

    it('finds it by a pasted Deadlock Forge id', () => {
        // Forge shows `player__melee__shared__charged_melee_full`; separator
        // normalization is what makes a paste of that id land here.
        expect(matchesSound(HEAVY_MELEE_HOLD, 'player__melee__shared__charged_melee_full')).toBe(
            true
        );
    });

    it('still finds it by event and label', () => {
        expect(matchesSound(HEAVY_MELEE_HOLD, 'Melee.Hold')).toBe(true);
        expect(matchesSound(HEAVY_MELEE_HOLD, 'melee')).toBe(true);
    });

    it('does not match unrelated text', () => {
        expect(matchesSound(HEAVY_MELEE_HOLD, 'zipline')).toBe(false);
    });

    it('an empty query matches everything', () => {
        expect(matchesSound(HEAVY_MELEE_HOLD, '   ')).toBe(true);
    });
});

describe('descriptions', () => {
    it('says what the heavy melee charge-up actually is', () => {
        // The whole point: the event name never says "heavy melee".
        expect(describeSound(HEAVY_MELEE_HOLD)).toMatch(/heavy melee charge-up/i);
    });

    it('derives a sentence from the event structure when uncurated', () => {
        expect(describeSound({ event: 'Guardian.Tier1.Melee.Hit', category: 'npc' })).toBe(
            'A Guardian: tier 1 melee hit.'
        );
    });

    it('names the ability when the row carries one', () => {
        expect(
            describeSound({ event: 'Gigawatt.Ability.PowerCycle.Cast', ability: 'Power Cycle' })
        ).toBe('Power Cycle: ability power cycle being cast.');
    });

    it('falls back to the category rather than inventing specifics', () => {
        expect(describeSound({ event: 'Whatever', category: 'ambience' })).toMatch(/Ambient world/);
    });

    it('returns null when nothing honest can be said', () => {
        expect(describeSound({ event: 'Whatever', category: 'other' })).toBeNull();
    });
});
