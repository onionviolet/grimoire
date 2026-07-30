/**
 * The cheap, local half of "who claims this path".
 *
 * Pure and IPC-free, over what installed mods *recorded* that they write. The
 * authoritative answer, which includes VPKs that recorded nothing, is the
 * inspected asset-claims index in `assetClaims.ts`; this one exists so a shelf
 * can flag an obvious collision without a round trip per row.
 *
 * It can only ever under-report, and that is the intended failure direction: a
 * missed warning sends the user to the inspector, an invented one sends them
 * chasing nothing.
 *
 * One implementation rather than one per inventory module (S1): the sound shelf
 * and the portrait card picker had the same fifteen lines twice, and two copies
 * of a rule are two chances for the rule to change on only one shelf.
 */

/** Anything with a stable key, an enabled state, and recorded write paths. */
export interface RecordedClaimant {
    key: string;
    enabled: boolean;
    paths: readonly string[];
}

/** One path claimed by more than one enabled claimant, with its claimants. */
export interface RecordedClaimOverlap {
    path: string;
    /** Claimant keys, in the input list's own order. */
    entryKeys: string[];
}

/**
 * Paths that more than one ENABLED claimant records writing.
 *
 * Disabled entries are skipped rather than reported as a conflict-in-waiting:
 * a disabled mod writes nothing, and warning about it would train the user to
 * ignore the warning.
 */
export function overlappingRecordedClaims(
    entries: readonly RecordedClaimant[],
): RecordedClaimOverlap[] {
    const byPath = new Map<string, string[]>();
    for (const entry of entries) {
        if (!entry.enabled) continue;
        for (const path of new Set(entry.paths)) {
            const claimants = byPath.get(path);
            if (claimants) claimants.push(entry.key);
            else byPath.set(path, [entry.key]);
        }
    }
    return [...byPath.entries()]
        .filter(([, entryKeys]) => entryKeys.length > 1)
        .map(([path, entryKeys]) => ({ path, entryKeys }))
        .sort((a, b) => a.path.localeCompare(b.path));
}
