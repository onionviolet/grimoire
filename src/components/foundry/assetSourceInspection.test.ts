import { describe, expect, it, vi } from 'vitest';
import { AssetSourceInspectionCoordinator } from './assetSourceInspection';
import type { FoundryAssetSourcesInspection } from '../../types/foundry';

const inspection = (path: string): FoundryAssetSourcesInspection => ({ paths: [path], sources: [], winners: { [path]: null }, unreadableMods: [] });

describe('AssetSourceInspectionCoordinator', () => {
  it('debounces selection and only inspects the final exact path set', async () => {
    vi.useFakeTimers();
    const inspect = vi.fn(async (paths: string[]) => inspection(paths[0]));
    const coordinator = new AssetSourceInspectionCoordinator(inspect, 100);
    coordinator.request(['a.vsnd_c'], vi.fn(), vi.fn());
    coordinator.request(['b.vsnd_c'], vi.fn(), vi.fn());
    await vi.advanceTimersByTimeAsync(100);
    expect(inspect).toHaveBeenCalledTimes(1);
    expect(inspect).toHaveBeenCalledWith(['b.vsnd_c']);
    vi.useRealTimers();
  });

  it('suppresses a late response after selection changes', async () => {
    vi.useFakeTimers();
    let resolveFirst!: (result: FoundryAssetSourcesInspection) => void;
    let resolveSecond!: (result: FoundryAssetSourcesInspection) => void;
    const inspect = vi.fn((paths: string[]) => new Promise<FoundryAssetSourcesInspection>((resolve) => {
      if (paths[0] === 'first.vsnd_c') resolveFirst = resolve;
      else resolveSecond = resolve;
    }));
    const shown: string[] = [];
    const coordinator = new AssetSourceInspectionCoordinator(inspect, 0);
    coordinator.request(['first.vsnd_c'], (result) => shown.push(result.paths[0]), vi.fn());
    await vi.advanceTimersByTimeAsync(0);
    coordinator.request(['second.vsnd_c'], (result) => shown.push(result.paths[0]), vi.fn());
    await vi.advanceTimersByTimeAsync(0);
    resolveFirst(inspection('first.vsnd_c'));
    await Promise.resolve();
    resolveSecond(inspection('second.vsnd_c'));
    await Promise.resolve();
    expect(shown).toEqual(['second.vsnd_c']);
    vi.useRealTimers();
  });

  it('uses cached exact path sets until mod state invalidates them', async () => {
    vi.useFakeTimers();
    const inspect = vi.fn(async (paths: string[]) => inspection(paths[0]));
    const coordinator = new AssetSourceInspectionCoordinator(inspect, 0);
    coordinator.request(['a.vsnd_c'], vi.fn(), vi.fn());
    await vi.advanceTimersByTimeAsync(0);
    await Promise.resolve();
    coordinator.request(['a.vsnd_c'], vi.fn(), vi.fn());
    expect(inspect).toHaveBeenCalledTimes(1);
    coordinator.invalidate();
    coordinator.request(['a.vsnd_c'], vi.fn(), vi.fn());
    await vi.advanceTimersByTimeAsync(0);
    expect(inspect).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
