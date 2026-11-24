// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { foundryTextures } from '../../lib/api';
import { inspectAssetClaims } from '../../lib/inspectedAssetClaims';
import { HIDEOUT_PAINTING_PATHS } from '../../lib/hideoutPaintings';
import type { TextureEntry } from '../../types/foundry';
import TextureBrowse from './TextureBrowse';

vi.mock('../../lib/api', () => ({ foundryTextures: vi.fn() }));
vi.mock('../../lib/inspectedAssetClaims', () => ({ inspectAssetClaims: vi.fn() }));
vi.mock('../../lib/useFoundryDraft', () => ({ useFoundryDraft: (_key: string, _schema: unknown, initial: unknown) => useState(initial) }));
vi.mock('../../stores/toastStore', () => ({ showToast: vi.fn() }));
vi.mock('./TextureLightbox', () => ({ default: () => null }));
vi.mock('../common/confirmContext', () => ({ useConfirm: () => async () => true }));
vi.mock('react-i18next', () => ({ initReactI18next: { type: '3rdParty', init: () => {} }, useTranslation: () => ({ t: (key: string) => key }) }));

const entry = (path: string): TextureEntry => ({ path, label: path, category: 'other', hero: null });
let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  vi.mocked(foundryTextures).mockResolvedValue([
    ...HIDEOUT_PAINTING_PATHS.map(entry),
    entry('models/hideout/materials/hideout_portrait_large_selfillum_psd_e2306db2.vtex_c'),
    entry('models/hideout/materials/unverified_portrait_color.vtex_c'),
  ]);
  vi.mocked(inspectAssetClaims).mockResolvedValue({ paths: [], sources: [], winners: {}, unreadableMods: [] });
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function openPaintings(onStage = vi.fn()) {
  await act(async () => root.render(<TextureBrowse heroes={[]} heroNames={new Map()} hero={null} onStage={onStage} />));
  await act(async () => {
    const select = host.querySelector('select')!;
    select.value = 'hideout-paintings';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await act(async () => { await vi.advanceTimersByTimeAsync(250); });
}

it('loads the bounded painting color slots without a hero and excludes masks', async () => {
  await openPaintings();
  expect(foundryTextures).toHaveBeenCalledWith({ category: 'other', search: 'hideout_portrait', hero: undefined, limit: 400 });
  expect(host.querySelectorAll('li')).toHaveLength(3);
  expect(host.textContent).not.toContain('selfillum');
  expect(host.textContent).not.toContain('unverified_portrait');
  expect(host.textContent).toContain('foundry.texture.hideoutPaintings.description');
});

it('stages only the chosen exact painting texture through the existing conflict inspection', async () => {
  const onStage = vi.fn();
  vi.stubGlobal('electronAPI', undefined);
  Object.defineProperty(window, 'electronAPI', { configurable: true, value: { getDroppedFilePath: () => '/input/painting.png' } });
  await openPaintings(onStage);
  await act(async () => {
    const input = host.querySelector('input[type="file"]')!;
    Object.defineProperty(input, 'files', { value: [new File(['fixture'], 'painting.png', { type: 'image/png' })] });
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  expect(inspectAssetClaims).toHaveBeenCalledWith([HIDEOUT_PAINTING_PATHS[0]]);
  expect(onStage).toHaveBeenCalledWith(expect.objectContaining({
    kind: 'texture', affectedFiles: [HIDEOUT_PAINTING_PATHS[0]],
    source: expect.objectContaining({ entryPath: HIDEOUT_PAINTING_PATHS[0], imagePath: '/input/painting.png', category: 'other' }),
  }));
});

it('does not offer global painting edits inside a hero workshop', async () => {
  await act(async () => root.render(<TextureBrowse heroes={[]} heroNames={new Map()} hero="atlas" />));
  expect(host.querySelector('option[value="hideout-paintings"]')).toBeNull();
});

it('does not synthesize painting targets missing from an updated game catalog', async () => {
  vi.mocked(foundryTextures).mockResolvedValue([entry(HIDEOUT_PAINTING_PATHS[2])]);
  await openPaintings();
  expect(host.querySelectorAll('li')).toHaveLength(1);
  expect(host.textContent).toContain(HIDEOUT_PAINTING_PATHS[2]);
  expect(host.textContent).not.toContain(HIDEOUT_PAINTING_PATHS[0]);
});
