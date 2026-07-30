import { cpSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';

/* A dev slot gets its own userData directory so two instances can run at once:
 * Chromium locks a profile, so sharing one directory is not an option. But an
 * empty profile is useless for feature work. Every mod reads as `PakNN` because
 * mod-metadata.json is gone, and half the nav disappears because the settings
 * that gate it are gone. So a slot's first boot copies the real profile.
 *
 * Copied once, on creation only. After that the slot owns its state and diverges
 * freely, which is the point of having slots. */

/* Chromium's own per-profile state. Never copied: it is the part that must stay
 * distinct (a copied lockfile or DevToolsActivePort actively misleads), and it
 * is also ~90% of the bytes on disk. Regenerates on first launch. */
const CHROMIUM_STATE = new Set(
    [
        'Cache',
        'Code Cache',
        'GPUCache',
        'DawnGraphiteCache',
        'DawnWebGPUCache',
        'Crashpad',
        'Partitions',
        'Local Storage',
        'Session Storage',
        'Shared Dictionary',
        'blob_storage',
        'Network',
        'Local State',
        'Preferences',
        'DevToolsActivePort',
        'lockfile',
        'SharedStorage',
        'SharedStorage-wal',
        'DIPS',
        'DIPS-wal',
        'logs',
        // The updater identity should be per-profile, not cloned.
        '.updaterId',
    ].map((name) => name.toLowerCase())
);

function isCopyable(name: string): boolean {
    if (CHROMIUM_STATE.has(name.toLowerCase())) return false;
    // SQLite rebuilds -shm from the database and WAL. Copying a shared-memory
    // index that describes a *live* WAL from another process is the one way this
    // copy can hand the slot a corrupt database, so leave it behind.
    return !name.endsWith('-shm');
}

export type SeedOutcome = 'seeded' | 'slot-exists' | 'no-source' | 'disabled';

/**
 * Populate a freshly created dev-slot profile from the real one.
 * Returns what it decided to do, for logging.
 */
export function seedDevSlotUserData(
    source: string,
    target: string,
    enabled = process.env.GRIMOIRE_DEV_SEED !== '0'
): SeedOutcome {
    if (!enabled) return 'disabled';
    if (existsSync(target)) return 'slot-exists';
    if (!existsSync(source)) return 'no-source';

    const entries = readdirSync(source).filter(isCopyable);

    mkdirSync(target, { recursive: true });
    for (const entry of entries) {
        // A profile in use will drop a file mid-walk (cache eviction, a rotated
        // log). One unreadable entry should cost that entry, not the whole seed.
        try {
            cpSync(join(source, entry), join(target, entry), { recursive: true });
        } catch {
            /* empty */
        }
    }
    return 'seeded';
}
