// Characterization test for attachBrowserFilter's permission floor: a
// blanket deny for every Chromium permission except fullscreen, because
// there is no UI in which the user could evaluate an ad hoc prompt from an
// arbitrary embedded page (D-12 in the phase 06 context doc). This file
// deliberately does not modify browserContentFilter.ts; its whole value is
// that it now fails if a future change to the download or capture path
// quietly widens the floor.
//
// A separate file from browserContentFilter.test.ts on purpose: that file
// tests only pure exported helpers (parseBlocklist, isBlockedHost), while
// this one needs a stub session to observe attachBrowserFilter's side
// effects. attachBrowserFilter guards every session call with optional
// chaining, so a stub carrying only the members it touches is enough.

import { describe, expect, it } from 'vitest';
import { attachBrowserFilter } from './browserContentFilter';

// New browser permissions Electron adds over time should be appended here
// rather than assumed denied: this list is what the floor is actually
// checked against, not a description of Electron's full permission set.
const DENIED_PERMISSIONS = [
    'media',
    'geolocation',
    'notifications',
    'midi',
    'midiSysex',
    'pointerLock',
    'openExternal',
    'clipboard-read',
    'display-capture',
];

type RequestHandler = (
    webContents: unknown,
    permission: string,
    callback: (granted: boolean) => void
) => void;
type CheckHandler = (webContents: unknown, permission: string) => boolean;

interface StubSession {
    requestHandler: RequestHandler | null;
    checkHandler: CheckHandler | null;
    setPermissionRequestHandler: (handler: RequestHandler) => void;
    setPermissionCheckHandler: (handler: CheckHandler) => void;
    webRequest: { onBeforeRequest: (listener: (...args: unknown[]) => void) => void };
}

function makeStubSession(): StubSession {
    const stub: StubSession = {
        requestHandler: null,
        checkHandler: null,
        setPermissionRequestHandler: (handler) => {
            stub.requestHandler = handler;
        },
        setPermissionCheckHandler: (handler) => {
            stub.checkHandler = handler;
        },
        webRequest: {
            // No-op recorder: attachBrowserFilter registers a webRequest
            // listener too, and a stub missing this member entirely would
            // throw before reaching the permission floor it guards with
            // optional chaining.
            onBeforeRequest: () => {},
        },
    };
    return stub;
}

function requestResult(stub: StubSession, permission: string): boolean {
    let granted: boolean | undefined;
    stub.requestHandler?.({}, permission, (result) => {
        granted = result;
    });
    expect(granted).not.toBeUndefined();
    return granted as boolean;
}

describe('attachBrowserFilter permission floor', () => {
    it('installs both a permission request handler and a permission check handler', () => {
        const stub = makeStubSession();
        attachBrowserFilter(stub as unknown as Parameters<typeof attachBrowserFilter>[0]);
        expect(stub.requestHandler).not.toBeNull();
        expect(stub.checkHandler).not.toBeNull();
    });

    it('the request handler calls back with true for fullscreen', () => {
        const stub = makeStubSession();
        attachBrowserFilter(stub as unknown as Parameters<typeof attachBrowserFilter>[0]);
        expect(requestResult(stub, 'fullscreen')).toBe(true);
    });

    it('the check handler returns true for fullscreen', () => {
        const stub = makeStubSession();
        attachBrowserFilter(stub as unknown as Parameters<typeof attachBrowserFilter>[0]);
        expect(stub.checkHandler?.({}, 'fullscreen')).toBe(true);
    });

    it.each(DENIED_PERMISSIONS)('the request handler calls back with false for %s', (permission) => {
        const stub = makeStubSession();
        attachBrowserFilter(stub as unknown as Parameters<typeof attachBrowserFilter>[0]);
        expect(requestResult(stub, permission)).toBe(false);
    });

    it.each(DENIED_PERMISSIONS)('the check handler returns false for %s', (permission) => {
        const stub = makeStubSession();
        attachBrowserFilter(stub as unknown as Parameters<typeof attachBrowserFilter>[0]);
        expect(stub.checkHandler?.({}, permission)).toBe(false);
    });

    it('attaching twice does not leave the session with a handler that answers differently', () => {
        const stub = makeStubSession();
        attachBrowserFilter(stub as unknown as Parameters<typeof attachBrowserFilter>[0]);
        attachBrowserFilter(stub as unknown as Parameters<typeof attachBrowserFilter>[0]);

        expect(requestResult(stub, 'fullscreen')).toBe(true);
        expect(stub.checkHandler?.({}, 'fullscreen')).toBe(true);
        for (const permission of DENIED_PERMISSIONS) {
            expect(requestResult(stub, permission)).toBe(false);
            expect(stub.checkHandler?.({}, permission)).toBe(false);
        }
    });
});
