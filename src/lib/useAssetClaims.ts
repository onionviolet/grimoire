/**
 * React access to the shared asset-claims index (see `assetClaims.ts`).
 *
 * Two behaviours this hook owes its callers, both of them the point of S1:
 *
 *  - A cached answer renders synchronously on the first frame, so arrow-keying
 *    back to a row you already inspected shows its sources immediately.
 *  - A stale answer is kept on screen while a refresh runs, rather than being
 *    replaced by a spinner. The panel says it is refreshing; it does not blank.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    assetClaims,
    assetClaimsGeneration,
    peekAssetClaims,
    type AssetClaimsIndex,
} from './assetClaims';
import { useAppStore } from '../stores/appStore';

export interface UseAssetClaimsResult {
    /** Null until an answer exists. May be a previous generation's answer while
     *  `loading` is true, which is deliberate: see the note above. */
    index: AssetClaimsIndex | null;
    loading: boolean;
    error: string | null;
    /** True when `index` describes a mod state that has since changed. */
    stale: boolean;
    /** Ask again now. Used by the panel's explicit re-inspect control. */
    refresh: () => Promise<void>;
}

/**
 * @param paths Exact VPK entry paths. Null or empty means "nothing to ask".
 * @param enabled Whether to actually fetch. Inspection reads VPK directories,
 *   so a catalog grid keeps it false until a row is opened. A cached answer is
 *   still served when false: it costs nothing and it is already true.
 */
export function useAssetClaims(
    paths: readonly string[] | null | undefined,
    enabled = true,
): UseAssetClaimsResult {
    // Re-reading the mods array is what makes this recompute after a toggle:
    // the store bumps the claims generation from the same change.
    useAppStore((state) => state.mods);
    const generation = assetClaimsGeneration();
    const key = paths?.length ? [...paths].join('\n') : '';

    const cached = paths?.length ? peekAssetClaims(paths) : null;
    const [index, setIndex] = useState<AssetClaimsIndex | null>(cached);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // Which (path set, generation) the held answer describes, so a stale one can
    // stay visible while being honestly labelled as stale.
    const answered = useRef<string | null>(cached ? `${generation}\n${key}` : null);
    const want = `${generation}\n${key}`;

    const run = useCallback(async (): Promise<void> => {
        if (!paths?.length) return;
        setLoading(true);
        setError(null);
        try {
            const resolved = await assetClaims(paths);
            setIndex(resolved);
            answered.current = `${assetClaimsGeneration()}\n${key}`;
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : String(cause));
        } finally {
            setLoading(false);
        }
        // `paths` is a fresh array on most renders; `key` is its stable identity.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);

    useEffect(() => {
        if (!paths?.length) {
            setIndex(null);
            setError(null);
            answered.current = null;
            return;
        }
        const hit = peekAssetClaims(paths);
        if (hit) {
            setIndex(hit);
            setError(null);
            answered.current = want;
            return;
        }
        if (enabled) void run();
        // Same reasoning as above: identity comes from `key`, not the array.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, want, enabled, run]);

    return {
        index,
        loading,
        error,
        stale: Boolean(index) && answered.current !== want,
        refresh: run,
    };
}
