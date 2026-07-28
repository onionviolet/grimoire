import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { app, type Session } from 'electron';
import { ElectronBlocker, parseFilters } from '@ghostery/adblocker-electron';

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
    enabled: boolean;
    userListPath?: string;
    domains: Set<string>;
    blocked: number;
    userListError: string | null;
    attachedSessions: Set<Session>;
    /** Rules previously injected into the Ghostery engine. `update()` is
     * additive unless we explicitly provide these as removals. */
    injectedNetworkFilterIds: number[];
}

const state: FilterState = {
    enabled: true,
    domains: new Set(BUILTIN_BLOCKLIST),
    blocked: 0,
    userListError: null,
    attachedSessions: new Set(),
    injectedNetworkFilterIds: [],
};

let blockerInstance: ElectronBlocker | null = null;
let blockerInitPromise: Promise<ElectronBlocker | null> | null = null;

function getEngineCachePath(): string | null {
    try {
        if (typeof app !== 'undefined' && app?.getPath) {
            return path.join(app.getPath('userData'), 'adblocker-engine.bin');
        }
    } catch {
        // Ignored under unit tests
    }
    return null;
}

async function getOrLoadBlocker(): Promise<ElectronBlocker | null> {
    if (blockerInstance) return blockerInstance;
    if (blockerInitPromise) return blockerInitPromise;

    blockerInitPromise = (async () => {
        const cachePath = getEngineCachePath();
        if (cachePath && existsSync(cachePath)) {
            try {
                const buf = readFileSync(cachePath);
                blockerInstance = ElectronBlocker.deserialize(buf);
            } catch (err) {
                console.warn('[Adblocker] Failed to deserialize cached engine, re-fetching:', err);
            }
        }

        if (!blockerInstance) {
            try {
                blockerInstance = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch);
                if (cachePath) {
                    try {
                        const dir = path.dirname(cachePath);
                        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
                        writeFileSync(cachePath, blockerInstance.serialize());
                    } catch (e) {
                        console.warn('[Adblocker] Failed to cache serialized engine:', e);
                    }
                }
            } catch (err) {
                console.warn('[Adblocker] Network fetch failed, initializing empty fallback blocker:', err);
                blockerInstance = ElectronBlocker.empty();
            }
        }

        blockerInstance.on('request-blocked', () => {
            state.blocked += 1;
        });

        return blockerInstance;
    })();

    return blockerInitPromise;
}

async function syncBlockerState(): Promise<void> {
    if (!state.enabled) {
        if (blockerInstance) {
            for (const session of state.attachedSessions) {
                try {
                    if (blockerInstance.isBlockingEnabled(session)) {
                        blockerInstance.disableBlockingInSession(session);
                    }
                } catch {
                    // Ignore if not enabled
                }
            }
        }
        return;
    }

    const blocker = await getOrLoadBlocker();
    if (!blocker) return;

    // The settings UI promises that a replacement or cleared custom list takes
    // effect immediately. FiltersEngine.update is additive by default, so pass
    // the prior injection as removals before adding the current complete set;
    // otherwise a domain removed from a user's file remains blocked until the
    // next app restart.
    const nextNetworkFilters = state.domains.size > 0
        ? parseFilters(Array.from(state.domains)
            .map((d) => `||${d}^`)
            .join('\n')).networkFilters
        : [];
    blocker.update({
        newNetworkFilters: nextNetworkFilters,
        removedNetworkFilters: state.injectedNetworkFilterIds,
    });
    state.injectedNetworkFilterIds = nextNetworkFilters.map((filter) => filter.getId());

    for (const session of state.attachedSessions) {
        try {
            if (!blocker.isBlockingEnabled(session)) {
                blocker.enableBlockingInSession(session);
            }
        } catch (err) {
            console.warn('[Adblocker] Failed to enable blocking on session:', err);
        }
    }
}

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
    state.enabled = config.enabled;
    state.userListPath = config.userListPath;
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

    syncBlockerState().catch((err) => console.warn('[Adblocker] Failed to sync blocker state:', err));

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
    if (session) {
        state.attachedSessions.add(session);
    }

    // Permission floor. An embedded modding browser has no legitimate need for
    // any of these, and there is no UI in which the user could evaluate a
    // prompt, so the honest answer is a blanket no. Fullscreen is the one
    // exception: it is harmless and video embeds use it.
    if (session?.setPermissionRequestHandler && session?.setPermissionCheckHandler) {
        const ALLOWED = new Set(['fullscreen']);
        session.setPermissionRequestHandler((_wc, permission, callback) => {
            callback(ALLOWED.has(permission));
        });
        session.setPermissionCheckHandler((_wc, permission) => ALLOWED.has(permission));
    }

    // WebRequest fallback listener for host matching and unit test compatibility
    if (session?.webRequest?.onBeforeRequest) {
        session.webRequest.onBeforeRequest((details, callback) => {
            if (details.resourceType === 'mainFrame') {
                callback({ cancel: false });
                return;
            }
            if (!state.enabled) {
                callback({ cancel: false });
                return;
            }
            if (blockerInstance && blockerInstance.isBlockingEnabled(session)) {
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
    }

    syncBlockerState().catch((err) => console.warn('[Adblocker] Sync on attach failed:', err));
}

