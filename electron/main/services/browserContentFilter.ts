import { createHash } from 'node:crypto';
import {
    existsSync,
    mkdirSync,
    readdirSync,
    readFileSync,
    unlinkSync,
    writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { app, webContents, type Session } from 'electron';
import { randomUUID } from 'node:crypto';
import { readFilterUpdate, fetchFilterUpdate, saveFilterUpdate, removeFilterUpdate, filterBundleHash, type BrowserFilterBundle } from './browserFilterUpdates';
import type { BrowserFilterListInfo, BrowserCustomListInfo, BrowserFilterUpdateReview } from '../../../src/types/browserFilter';
import { ElectronBlocker, parseFilters } from '@ghostery/adblocker-electron';
import type { BrowserFilterStats } from '../../../src/types/foundry';

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
    exceptions?: string[];
}

interface FilterState {
    enabled: boolean;
    userListPath?: string;
    domains: Set<string>;
    blocked: number;
    userListError: string | null;
    /** Bundled filter lists missing or unreadable. Surfaced in Settings so a
     *  broken bundle is loud instead of silently weak blocking. */
    bundledError: string | null;
    /** Rule count from the bundled lists' meta.json (network + cosmetic). */
    bundledFilterCount: number;
    /** Full-syntax lines (uBO/EasyList) from the user's custom list. */
    userFilterText: string;
    attachedSessions: Set<Session>;
    /** Sessions that already have the webRequest fallback registered. */
    fallbackSessions: Set<Session>;
    /** Rules previously injected into the Ghostery engine. `update()` is
     * additive unless we explicitly provide these as removals. */
    injectedNetworkFilterIds: number[];
    /** Cosmetic rules previously injected into the Ghostery engine. */
    injectedCosmeticFilterIds: number[];
    exceptions: string[];
    status: BrowserFilterStats['status'];
    listInfo: BrowserFilterListInfo | null;
    custom: BrowserCustomListInfo;
    engineError: string | null;
}

const state: FilterState = {
    enabled: true,
    domains: new Set(BUILTIN_BLOCKLIST),
    blocked: 0,
    userListError: null,
    bundledError: null,
    bundledFilterCount: 0,
    userFilterText: '',
    attachedSessions: new Set(),
    fallbackSessions: new Set(),
    injectedNetworkFilterIds: [],
    injectedCosmeticFilterIds: [],
    exceptions: [], status: 'loading', listInfo: null,
    custom: { accepted: 0, rejected: 0, rejectedLines: [] }, engineError: null,
};

let blockerInstance: ElectronBlocker | null = null;
let blockerInitPromise: Promise<ElectronBlocker | null> | null = null;
let activeBundle: BrowserFilterBundle | null = null;
let baseNetworkIds = new Set<number>();
let baseCosmeticIds = new Set<number>();
let syncQueue: Promise<void> = Promise.resolve();
let pendingUpdate: { review: BrowserFilterUpdateReview; bundle: BrowserFilterBundle; base: string } | null = null;
let checkingUpdate = false;

export function normalizeFilterExceptions(values: unknown): string[] {
    if (!Array.isArray(values)) return [];
    const origins = new Set<string>();
    for (const value of values.slice(0, 200)) {
        try {
            const url = new URL(String(value));
            if (url.protocol === 'https:' || url.protocol === 'http:') origins.add(url.origin);
        } catch { /* Ignore invalid saved entries. */ }
    }
    return [...origins].sort();
}

function isPaused(url: string): boolean {
    try { return state.exceptions.includes(new URL(url).origin); } catch { return false; }
}
function pausedRequest(details: { webContentsId?: number; referrer?: string; url?: string; resourceType?: string }): boolean {
    if (details.resourceType === 'mainFrame') return isPaused(details.url ?? '');
    const owner = details.webContentsId === undefined ? undefined : webContents?.fromId?.(details.webContentsId);
    return isPaused(owner && !owner.isDestroyed() ? owner.getURL() : details.referrer ?? '');
}
function prepareBlocker(blocker: ElectronBlocker): ElectronBlocker {
    const before = blocker.onBeforeRequest;
    const headers = blocker.onHeadersReceived;
    const cosmetics = blocker.onInjectCosmeticFilters;
    blocker.onBeforeRequest = (details, callback) => !state.enabled || pausedRequest(details) ? callback({}) : before(details, callback);
    blocker.onHeadersReceived = (details, callback) => !state.enabled || pausedRequest(details) ? callback({}) : headers(details, callback);
    blocker.onInjectCosmeticFilters = (event, url, msg) => {
        if (!state.enabled || isPaused(event.sender.getURL())) return Promise.resolve();
        return cosmetics(event, url, msg);
    };
    blocker.on('request-blocked', () => { state.blocked += 1; });
    const filters = blocker.getFilters();
    baseNetworkIds = new Set(filters.networkFilters.map(filter => filter.getId()));
    baseCosmeticIds = new Set(filters.cosmeticFilters.map(filter => filter.getId()));
    state.bundledFilterCount = filters.networkFilters.length + filters.cosmeticFilters.length;
    return blocker;
}
function scheduleSync(): Promise<void> {
    const operation = syncQueue.then(syncBlockerState);
    syncQueue = operation.catch(error => { state.engineError = String(error); state.status = 'error'; });
    return operation;
}
export async function reloadBrowserFilter(): Promise<BrowserFilterStats> {
    configureFilter({ enabled: state.enabled, userListPath: state.userListPath, exceptions: state.exceptions });
    await syncQueue;
    // A resource fetched while filtering was paused must be checked again on
    // the next load. Keep cookies/storage; invalidate only guest HTTP caches.
    for (const session of state.attachedSessions) await session.clearCache?.();
    return filterStats();
}

/** Directory the bundled filter lists ship in: repo resources/ in dev,
 *  process.resourcesPath/filters in the packaged app (extraResources). */
function getFiltersDir(): string | null {
    try {
        if (typeof app !== 'undefined' && app?.isPackaged) {
            return path.join(process.resourcesPath, 'filters');
        }
        if (typeof app !== 'undefined' && app?.getAppPath) {
            return path.join(app.getAppPath(), 'resources', 'filters');
        }
    } catch {
        // Ignored under unit tests
    }
    return null;
}

interface BundledLists {
    filters: string;
    resources: string;
    meta: { networkFilters: number; cosmeticFilters: number; tag?: string; fetchedAt?: string } | null;
}

function loadBundledLists(): BundledLists | null {
    const dir = getFiltersDir();
    if (!dir) return null;
    const filtersPath = path.join(dir, 'filters.txt');
    const resourcesPath = path.join(dir, 'resources.json');
    const metaPath = path.join(dir, 'meta.json');
    if (!existsSync(filtersPath) || !existsSync(resourcesPath)) {
        state.bundledError = `Bundled filter lists not found in ${dir}.`;
        return null;
    }
    try {
        let meta: BundledLists['meta'] = null;
        if (existsSync(metaPath)) {
            try {
                const parsed = JSON.parse(readFileSync(metaPath, 'utf-8')) as {
                    networkFilters?: number;
                    cosmeticFilters?: number; tag?: string; fetchedAt?: string;
                };
                if (
                    typeof parsed.networkFilters === 'number' &&
                    Number.isFinite(parsed.networkFilters) &&
                    typeof parsed.cosmeticFilters === 'number' &&
                    Number.isFinite(parsed.cosmeticFilters)
                ) {
                    meta = {
                        networkFilters: parsed.networkFilters,
                        cosmeticFilters: parsed.cosmeticFilters,
                        tag: typeof parsed.tag === 'string' ? parsed.tag : undefined,
                        fetchedAt: typeof parsed.fetchedAt === 'string' && Number.isFinite(Date.parse(parsed.fetchedAt)) ? parsed.fetchedAt : undefined,
                    };
                }
            } catch {
                // meta.json is optional provenance; a bad one must not disable blocking.
            }
        }
        return {
            filters: readFileSync(filtersPath, 'utf-8'),
            resources: readFileSync(resourcesPath, 'utf-8'),
            meta,
        };
    } catch (err) {
        state.bundledError = err instanceof Error ? err.message : String(err);
        return null;
    }
}

/** Short content hash so a refreshed bundle invalidates the cached engine. */
function contentHash(...parts: string[]): string {
    const hash = createHash('sha256');
    for (const part of parts) hash.update(part);
    return hash.digest('hex').slice(0, 12);
}

function getEngineCachePath(bundled: BundledLists): string | null {
    try {
        if (typeof app !== 'undefined' && app?.getPath) {
            return path.join(
                app.getPath('userData'),
                `adblocker-engine-${contentHash(bundled.filters, bundled.resources)}.bin`
            );
        }
    } catch {
        // Ignored under unit tests
    }
    return null;
}

/** Remove engine caches for older bundled-list generations so userData does
 *  not accumulate one file per release forever. Only ever touches the exact
 *  generated-name pattern, never the directory at large. */
function pruneStaleEngineCaches(cachePath: string): void {
    try {
        const dir = path.dirname(cachePath);
        const current = path.basename(cachePath);
        for (const name of readdirSync(dir)) {
            if (name === current) continue;
            if (/^adblocker-engine-[0-9a-f]{12}\.bin$/.test(name)) {
                unlinkSync(path.join(dir, name));
            }
        }
    } catch {
        // Cleanup is best-effort; a stale cache only costs disk space.
    }
}

async function getOrLoadBlocker(): Promise<ElectronBlocker | null> {
    if (blockerInstance) return blockerInstance;
    if (blockerInitPromise) return blockerInitPromise;

    blockerInitPromise = (async () => {
        let update: BrowserFilterBundle | null = null;
        try { update = await readFilterUpdate(); } catch (error) { state.bundledError = String(error); }
        const local = loadBundledLists();
        activeBundle = update ?? (local ? { filters: local.filters, resources: local.resources,
            info: { source: 'bundled', revision: local.meta?.tag ?? 'bundled', fetchedAt: local.meta?.fetchedAt ?? null } } : null);
        state.listInfo = activeBundle?.info ?? { source: 'fallback', revision: 'built-in domains', fetchedAt: null };
        const bundled = activeBundle ? { ...activeBundle, meta: null } : null;
        const cachePath = bundled ? getEngineCachePath(bundled) : null;
        if (cachePath && existsSync(cachePath)) {
            try {
                blockerInstance = ElectronBlocker.deserialize(readFileSync(cachePath));
            } catch (err) {
                console.warn('[Adblocker] Failed to deserialize cached engine, rebuilding:', err);
            }
        }

        if (!blockerInstance) {
            if (!bundled) {
                console.warn(
                    '[Adblocker] Bundled filter lists unavailable; falling back to the built-in domain list.'
                );
                blockerInstance = ElectronBlocker.empty();
            } else {
                try {
                    // Lists are fetched at build time (scripts/fetch-filter-lists.mjs)
                    // and ship with the app, so the packaged blocker has full
                    // EasyList/EasyPrivacy/uBO coverage with no runtime network.
                    blockerInstance = ElectronBlocker.parse(bundled.filters);
                    blockerInstance.updateResources(bundled.resources, '' + bundled.resources.length);
                    state.bundledError = null;
                    if (cachePath) {
                        try {
                            const dir = path.dirname(cachePath);
                            if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
                            writeFileSync(cachePath, blockerInstance.serialize());
                            pruneStaleEngineCaches(cachePath);
                        } catch (err) {
                            console.warn('[Adblocker] Failed to cache serialized engine:', err);
                        }
                    }
                } catch (err) {
                    state.bundledError = err instanceof Error ? err.message : String(err);
                    console.warn(
                        '[Adblocker] Failed to parse bundled lists; falling back to the built-in domain list:',
                        err
                    );
                    blockerInstance = ElectronBlocker.empty();
                    activeBundle = null;
                    state.listInfo = { source: 'fallback', revision: 'built-in domains', fetchedAt: null };
                }
            }
        }

        prepareBlocker(blockerInstance);
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
        state.status = 'off';
        return;
    }

    state.status = 'loading';
    const blocker = await getOrLoadBlocker();
    if (!blocker || !state.enabled) { state.status = 'off'; return; }

    // The settings UI promises that a replacement or cleared custom list takes
    // effect immediately. FiltersEngine.update is additive by default, so pass
    // the prior injection as removals before adding the current complete set;
    // otherwise a domain removed from a user's file remains blocked until the
    // next app restart.
    const parsedDomains =
        state.domains.size > 0
            ? parseFilters(
                  Array.from(state.domains)
                      .map((d) => `||${d}^`)
                      .join('\n')
              )
            : { networkFilters: [] };
    const parsedUser = state.userFilterText
        ? parseFilters(state.userFilterText)
        : { networkFilters: [], cosmeticFilters: [] };
    const nextNetworkFilters = dedupeById([
        ...parsedDomains.networkFilters,
        ...parsedUser.networkFilters,
    ]).filter(filter => !baseNetworkIds.has(filter.getId()));
    const nextCosmeticFilters = dedupeById(parsedUser.cosmeticFilters).filter(filter => !baseCosmeticIds.has(filter.getId()));
    const oldNetwork = new Set(state.injectedNetworkFilterIds);
    const oldCosmetic = new Set(state.injectedCosmeticFilterIds);
    const nextNetwork = new Set(nextNetworkFilters.map(filter => filter.getId()));
    const nextCosmetic = new Set(nextCosmeticFilters.map(filter => filter.getId()));
    // Removal and addition must be disjoint. The engine does not promise that
    // an id removed and re-added in the same update remains present.
    blocker.update({
        newNetworkFilters: nextNetworkFilters.filter(filter => !oldNetwork.has(filter.getId())),
        removedNetworkFilters: state.injectedNetworkFilterIds.filter(id => !nextNetwork.has(id)),
        newCosmeticFilters: nextCosmeticFilters.filter(filter => !oldCosmetic.has(filter.getId())),
        removedCosmeticFilters: state.injectedCosmeticFilterIds.filter(id => !nextCosmetic.has(id)),
    });
    state.injectedNetworkFilterIds = nextNetworkFilters.map((filter) => filter.getId());
    state.injectedCosmeticFilterIds = nextCosmeticFilters.map((filter) => filter.getId());

    state.engineError = null;
    for (const session of state.attachedSessions) {
        try {
            if (!blocker.isBlockingEnabled(session)) {
                blocker.enableBlockingInSession(session);
            }
        } catch (err) {
            state.engineError = String(err);
            console.warn('[Adblocker] Failed to enable blocking on session:', err);
        }
    }
    state.status = state.engineError ? 'error' : activeBundle ? 'active' : 'fallback';
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

/** Is this line a plain domain or hosts-file entry rather than full filter
 *  syntax? Cosmetic rules are checked first: `example.com##.ad` must not be
 *  read as the bare domain `example.com` (which would block the whole site). */
export function isDomainEntryLine(rawLine: string): boolean {
    const line = rawLine.trim();
    if (!line) return false;
    if (line.includes('##') || line.includes('#@') || line.includes('#?')) return false;
    const noComment = line.split('#')[0].trim();
    if (!noComment) return false;
    const parts = noComment.split(/\s+/);
    const candidate = parts.length > 1 ? parts[1] : parts[0];
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(candidate)) return false;
    if (parts.length === 1) return true;
    // Hosts-file syntax: the first field is an address. Anything else with two
    // fields is not a hosts entry and goes to the filter bucket.
    return /^(0\.0\.0\.0|127\.0\.0\.1|::|::1)$/i.test(parts[0]);
}

/** Split a user-supplied blocklist into domain entries (hosts-file or plain
 *  domains) and full uBlock/EasyList filter lines. Both forms are accepted so
 *  pointing the custom list at a real filter list actually does something. */
export function splitUserList(text: string): { domains: string[]; filterLines: string[] } {
    const domains: string[] = [];
    const filterLines: string[] = [];
    for (const rawLine of text.split(/\r?\n/)) {
        const trimmed = rawLine.trim();
        if (!trimmed) continue;
        // Hosts-style `# comment` lines are dropped outright; `!` comments are
        // left in the filter bucket where the parser ignores them, so pointing
        // the list at a real EasyList/uBO file keeps its headers intact.
        if (/^#\s/.test(trimmed)) continue;
        if (isDomainEntryLine(trimmed)) {
            domains.push(...parseBlocklist(trimmed));
        } else {
            filterLines.push(trimmed);
        }
    }
    return { domains, filterLines };
}

/** The same rule can arrive from both the domain bucket (`||d^`) and a
 *  full-syntax line in the user list; the engine stores rules by id, so drop
 *  duplicates before injection. */
function dedupeById<T extends { getId(): number }>(filters: T[]): T[] {
    const seen = new Set<number>();
    const out: T[] = [];
    for (const filter of filters) {
        const id = filter.getId();
        if (!seen.has(id)) {
            seen.add(id);
            out.push(filter);
        }
    }
    return out;
}

/** Rebuild the domain set from config. Safe to call on every settings save. */
export function configureFilter(config: FilterConfig): { count: number; error: string | null } {
    state.enabled = config.enabled;
    state.userListPath = config.userListPath;
    state.exceptions = normalizeFilterExceptions(config.exceptions);
    state.domains = new Set(config.enabled ? BUILTIN_BLOCKLIST : []);
    state.userFilterText = '';
    state.userListError = null;
    state.custom = { accepted: 0, rejected: 0, rejectedLines: [] };

    if (config.enabled && config.userListPath) {
        try {
            const text = readFileSync(config.userListPath, 'utf-8');
            if (Buffer.byteLength(text) > 8 * 1024 * 1024 || text.split('\n').length > 150_000) throw new Error('Custom list exceeds 8 MiB or 150,000 lines.');
            const { domains, filterLines } = splitUserList(text);
            state.custom = inspectCustomList(text);
            for (const domain of domains) {
                state.domains.add(domain);
            }
            state.userFilterText = filterLines.join('\n');
        } catch (e) {
            // A missing or unreadable custom list must not silently disable the
            // built-in one, and must be visible in Settings rather than only in
            // a log the user never opens.
            state.userListError = e instanceof Error ? e.message : String(e);
        }
    }

    void scheduleSync().catch(() => {});

    return { count: state.domains.size, error: state.userListError };
}

export function filterStats(): BrowserFilterStats {
    return {
        filters:
            state.bundledFilterCount +
            state.injectedNetworkFilterIds.length +
            state.injectedCosmeticFilterIds.length,
        domains: state.domains.size,
        blocked: state.blocked,
        error: state.userListError ?? state.engineError ?? state.bundledError,
        status: state.status, list: state.listInfo, custom: state.custom,
        exceptions: state.exceptions,
    };
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

    // WebRequest fallback listener for host matching and unit test
    // compatibility. Electron keeps a single webRequest listener per event per
    // session: re-registering here on every webview attach would replace the
    // Ghostery engine's own listener (registered once when blocking was first
    // enabled, and never again because enableBlockingInSession is idempotent),
    // leaving the session with a fallback that defers to a listener that no
    // longer exists. Register once per session and let the engine own the slot
    // afterwards.
    if (session?.webRequest?.onBeforeRequest && !state.fallbackSessions.has(session)) {
        state.fallbackSessions.add(session);
        session.webRequest.onBeforeRequest((details, callback) => {
            if (details.resourceType === 'mainFrame') {
                callback({ cancel: false });
                return;
            }
            if (!state.enabled || pausedRequest(details)) {
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

    void scheduleSync().catch(() => {});
}


export function inspectCustomList(text: string): BrowserCustomListInfo {
    let accepted = 0;
    const rejectedLines: number[] = [];
    let rejected = 0;
    for (const [index, raw] of text.split(/\r?\n/).entries()) {
        const line = raw.trim();
        if (!line || line.startsWith('!') || /^#(?:\s|$)/.test(line) || line.startsWith('[Adblock')) continue;
        const parsed = isDomainEntryLine(line) ? parseFilters(parseBlocklist(line).map(domain => `||${domain}^`).join('\n')) : parseFilters(line);
        if (parsed.networkFilters.length || parsed.cosmeticFilters.length) accepted += 1;
        else { rejected += 1; if (rejectedLines.length < 8) rejectedLines.push(index + 1); }
    }
    return { accepted, rejected, rejectedLines };
}

export async function checkBrowserFilterUpdate(): Promise<BrowserFilterUpdateReview> {
    if (checkingUpdate) throw new Error('A filter update check is already running.');
    checkingUpdate = true;
    pendingUpdate = null;
    try {
        const bundle = await fetchFilterUpdate();
        const engine = ElectronBlocker.parse(bundle.filters);
        engine.updateResources(bundle.resources, filterBundleHash(bundle));
        const { networkFilters, cosmeticFilters } = engine.getFilters();
        if (networkFilters.length < 50_000 || cosmeticFilters.length < 1_000) throw new Error('Filter update has too few supported rules.');
        const review = { reviewId: randomUUID(), revision: bundle.info.revision,
            fetchedAt: bundle.info.fetchedAt!, networkFilters: networkFilters.length,
            cosmeticFilters: cosmeticFilters.length, currentFilters: state.bundledFilterCount };
        pendingUpdate = { review, bundle, base: activeBundle ? filterBundleHash(activeBundle) : '' };
        return review;
    } finally { checkingUpdate = false; }
}

export async function applyBrowserFilterUpdate(reviewId: string): Promise<BrowserFilterStats> {
    const pending = pendingUpdate;
    if (!pending || pending.review.reviewId !== reviewId) throw new Error('Filter update review has expired. Check again.');
    pendingUpdate = null;
    const operation = syncQueue.then(async () => {
        if (pending.base !== (activeBundle ? filterBundleHash(activeBundle) : '')) throw new Error('Active lists changed since review. Check again.');
        // Prepare and validate before changing either the active engine or its durable record.
        const replacement = ElectronBlocker.parse(pending.bundle.filters);
        replacement.updateResources(pending.bundle.resources, filterBundleHash(pending.bundle));
        const previousRecord = await readFilterUpdate().catch(() => null);
        const previous = { engine: blockerInstance, bundle: activeBundle, info: state.listInfo,
            network: baseNetworkIds, cosmetic: baseCosmeticIds, count: state.bundledFilterCount,
            injectedNetwork: state.injectedNetworkFilterIds, injectedCosmetic: state.injectedCosmeticFilterIds };
        await saveFilterUpdate(pending.bundle);
        try {
            if (blockerInstance) for (const session of state.attachedSessions) {
                if (blockerInstance.isBlockingEnabled(session)) blockerInstance.disableBlockingInSession(session);
            }
            activeBundle = pending.bundle;
            state.listInfo = pending.bundle.info;
            blockerInstance = prepareBlocker(replacement);
            blockerInitPromise = Promise.resolve(blockerInstance);
            state.injectedNetworkFilterIds = []; state.injectedCosmeticFilterIds = [];
            state.bundledError = null;
            await syncBlockerState();
            if (state.status === 'error') throw new Error(state.engineError ?? 'Updated engine failed to attach.');
            return filterStats();
        } catch (error) {
            for (const session of state.attachedSessions) {
                if (replacement.isBlockingEnabled(session)) replacement.disableBlockingInSession(session);
            }
            blockerInstance = previous.engine; blockerInitPromise = null;
            activeBundle = previous.bundle; state.listInfo = previous.info;
            baseNetworkIds = previous.network; baseCosmeticIds = previous.cosmetic; state.bundledFilterCount = previous.count;
            state.injectedNetworkFilterIds = previous.injectedNetwork; state.injectedCosmeticFilterIds = previous.injectedCosmetic;
            if (previousRecord) await saveFilterUpdate(previousRecord); else await removeFilterUpdate();
            await syncBlockerState();
            throw error;
        }
    });
    syncQueue = operation.then(() => {}, () => {});
    return operation;
}
