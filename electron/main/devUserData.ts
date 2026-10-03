import { app } from 'electron';
import { mkdirSync } from 'node:fs';
import { devSlotConfig } from './devSlot';
import { seedDevSlotUserData, type SeedOutcome } from './devSlotSeed';

// Imported before the service graph. Static IPC imports can initialize SQLite
// before index.ts's body runs, so selecting a slot there is already too late.
const dev = devSlotConfig();
export let devSlotSeeding: SeedOutcome | undefined;
if (dev.slot !== undefined && dev.slot !== 0) {
    const base = app.getPath('userData');
    const slotDir = `${base}-dev${dev.slot}`;
    devSlotSeeding = seedDevSlotUserData(base, slotDir);
    // Disabled seeding and absent source profiles must still create the slot.
    mkdirSync(slotDir, { recursive: true });
    app.setPath('userData', slotDir);
}
