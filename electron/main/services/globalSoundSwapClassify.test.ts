// Why Foundry global sound swaps are exempt from the VPK-path global classifier.
//
// The Locker's Sounds list filters on
// `isLockerManagedSound(m) && !getEffectiveGlobalType(m)`, and a global swap is
// installed with `sourceSection: 'Sound'` and no `lockerHero` precisely so it
// files there. But `enrichMod` also ran the path classifier over every scanned
// mod, and a swap's file tree is not its own: it mirrors the event it
// overrides. An item-sound swap mints into `sounds/mods/...`, which is exactly
// ANNOUNCER_PATTERN, so the mod got tagged 'announcer' and dropped out of the
// Sounds bucket onto the Global card instead.
//
// Measured against the live pak (1100 indexed global events): 295 mint into
// `sounds/mods/`, essentially the whole `item` category (291 of 293). Not an
// edge case; the largest single category of global swap.
//
// The fix is the `metadata.soundSwap` guard in resolveGlobalType (ipc/mods.ts).
// This file pins the half that makes the guard load-bearing rather than
// decoration: the classifier really does claim these paths. The Locker-side
// half is in src/lib/globalSoundSwapBucket.test.ts (kept separate because the
// main and renderer tsconfig projects don't share a lib set).

import { describe, expect, it } from 'vitest';
import { classifyGlobalModType } from './vpk';

/** Clip entries a `soundswap --pool all` mints for one event, by category. */
const MINTED = {
    // catalog globalsounds --category item -> soundevents/mods/armor.vsndevts_c
    item: ['sounds/mods/armor/cheat_death/cheat_death_expire.vsnd_c'],
    ui: ['sounds/ui/ui_chat_msg_received_01.vsnd_c'],
    music: ['sounds/music/round_start_01.vsnd_c'],
    ambience: ['sounds/ambient/soundscapes/nature/grasshoppers_lp.vsnd_c'],
};

describe('global sound swap / path classifier', () => {
    it('claims item-sound swaps as announcer (why the guard exists)', () => {
        // Removing the soundSwap guard silently re-breaks the item category.
        expect(classifyGlobalModType(MINTED.item)).toBe('announcer');
    });

    it('leaves the other global sound categories unclassified', () => {
        for (const category of ['ui', 'music', 'ambience'] as const) {
            expect(classifyGlobalModType(MINTED[category])).toBeNull();
        }
    });
});
