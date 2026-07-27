// A Foundry *global* sound swap must reach the Locker's Sounds bucket.
//
// It installs with `sourceSection: 'Sound'`, `categoryName: 'Sounds'` and
// deliberately no `lockerHero` (there is no hero to tag), so it has to survive
// both of the Sounds list's gates: `isLockerManagedSound` and the
// `!getEffectiveGlobalType` filter. Two things could drop it, and both are
// pinned here because both are one word away from silently reappearing:
//
//   1. GLOBAL_SOUND_CATEGORIES dropping the installed category name.
//   2. a globalType arriving from the VPK-path classifier, which mis-reads a
//      swap's borrowed file tree (see the companion test at
//      electron/main/services/globalSoundSwapClassify.test.ts, and the
//      `soundSwap` guard in resolveGlobalType that stops it).

import { describe, expect, it } from 'vitest';
import { getEffectiveGlobalType, isLockerManagedSound } from './lockerUtils';
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
    it('files an unclassified global swap under Sounds, not the Global card', () => {
        const mod = globalSwapMod();
        expect(isLockerManagedSound(mod)).toBe(true);
        // The Locker's Sounds filter is `isLockerManagedSound && !globalType`.
        expect(getEffectiveGlobalType(mod)).toBeUndefined();
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
