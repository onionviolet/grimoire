// Request filtering and permission denial for the in-app Browser's <webview>.
//
// WHY. The Browser page embeds third-party sites (GameBanana, wikis, Deadlock
// Forge). `will-attach-webview` already strips the preload, forces
// sandbox/contextIsolation, and pins a separate partition, so a page cannot
// reach the app. What that does NOT cover is what an ordinary ad-supported page
// does to the USER: third-party ad and tracker requests, and permission prompts
// (camera, microphone, location, notifications) that an embedded frame has no
// business asking for. A stock Chrome user has uBlock Origin and a familiar
// permission UI; a user inside Grimoire's frame has neither.
//
// WHY NOT AN ADBLOCK LIBRARY. `@cliqz/adblocker-electron` parses real EasyList
// rules and is the better filter, but it is a dependency plus a filter-list
// fetch plus periodic list updates, on a fork that already has to justify every
// line to a possible upstream PR. Cosmetic filtering (hiding ad boxes) also
// needs a content script, and a content script in a sandboxed guest is exactly
// the privilege this design deliberately removed. So: domain-level network
// blocking, which kills the request rather than the empty box it leaves, plus a
// user-supplied list for anything the built-in set misses. If this ever needs
// real EasyList semantics, swap the matcher here; the call sites do not change.
//
// The built-in list is deliberately short and boring: the large ad/tracker
// networks, nothing opinionated, nothing that breaks a site's own content. A
// blocked request fails closed (the page still renders, minus the ad).

import { readFileSync } from 'node:fs';
import type { Session } from 'electron';

/** Ad and tracker hosts blocked by default. Matched on the request host and any
 *  parent domain, so `foo.doubleclick.net` is covered by `doubleclick.net`. */
const BUILTIN_BLOCKLIST = [
    // Google ads / analytics
    'doubleclick.net',
    'googlesyndication.com',
    'googleadservices.com',
    'google-analytics.com',
    'googletagmanager.com',
    'googletagservices.com',
    'adservice.google.com',
    // Other large ad exchanges
    'adnxs.com',
    'rubiconproject.com',
    'pubmatic.com',
    'openx.net',
    'criteo.com',
    'criteo.net',
    'taboola.com',
    'outbrain.com',
    'media.net',
    'amazon-adsystem.com',
    'adsrvr.org',
    'casalemedia.com',
    'sharethrough.com',
    'smartadserver.com',
    'teads.tv',
    'yieldmo.com',
    // Analytics / session recording / fingerprinting
    'scorecardresearch.com',
    'quantserve.com',
    'hotjar.com',
    'mouseflow.com',
    'fullstory.com',
    'segment.io',
    'mixpanel.com',
    'branch.io',
    'crazyegg.com',
    // Social trackers (the pixel, not the site itself)
    'connect.facebook.net',
    'analytics.tiktok.com',
    'ads-twitter.com',
    'static.ads-twitter.com',
];

export interface FilterConfig {
    /** Master switch. Off = no request filtering at all (permission denial stays
     *  on regardless: that one is a safety floor, not a preference). */
    enabled: boolean;
    /** Path to a user blocklist. One domain per line; `#` comments and hosts-file
     *  syntax (`0.0.0.0 example.com`) are both accepted, so a list downloaded
     *  from the usual sources works without editing. */
    userListPath?: string;
}

interface FilterState {
    domains: Set<string>;
    blocked: number;
    userListError: string | null;
}

const state: FilterState = { domains: new Set(), blocked: 0, userListError: null };

/** Parse a hosts-style or plain-domain blocklist. Tolerant on purpose: a bad
 *  line is skipped, never fatal, because this runs on a file the user edits. */
export function parseBlocklist(text: string): string[] {
    const out: string[] = [];
    for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.split('#')[0].trim();
        if (!line) continue;
        // `0.0.0.0 ads.example.com` / `127.0.0.1 ads.example.com` -> second field.
        const parts = line.split(/\s+/);
        const candidate = parts.length > 1 ? parts[1] : parts[0];
        // Reject anything that is not plausibly a domain, including the
        // localhost entries every hosts file starts with.
        if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(candidate)) continue;
        out.push(candidate.toLowerCase());
    }
    return out;
}

/** Does `host` sit at or under any blocked domain? Walks parent labels so one
 *  entry covers every subdomain without wildcards. */
export function isBlockedHost(host: string, domains: Set<string>): boolean {
    const h = host.toLowerCase();
    let idx = 0;
    for (;;) {
        if (domains.has(h.slice(idx))) return true;
        const next = h.indexOf('.', idx);
        if (next === -1) return false;
        idx = next + 1;
    }
}

/** Rebuild the domain set from config. Safe to call on every settings save. */
export function configureFilter(config: FilterConfig): { count: number; error: string | null } {
    state.domains = new Set(config.enabled ? BUILTIN_BLOCKLIST : []);
    state.userListError = null;

    if (config.enabled && config.userListPath) {
        try {
            for (const domain of parseBlocklist(readFileSync(config.userListPath, 'utf-8'))) {
                state.domains.add(domain);
            }
        } catch (e) {
            // A missing or unreadable custom list must not silently disable the
            // built-in one, and must be visible in Settings rather than only in
            // a log the user never opens.
            state.userListError = e instanceof Error ? e.message : String(e);
        }
    }
    return { count: state.domains.size, error: state.userListError };
}

export function filterStats(): { domains: number; blocked: number; error: string | null } {
    return { domains: state.domains.size, blocked: state.blocked, error: state.userListError };
}

/**
 * Attach the filter and the permission floor to the browser partition's session.
 * Call once per session; re-running `configureFilter` is how the list changes.
 */
export function attachBrowserFilter(session: Session): void {
    session.webRequest.onBeforeRequest((details, callback) => {
        // Never filter the top-level document: blocking a page the user typed
        // would look like a broken browser, and the blocklist targets embedded
        // ad/tracker resources, not destinations.
        if (details.resourceType === 'mainFrame') {
            callback({ cancel: false });
            return;
        }
        let host: string;
        try {
            host = new URL(details.url).hostname;
        } catch {
            callback({ cancel: false });
            return;
        }
        if (isBlockedHost(host, state.domains)) {
            state.blocked += 1;
            callback({ cancel: true });
            return;
        }
        callback({ cancel: false });
    });

    // Permission floor. An embedded modding browser has no legitimate need for
    // any of these, and there is no UI in which the user could evaluate a
    // prompt, so the honest answer is a blanket no. Fullscreen is the one
    // exception: it is harmless and video embeds use it.
    const ALLOWED = new Set(['fullscreen']);
    session.setPermissionRequestHandler((_wc, permission, callback) => {
        callback(ALLOWED.has(permission));
    });
    session.setPermissionCheckHandler((_wc, permission) => ALLOWED.has(permission));

    // Certificate errors are deliberately NOT handled here. Chromium's default
    // already fails the load, and a <webview> has no "proceed anyway"
    // interstitial to click through, so a custom verify proc could only make
    // this weaker. Left as a comment so nobody adds one thinking it was missed.
}
