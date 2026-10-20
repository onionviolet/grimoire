// @vitest-environment jsdom
import '../../i18n';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BrowserFilterStats } from '../../types/foundry';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const mock = vi.hoisted(() => ({ stats: null as BrowserFilterStats | null,
    state: { settings: { browserBlockTrackers: true, browserFilterExceptions: [] as string[] }, saveSettings: vi.fn() }, reloadFilter: vi.fn() }));
vi.mock('../../stores/appStore', () => ({ useAppStore: (select: (state: typeof mock.state) => unknown) => select(mock.state) }));
vi.mock('./useBrowserFilterStats', () => ({ useBrowserFilterStats: () => mock.stats }));
import { BrowserBlockerControl } from './BrowserBlockerControl';
let host: HTMLDivElement;
let root: Root;
const reload = vi.fn();
const render = (url = 'https://site.test/page') => act(() => root.render(<BrowserBlockerControl url={url} reload={reload} />));
beforeEach(() => {
    vi.clearAllMocks();
    mock.stats = { status: 'active', filters: 100, domains: 1, blocked: 7, error: null, list: null,
        custom: { accepted: 0, rejected: 0, rejectedLines: [] }, exceptions: [] };
    mock.state.settings.browserBlockTrackers = true;
    mock.state.saveSettings.mockResolvedValue(undefined); mock.reloadFilter.mockResolvedValue(mock.stats);
    Object.defineProperty(window, 'electronAPI', { configurable: true, value: { browser: { reloadFilter: mock.reloadFilter } } });
    host = document.createElement('div'); document.body.append(host); root = createRoot(host); render();
});
afterEach(() => { act(() => root.unmount()); host.remove(); });
describe('Browser blocker control', () => {
    it('pauses the exact current origin, awaits filter application, then reloads', async () => {
        await act(async () => { host.querySelector('button')!.click(); });
        expect(mock.state.saveSettings).toHaveBeenCalledWith({ browserBlockTrackers: true, browserFilterExceptions: ['https://site.test'] });
        expect(mock.reloadFilter).toHaveBeenCalledOnce(); expect(reload).toHaveBeenCalledOnce();
        expect(mock.reloadFilter.mock.invocationCallOrder[0]).toBeLessThan(reload.mock.invocationCallOrder[0]);
    });
    it('removes only this exception when resuming and reflects live request counts', async () => {
        mock.stats!.exceptions = ['https://site.test', 'https://other.test']; render();
        expect(host.textContent).toContain('Resume for this site');
        await act(async () => host.querySelector('button')!.click());
        expect(mock.state.saveSettings).toHaveBeenCalledWith({ browserBlockTrackers: true, browserFilterExceptions: ['https://other.test'] });
        mock.stats!.blocked = 9; render(); expect(host.textContent).toContain('9 requests stopped since launch');
    });
    it('does not reload when filter application fails', async () => {
        mock.reloadFilter.mockRejectedValueOnce(new Error('Cache clear failed'));
        await act(async () => host.querySelector('button')!.click());
        expect(reload).not.toHaveBeenCalled();
        expect(host.querySelector('[role="alert"]')?.textContent).toContain('Cache clear failed');
    });
    it('does not offer site exceptions for a non-web address or with blocking off', () => {
        render('file:///local'); expect(host.querySelector('button')?.disabled).toBe(true);
        mock.state.settings.browserBlockTrackers = false; render(); expect(host.querySelector('button')?.disabled).toBe(true);
    });
});
