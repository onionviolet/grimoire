// @vitest-environment jsdom
import '../i18n';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmContext, type ConfirmFn } from '../components/common/confirmContext';
import type { ConfigWorkspaceSnapshot } from '../types/configWorkspace';
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const api = vi.hoisted(() => ({ getConfigWorkspace: vi.fn(), applyConfigWorkspace: vi.fn(), parseConfigBundle: vi.fn(), exportConfigBundle: vi.fn(), loadSettings: vi.fn() }));
vi.mock('../lib/api', () => api);
vi.mock('../stores/appStore', () => ({ useAppStore: { getState: () => ({ loadSettings: api.loadSettings }) } }));
import Config from './Config';
import { useConfigDraftStore } from '../stores/configDraftStore';
const snapshot: ConfigWorkspaceSnapshot = {
  available: true, reviewToken: 'review-before', definitions: [{ key: 'minimap_update_rate_hz', file: 'gameinfo.gi', type: 'numeric', min: 5, max: 60, step: 5,
    label: 'minimap update rate hz', description: 'control', surfaces: ['game-configuration'], gameDefault: '20', engineDefault: '20' }],
  performance: { state: 'not-applied', appliedPresetId: null, appliedVersion: null, bundledVersion: '2.7', overrideCount: 0, message: '', convarStates: {
    minimap_update_rate_hz: { origin: 'game-default', value: '20', presetValue: null, gameDefault: '20', engineDefault: '20', resolvedValue: '20', resolvedFrom: 'gameinfo.gi' },
  } }, unknown: [{ key: 'handwritten_setting', value: '7', file: 'gameinfo.gi', line: 14 }], autoexecCommands: ['fps_max 120'], manualCommands: ['echo keep'], launchOptions: '-old',
};
let host: HTMLDivElement;
let root: Root;
let confirm: ReturnType<typeof vi.fn<ConfirmFn>>;
const flush = () => new Promise(resolve => setTimeout(resolve, 0));
const click = async (text: string) => {
  const button = [...document.querySelectorAll('button')].find(candidate => candidate.textContent === text);
  expect(button, text).toBeDefined();
  await act(async () => { button!.click(); await flush(); });
};
const setValue = async (selector: string, value: string) => {
  const input = document.querySelector(selector) as HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await flush();
  });
};
beforeEach(async () => {
  useConfigDraftStore.setState({ snapshot: null, values: {}, commands: '', launchOptions: '' });
  vi.clearAllMocks();
  api.getConfigWorkspace.mockResolvedValue(snapshot);
  api.applyConfigWorkspace.mockResolvedValue(snapshot);
  api.loadSettings.mockResolvedValue(undefined);
  confirm = vi.fn<ConfirmFn>().mockResolvedValue(true);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => { root.render(<ConfirmContext value={confirm}><Config /></ConfirmContext>); await flush(); });
});
afterEach(() => { act(() => root.unmount()); host.remove(); });
describe('Config staged editing', () => {
  it('retains drafts and their original review token across route unmounts', async () => {
    await setValue('#config-launch', '-draft');
    act(() => root.unmount());
    api.getConfigWorkspace.mockResolvedValue({ ...snapshot, reviewToken: 'later' });
    root = createRoot(host);
    await act(async () => { root.render(<ConfirmContext value={confirm}><Config /></ConfirmContext>); await flush(); });
    expect((document.querySelector('#config-launch') as HTMLInputElement).value).toBe('-draft');
    await click('Review and apply');
    expect(api.applyConfigWorkspace).toHaveBeenCalledWith({ reviewToken: 'review-before', gameinfo: {}, launchOptions: '-draft' });
    expect(confirm.mock.calls[0][0].items).toContain('Steam launch options: -old → -draft');
  });
  it('shows manual/unknown content without providing an unknown-key writer', () => {
    expect(host.textContent).toContain('handwritten_setting 7');
    expect(host.textContent).toContain('echo keep');
    expect(document.querySelector('#config-handwritten_setting')).toBeNull();
  });
  it('cancellation preserves staged values and sends no write', async () => {
    confirm.mockResolvedValue(false);
    await setValue('#config-minimap_update_rate_hz', '25');
    await click('Review and apply');
    expect(api.applyConfigWorkspace).not.toHaveBeenCalled();
    expect((document.querySelector('#config-minimap_update_rate_hz') as HTMLInputElement).value).toBe('25');
    expect(confirm.mock.calls[0][0].items).toContain('minimap_update_rate_hz: 20 → 25');
  });
  it('applies reviewed values using the original review token', async () => {
    await setValue('#config-minimap_update_rate_hz', '30');
    await click('Review and apply');
    expect(api.applyConfigWorkspace).toHaveBeenCalledExactlyOnceWith({ reviewToken: 'review-before', gameinfo: { minimap_update_rate_hz: '30' } });
    expect(api.loadSettings).toHaveBeenCalledOnce();
  });
  it('does not discard edits on refresh cancellation', async () => {
    await setValue('#config-launch', '-high');
    confirm.mockResolvedValue(false);
    await click('Refresh');
    expect(api.getConfigWorkspace).toHaveBeenCalledTimes(1);
    expect((document.querySelector('#config-launch') as HTMLInputElement).value).toBe('-high');
  });
  it('keeps staged changes and surfaces stale-review errors', async () => {
    api.applyConfigWorkspace.mockRejectedValue(new Error('Configuration changed since review'));
    await setValue('#config-minimap_update_rate_hz', '35');
    await click('Review and apply');
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Configuration changed since review');
    expect((document.querySelector('#config-minimap_update_rate_hz') as HTMLInputElement).value).toBe('35');
  });
});
