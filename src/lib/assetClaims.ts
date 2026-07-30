/**
 * The asset-claims index: one answer to "what claims this path, and who wins".
 *
 * Structural cause S1/S4. That question used to be derived twice: the Locker
 * folded it out of `buildSoundInventory` plus its own ad hoc inspect call, and
 * Foundry asked `foundryInspectAssetSources` from four different components,
 * each caching nothing and each recomputing the winner lookup inside the view
 * that rendered it. Two derivations of one fact is how a mod can be a "winner"
 * in one panel and unexplained in another, and how the same set gets counted
 * twice by two rails that both did their own arithmetic.
 *
 * So: one index, computed once per path set, consumed everywhere.
 *
 * OWNERSHIP INVARIANT, unchanged. Ownership is still keyed on exact VPK entry
 * paths and still resolved in the main process by reading real VPK directories.
 * Only the *derivation* is centralised. Nothing here decides a winner from a
 * label, a category, or a hero name, and nothing here may start doing so.
 *
 * Three properties this has to keep, because they are the reasons it exists:
 *
 *  - **Cached per path set.** Arrow-keying down a catalog re-selects rows whose
 *    answer is already known; going back to a row must be instant, not another
 *    VPK scan. `peekAssetClaims` is the synchronous read that makes that work.
 *  - **Invalidated on any mod-state change**, including the Disable button
 *    inside the sources panel itself. Wired once in `appStore.ts` off the mods
 *    array identity, so a new mutation site cannot forget to call it.
 *  - **Counts are projections.** `contestedPaths`, `claimedPaths`, and the
 *    winner lookup live on the index. A view renders them; it never derives
 *    them, because two views that each derive get to disagree.
 */
import { foundryInspectAssetSources } from './api';
import type { FoundryAssetSource, FoundryAssetSourcesInspection } from '../types/foundry';

/** Same normalization the main process applies, so keys match end to end. */
export function normalizeClaimPath(path: string): string {
    return path.replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();
}

/**
 * A resolved view over one path set.
 *
 * `raw` is the wire result, kept so existing callers that already speak
 * `FoundryAssetSourcesInspection` (staging preflights, the gating helper) do not
 * need rewriting to share the cache. New readers should prefer the projections.
 */
export interface AssetClaimsIndex {
    /** Normalized paths this index covers, sorted. */
    readonly paths: readonly string[];
    /** Every installed VPK claiming at least one of `paths`. */
    readonly claimants: readonly FoundryAssetSource[];
    /** VPKs whose directory could not be read, so the picture is incomplete. */
    readonly unreadable: FoundryAssetSourcesInspection['unreadableMods'];
    readonly raw: FoundryAssetSourcesInspection;
    /** Claimants of one exact path, enabled first then by load order. */
    claimantsFor(path: string): readonly FoundryAssetSource[];
    /** The enabled claimant that actually wins this path at runtime, or null. */
    winnerFor(path: string): FoundryAssetSource | null;
    /** Winner's display name, or null. The lookup two views used to each do. */
    winnerNameFor(path: string): string | null;
    /** Paths claimed by at least one VPK. */
    claimedPaths(): readonly string[];
    /** Paths claimed by more than one ENABLED VPK: a real, live conflict. */
    contestedPaths(): readonly string[];
}

function buildIndex(raw: FoundryAssetSourcesInspection): AssetClaimsIndex {
    const byPath = new Map<string, FoundryAssetSource[]>();
    for (const source of raw.sources) {
        for (const entry of source.entries) {
            const key = normalizeClaimPath(entry);
            const list = byPath.get(key);
            if (list) list.push(source);
            else byPath.set(key, [source]);
        }
    }
    const byModId = new Map(raw.sources.map((source) => [source.modId, source]));
    return {
        paths: raw.paths,
        claimants: raw.sources,
        unreadable: raw.unreadableMods,
        raw,
        claimantsFor: (path) => byPath.get(normalizeClaimPath(path)) ?? [],
        winnerFor: (path) => {
            const winnerId = raw.winners[normalizeClaimPath(path)];
            return winnerId ? byModId.get(winnerId) ?? null : null;
        },
        winnerNameFor: (path) => {
            const winnerId = raw.winners[normalizeClaimPath(path)];
            if (!winnerId) return null;
            // Fall back to the id rather than to nothing: an id the user can
            // paste into Installed beats a blank where a name should be.
            return byModId.get(winnerId)?.modName ?? winnerId;
        },
        claimedPaths: () => [...byPath.keys()].sort(),
        contestedPaths: () =>
            [...byPath.entries()]
                .filter(([, claimants]) => claimants.filter((source) => source.enabled).length > 1)
                .map(([path]) => path)
                .sort(),
    };
}

/** Stable cache key for a path set. Order and duplicates are not part of the
 *  question being asked, so two callers spelling the same set differently share
 *  one answer. */
function cacheKey(paths: readonly string[]): string {
    return [...new Set(paths.map(normalizeClaimPath))].sort().join('\n');
}

interface CacheEntry {
    generation: number;
    /** Present once resolved, which is what makes the synchronous peek possible. */
    value: AssetClaimsIndex | null;
    inflight: Promise<AssetClaimsIndex> | null;
}

/**
 * Bounded because a catalog browse walks a lot of rows and each one is a path
 * set. Large enough that arrow-keying back and forth stays a cache hit, small
 * enough that nothing accumulates a session's worth of VPK listings.
 */
const CACHE_LIMIT = 128;
const cache = new Map<string, CacheEntry>();

let generation = 0;

/**
 * Every claim answer is now stale.
 *
 * Called from one place (the mods-array subscription in `appStore.ts`) so it
 * covers every mutation: toggle, reorder, delete, profile apply, forge, install,
 * and the Disable button inside `AssetSourcesPanel` itself, which goes through
 * the same store action the Installed list uses.
 */
export function invalidateAssetClaims(): void {
    generation += 1;
    cache.clear();
}

/** Current generation. Exposed so a hook can re-run when claims go stale. */
export function assetClaimsGeneration(): number {
    return generation;
}

function touch(key: string, entry: CacheEntry): void {
    // Re-insert to keep Map iteration order as an LRU list.
    cache.delete(key);
    cache.set(key, entry);
    while (cache.size > CACHE_LIMIT) {
        const oldest = cache.keys().next();
        if (oldest.done) break;
        cache.delete(oldest.value);
    }
}

/**
 * The cached answer for this path set, or null when there is not one yet.
 *
 * Synchronous on purpose. It is what lets a re-selected row render its sources
 * immediately, and what lets a panel keep showing a previous answer while a
 * refresh is in flight instead of blanking.
 */
export function peekAssetClaims(paths: readonly string[]): AssetClaimsIndex | null {
    if (!paths.length) return null;
    const key = cacheKey(paths);
    const entry = cache.get(key);
    if (!entry || entry.generation !== generation) return null;
    return entry.value;
}

/** Resolve the claims for a path set, sharing one in-flight call per set. */
export function assetClaims(paths: readonly string[]): Promise<AssetClaimsIndex> {
    const key = cacheKey(paths);
    const existing = cache.get(key);
    if (existing && existing.generation === generation) {
        if (existing.value) return Promise.resolve(existing.value);
        if (existing.inflight) return existing.inflight;
    }
    const claimed = generation;
    const entry: CacheEntry = { generation: claimed, value: null, inflight: null };
    entry.inflight = foundryInspectAssetSources([...paths])
        .then((raw) => {
            const index = buildIndex(raw);
            // A mod changed while this was in flight: the answer describes a
            // state that no longer exists, so it is returned to this caller but
            // never cached for the next one.
            if (claimed === generation) {
                entry.value = index;
                entry.inflight = null;
            } else {
                cache.delete(key);
            }
            return index;
        })
        .catch((cause) => {
            cache.delete(key);
            throw cause;
        });
    touch(key, entry);
    return entry.inflight;
}

/**
 * Wire-shaped result for callers that already speak
 * `FoundryAssetSourcesInspection`: the staging preflights and `sourceGating`.
 *
 * A drop-in replacement for calling `foundryInspectAssetSources` directly, and
 * the reason to prefer it is that going through here is what puts those calls
 * on the same cache and the same invalidation as everything else. A preflight
 * that inspects independently is a second derivation again.
 */
export function inspectAssetClaims(paths: string[]): Promise<FoundryAssetSourcesInspection> {
    return assetClaims(paths).then((index) => index.raw);
}
