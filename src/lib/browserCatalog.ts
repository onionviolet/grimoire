/**
 * Catalog of in-app browser shortcut destinations. Each entry declares what
 * KIND of destination it is (D-04): the download-capture trust boundary
 * (D-11, `browserDownloadCapture.ts`) and the kind-grouped shortcut rendering
 * both key off this field, never off a hardcoded URL match.
 *
 * Fork-only: this replaces the flat `SHORTCUTS` array that used to live
 * inline in `src/pages/Browser.tsx`.
 */

/** What a catalog entry can do. `tool` is the only kind whose downloads are
 *  ever captured into Grimoire's mod library (D-11); every other kind keeps
 *  today's open-externally behavior unchanged. */
export type BrowserDestinationKind = 'mod-host' | 'reference' | 'tool' | 'community-feed';

export interface BrowserDestination {
    label: string;
    url: string;
    kind: BrowserDestinationKind;
    /** Optional-adult flag. Orthogonal to `kind`: it answers "should this be
     *  shown" (Browse content preference), not "what can this do". */
    nsfw?: boolean;
}

/** Group display order for the kind-grouped shortcut rows (UI-SPEC
 *  Copywriting Contract: mod hosts first, Tools second since it is the
 *  capability this phase adds). */
export const KIND_ORDER: readonly BrowserDestinationKind[] = ['mod-host', 'tool', 'reference', 'community-feed'];

/**
 * The deliberately small set of useful, community-loved Deadlock stops this
 * page shortcuts to, rather than a general bookmark manager (D-05). Frozen so
 * no reader can ever observe a partially-populated catalog: there is no
 * asynchronous load to race against.
 */
export const BROWSER_DESTINATIONS: readonly BrowserDestination[] = Object.freeze([
    { label: 'GameBanana', url: 'https://gamebanana.com/games/20948', kind: 'mod-host' },
    { label: 'Deadlock Forge', url: 'https://deadlockforge.net/', kind: 'reference' },
    { label: 'Deadlock Wiki', url: 'https://deadlock.wiki/', kind: 'reference' },
    { label: 'deadlock-api', url: 'https://deadlock-api.com/', kind: 'reference' },
    { label: 'Deadlock.io', url: 'https://deadlock.io/', kind: 'reference' },
    { label: 'Deadlocker', url: 'https://www.deadlocker.gg/', kind: 'reference' },
    { label: 'r/DeadlockTheGame', url: 'https://www.reddit.com/r/DeadlockTheGame/', kind: 'community-feed' },
    { label: 'Deadlock Daily (memes)', url: 'https://www.deadlockdaily.com/', kind: 'community-feed' },
    { label: 'Goonlock (18+)', url: 'https://goonlock.com/', kind: 'community-feed', nsfw: true },
    { label: 'Pimp My Hideout', url: 'https://xkitkatcat.github.io/pimpmyhideout/', kind: 'tool' },
]);

/**
 * Resolves the Home destination's url by label lookup, never by array index,
 * so a future catalog reorder can never silently change what "home" means.
 * Throws when the named entry is absent rather than returning a fallback, so
 * a removal that orphans Home fails loudly at the call site instead of
 * sending Home to the wrong site. Exported (with `catalog`/`label` as
 * parameters) so the throw path is unit testable against a synthetic
 * catalog, without needing GameBanana removed from the real one.
 */
export function resolveHomeDestinationUrl(
    catalog: readonly BrowserDestination[],
    label: string = 'GameBanana'
): string {
    const home = catalog.find((destination) => destination.label === label);
    if (!home) throw new Error(`browserCatalog: no ${label} entry to anchor HOME_DESTINATION_URL`);
    return home.url;
}

/** The GameBanana entry's url. Resolved eagerly at import time so an
 *  orphaned Home (see `resolveHomeDestinationUrl`) fails at startup rather
 *  than at first navigation. */
export const HOME_DESTINATION_URL: string = resolveHomeDestinationUrl(BROWSER_DESTINATIONS);

/** Host (lowercased, leading `www.` stripped) and pathname of a URL, or null
 *  for an empty or unparseable input. Never a substring match on the raw
 *  string: everything goes through `new URL` first. */
function parsedForMatch(rawUrl: string): { host: string; pathname: string } | null {
    if (!rawUrl) return null;
    try {
        const parsed = new URL(rawUrl);
        return { host: parsed.hostname.toLowerCase().replace(/^www\./, ''), pathname: parsed.pathname };
    } catch {
        return null;
    }
}

/**
 * Resolve a live URL to its catalog entry. Matches by host (case-insensitive,
 * `www.` ignored); when more than one entry shares a host, the entry whose
 * pathname is the longest prefix of the visited pathname wins. Two matching
 * entries are never merged. `catalog` defaults to `BROWSER_DESTINATIONS`;
 * accepting it as a parameter is what lets the shared-host tie-break rule be
 * unit tested against synthetic entries without mutating the real catalog.
 */
export function destinationForUrl(
    url: string,
    catalog: readonly BrowserDestination[] = BROWSER_DESTINATIONS
): BrowserDestination | null {
    const visited = parsedForMatch(url);
    if (!visited) return null;

    let best: BrowserDestination | null = null;
    let bestPrefixLength = -1;
    for (const destination of catalog) {
        const entry = parsedForMatch(destination.url);
        if (!entry || entry.host !== visited.host) continue;
        if (!visited.pathname.startsWith(entry.pathname)) continue;
        if (entry.pathname.length > bestPrefixLength) {
            best = destination;
            bestPrefixLength = entry.pathname.length;
        }
    }
    return best;
}

/** The catalog `kind` for a live URL, or null when it matches no entry. */
export function destinationKindForUrl(
    url: string,
    catalog: readonly BrowserDestination[] = BROWSER_DESTINATIONS
): BrowserDestinationKind | null {
    return destinationForUrl(url, catalog)?.kind ?? null;
}

/**
 * Reproduces the nsfw-visibility predicate the shortcut row has always
 * applied: keep an entry unless it is nsfw and the mode is `hide`. `blur` and
 * any other mode leave the entry in the list (the blur styling is applied at
 * render time, not here).
 */
export function visibleDestinations(
    entries: readonly BrowserDestination[],
    nsfwMode: string | undefined
): BrowserDestination[] {
    return entries.filter((entry) => !entry.nsfw || nsfwMode !== 'hide');
}

/** One kind's entries, in the order they appear in `KIND_ORDER`. */
export interface BrowserDestinationGroup {
    kind: BrowserDestinationKind;
    entries: BrowserDestination[];
}

/**
 * Buckets `entries` by `kind`, walking `KIND_ORDER` so the result is always in
 * that fixed order regardless of the input array's own order. A kind with no
 * entries produces no group object at all: there is nothing for the caller to
 * special-case for an empty group. Within a group, entries keep their input
 * order; nothing here sorts, so declaration order in `BROWSER_DESTINATIONS`
 * is what determines render order. Safe to call on every render, including
 * with an already-grouped-and-reflattened input.
 */
export function groupDestinationsByKind(
    entries: readonly BrowserDestination[]
): BrowserDestinationGroup[] {
    const groups: BrowserDestinationGroup[] = [];
    for (const kind of KIND_ORDER) {
        const kindEntries = entries.filter((entry) => entry.kind === kind);
        if (kindEntries.length === 0) continue;
        groups.push({ kind, entries: kindEntries });
    }
    return groups;
}
