// @vitest-environment jsdom

import '../../i18n';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HeroPortraitFamilies from './HeroPortraitFamilies';
import type { CustomCardSlot, HeroPortrait } from '../../types/portrait';
import type { Mod } from '../../types/mod';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

// The family surface inspects exact VPK paths only when it has slots to
// inspect; in these fixtures it never reaches IPC, and neither module should
// be allowed to either.
vi.mock('../foundry/assetSourceInspection', () => ({
  useAssetSourceInspection: () => ({
    result: null,
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
}));

vi.mock('../../lib/api', () => ({
  foundryInspectAssetSources: vi.fn(),
}));

const LOADING_COPY = 'Reading the base game portrait family...';
const NONE_TITLE = 'No base game portrait family';
const FAILED_TITLE = 'Portrait family could not be read';
const FAMILIES_HEADING = 'Portrait families';

const slot = (overrides: Partial<CustomCardSlot> = {}): CustomCardSlot => ({
  variant: 'card',
  entry: 'panorama/images/heroes/bull_card.vtex_c',
  width: 512,
  height: 512,
  baseDataUrl: 'data:image/png;base64,QUFB',
  ...overrides,
});

const portrait = (overrides: Partial<HeroPortrait> = {}): HeroPortrait => ({
  modFileName: 'pak42_dir.vpk',
  variant: 'card',
  width: 512,
  height: 512,
  formatName: 'PNG_RGBA8888',
  dataUrl: 'data:image/png;base64,QkJC',
  ...overrides,
});

const mod = (overrides: Partial<Mod> = {}): Mod =>
  ({
    id: 'mod-1',
    name: 'Custom card',
    fileName: 'pak42_dir.vpk',
    path: 'C:/game/addons/pak42_dir.vpk',
    metaKey: 'pak42_dir.vpk',
    enabled: true,
    priority: 1,
    size: 10,
    installedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  }) as Mod;

describe('HeroPortraitFamilies four-state render', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.restoreAllMocks();
  });

  const renderFamilies = async (props: {
    loading?: boolean;
    error?: string | null;
    onRetry?: () => void;
    slots?: readonly CustomCardSlot[];
    portraits?: readonly HeroPortrait[];
    mods?: readonly Mod[];
  }) => {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <HeroPortraitFamilies
            heroName="Abrams"
            slots={props.slots ?? []}
            portraits={props.portraits ?? []}
            mods={props.mods ?? []}
            loading={props.loading ?? false}
            error={props.error ?? null}
            onRetry={props.onRetry}
          />
        </MemoryRouter>
      );
    });
  };

  it('loading shows only the loading copy, none of the other three states', async () => {
    await renderFamilies({ loading: true });

    expect(document.body.textContent).toContain(LOADING_COPY);
    expect(document.body.textContent).not.toContain(FAILED_TITLE);
    expect(document.body.textContent).not.toContain(NONE_TITLE);
    expect(document.body.textContent).not.toContain(FAMILIES_HEADING);
  });

  it('error shows the failed heading, the raw diagnostic and a retry that fires onRetry once', async () => {
    const onRetry = vi.fn();
    await renderFamilies({ error: 'boom: could not read pak42_dir.vpk', onRetry });

    expect(document.body.textContent).toContain(FAILED_TITLE);
    expect(document.body.textContent).toContain('boom: could not read pak42_dir.vpk');
    expect(document.body.textContent).toContain('Retry');
    expect(document.body.textContent).not.toContain(NONE_TITLE);

    const retry = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent === 'Retry'
    );
    expect(retry).toBeDefined();
    act(() => retry!.click());
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('no slots and no portraits shows the existing none copy and no retry control', async () => {
    await renderFamilies({});

    expect(document.body.textContent).toContain(NONE_TITLE);
    expect(document.body.textContent).not.toContain(FAILED_TITLE);
    expect(document.body.textContent).not.toContain(LOADING_COPY);
    expect(
      Array.from(document.querySelectorAll<HTMLButtonElement>('button')).some(
        (button) => button.textContent === 'Retry'
      )
    ).toBe(false);
  });

  it('a populated family shows the families heading and neither the failed nor the none copy', async () => {
    await renderFamilies({
      slots: [slot()],
      portraits: [portrait()],
      mods: [mod()],
    });

    expect(document.body.textContent).toContain(FAMILIES_HEADING);
    expect(document.body.textContent).not.toContain(FAILED_TITLE);
    expect(document.body.textContent).not.toContain(NONE_TITLE);
    expect(document.body.textContent).not.toContain(LOADING_COPY);
  });
});
