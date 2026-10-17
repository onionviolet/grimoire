// @vitest-environment jsdom
import '../i18n';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../i18n';
import { HOME_DESTINATION_URL } from '../lib/browserCatalog';
import type { BrowserWebview } from '../components/browser/webview';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const mock = vi.hoisted(() => ({
    state: { settings: null as null | { experimentalBrowser: boolean; nsfwContentMode: 'hide' } },
    grant: vi.fn(),
}));
vi.mock('../stores/appStore', () => ({ useAppStore: (select: (state: typeof mock.state) => unknown) => select(mock.state) }));
vi.mock('../lib/browserToolDownload', () => ({ setActiveBrowserDestination: mock.grant }));
import Browser from './Browser';

let host: HTMLDivElement;
let root: Root;
let url: string;
let guest: BrowserWebview;
let searchId: number;
const render = () => act(() => root.render(<MemoryRouter><Browser /></MemoryRouter>));
const event = (name: string, detail: Record<string, unknown> = {}) => act(() => {
    guest.dispatchEvent(Object.assign(new Event(name), detail));
});
const click = (label: string) => act(() => {
    const button = host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)
        ?? [...host.querySelectorAll('button')].find(button => button.textContent === label);
    expect(button, label).toBeDefined();
    button!.click();
});
const input = (label: string, value: string) => act(() => {
    const el = host.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
});
function attachGuest() {
    guest = host.querySelector('webview') as BrowserWebview;
    let zoom = 1;
    Object.assign(guest, {
        getURL: vi.fn(() => url), canGoBack: vi.fn(() => true), canGoForward: vi.fn(() => false),
        goBack: vi.fn(), goForward: vi.fn(), reload: vi.fn(), reloadIgnoringCache: vi.fn(), stop: vi.fn(),
        findInPage: vi.fn(() => ++searchId), stopFindInPage: vi.fn(),
        getZoomFactor: vi.fn(() => zoom), setZoomFactor: vi.fn((value: number) => { zoom = value; }),
    });
}
beforeEach(() => {
    vi.clearAllMocks();
    mock.state.settings = { experimentalBrowser: true, nsfwContentMode: 'hide' };
    url = HOME_DESTINATION_URL;
    searchId = 0;
    host = document.createElement('div'); document.body.append(host); root = createRoot(host);
    render(); attachGuest();
});
afterEach(async () => {
    act(() => root.unmount()); host.remove();
    await act(() => i18n.changeLanguage('en'));
});

describe('Browser navigation lifecycle', () => {
    it('binds the guest when settings arrive after the first render and waits for readiness', () => {
        mock.state.settings = null; render();
        expect(host.querySelector('webview')).toBeNull();
        mock.state.settings = { experimentalBrowser: true, nsfwContentMode: 'hide' }; render(); attachGuest();
        event('did-start-loading');
        expect(host.querySelector('button[aria-label="Stop"]')).not.toBeNull();
        event('did-stop-loading');
        expect(guest.getURL).not.toHaveBeenCalled();
        expect(guest.canGoBack).not.toHaveBeenCalled();
        event('dom-ready');
        expect(guest.canGoBack).toHaveBeenCalled();
        click('Back'); expect(guest.goBack).toHaveBeenCalledOnce();
    });
    it('tracks committed redirects, revokes grants during navigation and on unmount', () => {
        event('dom-ready');
        url = 'https://xkitkatcat.github.io/pimpmyhideout/';
        event('did-navigate', { url });
        expect(mock.grant).toHaveBeenLastCalledWith('tool', 'https://xkitkatcat.github.io', 'Pimp My Hideout');
        event('did-start-navigation', { isMainFrame: true, isInPlace: false });
        expect(mock.grant).toHaveBeenLastCalledWith(null, null, null);
        url = 'https://example.com/redirect'; event('did-navigate', { url });
        expect(host.querySelector('input')?.value).toBe(url);
        expect(mock.grant).toHaveBeenLastCalledWith(null, 'https://example.com', null);
        act(() => root.unmount()); root = createRoot(host);
        expect(mock.grant).toHaveBeenLastCalledWith(null, null, null);
    });
    it('ignores subframe navigation, subframe failures and ordinary cancellation', () => {
        event('dom-ready');
        event('did-navigate-in-page', { url: 'https://example.com/frame', isMainFrame: false });
        expect(host.querySelector('input')?.value).toBe(HOME_DESTINATION_URL);
        event('did-fail-load', { errorCode: -105, errorDescription: 'ERR_NAME_NOT_RESOLVED', isMainFrame: false });
        event('did-fail-load', { errorCode: -3, isMainFrame: true });
        expect(host.querySelector('[role="alert"]')).toBeNull();
        event('did-fail-load', { errorCode: -105, errorDescription: 'ERR_NAME_NOT_RESOLVED', isMainFrame: true });
        expect(host.querySelector('[role="alert"]')?.textContent).toContain('Page failed to load.');
    });
    it('keeps the live grant and readiness when the language changes', async () => {
        event('dom-ready'); mock.grant.mockClear();
        await act(() => i18n.changeLanguage('de'));
        expect(mock.grant).not.toHaveBeenCalled();
        expect(host.querySelector('button[aria-label="Zoom in"]')?.hasAttribute('disabled')).toBe(false);
    });
    it('disables guest methods again when the experimental setting remounts the guest', () => {
        event('dom-ready');
        mock.state.settings!.experimentalBrowser = false; render();
        mock.state.settings!.experimentalBrowser = true; render(); attachGuest();
        click('Zoom in'); click('Back');
        expect(guest.getZoomFactor).not.toHaveBeenCalled();
        expect(guest.goBack).not.toHaveBeenCalled();
        event('dom-ready'); click('Zoom in');
        expect(guest.setZoomFactor).toHaveBeenCalledWith(1.1);
    });
    it('rejects non-web addresses without navigating or changing the grant', () => {
        event('dom-ready'); mock.grant.mockClear();
        input('Enter a web address', 'file:///private/data');
        act(() => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
        expect(guest.getAttribute('src')).toBe(HOME_DESTINATION_URL);
        expect(mock.grant).not.toHaveBeenCalled();
        expect(host.querySelector('[role="alert"]')?.textContent).toContain('That does not look like a web address.');
    });
});

describe('Browser reading controls', () => {
    it('finds, steps forward/backward and ignores stale results after edits and closing', () => {
        event('dom-ready'); click('Find in page');
        expect(document.activeElement?.getAttribute('aria-label')).toBe('Find text on this page');
        input('Find text on this page', 'mod');
        expect(guest.findInPage).toHaveBeenLastCalledWith('mod', { forward: true, findNext: true });
        event('found-in-page', { result: { requestId: 1, activeMatchOrdinal: 1, matches: 3 } });
        expect(host.querySelector('[role="status"]')?.textContent).toBe('1 of 3');
        click('Next match');
        expect(guest.findInPage).toHaveBeenLastCalledWith('mod', { forward: true, findNext: false });
        click('Previous match');
        expect(guest.findInPage).toHaveBeenLastCalledWith('mod', { forward: false, findNext: false });
        input('Find text on this page', 'texture');
        event('found-in-page', { result: { requestId: 1, activeMatchOrdinal: 1, matches: 3 } });
        expect(host.querySelector('[role="status"]')?.textContent).toBe('');
        click('Close find');
        expect(guest.stopFindInPage).toHaveBeenLastCalledWith('clearSelection');
        expect(host.querySelector('#browser-find')).toBeNull();
    });
    it('clears find results on top-level navigation and empty queries', () => {
        event('dom-ready'); click('Find in page'); input('Find text on this page', 'mod');
        input('Find text on this page', '');
        expect(guest.stopFindInPage).toHaveBeenLastCalledWith('clearSelection');
        input('Find text on this page', 'mod');
        event('did-start-navigation', { isMainFrame: true });
        expect(host.querySelector<HTMLInputElement>('#browser-find input')?.value).toBe('');
        event('found-in-page', { result: { requestId: 2, activeMatchOrdinal: 1, matches: 3 } });
        expect(host.querySelector('[role="status"]')?.textContent).toBe('');
    });
    it('supports reverse search with Shift+Enter and closes with Escape, restoring focus', () => {
        event('dom-ready'); click('Find in page'); input('Find text on this page', 'mod');
        const field = host.querySelector<HTMLInputElement>('#browser-find input')!;
        act(() => field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true, cancelable: true })));
        expect(guest.findInPage).toHaveBeenLastCalledWith('mod', { forward: false, findNext: false });
        act(() => field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })));
        expect(host.querySelector('#browser-find')).toBeNull();
        expect(document.activeElement?.textContent).toBe('Find in page');
    });
    it('changes actual guest zoom, resets it and disables both endpoints', () => {
        event('dom-ready'); click('Zoom in');
        expect(guest.setZoomFactor).toHaveBeenLastCalledWith(1.1);
        expect(host.textContent).toContain('110%');
        click('Reset zoom'); expect(guest.setZoomFactor).toHaveBeenLastCalledWith(1);
        for (let n = 0; n < 12; n++) click('Zoom out');
        expect(host.querySelector('button[aria-label="Zoom out"]')?.hasAttribute('disabled')).toBe(true);
        expect(guest.setZoomFactor).toHaveBeenLastCalledWith(0.5);
        for (let n = 0; n < 12; n++) click('Zoom in');
        expect(host.querySelector('button[aria-label="Zoom in"]')?.hasAttribute('disabled')).toBe(true);
        expect(guest.setZoomFactor).toHaveBeenLastCalledWith(2);
    });
});
