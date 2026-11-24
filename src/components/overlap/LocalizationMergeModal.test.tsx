// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import LocalizationMergeModal from './LocalizationMergeModal';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../../stores/toastStore', () => ({ showToast: vi.fn() }));

it('requires explicit token choices before exporting the reviewed merge', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  const path = 'resource/localization/demo_english.txt';
  const reviewLocalizationMerge = vi.fn().mockResolvedValue({ reviewToken: 'reviewed', files: [{ path, language: 'English', changes: [
    { key: 'A', baseline: 'old', candidates: [{ value: 'new', sourceIds: ['left'] }], conflict: false },
    { key: 'B', baseline: 'old', candidates: [{ value: 'left', sourceIds: ['left'] }, { value: 'right', sourceIds: ['right'] }], conflict: true },
  ] }] });
  const exportLocalizationMerge = vi.fn().mockResolvedValue('localization_merge_dir.vpk');
  vi.stubGlobal('electronAPI', { reviewLocalizationMerge, exportLocalizationMerge });
  const mods = (['left', 'right'] as const).map(id => ({ id, name: id, identity: id, fileName: `${id}.vpk`, variant: null }));
  const findButton = (suffix: string) => [...document.querySelectorAll('button')]
    .find(button => button.textContent === `overlap.localization.${suffix}`)!;
  const close = vi.fn();

  try {
    await act(async () => root.render(<LocalizationMergeModal mods={[mods[0], mods[1]]} onClose={close} />));
    expect(reviewLocalizationMerge).toHaveBeenCalledWith(['left', 'right']);
    expect(findButton('export').disabled).toBe(true);
    await act(async () => findButton('chooseSingle').click());
    expect(findButton('export').disabled).toBe(true);
    const second = document.querySelectorAll('select')[1];
    await act(async () => {
      second.value = 'mod:right';
      second.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await act(async () => findButton('export').click());
    expect(exportLocalizationMerge).toHaveBeenCalledWith(['left', 'right'], 'reviewed', [
      { path, key: 'A', sourceModId: 'left' }, { path, key: 'B', sourceModId: 'right' },
    ]);
    expect(close).toHaveBeenCalledOnce();
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
});
