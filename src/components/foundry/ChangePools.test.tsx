// @vitest-environment jsdom

import '../../i18n';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FoundryPoolList from './ChangePools';
import { collectFoundryChanges } from './changeList';
import { foundryShuffleKey } from '../../lib/foundryChanges';
import type { Mod } from '../../types/mod';
import type { FoundryAssetSourcesInspection } from '../../types/foundry';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

function mod(overrides: Partial<Mod>): Mod {
  return {
    id: 'mod-1',
    name: 'A change',
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

const SHARED_PATH = 'panorama/images/heroes/bull.png';
const MINIMAP_PATH = 'panorama/images/heroes/bull_minimap.png';

/** Two builds writing the same portrait path, so the card is a real contended
 *  pool rather than a `single` one. Mirrors the fixture shape from
 *  poolView.test.ts. */
const portraitA = mod({
  id: 'portrait-a',
  name: 'Neon Abrams',
  sha256: 'aaa',
  foundryBuild: {
    writeSet: [SHARED_PATH],
    parts: [{
      kind: 'texture',
      title: 'Neon portrait',
      entries: [SHARED_PATH],
      category: 'hero-image',
      heroName: 'Abrams',
      sourceFileName: 'neon.png',
    }],
  },
});

const portraitB = mod({
  id: 'portrait-b',
  name: 'Chrome Abrams',
  sha256: 'bbb',
  foundryBuild: {
    writeSet: [SHARED_PATH, MINIMAP_PATH],
    parts: [{
      kind: 'texture',
      title: 'Chrome portrait',
      entries: [SHARED_PATH, MINIMAP_PATH],
      category: 'hero-image',
      heroName: 'Abrams',
      sourceFileName: 'chrome.png',
    }],
  },
});

function buildInspection(
  overrides: Partial<FoundryAssetSourcesInspection> = {},
): FoundryAssetSourcesInspection {
  return {
    paths: [SHARED_PATH, MINIMAP_PATH],
    sources: [
      {
        modId: 'portrait-a',
        modName: 'Neon Abrams',
        enabled: true,
        priority: 1,
        provenance: 'Forged',
        entries: [SHARED_PATH],
        wins: [SHARED_PATH],
        managed: true,
        auditionable: [],
      },
      {
        modId: 'portrait-b',
        modName: 'Chrome Abrams',
        enabled: true,
        priority: 2,
        provenance: 'Forged',
        entries: [SHARED_PATH, MINIMAP_PATH],
        wins: [MINIMAP_PATH],
        managed: true,
        auditionable: [],
      },
    ],
    // Only the shared path resolves to a pool member. The minimap path
    // resolves to no owner (base game wins), so exactly one member shows the
    // "in game now" winner label and the assertion below is unambiguous.
    winners: {
      [SHARED_PATH]: 'portrait-a',
      [MINIMAP_PATH]: null,
    },
    unreadableMods: [],
    ...overrides,
  };
}

describe('FoundryPoolList pool cards lane', () => {
  let host: HTMLDivElement;
  let root: Root;
  let onToggleShuffleKey: ReturnType<typeof vi.fn<(key: string) => void>>;
  let onToggleMod: ReturnType<typeof vi.fn<(modId: string) => void>>;
  let onOpenInInstalled: ReturnType<typeof vi.fn<(modId: string) => void>>;
  let inspectAssetSources: ReturnType<typeof vi.fn>;

  const mods: Mod[] = [portraitA, portraitB];
  const changes = collectFoundryChanges(mods);

  beforeEach(() => {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    onToggleShuffleKey = vi.fn<(key: string) => void>();
    onToggleMod = vi.fn<(modId: string) => void>();
    onOpenInInstalled = vi.fn<(modId: string) => void>();
    inspectAssetSources = vi.fn().mockResolvedValue(buildInspection());
    window.electronAPI = {
      foundry: {
        inspectAssetSources,
      },
    } as unknown as typeof window.electronAPI;
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.restoreAllMocks();
  });

  const renderPools = async (included: ReadonlySet<string> = new Set()) => {
    await act(async () => {
      root.render(
        <FoundryPoolList
          mods={mods}
          changes={changes}
          included={included}
          onToggleShuffleKey={onToggleShuffleKey}
          onToggleMod={onToggleMod}
          onOpenInInstalled={onOpenInInstalled}
        />
      );
      // Flush the mount-time inspection promise so React commits the state
      // update it drives before assertions run.
      await inspectAssetSources.mock.results[0]?.value;
    });
  };

  it('resolves the mount-time IPC inspection into visible winner text for both members', async () => {
    await renderPools();

    expect(inspectAssetSources).toHaveBeenCalledTimes(1);
    expect(inspectAssetSources).toHaveBeenCalledWith(
      expect.arrayContaining([SHARED_PATH, MINIMAP_PATH])
    );

    // Only portrait-a wins a path in this fixture, so the label appears once,
    // on the winning member's own row.
    expect(document.body.textContent).toContain('in game now');

    const memberRows = Array.from(document.querySelectorAll('p')).filter((p) =>
      p.textContent === 'Neon portrait' || p.textContent === 'Chrome portrait'
    );
    expect(memberRows).toHaveLength(2);
    // Each title <p> sits inside a "min-w-0 flex-1" div, which is itself a
    // direct child of the member row that also carries the winner span.
    const neonRow = memberRows.find((p) => p.textContent === 'Neon portrait')?.parentElement
      ?.parentElement;
    const chromeRow = memberRows.find((p) => p.textContent === 'Chrome portrait')?.parentElement
      ?.parentElement;
    expect(neonRow?.textContent).toContain('in game now');
    expect(chromeRow?.textContent).not.toContain('in game now');
    expect(chromeRow?.textContent).toContain('enabled, overridden');
  });

  it('flips the pool-level shuffle control and reports aria-pressed for the pool state', async () => {
    await renderPools();

    const poolShuffle = Array.from(
      document.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')
    ).find((button) => button.textContent?.includes('Shuffle this pool'));
    expect(poolShuffle).toBeDefined();
    // Neither member is opted into the launch shuffle in this fixture, so the
    // pool-level control reflects allIncluded === false.
    expect(poolShuffle!.getAttribute('aria-pressed')).toBe('false');

    act(() => {
      poolShuffle!.click();
    });

    // poolShuffleToggle returns every member not yet in the shuffle: both, here.
    // The keys are passed straight to Array#forEach, so the calls also carry an
    // index/array argument; only the key (the first argument) matters here.
    const calledKeys = onToggleShuffleKey.mock.calls.map((call) => call[0]);
    expect(calledKeys).toHaveLength(2);
    expect(calledKeys).toContain(foundryShuffleKey(portraitA));
    expect(calledKeys).toContain(foundryShuffleKey(portraitB));
  });

  it('reports the pool as fully shuffled when every member is already opted in', async () => {
    const included = new Set([foundryShuffleKey(portraitA), foundryShuffleKey(portraitB)]);
    await renderPools(included);

    const poolShuffle = Array.from(
      document.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')
    ).find((button) => button.textContent?.includes('Shuffling this pool'));
    expect(poolShuffle).toBeDefined();
    expect(poolShuffle!.getAttribute('aria-pressed')).toBe('true');
  });
});
