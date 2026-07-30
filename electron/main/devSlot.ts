export const DEV_CDP_PORT_BASE = 9222;
export const DEV_VITE_PORT_BASE = 5173;

/** A configured development slot, or undefined for the normal single instance. */
export function readDevSlot(raw = process.env.GRIMOIRE_DEV_SLOT): number | undefined {
    if (raw === undefined || raw === '') return undefined;
    if (!/^(?:0|[1-9]\d*)$/.test(raw)) {
        throw new Error('GRIMOIRE_DEV_SLOT must be a non-negative integer.');
    }

    const slot = Number(raw);
    if (!Number.isSafeInteger(slot) || slot > 65535 - DEV_CDP_PORT_BASE) {
        throw new Error(`GRIMOIRE_DEV_SLOT must be between 0 and ${65535 - DEV_CDP_PORT_BASE}.`);
    }
    return slot;
}

export function devSlotConfig(raw = process.env.GRIMOIRE_DEV_SLOT) {
    const slot = readDevSlot(raw);
    return {
        slot,
        vitePort: DEV_VITE_PORT_BASE + (slot ?? 0),
        cdpPort: slot === undefined ? undefined : DEV_CDP_PORT_BASE + slot,
    };
}
