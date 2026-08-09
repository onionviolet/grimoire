// @vitest-environment jsdom

import '../../i18n';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FoundryHeroGrid from './FoundryHeroGrid';
import type { HeroInfo } from '../../types/foundry';
import type { Mod } from '../../types/mod';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

const appStoreState = vi.hoisted(() => ({
  mods: [] as Mod[],
  modsLoaded: false,
  loadMods: vi.fn(),
}));

vi.mock('../../stores/appStore', () => ({
  useAppStore: <T,>(selector: (state: typeof appStoreState) => T): T => selector(appStoreState),
}));

vi.mock('../../lib/heroFavorites', () => ({
  useHeroFavorites: () => ({ isFavorite: () => false, toggleFavorite: () => {} }),
}));

const hero = (overrides: Partial<HeroInfo> = {}): HeroInfo => ({
  codename: 'bull',
  name: 'Abrams',
  selectable: true,
  inDevelopment: false,
  disabled: false,
  ...overrides,
});

/** A mod the grid counts as two authored changes for Abrams: a mixed build
 *  with a portrait part and a sound part (the same shape `My changes` lists). */
const twoChangeMod = (id: string): Mod =>
  ({
    id,
    name: `Build ${id}`,
    fileName: 'pak01_dir.vpk',
    path: 'C:/game/addons/pak01_dir.vpk',
    metaKey: 'pak01_dir.vpk',
    enabled: true,
    priority: 1,
    size: 10,
    installedAt: '2026-07-01T00:00:00.000Z',
    foundryBuild: {
      writeSet: ['panorama/images/heroes/bull.png', 'sounds/abrams/charge_01.vsnd_c'],
      parts: [
        {
          kind: 'texture',
          title: 'Abrams portrait',
          entries: ['panorama/images/heroes/bull.png'],
          category: 'hero-image',
          heroName: 'Abrams',
        },
        {
          kind: 'sound',
          title: 'Charge horn',
          entries: ['sounds/abrams/charge_01.vsnd_c'],
          heroName: 'Abrams',
          event: 'Abrams.Charge',
        },
      ],
    },
  }) as Mod;

const LOADING_LABEL = 'Change count is loading';

describe('FoundryHeroGrid change-count badge', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    appStoreState.mods = [];
    appStoreState.modsLoaded = false;
    appStoreState.loadMods.mockClear();
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.restoreAllMocks();
  });

  const renderGrid = async (mods: Mod[], modsLoaded: boolean) => {
    appStoreState.mods = mods;
    appStoreState.modsLoaded = modsLoaded;
    await act(async () => {
      root.render(<FoundryHeroGrid heroes={[hero()]} onPick={vi.fn()} />);
    });
  };

  const card = () => document.querySelector('div.group.relative') as HTMLDivElement;

  const loadingDot = () => card().querySelector(`[aria-label="${LOADING_LABEL}"]`);

  const numeralBadge = () =>
    Array.from(card().querySelectorAll('span')).find(
      (span) => span.classList.contains('tabular-nums') && /\d/.test(span.textContent ?? ''),
    );

  it('renders a neutral loading dot, no numeral, and no literal zero while the mod list is unloaded', async () => {
    await renderGrid([], false);
    expect(loadingDot()).not.toBeNull();
    expect(numeralBadge()).toBeUndefined();
    // A loading zero must not be rendered as a zero: it is exactly the state
    // this badge exists to keep apart from a genuine zero.
    expect(card().textContent).not.toContain('0');
  });

  it('renders neither a dot nor a numeral when the count is genuinely zero', async () => {
    await renderGrid([], true);
    expect(loadingDot()).toBeNull();
    expect(numeralBadge()).toBeUndefined();
    // Assert the zero case by what the card actually says, not by a snapshot:
    // "no badge" is the entire point of the absent-zero contract.
    expect(card().textContent).not.toContain('0');
  });

  it('renders the numeral badge and no loading dot for a hero with authored changes', async () => {
    await renderGrid([twoChangeMod('build-a')], true);
    expect(numeralBadge()?.textContent).toBe('2');
    expect(loadingDot()).toBeNull();
  });

  it('never renders a dot and a numeral at once', async () => {
    await renderGrid([], false);
    expect(loadingDot()).not.toBeNull();
    expect(numeralBadge()).toBeUndefined();

    await renderGrid([twoChangeMod('build-a')], true);
    expect(loadingDot()).toBeNull();
    expect(numeralBadge()?.textContent).toBe('2');
  });
});
