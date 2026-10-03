// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProfileRecoveryPreview } from '../../types/profileRecovery';
const h = vi.hoisted(() => ({ list: vi.fn(), preview: vi.fn(), restore: vi.fn(), refreshed: vi.fn(), t: (key: string) => key }));
vi.mock('../../lib/api', () => ({ listProfileRecoveryPoints: h.list, previewProfileRecovery: h.preview, restoreProfileRecovery: h.restore }));
vi.mock('../../lib/dates', () => ({ formatAbsoluteDate: (value: string) => value }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: h.t }) }));
import ProfileRecoveryPanel from './ProfileRecoveryPanel';
let root: Root;
let container: HTMLDivElement;
const preview: ProfileRecoveryPreview = { point: { id: 'point', createdAt: '2026-10-03T18:00:00Z', profileName: 'Before switch', modCount: 2, enabledCount: 1 },
  canRestore: true, issues: [], reviewToken: 'current-state', disableCount: 1 };
beforeEach(async () => {
  vi.clearAllMocks();
  h.list.mockResolvedValue([preview.point]);
  h.preview.mockResolvedValue(preview);
  h.restore.mockResolvedValue(undefined);
  h.refreshed.mockResolvedValue(undefined);
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<ProfileRecoveryPanel revision="a" onRestored={h.refreshed} />));
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
async function click(key: string) {
  const button = [...document.querySelectorAll('button')].find(button => button.textContent === key);
  expect(button).toBeDefined();
  await act(async () => button!.click());
}
describe('local restore review', () => {
  it('requires deliberate confirmation and sends the reviewed token before refreshing live state', async () => {
    await click('profiles.recovery.preview');
    expect(h.restore).not.toHaveBeenCalled();
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    await click('profiles.recovery.restore');
    expect(h.restore).toHaveBeenCalledWith('point', 'current-state');
    expect(h.refreshed).toHaveBeenCalledOnce();
    expect(container.textContent).toContain('profiles.recovery.restored');
  });
  it('cancel leaves all files unchanged', async () => {
    await click('profiles.recovery.preview');
    await click('profiles.recovery.cancel');
    expect(h.restore).not.toHaveBeenCalled();
    expect(document.querySelector('[role="dialog"]')?.className).toContain('pointer-events-none');
  });
  it('shows blockers and offers no restore confirmation for changed assets', async () => {
    h.preview.mockResolvedValue({ ...preview, canRestore: false, issues: [{ name: 'Foundry asset', reason: 'changed' }] });
    await click('profiles.recovery.preview');
    expect(container.textContent).toContain('Foundry asset');
    expect(container.textContent).toContain('profiles.recovery.changed');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(h.restore).not.toHaveBeenCalled();
  });
});
