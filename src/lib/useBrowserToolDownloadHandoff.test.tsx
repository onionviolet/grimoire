// @vitest-environment jsdom

import '../i18n';
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useNavigate, type NavigateFunction } from 'react-router-dom';
import { ConfirmContext, type ConfirmFn } from '../components/common/confirmContext';
import { useToastStore } from '../stores/toastStore';
import { useBrowserToolDownloadStore } from '../stores/browserToolDownloadStore';
import { useBrowserToolDownloadHandoff } from './useBrowserToolDownloadHandoff';
import type { BrowserToolDownloadEvent } from '../types/electron';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;

/**
 * CR-01 regression coverage for `useBrowserToolDownloadHandoff`: the app
 * scoped subscriber that replaced the page scoped effect that used to live
 * in `Browser.tsx`. The whole point of the move is that the subscriber's
 * lifetime is the renderer document's lifetime, not the `/browser` route's
 * mount, so this file's central test drives a real `MemoryRouter` navigation
 * away from `/browser` and asserts the subscription survives it.
 *
 * `window.electronAPI.onBrowserToolDownload`/`resolveToolDownload` are
 * stubbed directly (the `PortraitEditor.test.tsx` convention), since this
 * hook talks to them through the fork-only `browserToolDownload.ts`
 * pass-throughs, not through a mockable module boundary of its own.
 */

let capturedSubscriber: ((event: BrowserToolDownloadEvent) => void) | null = null;
let capturedNavigate: NavigateFunction | null = null;
let subscribeSpy: ReturnType<typeof vi.fn<(cb: (event: BrowserToolDownloadEvent) => void) => void>>;
let unsubscribeSpy: ReturnType<typeof vi.fn>;
let resolveToolDownloadSpy: ReturnType<typeof vi.fn>;

/** One macrotask turn, so the void async IIFE inside the hook's 'ready'
 *  branch (and any pending promise chain) settles before the next
 *  assertion, mirroring `ChatWheel.test.tsx`'s `flush`. */
function flush(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

function NavigateCapture() {
    const navigate = useNavigate();
    useEffect(() => {
        capturedNavigate = navigate;
    }, [navigate]);
    return null;
}

function HookHost() {
    useBrowserToolDownloadHandoff();
    return null;
}

async function renderHarness(
    root: Root,
    confirmFn: ReturnType<typeof vi.fn<ConfirmFn>>,
    initialPath = '/browser'
): Promise<void> {
    await act(async () => {
        root.render(
            <MemoryRouter initialEntries={[initialPath]}>
                <ConfirmContext.Provider value={confirmFn}>
                    <NavigateCapture />
                    <HookHost />
                    <Routes>
                        <Route path="/browser" element={<div>browser page</div>} />
                        <Route path="/installed" element={<div>installed page</div>} />
                    </Routes>
                </ConfirmContext.Provider>
            </MemoryRouter>
        );
    });
}

describe('useBrowserToolDownloadHandoff', () => {
    let host: HTMLDivElement;
    let root: Root;

    beforeEach(async () => {
        capturedSubscriber = null;
        capturedNavigate = null;
        subscribeSpy = vi.fn<(cb: (event: BrowserToolDownloadEvent) => void) => void>();
        unsubscribeSpy = vi.fn();
        resolveToolDownloadSpy = vi.fn().mockResolvedValue({ ok: true });

        window.electronAPI = {
            onBrowserToolDownload: (cb: (event: BrowserToolDownloadEvent) => void) => {
                subscribeSpy(cb);
                capturedSubscriber = cb;
                return unsubscribeSpy;
            },
            resolveToolDownload: resolveToolDownloadSpy,
        } as unknown as typeof window.electronAPI;

        useToastStore.setState({ toasts: [] });
        useBrowserToolDownloadStore.setState({ refusal: null });

        host = document.createElement('div');
        document.body.append(host);
        root = createRoot(host);
    });

    afterEach(() => {
        act(() => root.unmount());
        host.remove();
        vi.clearAllMocks();
    });

    it('subscribes exactly once on mount and calls the returned unsubscribe on unmount', async () => {
        await renderHarness(root, vi.fn<ConfirmFn>().mockResolvedValue(true));
        expect(subscribeSpy).toHaveBeenCalledTimes(1);
        expect(unsubscribeSpy).not.toHaveBeenCalled();

        act(() => root.unmount());
        expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
    });

    it('does not resubscribe on a route change away from /browser, and a ready pushed after that navigation still reaches the confirm spy (CR-01)', async () => {
        const confirmSpy = vi.fn<ConfirmFn>().mockResolvedValue(true);
        await renderHarness(root, confirmSpy);
        expect(subscribeSpy).toHaveBeenCalledTimes(1);

        await act(async () => {
            capturedNavigate!('/installed');
        });
        // The whole point of the app-scoped move: navigating away must not
        // tear down and re-establish the listener.
        expect(subscribeSpy).toHaveBeenCalledTimes(1);
        expect(unsubscribeSpy).not.toHaveBeenCalled();

        await act(async () => {
            capturedSubscriber!({ status: 'ready', id: 'post-nav-id', name: 'build.vpk' });
            await flush();
        });
        expect(confirmSpy).toHaveBeenCalledTimes(1);
    });

    it('a ready event with no name uses the fallbackName in the disclosure message values', async () => {
        const confirmSpy = vi.fn<ConfirmFn>().mockResolvedValue(true);
        await renderHarness(root, confirmSpy);

        await act(async () => {
            capturedSubscriber!({ status: 'ready', id: 'no-name-id' });
            await flush();
        });

        expect(confirmSpy).toHaveBeenCalledTimes(1);
        const request = confirmSpy.mock.calls[0][0];
        const messageProps = (request.message as { props: { values: { name: string } } }).props;
        expect(messageProps.values.name).toBe('Browser download');
    });

    it('confirming a ready resolves accepted (id, true)', async () => {
        const confirmSpy = vi.fn<ConfirmFn>().mockResolvedValue(true);
        await renderHarness(root, confirmSpy);

        await act(async () => {
            capturedSubscriber!({ status: 'ready', id: 'accept-id', name: 'build.vpk' });
            await flush();
        });

        expect(resolveToolDownloadSpy).toHaveBeenCalledWith('accept-id', true);
    });

    it('declining a ready resolves declined (id, false)', async () => {
        const confirmSpy = vi.fn<ConfirmFn>().mockResolvedValue(false);
        await renderHarness(root, confirmSpy);

        await act(async () => {
            capturedSubscriber!({ status: 'ready', id: 'decline-id', name: 'build.vpk' });
            await flush();
        });

        expect(resolveToolDownloadSpy).toHaveBeenCalledWith('decline-id', false);
    });

    it('a replaced event for an id whose confirm is still open makes the eventual answer a no-op', async () => {
        let resolveConfirm: ((accepted: boolean) => void) | null = null;
        const confirmSpy = vi.fn<ConfirmFn>().mockImplementation(
            () => new Promise<boolean>((resolve) => { resolveConfirm = resolve; })
        );
        await renderHarness(root, confirmSpy);

        await act(async () => {
            capturedSubscriber!({ status: 'ready', id: 'stale-id', name: 'build.vpk' });
            await flush();
        });
        expect(confirmSpy).toHaveBeenCalledTimes(1);

        // Superseded by a second Build VPK click while the first confirm is
        // still open (unanswered).
        await act(async () => {
            capturedSubscriber!({ status: 'replaced', id: 'stale-id', tool: 'Pimp My Hideout' });
            await flush();
        });

        // The user finally answers the (visually stale) still-open dialog.
        await act(async () => {
            resolveConfirm!(true);
            await flush();
        });

        expect(resolveToolDownloadSpy).not.toHaveBeenCalled();
    });

    it('refused on /browser sets the store refusal and shows no toast', async () => {
        const confirmSpy = vi.fn<ConfirmFn>().mockResolvedValue(true);
        await renderHarness(root, confirmSpy, '/browser');

        await act(async () => {
            capturedSubscriber!({ status: 'refused', id: 'refused-id', reason: 'Not a VPK.' });
            await flush();
        });

        expect(useBrowserToolDownloadStore.getState().refusal).toBe('Not added: Not a VPK.');
        expect(useToastStore.getState().toasts).toHaveLength(0);
    });

    it('refused off /browser leaves the store refusal null and shows exactly one error toast ending with the reason', async () => {
        const confirmSpy = vi.fn<ConfirmFn>().mockResolvedValue(true);
        await renderHarness(root, confirmSpy, '/browser');

        await act(async () => {
            capturedNavigate!('/installed');
        });

        await act(async () => {
            capturedSubscriber!({ status: 'refused', id: 'refused-id-2', reason: 'Not a VPK.' });
            await flush();
        });

        expect(useBrowserToolDownloadStore.getState().refusal).toBeNull();
        const toasts = useToastStore.getState().toasts;
        expect(toasts).toHaveLength(1);
        expect(toasts[0].tone).toBe('error');
        expect(toasts[0].message.endsWith('Not a VPK.')).toBe(true);
    });

    it('started shows an info toast naming the tool, and a terminal status dismisses it before its duration', async () => {
        const confirmSpy = vi.fn<ConfirmFn>().mockResolvedValue(true);
        await renderHarness(root, confirmSpy);

        await act(async () => {
            capturedSubscriber!({ status: 'started', id: 'started-id', tool: 'Pimp My Hideout' });
            await flush();
        });
        let toasts = useToastStore.getState().toasts;
        expect(toasts).toHaveLength(1);
        expect(toasts[0].tone).toBe('info');
        expect(toasts[0].message).toBe('Downloading from Pimp My Hideout...');

        await act(async () => {
            capturedSubscriber!({ status: 'failed', id: 'started-id' });
            await flush();
        });
        toasts = useToastStore.getState().toasts;
        // The in-flight toast is dismissed and replaced by the failure toast:
        // never both stacked, and never the in-flight one lingering.
        expect(toasts).toHaveLength(1);
        expect(toasts[0].tone).toBe('error');
    });

    it('failed shows an error toast and clears any store refusal', async () => {
        const confirmSpy = vi.fn<ConfirmFn>().mockResolvedValue(true);
        await renderHarness(root, confirmSpy, '/browser');

        await act(async () => {
            capturedSubscriber!({ status: 'refused', id: 'r-1', reason: 'Not a VPK.' });
            await flush();
        });
        expect(useBrowserToolDownloadStore.getState().refusal).not.toBeNull();

        await act(async () => {
            capturedSubscriber!({ status: 'failed', id: 'f-1' });
            await flush();
        });

        expect(useBrowserToolDownloadStore.getState().refusal).toBeNull();
        const toasts = useToastStore.getState().toasts;
        expect(toasts).toHaveLength(1);
        expect(toasts[0].tone).toBe('error');
        expect(toasts[0].message).toBe('The download did not finish. Nothing was added.');
    });
});
