import type { Mod } from '../types/mod';

/**
 * Launch-shuffle support for Foundry changes.
 *
 * The hard question is what a "pool" even is here. Randomly enabling and
 * disabling each opted-in change independently would not be a shuffle: two
 * changes that write the same VPK entry are not independent coin flips, because
 * enabling both just means load order silently decides, and the randomness is
 * invisible. Equally, two changes that write completely unrelated paths are not
 * alternatives to each other, so picking between them destroys one for no
 * reason.
 *
 * So a pool is exactly the set of changes that contend for the same game paths,
 * derived from the exact entry paths each change recorded. That is the
 * "safe, event-level persisted pool" the roadmap required before any shuffle
 * over installed VPKs: the paths are the ownership key, so the pool is computed
 * from what a change actually writes rather than from its label or its hero.
 *
 * Grouping is transitive (connected components over shared paths), not
 * exact-set equality. A change writing {portrait} and one writing
 * {portrait, minimap} genuinely contend, and equality-grouping would leave both
 * enabled, which is the invisible-shuffle bug again. Transitive grouping is the
 * conservative choice: it never leaves two contending changes both enabled.
 */

export const FOUNDRY_SHUFFLE_INCLUDED_KEY = 'foundryShuffleIncluded';

export function normalizeChangeEntry(path: string): string {
    return path.replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();
}

/** Catalog rows name the source `.vsnd`; a VPK carries the compiled `.vsnd_c`. */
export function compiledSoundEntry(path: string): string {
    return normalizeChangeEntry(path).replace(/\.vsnd(?:_c)?$/i, '.vsnd_c');
}

/** Is this mod something Foundry authored, in any of its three provenance
 *  shapes? Enable state is per VPK, so this is deliberately per mod: a
 *  multi-part build is one atomic thing to the shuffle. */
export function isFoundryChange(mod: Mod): boolean {
    return Boolean(mod.soundSwap || mod.textureReplacement || mod.foundryBuild);
}

/**
 * Every exact VPK entry this change claims, across all of its provenance. An
 * empty result means the change predates recorded write sets: it cannot be
 * pooled, because we would be guessing what it contends with. Those are left
 * out of the shuffle entirely rather than grouped on a hunch.
 */
export function foundryChangeEntries(mod: Mod): string[] {
    const entries: string[] = [];

    const recorded = mod.soundSwap?.reforge;
    const clips = recorded?.assignments.map(({ clipPath }) => clipPath) ?? recorded?.clipPaths ?? [];
    entries.push(...clips.map(compiledSoundEntry));

    if (mod.textureReplacement?.entryPath) {
        entries.push(normalizeChangeEntry(mod.textureReplacement.entryPath));
    }
    if (mod.foundryBuild) {
        entries.push(...mod.foundryBuild.writeSet.map(normalizeChangeEntry));
        // A build's parts can name entries the recorded write set missed (a
        // sound part whose assignments were expanded at build time), so union
        // both rather than trusting either alone.
        for (const part of mod.foundryBuild.parts) {
            entries.push(...part.entries.map(normalizeChangeEntry));
        }
    }
    return [...new Set(entries.filter(Boolean))];
}

/**
 * Stable pool membership identity. Deliberately NOT `mod.id` or `metaKey`:
 * both are derived from the pakNN filename, which changes every time a mod is
 * enabled or disabled, so a persisted opt-in keyed on either would silently
 * detach the moment the shuffle it belongs to ran. Foundry changes have no
 * GameBanana id, so the content hash is the stable identity; the write set is
 * the fallback because it is the one thing that defines the change.
 */
export function foundryShuffleKey(mod: Mod): string {
    if (mod.sha256) return `foundry:sha256:${mod.sha256}`;
    const entries = foundryChangeEntries(mod);
    if (entries.length) return `foundry:paths:${entries.slice().sort().join(',')}`;
    return `foundry:mod:${mod.id}`;
}

export interface FoundryShufflePool {
    /** The contending changes, in the order they were supplied. */
    mods: Mod[];
    /** Every exact path this pool covers, for display. */
    entries: string[];
}

/**
 * Partition Foundry changes into contended-path pools (connected components
 * over shared entries). Changes with no recorded entries are omitted: there is
 * nothing to say about what they compete with.
 */
export function groupFoundryShufflePools(mods: readonly Mod[]): FoundryShufflePool[] {
    const changes = mods.filter((mod) => isFoundryChange(mod) && foundryChangeEntries(mod).length > 0);
    const parent = changes.map((_, index) => index);
    const find = (index: number): number => {
        let root = index;
        while (parent[root] !== root) root = parent[root];
        // Path compression: pools are small, but this keeps the union loop
        // linear regardless of how the shared paths chain together.
        let walk = index;
        while (parent[walk] !== root) {
            const next = parent[walk];
            parent[walk] = root;
            walk = next;
        }
        return root;
    };
    const union = (a: number, b: number) => {
        const rootA = find(a);
        const rootB = find(b);
        if (rootA !== rootB) parent[rootB] = rootA;
    };

    const owners = new Map<string, number>();
    changes.forEach((mod, index) => {
        for (const entry of foundryChangeEntries(mod)) {
            const existing = owners.get(entry);
            if (existing === undefined) owners.set(entry, index);
            else union(existing, index);
        }
    });

    const grouped = new Map<number, Mod[]>();
    changes.forEach((mod, index) => {
        const root = find(index);
        grouped.set(root, [...(grouped.get(root) ?? []), mod]);
    });
    return [...grouped.values()].map((pool) => ({
        mods: pool,
        entries: [...new Set(pool.flatMap(foundryChangeEntries))].sort(),
    }));
}

export interface FoundryShufflePlanOptions {
    mods: readonly Mod[];
    /** Keys (foundryShuffleKey) the user opted INTO the pool. */
    included: ReadonlySet<string>;
    /** Injectable RNG returning [0, 1); defaults to Math.random. */
    rng?: () => number;
    /** Allow "none of them" as an equally likely outcome for a pool. */
    includeVanilla?: boolean;
    /** Bias away from the currently enabled pick so a repeat shuffle visibly
     *  changes something. Defaults to true, matching the Locker. */
    avoidCurrent?: boolean;
}

export interface FoundryShufflePlan {
    enableIds: string[];
    disableIds: string[];
    /** How many pools actually changed, for the result toast. */
    changedPools: number;
}

/**
 * Pick one change per contended pool and make it that pool's single active
 * member. A pool with no opted-in member is left completely untouched: that is
 * the opt-out, and it is why merely having Foundry changes never alters a
 * launch.
 *
 * Opting one change into a pool makes the whole pool exclusive at launch, the
 * same way opting one skin in makes that hero's skins exclusive
 * (`planRandomization`). Anything less would leave a non-member enabled and
 * winning the same path by load order, which is the invisible-shuffle bug.
 *
 * Pure and deterministic given a fixed rng, so it is unit-tested directly.
 */
export function planFoundryShuffle(options: FoundryShufflePlanOptions): FoundryShufflePlan {
    const { mods, included, rng = Math.random, includeVanilla = false, avoidCurrent = true } = options;
    const enableIds: string[] = [];
    const disableIds: string[] = [];
    let changedPools = 0;
    if (included.size === 0) return { enableIds, disableIds, changedPools };

    for (const pool of groupFoundryShufflePools(mods)) {
        const eligible = pool.mods.filter((mod) => included.has(foundryShuffleKey(mod)));
        if (eligible.length === 0) continue;

        const active = pool.mods.find((mod) => mod.enabled);
        let candidates = eligible;
        if (avoidCurrent && eligible.length > 1 && active) {
            const without = eligible.filter((mod) => mod.id !== active.id);
            if (without.length > 0) candidates = without;
        }

        const choices: Array<Mod | null> = includeVanilla ? [...candidates, null] : candidates;
        const index = Math.min(choices.length - 1, Math.floor(rng() * choices.length));
        const chosen = choices[index] ?? null;

        let changed = false;
        if (chosen && !chosen.enabled) {
            enableIds.push(chosen.id);
            changed = true;
        }
        for (const mod of pool.mods) {
            if (mod.enabled && mod.id !== chosen?.id) {
                disableIds.push(mod.id);
                changed = true;
            }
        }
        if (changed) changedPools += 1;
    }

    return { enableIds, disableIds, changedPools };
}

/** Persisted pool membership, read defensively: a corrupt or hand-edited value
 *  must not stop the app from launching. */
export function readStoredFoundryShuffleIncluded(): Set<string> {
    try {
        const raw = localStorage.getItem(FOUNDRY_SHUFFLE_INCLUDED_KEY);
        if (!raw) return new Set();
        const value: unknown = JSON.parse(raw);
        return new Set(Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []);
    } catch {
        return new Set();
    }
}
