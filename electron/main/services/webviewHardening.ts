// The single authority for what a `<webview>` guest is allowed to be. The
// renderer sets a guest's attributes, so a compromised or buggy renderer
// could otherwise ask for a privileged guest. `hardenGuestWebPreferences`
// runs in the main process (called from `will-attach-webview`) and overrides
// whatever was requested, unconditionally and with no override parameter.
//
// Kept as a plain function (not a class, no module state) so it is testable
// in a bare node environment: the electron runtime is never imported here,
// only structural types narrow enough to describe the two objects
// `will-attach-webview` hands us.

/** The subset of Electron's `WebPreferences` this function mutates. Declared
 *  locally (rather than importing the type from `electron`) so this module
 *  and its test can run without the electron runtime. */
export interface GuestWebPreferences {
    preload?: unknown;
    nodeIntegration?: boolean;
    nodeIntegrationInSubFrames?: boolean;
    contextIsolation?: boolean;
    sandbox?: boolean;
    webSecurity?: boolean;
    allowRunningInsecureContent?: boolean;
    experimentalFeatures?: boolean;
}

/** The subset of `will-attach-webview`'s `params` this function mutates. */
export interface GuestAttachParams {
    partition?: string;
    src?: string;
}

/** Third-party pages get their own session partition, so their cookies and
 *  storage never touch the app's session (which holds the user's GameBanana
 *  login). Exported so the renderer's `<webview partition>` attribute
 *  (`src/pages/Browser.tsx`) and this pin can never drift apart. */
export const GUEST_PARTITION = 'persist:grimoire-browser';

/**
 * Overrides a guest webview's requested privileges with the hardened set.
 * Mutates both arguments in place, matching `will-attach-webview`'s own
 * contract. Takes no options, flags, or override parameter: there is no
 * supported way for a caller to request a weaker guest.
 */
export function hardenGuestWebPreferences(
    webPreferences: GuestWebPreferences,
    params: GuestAttachParams
): void {
    // Never let a guest reach Node, and never let it borrow our preload
    // (which exposes the whole electronAPI surface to whatever page loads).
    delete webPreferences.preload;
    webPreferences.nodeIntegration = false;
    webPreferences.nodeIntegrationInSubFrames = false;
    webPreferences.contextIsolation = true;
    webPreferences.sandbox = true;
    webPreferences.webSecurity = true;
    webPreferences.allowRunningInsecureContent = false;
    webPreferences.experimentalFeatures = false;

    // Third-party pages get their own session partition, so their cookies
    // and storage never touch the app's session (which holds the user's
    // GameBanana login).
    params.partition = GUEST_PARTITION;

    // Only ever load real web pages. Blocks file:// (local file read) and
    // the app's own custom schemes from being driven by page content.
    const src = String(params.src ?? '');
    if (!/^https?:\/\//i.test(src)) params.src = 'about:blank';
}
