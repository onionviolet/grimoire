import { ipcMain } from 'electron';
import { getActiveDeadlockPath } from '../services/settings';
import { getHeroAbilitySlots } from '../services/abilitySounds';
import {
    applyHeroSound,
    revertHeroSound,
    getActiveHeroSounds,
    heroSoundWriteSet,
} from '../services/heroSounds';
import type {
    AbilitySlot,
    AbilitySoundParams,
    ActiveHeroSound,
    ApplyHeroSoundResult,
    HeroAbilitySlot,
} from '../../../src/types/mod';

/** Active Deadlock install path (dev override wins, same as ipc/portraits.ts). */
// Reference data for the per-ability sound picker: the 4 ability slots (name +
// icon) for a hero. Per-mod classifications ride on the Mod object via
// enrichMod, so no per-mod IPC is needed here.
ipcMain.handle(
    'get-hero-ability-slots',
    (_, heroName: string): HeroAbilitySlot[] => getHeroAbilitySlots(heroName),
);

// Per-ability sound APPLY pipeline (services/heroSounds.ts). Mirrors the
// apply-hero-card trio in ipc/portraits.ts: pick one source per (hero, slot),
// revert a slot, and read back which source each slot currently uses.
ipcMain.handle(
    'apply-hero-sound',
    async (
        _,
        heroName: string,
        slot: AbilitySlot,
        sourceFileName: string,
        params?: AbilitySoundParams,
    ): Promise<ApplyHeroSoundResult> => {
        const deadlockPath = getActiveDeadlockPath();
        if (!deadlockPath) throw new Error('No Deadlock path configured');
        return applyHeroSound(deadlockPath, heroName, slot, sourceFileName, params);
    },
);

ipcMain.handle(
    'revert-hero-sound',
    async (_, heroName: string, slot: AbilitySlot): Promise<ApplyHeroSoundResult> => {
        const deadlockPath = getActiveDeadlockPath();
        if (!deadlockPath) throw new Error('No Deadlock path configured');
        return revertHeroSound(deadlockPath, heroName, slot);
    },
);

// Pre-write disclosure: the exact entries an apply would write, so the picker
// can say what a pick overwrites before it writes rather than leaving the user
// to find out on the Conflicts page. Writes nothing.
ipcMain.handle(
    'get-hero-sound-write-set',
    async (_, heroName: string, slot: AbilitySlot, sourceKey: string): Promise<string[]> => {
        const deadlockPath = getActiveDeadlockPath();
        if (!deadlockPath) return [];
        return heroSoundWriteSet(deadlockPath, heroName, slot, sourceKey);
    },
);

ipcMain.handle(
    'get-active-hero-sounds',
    async (_, heroName: string): Promise<ActiveHeroSound[]> => {
        const deadlockPath = getActiveDeadlockPath();
        if (!deadlockPath) return [];
        return getActiveHeroSounds(deadlockPath, heroName);
    },
);
