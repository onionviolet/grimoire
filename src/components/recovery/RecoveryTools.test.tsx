// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ interrupted: vi.fn(), recover: vi.fn(), compatibility: vi.fn(), session: vi.fn(), start: vi.fn(), trial: vi.fn(), result: vi.fn(), finish: vi.fn() }));
vi.mock('../../lib/api', () => ({ getInterruptedProfileRecovery: h.interrupted, recoverInterruptedProfileRecovery: h.recover, reviewSetupCompatibility: h.compatibility,
  getModIsolationSession: h.session, startModIsolation: h.start, applyModIsolationTrial: h.trial, recordModIsolationResult: h.result, finishModIsolation: h.finish }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
import RecoveryTools from './RecoveryTools';
let root: Root;
let container: HTMLDivElement;
const ready = { id: 's', recoveryPointId: 'p', createdAt: '2026-10-03', phase: 'ready', candidates: [{ id: 'a', name: 'Alpha' }], testIds: ['a'], steps: 1,
  reviewToken: 'trial-review', restoreReviewToken: 'restore-review' };
beforeEach(async () => {
  vi.clearAllMocks();
  h.interrupted.mockResolvedValue(null); h.session.mockResolvedValue(ready);
  h.trial.mockResolvedValue({ ...ready, phase: 'testing' }); h.finish.mockResolvedValue(undefined); h.recover.mockResolvedValue(undefined);
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
async function render() { await act(async () => root.render(<RecoveryTools />)); }
async function click(key: string) {
  const button = [...document.querySelectorAll('button')].find(button => button.textContent === key);
  expect(button).toBeDefined(); await act(async () => button!.click());
}
describe('explicit recovery actions', () => {
  it('requires confirmation before applying a trial and submits the reviewed token', async () => {
    await render(); await click('recovery.tools.applyTrial'); expect(h.trial).not.toHaveBeenCalled();
    await click('recovery.tools.confirm'); expect(h.trial).toHaveBeenCalledWith('trial-review');
  });
  it('restores only after confirmation with a separate current restore review', async () => {
    await render(); await click('recovery.tools.restoreOriginal'); expect(h.finish).not.toHaveBeenCalled();
    await click('recovery.tools.confirm'); expect(h.finish).toHaveBeenCalledWith('restore-review');
  });
  it('uses only explicit Works or Crashes feedback', async () => {
    h.session.mockResolvedValue({ ...ready, phase: 'testing' }); await render();
    expect(h.result).not.toHaveBeenCalled(); await click('recovery.tools.crashes');
    expect(h.result).toHaveBeenCalledWith('trial-review', 'crashes');
  });
  it('blocks trial changes while an interrupted recovery remains unresolved', async () => {
    h.interrupted.mockResolvedValue({ createdAt: '2026-10-03', fileCount: 2, canRecover: false, reviewToken: 'journal-review' }); await render();
    const trial = [...container.querySelectorAll('button')].find(button => button.textContent === 'recovery.tools.applyTrial');
    expect(trial?.disabled).toBe(true); expect(h.recover).not.toHaveBeenCalled();
  });
});
