// `hardenGuestWebPreferences` is the single authority for what a `<webview>`
// guest is allowed to be. This file pins the nine invariants so a future edit
// that removes or weakens one of them fails a test rather than surviving on
// a comment. Imports nothing but vitest and the module under test, so it
// proves the module needs no electron runtime to be exercised.

import { describe, expect, it } from 'vitest';
import { GUEST_PARTITION, hardenGuestWebPreferences } from './webviewHardening';
import type { GuestAttachParams, GuestWebPreferences } from './webviewHardening';

function relaxedWebPreferences(): GuestWebPreferences {
    return {
        preload: 'C:/app/preload/index.js',
        nodeIntegration: true,
        nodeIntegrationInSubFrames: true,
        contextIsolation: false,
        sandbox: false,
        webSecurity: false,
        allowRunningInsecureContent: true,
        experimentalFeatures: true,
    };
}

describe('hardenGuestWebPreferences', () => {
    it('removes the preload key entirely rather than setting it to undefined or empty', () => {
        const webPreferences = relaxedWebPreferences();
        hardenGuestWebPreferences(webPreferences, {});
        expect('preload' in webPreferences).toBe(false);
    });

    it('forces every one of the seven relaxed booleans back to its hardened value', () => {
        const webPreferences = relaxedWebPreferences();
        hardenGuestWebPreferences(webPreferences, {});
        expect(webPreferences.nodeIntegration).toBe(false);
        expect(webPreferences.nodeIntegrationInSubFrames).toBe(false);
        expect(webPreferences.contextIsolation).toBe(true);
        expect(webPreferences.sandbox).toBe(true);
        expect(webPreferences.webSecurity).toBe(true);
        expect(webPreferences.allowRunningInsecureContent).toBe(false);
        expect(webPreferences.experimentalFeatures).toBe(false);
    });

    it('pins params.partition to the browser partition constant regardless of what was requested', () => {
        const params: GuestAttachParams = { partition: 'persist:grimoire' };
        hardenGuestWebPreferences(relaxedWebPreferences(), params);
        expect(params.partition).toBe(GUEST_PARTITION);
    });

    it('rewrites a file:// src to about:blank', () => {
        const params: GuestAttachParams = { src: 'file:///etc/passwd' };
        hardenGuestWebPreferences(relaxedWebPreferences(), params);
        expect(params.src).toBe('about:blank');
    });

    it('rewrites a custom app-scheme src to about:blank', () => {
        const params: GuestAttachParams = { src: 'grimoire://something' };
        hardenGuestWebPreferences(relaxedWebPreferences(), params);
        expect(params.src).toBe('about:blank');
    });

    it('rewrites a javascript: src to about:blank', () => {
        const params: GuestAttachParams = { src: 'javascript:alert(1)' };
        hardenGuestWebPreferences(relaxedWebPreferences(), params);
        expect(params.src).toBe('about:blank');
    });

    it('rewrites a missing src to about:blank', () => {
        const params: GuestAttachParams = {};
        hardenGuestWebPreferences(relaxedWebPreferences(), params);
        expect(params.src).toBe('about:blank');
    });

    it('leaves an https:// src unchanged', () => {
        const params: GuestAttachParams = { src: 'https://gamebanana.com/' };
        hardenGuestWebPreferences(relaxedWebPreferences(), params);
        expect(params.src).toBe('https://gamebanana.com/');
    });

    it('leaves an https:// src unchanged case-insensitively', () => {
        const params: GuestAttachParams = { src: 'HTTPS://GameBanana.com/' };
        hardenGuestWebPreferences(relaxedWebPreferences(), params);
        expect(params.src).toBe('HTTPS://GameBanana.com/');
    });

    it('walks every one of the nine invariants in a single pass, naming the regressed one on failure', () => {
        const webPreferences = relaxedWebPreferences();
        const params: GuestAttachParams = { partition: 'persist:grimoire', src: 'file:///etc/passwd' };
        hardenGuestWebPreferences(webPreferences, params);

        expect({
            hasPreload: 'preload' in webPreferences,
            nodeIntegration: webPreferences.nodeIntegration,
            nodeIntegrationInSubFrames: webPreferences.nodeIntegrationInSubFrames,
            contextIsolation: webPreferences.contextIsolation,
            sandbox: webPreferences.sandbox,
            webSecurity: webPreferences.webSecurity,
            allowRunningInsecureContent: webPreferences.allowRunningInsecureContent,
            experimentalFeatures: webPreferences.experimentalFeatures,
            partition: params.partition,
            src: params.src,
        }).toEqual({
            hasPreload: false,
            nodeIntegration: false,
            nodeIntegrationInSubFrames: false,
            contextIsolation: true,
            sandbox: true,
            webSecurity: true,
            allowRunningInsecureContent: false,
            experimentalFeatures: false,
            partition: GUEST_PARTITION,
            src: 'about:blank',
        });
    });
});
