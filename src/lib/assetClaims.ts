/**
 * The asset-claims index: who claims a path, and which claimant wins.
 *
 * This is S1/S4 in docs/global-locker-foundry-ux-plan.md. "What claims this
 * path, which claimant wins" used to be derived twice, in two processes, from
 * two shapes: `inspectFoundryAssetSources` in the main process (over real VPK
 * directories) and `overlappingClaims` in the renderer (over recorded entries).
 * Two derivations of one fact is how the app came to disagree with itself about
 * what was installed.
 *
 * The two callers still differ in the one way they legitimately should: what
 * evidence they can see. The main process reads VPK directories and knows
 * everything; the renderer knows only what entries recorded. Neither gets to
 * have its own opinion about who *wins* a path they both can see.
 *
 * Deliberately pure and dependency-free so both processes can import it (the
 * main process already imports `src/lib/crosshair` and friends the same way).
 */

/** One normalized Source 2 asset path. A VPK directory may preserve different
 *  slash and case spellings; those are not distinct assets. */
export function normalizeAssetPath(path: string): string {
    return path.replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();
}

/** Anything that can claim paths: an installed mod, however its entries were
 *  learned. `entries` need not be normalized. */
export interface AssetClaimant {
    /** Stable identity, and the tie-breaker when two claimants share a priority. */
    id: string;
    enabled: boolean;
    /** Deadlock loads a higher pakNN later, so the LOWEST priority wins. */
    priority: number;
    entries: readonly string[];
}

export interface AssetClaim {
    path: string;
    /** Every claimant id, enabled or not, in winner-first order. */
    claimants: string[];
    /** Claimant ids that are enabled, in the same order. */
    enabledClaimants: string[];
    /** The enabled claimant that wins at runtime, or null when none is enabled. */
    winner: string | null;
}

export interface AssetClaimsIndex {
    /** Every requested path that at least one claimant claims, sorted. */
    paths: string[];
    byPath: ReadonlyMap<string, AssetClaim>;
    /** Paths more than one ENABLED claimant writes: the real conflicts. */
    contested: string[];
    winnerOf(path: string): string | null;
    claimantsOf(path: string): string[];
}

/**
 * The one place the load-order rule is written down.
 *
 * Deadlock loads a higher-numbered pak later, so the lowest priority among
 * enabled claimants is the runtime winner. A disabled claimant never wins, and
 * never suppresses one that is enabled.
 */
function winnerFirst(a: AssetClaimant, b: AssetClaimant): number {
    if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
    return a.priority - b.priority || a.id.localeCompare(b.id);
}

/**
 * Build the index for `paths` from `claimants`.
 *
 * `paths` scopes the question: only these are answered, because both callers
 * are asking about a specific selection rather than the whole install. Pass an
 * empty `paths` to mean "every path any claimant claims".
 */
export function buildAssetClaimsIndex(
    paths: readonly string[],
    claimants: readonly AssetClaimant[]
): AssetClaimsIndex {
    const wanted = new Set(paths.map(normalizeAssetPath).filter(Boolean));
    const scoped = wanted.size > 0;

    // Claimant order decides claimant order inside every path, so sort once
    // here rather than per path.
    const ordered = [...claimants].sort(winnerFirst);

    const byPath = new Map<string, AssetClaim>();
    for (const claimant of ordered) {
        for (const raw of new Set(claimant.entries.map(normalizeAssetPath))) {
            if (!raw) continue;
            if (scoped && !wanted.has(raw)) continue;
            let claim = byPath.get(raw);
            if (!claim) {
                claim = { path: raw, claimants: [], enabledClaimants: [], winner: null };
                byPath.set(raw, claim);
            }
            claim.claimants.push(claimant.id);
            if (claimant.enabled) {
                claim.enabledClaimants.push(claimant.id);
                // First enabled claimant in winner-first order is the winner.
                claim.winner ??= claimant.id;
            }
        }
    }

    const sorted = [...byPath.keys()].sort((a, b) => a.localeCompare(b));
    return {
        paths: sorted,
        byPath,
        contested: sorted.filter((path) => (byPath.get(path)?.enabledClaimants.length ?? 0) > 1),
        winnerOf: (path) => byPath.get(normalizeAssetPath(path))?.winner ?? null,
        claimantsOf: (path) => [...(byPath.get(normalizeAssetPath(path))?.claimants ?? [])],
    };
}
