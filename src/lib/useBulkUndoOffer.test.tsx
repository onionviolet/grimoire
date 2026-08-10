// @vitest-environment jsdom

import '../i18n';
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '../stores/appStore';
import { useToastStore } from '../stores/toastStore';
import { captureBulkSnapshot, type BulkModSnapshot } from './bulkUndo';
import { useBulkUndoOffer, type BulkPartial } from './useBulkUndoOffer';
import type { Mod } from '../types/mod';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

/**
 * CR-01 regression: the bulk-undo offer must read the LIVE store at offer time
 * (for the changed count) and at click time (for the restore plan), never the
 * render closure that created the callback. The page's five bulk handlers call
 * `offerBulkUndo` from the same render that captured the pre-batch snapshot, so
 * the harness below captures the callback from the mount render, mutates the
 * store, and only then invokes the captured (stale-render) callback — exactly
 * the wiring that used to diff the snapshot against itself.
 */

type OfferFn = (
  snapshot: BulkModSnapshot[],
  selection: string[],
  partial?: BulkPartial,
) => void;

const apiMock = vi.hoisted(() => ({
  getMods: vi.fn(),
  enableMod: vi.fn(),
  disableMod: vi.fn(),
  setModLockerHero: vi.fn(),
  setModGlobalType: vi.fn(),
}));

vi.mock('../lib/api', () => apiMock);

function mod(overrides: Partial<Mod>): Mod {
  return {
    id: 'mod-1',
    name: 'A mod',
    fileName: 'pak01_dir.vpk',
    path: 'C:/game/addons/pak01_dir.vpk',
    metaKey: 'pak01_dir.vpk',
    enabled: true,
    priority: 1,
    size: 10,
    installedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  } as Mod;
}

function Harness({
  onReady,
  onRestored,
}: {
  onReady: (offer: OfferFn) => void;
  onRestored?: (selection: string[]) => void;
}) {
  const { offerBulkUndo, undoBusy } = useBulkUndoOffer(onRestored);
  useEffect(() => {
    onReady(offerBulkUndo);
  }, [offerBulkUndo, onReady]);
  return <div>{undoBusy ? <span data-testid="undo-busy">busy</span> : null}</div>;
}

/** Two macrotask turns so async restores (and their loadMods refresh) settle. */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('useBulkUndoOffer', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    apiMock.getMods.mockImplementation(async () => useAppStore.getState().mods);
    apiMock.enableMod.mockImplementation(async (id: string) => {
      const current = useAppStore.getState().mods.find((m) => m.id === id);
      if (!current) throw new Error('Mod not found');
      return { ...current, enabled: true };
    });
    apiMock.disableMod.mockImplementation(async (id: string) => {
      const current = useAppStore.getState().mods.find((m) => m.id === id);
      if (!current) throw new Error('Mod not found');
      return { ...current, enabled: false };
    });
    useAppStore.setState({
      mods: [],
      modsLoaded: true,
      modsLoading: false,
      modsError: null,
      modsNotice: null,
    });
    useToastStore.setState({ toasts: [] });

    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.clearAllMocks();
  });

  it('offers the toast and restores from the live store, not the render closure (CR-01)', async () => {
    const initial = [mod({ id: 'a', enabled: true }), mod({ id: 'b', enabled: true })];
    useAppStore.setState({ mods: initial });
    const snapshot = captureBulkSnapshot(initial, ['a', 'b']);
    const selection = ['a', 'b'];

    let offered: OfferFn | null = null;
    let restoredSelection: string[] | null = null;
    await act(async () => {
      root.render(
        <Harness
          onReady={(offer) => {
            offered = offer;
          }}
          onRestored={(sel) => {
            restoredSelection = sel;
          }}
        />
      );
    });
    await act(async () => {
      await flush();
    });
    const preBatchOffer = offered!;

    // The batch runs: the store now reflects the disabled mods. The callback
    // captured before the batch (exactly what the page's running handler
    // holds) must still see the live list.
    await act(async () => {
      useAppStore.setState({ mods: initial.map((m) => ({ ...m, enabled: false })) });
    });
    await act(async () => {
      preBatchOffer(snapshot, selection);
    });

    let toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0].message).toBe('2 mods updated.');
    expect(toasts[0].actionLabel).toBe('Undo');

    // Clicking Undo must build the plan against the live list too.
    await act(async () => {
      toasts[0].onAction?.();
    });
    await act(async () => {
      await flush();
      await flush();
    });

    expect(useAppStore.getState().mods.every((m) => m.enabled)).toBe(true);
    expect(restoredSelection).toEqual(selection);
    toasts = useToastStore.getState().toasts;
    expect(toasts.some((t) => t.message === '2 mods restored.')).toBe(true);
  });

  it('reports only actually-failed targets in a partial batch, not the skipped ones (IN-04)', async () => {
    const initial = [mod({ id: 'a', enabled: true }), mod({ id: 'b', enabled: true }), mod({ id: 'c', enabled: true })];
    useAppStore.setState({ mods: initial });
    const snapshot = captureBulkSnapshot(initial, ['a', 'b', 'c']);

    let offered: OfferFn | null = null;
    await act(async () => {
      root.render(<Harness onReady={(offer) => { offered = offer; }} />);
    });
    await act(async () => {
      await flush();
    });
    const preBatchOffer = offered!;

    // One target changed, a second failed when attempted, and the third was
    // never reached by the batch loop.
    await act(async () => {
      useAppStore.setState({
        mods: initial.map((m, i) => (i === 0 ? { ...m, enabled: false } : m)),
      });
    });
    await act(async () => {
      preBatchOffer(snapshot, ['a', 'b', 'c'], { done: 1, total: 3, failed: 1 });
    });

    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0].message).toBe('1 of 3 mods updated. 1 could not be changed.');
    expect(toasts[0].tone).toBe('warning');
  });
});
