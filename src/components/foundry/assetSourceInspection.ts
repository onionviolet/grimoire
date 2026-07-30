import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FoundryAssetSourcesInspection } from '../../types/foundry';
import { useAppStore } from '../../stores/appStore';

export type InspectAssetSources = (paths: string[]) => Promise<FoundryAssetSourcesInspection>;

const DEFAULT_DEBOUNCE_MS = 160;
const inspectionCache = new Map<string, FoundryAssetSourcesInspection>();

/** A small, UI-agnostic request coordinator.  IPC inspection has no abort
 * channel, so cancellation means cancelling the debounce and revoking the
 * request's authority to publish a result.  That is the important guarantee:
 * an old selection can never paint over the current one. */
export class AssetSourceInspectionCoordinator {
  private generation = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly inspect: InspectAssetSources;
  private readonly debounceMs: number;

  constructor(inspect: InspectAssetSources, debounceMs = DEFAULT_DEBOUNCE_MS) {
    this.inspect = inspect;
    this.debounceMs = debounceMs;
  }

  static key(paths: readonly string[]): string {
    return [...new Set(paths.map((path) => path.replace(/\\/g, '/')))].sort().join('\n');
  }

  get(paths: readonly string[]) {
    return inspectionCache.get(AssetSourceInspectionCoordinator.key(paths));
  }

  invalidate() {
    inspectionCache.clear();
  }

  cancel() {
    this.generation += 1;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  request(paths: readonly string[], publish: (result: FoundryAssetSourcesInspection) => void, fail: (error: unknown) => void, force = false) {
    this.cancel();
    const request = this.generation;
    const key = AssetSourceInspectionCoordinator.key(paths);
    const cached = !force ? inspectionCache.get(key) : undefined;
    if (cached) {
      queueMicrotask(() => {
        if (request === this.generation) publish(cached);
      });
      return false;
    }
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.inspect([...paths]).then((result) => {
        if (request !== this.generation) return;
        inspectionCache.set(key, result);
        publish(result);
      }, (error) => {
        if (request === this.generation) fail(error);
      });
    }, this.debounceMs);
    return true;
  }
}

export function useAssetSourceInspection(paths: readonly string[], active: boolean, inspect: InspectAssetSources) {
  const [coordinator] = useState(() => new AssetSourceInspectionCoordinator(inspect));
  const key = useMemo(() => AssetSourceInspectionCoordinator.key(paths), [paths]);
  // Ownership is a fact about the installed mods, so the cache is only valid
  // for the mod list it was read against. Without this, disabling or reordering
  // a mod anywhere in the app left every already-visited selection showing the
  // winner it had before the change, which reads as the app disagreeing with
  // itself: the cache made the stale answer instant.
  const mods = useAppStore((s) => s.mods);
  const seenMods = useRef(mods);
  // Declared before the request effect below so it clears the cache first on
  // the same commit; the request effect then re-asks against the new mod list.
  useEffect(() => {
    if (seenMods.current === mods) return;
    seenMods.current = mods;
    coordinator.invalidate();
  }, [coordinator, mods]);
  const [result, setResult] = useState<FoundryAssetSourcesInspection | null>(() => coordinator.get(paths) ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!active) return;
    setLoading(true);
    setError(null);
    coordinator.invalidate();
    coordinator.request(paths, (next) => { setResult(next); setLoading(false); }, (cause) => {
      setError(cause instanceof Error ? cause.message : String(cause));
      setLoading(false);
    }, true);
  }, [active, coordinator, paths]);

  useEffect(() => {
    if (!active) {
      coordinator.cancel();
      return;
    }
    let live = true;
    queueMicrotask(() => {
      if (!live) return;
      setLoading(true);
      setError(null);
      coordinator.request(paths, (next) => { setResult(next); setLoading(false); }, (cause) => {
        setError(cause instanceof Error ? cause.message : String(cause));
        setLoading(false);
      });
    });
    return () => { live = false; coordinator.cancel(); };
    // `mods` re-asks after the invalidation above. reconcileMods preserves the
    // array identity when a poll finds nothing changed, so this fires on real
    // mod-state changes and not on every background scan.
  }, [active, coordinator, key, paths, mods]);

  return { result, loading, error, refresh };
}
