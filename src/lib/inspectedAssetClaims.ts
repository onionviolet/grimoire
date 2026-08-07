/**
 * The renderer's cached, IPC-backed asset-claims layer.
 *
 * This is the authoritative answer: the one that actually read real VPK
 * directories in the main process this session (via the IPC bridge,
 * `foundryInspectAssetSources`), wrapped in a small LRU cache so a catalog row
 * already inspected renders instantly instead of re-scanning. Every
 * Foundry/Locker view that needs the authoritative winner should go through
 * `assetClaims`/`inspectAssetClaims` here rather than calling the IPC itself
 * (see `assetClaims.ts` for the fuller S1/S4 history: this used to be
 * re-derived independently by five-plus components).
 *
 * Deliberately a SEPARATE file from `assetClaims.ts`'s pure core: this module
 * imports `./api` (`window.electronAPI` under the hood), which only exists in
 * the renderer. `electron/main/services/foundryAssetSources.ts` imports the
 * pure core's `buildAssetClaimsIndex` directly; if that function lived in
 * this file instead, importing it from the main process would drag this
 * renderer-only, `window`-using module into the main process's build graph
 * and fail to typecheck under its DOM-less tsconfig.
 *
 * `InspectedAssetClaims` is its own name, distinct from the pure core's
 * `AssetClaimsIndex`, because the two are genuinely different shapes over
 * different evidence; naming them the same only invites a caller to reach for
 * whichever one happens to be in scope.
 *
 * OWNERSHIP INVARIANT, unchanged. Ownership is keyed on exact VPK entry paths
 * and resolved in the main process by reading real VPK directories. Nothing
 * here decides a winner from a label, a category, or a hero name.
 */
import { normalizeAssetPath } from './assetClaims';
import { foundryInspectAssetSources } from './api';
import type { FoundryAssetSource, FoundryAssetSourcesInspection } from '../types/foundry';

/**
 * A resolved view over one path set, backed by the actual IPC inspection
 * (real VPK directories, read this session) rather than by recorded entries.
 *
 * `raw` is the wire result, kept so existing callers that already speak
 * `FoundryAssetSourcesInspection` (staging preflights, the gating helper) do not
 * need rewriting to share the cache. New readers should prefer the projections.
 */
export interface InspectedAssetClaims {
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

function buildIndex(raw: FoundryAssetSourcesInspection): InspectedAssetClaims {
    const byPath = new Map<string, FoundryAssetSource[]>();
    for (const source of raw.sources) {
        for (const entry of source.entries) {
            const key = normalizeAssetPath(entry);
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
        claimantsFor: (path) => byPath.get(normalizeAssetPath(path)) ?? [],
        winnerFor: (path) => {
            const winnerId = raw.winners[normalizeAssetPath(path)];
            return winnerId ? byModId.get(winnerId) ?? null : null;
        },
        winnerNameFor: (path) => {
            const winnerId = raw.winners[normalizeAssetPath(path)];
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
    return [...new Set(paths.map(normalizeAssetPath))].sort().join('\n');
}

interface CacheEntry {
    generation: number;
    /** Present once resolved, which is what makes the synchronous peek possible. */
    value: InspectedAssetClaims | null;
    inflight: Promise<InspectedAssetClaims> | null;
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
export function peekAssetClaims(paths: readonly string[]): InspectedAssetClaims | null {
    if (!paths.length) return null;
    const key = cacheKey(paths);
    const entry = cache.get(key);
    if (!entry || entry.generation !== generation) return null;
    return entry.value;
}

/** Resolve the claims for a path set, sharing one in-flight call per set. */
export function assetClaims(paths: readonly string[]): Promise<InspectedAssetClaims> {
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
