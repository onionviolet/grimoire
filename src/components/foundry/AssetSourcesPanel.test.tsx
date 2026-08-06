// @vitest-environment jsdom

import '../../i18n';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AssetSourcesPanel from './AssetSourcesPanel';
import type { FoundryAssetSourcesInspection } from '../../types/foundry';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

const ENTRY_PATH = 'sounds/heroes/abrams/vo_abrams_ping.vsnd_c';

/** Two sources contending for the same audible path: one currently winning,
 *  one enabled but overridden. Both offer the same auditionable entry, so a
 *  click on the wrong row's button would go unnoticed unless the assertion
 *  checks the exact (modId, entryPath) pair auditionSourceClip received. */
const inspection: FoundryAssetSourcesInspection = {
  paths: [ENTRY_PATH],
  sources: [
    {
      modId: 'sound-mod-a',
      modName: 'Abrams VO Pack',
      enabled: true,
      priority: 2,
      provenance: 'Downloaded',
      entries: [ENTRY_PATH],
      wins: [ENTRY_PATH],
      managed: false,
      auditionable: [ENTRY_PATH],
    },
    {
      modId: 'sound-mod-b',
      modName: 'Alt VO Pack',
      enabled: true,
      priority: 1,
      provenance: 'Downloaded',
      entries: [ENTRY_PATH],
      wins: [],
      managed: false,
      auditionable: [ENTRY_PATH],
    },
  ],
  winners: { [ENTRY_PATH]: 'sound-mod-a' },
  unreadableMods: [],
};

/** Flushes both the mocked IPC promise and the component's follow-on
 *  `await audio.play()`, which jsdom resolves as a plain (non-promise)
 *  undefined rather than the mock's own resolved value. */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('AssetSourcesPanel audition-preview lane', () => {
  let host: HTMLDivElement;
  let root: Root;
  let inspectAssetSources: ReturnType<typeof vi.fn>;
  let auditionSourceClip: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    inspectAssetSources = vi.fn().mockResolvedValue(inspection);
    auditionSourceClip = vi.fn();
    window.electronAPI = {
      foundry: {
        inspectAssetSources,
        auditionSourceClip,
      },
    } as unknown as typeof window.electronAPI;
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.restoreAllMocks();
  });

  const renderPanel = async () => {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <AssetSourcesPanel paths={[ENTRY_PATH]} inspection={inspection} />
        </MemoryRouter>
      );
    });
  };

  const findAuditionButton = (modName: string) =>
    Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find((button) =>
      button.title.startsWith(`Audition what ${modName} writes`)
    );

  it('lists the inspected sources with the resolved winner and auditions the exact clicked source', async () => {
    auditionSourceClip.mockResolvedValue('blob:fake-clip-url');
    await renderPanel();

    expect(document.body.textContent).toContain('Abrams VO Pack');
    expect(document.body.textContent).toContain('Alt VO Pack');
    expect(document.body.textContent).toContain('Current winner: Abrams VO Pack');

    const auditionButton = findAuditionButton('Abrams VO Pack');
    expect(auditionButton).toBeDefined();
    expect(auditionButton!.querySelector('svg.lucide-play')).not.toBeNull();

    await act(async () => {
      auditionButton!.click();
      await flush();
    });

    expect(auditionSourceClip).toHaveBeenCalledTimes(1);
    expect(auditionSourceClip).toHaveBeenCalledWith('sound-mod-a', ENTRY_PATH);
    // The play/stop label swaps once the clip URL resolves.
    expect(auditionButton!.querySelector('svg.lucide-pause')).not.toBeNull();
  });

  it('does not enter the playing state when auditionSourceClip resolves null', async () => {
    auditionSourceClip.mockResolvedValue(null);
    await renderPanel();

    const auditionButton = findAuditionButton('Alt VO Pack');
    expect(auditionButton).toBeDefined();

    await act(async () => {
      auditionButton!.click();
      await flush();
    });

    expect(auditionSourceClip).toHaveBeenCalledWith('sound-mod-b', ENTRY_PATH);
    expect(auditionButton!.querySelector('svg.lucide-pause')).toBeNull();
    expect(auditionButton!.querySelector('svg.lucide-play')).not.toBeNull();
  });
});
