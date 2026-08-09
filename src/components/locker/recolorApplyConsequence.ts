import type {
    FoundryAssetSourceProvenance,
    FoundryAssetSourcesInspection,
} from '../../types/foundry';

/** One enabled, non-Locker-managed source that currently wins at least one
 *  path in the recolor's write set. `wins` are the inspection's own answer,
 *  never recomputed here. */
export interface RecolorContestingOwner {
    modId: string;
    modName: string;
    provenance: FoundryAssetSourceProvenance;
    wins: string[];
}

/** The pre-write consequence of a recolor apply, derived entirely from the
 *  inspection main already computed. */
export interface RecolorApplyConsequence {
    /** Exact normalized VPK entry paths the apply will write, verbatim from
     *  the inspection (main already normalized and sorted them). */
    paths: string[];
    /** Union of the contesting owners' wins, sorted and deduplicated. */
    contestedPaths: string[];
    /** Enabled, non-Locker-managed sources that win at least one path. */
    owners: RecolorContestingOwner[];
    /** Names of VPKs that could not be inspected. */
    unreadable: string[];
    /** True when at least one other enabled mod currently wins a path. */
    contested: boolean;
}

/**
 * What applying an ability recolor would overwrite, as a pure fact over the
 * inspection result the caller already fetched.
 *
 * The `entries` this receives came from parsing a real bake output through the
 * shared `foundry:prepareRecolorStage` IPC, and the inspection was run against
 * those exact entries, so the disclosed write set cannot drift from the write
 * the apply performs. Nothing here re-derives who wins: `winners` and `wins`
 * are already the claims index's answer, and putting the load-order rule in a
 * second place is exactly how the Locker and Foundry would come to disagree.
 *
 * The uncontested case is deliberately not a warning: a routine recolor that
 * no other enabled mod claims keeps its current one-press speed, and this
 * module only ever reports the fact.
 */
export function recolorApplyConsequence(
    entries: readonly string[],
    inspection: FoundryAssetSourcesInspection,
): RecolorApplyConsequence {
    // Refuse to disclose an empty write set when entries were actually
    // requested: a disclosure that disagrees with the write is worse than no
    // disclosure, and this state means discovery and inspection disagreed.
    if (entries.length > 0 && inspection.paths.length === 0) {
        throw new Error('The recolor write set could not be confirmed; refusing to disclose an empty set.');
    }
    const owners = inspection.sources
        .filter((source) => source.enabled && !source.lockerManaged && source.wins.length > 0)
        .map((source) => ({
            modId: source.modId,
            modName: source.modName,
            provenance: source.provenance,
            wins: source.wins,
        }))
        .sort((a, b) => a.modName.localeCompare(b.modName));
    const contestedPaths = [...new Set(owners.flatMap((owner) => owner.wins))].sort(
        (a, b) => a.localeCompare(b),
    );
    return {
        paths: inspection.paths,
        contestedPaths,
        owners,
        unreadable: inspection.unreadableMods.map((mod) => mod.modName),
        contested: owners.length > 0,
    };
}
