export const VANILLA_WINDOW_LOCK_MESSAGE = 'Vanilla launch in progress';

// In-memory on purpose: a stash file left by a crash must not refuse mutations.
let active = false;

export function beginVanillaWindow(): void {
    active = true;
}

export function endVanillaWindow(): void {
    active = false;
}

export function isVanillaWindowActive(): boolean {
    return active;
}
