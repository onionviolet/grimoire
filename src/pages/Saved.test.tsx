// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import Saved from './Saved';
import type { SavedMod } from '../types/electron';

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('../components/ModThumbnail', () => ({ default: () => null }));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it('keeps saved snapshots editable when catalog rows are missing or fail', async () => {
  const saved = (modId: number, titleSnapshot: string): SavedMod => ({
    modId, titleSnapshot, section: 'Mod', fileId: null, fileName: null, profileUrlSnapshot: null,
    savedAt: 1700000000000, notes: 'My note', tags: [], whySaved: '', watchUpdates: false,
    lastCheckedAt: null, latestFileId: null,
  });
  const getCachedMod = vi.fn().mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('Catalog unavailable'));
  const api = { getSavedMods: vi.fn(async () => [saved(1, 'Missing source'), saved(2, 'Unreachable cache')]), getCachedMod };
  vi.stubGlobal('electronAPI', api);
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);

  try {
    await act(async () => root.render(<MemoryRouter><Saved /></MemoryRouter>));
    expect([...host.querySelectorAll('article h2')].map(item => item.textContent)).toEqual(['Missing source', 'Unreachable cache']);
    const edit = [...host.querySelectorAll<HTMLButtonElement>('article:last-child button')].find(button => button.textContent === 'saved.editMetadata');
    expect(edit).toBeDefined();
    await act(async () => edit?.click());
    expect(host.querySelector('textarea')?.value).toBe('My note');
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
});
