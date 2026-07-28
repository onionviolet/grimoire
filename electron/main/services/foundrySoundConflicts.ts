import type { Mod, SoundSwapInfo } from '../../../src/types/mod';

/** A file-level overlap between a prospective Foundry VPK and an installed VPK.
 * Paths are VPK entry paths, not inferred event names: third-party mods have no
 * metadata we can trust. */
export interface FoundrySoundConflict {
    modId: string;
    modName: string;
    metaKey: string;
    enabled: boolean;
    priority: number;
    entries: string[];
    managed: boolean;
    soundSwap?: SoundSwapInfo;
}

export interface FoundrySoundConflictInspection {
    writeSet: string[];
    conflicts: FoundrySoundConflict[];
    /** VPKs whose directory could not be read. They are deliberately not
     * treated as harmless: the caller must surface this uncertainty. */
    unreadableMods: Array<{ modId: string; modName: string; enabled: boolean }>;
}

export interface InstalledSoundConflictCandidate {
    mod: Pick<Mod, 'id' | 'name' | 'metaKey' | 'enabled' | 'priority'>;
    entries: string[] | null;
    soundSwap?: SoundSwapInfo;
}

const canonical = (entry: string): string => entry.replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();

/** Pure exact-write-set matcher. Keeping this separate from IPC makes it hard to
 * accidentally reintroduce metadata/event-name based collision detection. */
export function inspectFoundrySoundWriteSet(
    writeSet: string[],
    installed: InstalledSoundConflictCandidate[]
): FoundrySoundConflictInspection {
    const wanted = new Map<string, string>();
    for (const entry of writeSet) {
        const normalized = canonical(entry);
        if (normalized) wanted.set(normalized, entry);
    }
    const conflicts: FoundrySoundConflict[] = [];
    const unreadableMods: FoundrySoundConflictInspection['unreadableMods'] = [];
    for (const candidate of installed) {
        if (!candidate.entries) {
            unreadableMods.push({ modId: candidate.mod.id, modName: candidate.mod.name, enabled: candidate.mod.enabled });
            continue;
        }
        const entries = candidate.entries.filter((entry) => wanted.has(canonical(entry)));
        if (!entries.length) continue;
        conflicts.push({
            modId: candidate.mod.id,
            modName: candidate.mod.name,
            metaKey: candidate.mod.metaKey,
            enabled: candidate.mod.enabled,
            priority: candidate.mod.priority,
            entries: [...new Set(entries)].sort(),
            managed: !!candidate.soundSwap,
            soundSwap: candidate.soundSwap,
        });
    }
    return { writeSet: [...wanted.values()].sort(), conflicts, unreadableMods };
}
