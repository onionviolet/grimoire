// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { exportAnimationModPreview } from '../../lib/api';
import { AnimationModViewer } from './MotionModViewers';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../../lib/api', () => ({ exportAnimationModPreview: vi.fn() }));
vi.mock('../locker/HeroPoseViewer', () => ({
  default: ({ clipOverride, skinSources, previewPlayback }: {
    clipOverride: { key: string; clip: string };
    skinSources?: { metaKey: string }[];
    previewPlayback: { seek?: { time: number }; progressRef: { current: { time: number; duration: number } } };
  }) =>
    <button type="button" data-motion={clipOverride.key} data-clip={clipOverride.clip} data-skin={skinSources?.[0]?.metaKey ?? 'stock'}
      data-seek={previewPlayback.seek?.time}
      onClick={() => { previewPlayback.progressRef.current = { time: 0.23, duration: 0.4 }; }}>
      Sample playback
    </button>,
}));

it('holds the selected skin and exact clip across animation sources and reports a missing stock clip', async () => {
  const heroName = 'Vindicta';
  const clips = ['ability_crow_cast', 'new_cast'];
  vi.mocked(exportAnimationModPreview).mockImplementation(async (_, stock) => ({
    heroName, key: stock ? 'stock' : 'override', clips: stock ? clips.slice(0, 1) : clips, meshGroup: null,
  }));
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const actEnvironment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = actEnvironment.IS_REACT_ACT_ENVIRONMENT;
  actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
  try {
    await act(async () => root.render(<AnimationModViewer metaKey="motion.vpk" expanded active turn={{ current: null }}
      skinsForHero={() => [{ key: 'skin.vpk', label: 'Selected skin', source: { heroName, skinSources: [{ metaKey: 'skin.vpk', priority: 10 }] } }]} />));
    const change = async (label: string, value: string) => {
      const select = host.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)!;
      await act(async () => {
        select.value = value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      });
    };
    await change('installed.preview.modelSource', 'skin.vpk');
    await change('installed.preview.clips', 'ability_crow_cast');
    const originalViewer = host.querySelector<HTMLButtonElement>('[data-motion="override"][data-clip="ability_crow_cast"][data-skin="skin.vpk"]')!;
    await act(async () => originalViewer.click());
    const stock = [...host.querySelectorAll('button')].find(button => button.textContent === 'installed.preview.stockMotion')!;
    await act(async () => stock.click());
    expect(exportAnimationModPreview).toHaveBeenCalledWith('motion.vpk', true);
    expect(host.querySelector('[data-motion="stock"][data-clip="ability_crow_cast"][data-skin="skin.vpk"][data-seek="0.23"]')).toBe(originalViewer);
    await change('installed.preview.clips', 'new_cast');
    expect(host.querySelector('[data-motion]')?.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(host.textContent).toContain('installed.preview.stockClipUnavailable');
  } finally {
    await act(async () => root.unmount());
    host.remove();
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = previous;
  }
});
