export const LOCKER_CARDS_KEY = 'locker:cards';
export const LOCKER_SOUNDS_KEY = 'locker:sounds';
export const LOCKER_COLORS_KEY = 'locker:colors';
export const LOCKER_TRIPPY_SKINS_KEY = 'locker:trippyskins';

export const LOCKER_VPK_SLOTS = {
    [LOCKER_CARDS_KEY]: 'pak01',
    [LOCKER_SOUNDS_KEY]: 'pak02',
    [LOCKER_COLORS_KEY]: 'pak03',
    [LOCKER_TRIPPY_SKINS_KEY]: 'pak04',
} as const;

export function isLockerVpkName(name: string): boolean {
    return Object.values(LOCKER_VPK_SLOTS).some(stem => isLockerVpkSlotFile(stem, name));
}

export function isLockerVpkSlotFile(stem: string, name: string): boolean {
    return name.startsWith(`${stem}_`) && /^(?:dir|\d{3})\.vpk$/.test(name.slice(stem.length + 1));
}
