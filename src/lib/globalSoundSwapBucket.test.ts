// A Foundry *global* sound swap must reach a Sounds bucket, never the
// announcer card.
//
// It installs with `sourceSection: 'Sound'`, `categoryName: 'Sounds'` and
// deliberately no `lockerHero` (there is no hero to tag). Since upstream v1.35
// every hero-less sound routes to the General view's `sounds` bucket (see
// getEffectiveGlobalType), which the Locker renders as its own tab, so that is
// where a global swap belongs. What must not come back is the old VPK-path
// misread that tagged an item-sound swap 'announcer' from its borrowed
// `sounds/mods/...` tree; the `soundSwap` guard in ipc/mods.ts enrichMod stops
// that.

import { describe, expect, it } from 'vitest';
import { getEffectiveGlobalType, groupGlobalMods, isLockerManagedSound } from './lockerUtils';
import type { Mod } from '../types/mod';

/** A Foundry global sound swap as ipc/mods.ts `foundry:swapSound` installs it. */
function globalSwapMod(overrides: Partial<Mod> = {}): Mod {
    return {
        sourceSection: 'Sound',
        categoryName: 'Sounds',
        lockerHero: undefined,
        globalType: undefined,
        ...overrides,
    } as Mod;
}

describe('global sound swap -> Locker Sounds bucket', () => {
    it('files an unclassified global swap under the General Sounds bucket', () => {
        const mod = { ...globalSwapMod(), id: 'swap', name: 'swap', enabled: true, priority: 1 } as Mod;
        expect(isLockerManagedSound(mod)).toBe(true);
        expect(getEffectiveGlobalType(mod)).toBe('sounds');
        const groups = groupGlobalMods([mod]);
        expect(groups.sounds).toEqual([mod]);
        expect(groups.announcer).toEqual([]);
    });

    it("does not treat the swap's 'Sounds' category as a global drop bucket", () => {
        // GLOBAL_SOUND_CATEGORIES drops 'ui', 'music', 'announcer', 'misc'...
        // The swap installs as 'Sounds', which is deliberately not in that set.
        expect(isLockerManagedSound(globalSwapMod({ categoryName: 'Sounds' }))).toBe(true);
    });

    it('still honours an explicit user retag of a swap', () => {
        // resolveGlobalType returns a stored type when there is one, so a
        // manual retag via the Global card's menu keeps working.
        expect(getEffectiveGlobalType(globalSwapMod({ globalType: 'announcer' }))).toBe('announcer');
    });
});
