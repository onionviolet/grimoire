import { describe, expect, it } from 'vitest';
import { BROWSER_DESTINATIONS } from './browserCatalog';

// This suite makes real outbound HTTP requests against every third-party host
// in the catalog, plus two wiki-domain candidates. It must never run as part
// of the default `pnpm test` invocation or CI, because those sites' uptime is
// outside this repo's control and the default gate must stay green on this
// repo's own correctness, not on nine strangers' servers. It only runs when a
// human deliberately opts in via GRIMOIRE_CHECK_DESTINATIONS, to produce (or
// refresh) the dated record in docs/browser-destinations.md. It imports
// BROWSER_DESTINATIONS directly from ./browserCatalog rather than keeping its
// own URL list, so the probe and the app can never disagree about which
// destinations exist.
const shouldRun = Boolean(process.env.GRIMOIRE_CHECK_DESTINATIONS);

const PROBE_TIMEOUT_MS = 15_000;
const TITLE_BYTE_BUDGET = 8192;

// The two hosts REQ-browser-tool-catalog asks to be checked against each
// other. Declared once so the URL scheme literal appears in exactly these
// two places, and every other reference below reuses these constants.
const DEADLOCKED_WIKI_URL = 'https://deadlocked.wiki/';
const DEADLOCK_WIKI_URL = 'https://deadlock.wiki/';

interface ProbeResult {
    status: number | null;
    finalUrl: string | null;
    title: string | null;
    hostChanged: boolean | null;
    error: string | null;
}

/** Reads at most `maxBytes` of a response body and decodes it as text.
 *  Streaming rather than `response.text()` so a large or slow-loading page
 *  never costs more than a small, bounded read just to find its <title>. */
async function firstBytes(response: Response, maxBytes: number): Promise<string> {
    if (!response.body) return '';
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let result = '';
    let received = 0;
    try {
        while (received < maxBytes) {
            const { done, value } = await reader.read();
            if (done) break;
            received += value.byteLength;
            result += decoder.decode(value, { stream: true });
        }
    } finally {
        // Best-effort: the body may already be fully consumed or the
        // connection already closed by the time we get here.
        reader.cancel().catch(() => {});
    }
    return result;
}

/** Non-greedy <title> extraction against a bounded HTML prefix. Returns null
 *  rather than an empty string when no title tag is present at all, so a
 *  missing title and an empty title are distinguishable in the record. */
function extractTitle(html: string): string | null {
    const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
    return match ? match[1].trim() : null;
}

function hostOf(url: string): string | null {
    try {
        return new URL(url).hostname.toLowerCase();
    } catch {
        return null;
    }
}

async function probe(requestedUrl: string): Promise<ProbeResult> {
    try {
        const response = await fetch(requestedUrl, {
            redirect: 'follow',
            signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
        });
        const body = await firstBytes(response, TITLE_BYTE_BUDGET);
        const requestedHost = hostOf(requestedUrl);
        const finalHost = hostOf(response.url);
        return {
            status: response.status,
            finalUrl: response.url,
            title: extractTitle(body),
            hostChanged: requestedHost !== null && finalHost !== null ? requestedHost !== finalHost : null,
            error: null,
        };
    } catch (err) {
        return {
            status: null,
            finalUrl: null,
            title: null,
            hostChanged: null,
            error: err instanceof Error ? err.message : String(err),
        };
    }
}

/** Prints one fixed-width, markdown-table-row-shaped line per probe, so the
 *  run's stdout can be transcribed directly into
 *  docs/browser-destinations.md without re-typing any of it. */
function printRow(label: string, kind: string, requestedUrl: string, result: ProbeResult): void {
    const status = result.status !== null ? String(result.status) : `ERROR: ${result.error ?? 'unknown'}`;
    const finalUrl = result.finalUrl ?? '-';
    const title = result.title ?? '-';
    const hostChanged = result.hostChanged === null ? '-' : String(result.hostChanged);
    console.log(`| ${label} | ${kind} | ${requestedUrl} | ${status} | ${finalUrl} | ${title} | ${hostChanged} |`);
}

describe.skipIf(!shouldRun)('browser destination reachability (opt-in via GRIMOIRE_CHECK_DESTINATIONS)', () => {
    for (const destination of BROWSER_DESTINATIONS) {
        it(
            `probes ${destination.label} (${destination.url})`,
            async () => {
                const result = await probe(destination.url);
                printRow(destination.label, destination.kind, destination.url, result);
                // The point of this run is the record it prints, not a
                // pass/fail gate: the only thing asserted is that an entry
                // the catalog still lists resolved at all and came back
                // under 400. A failure here is exactly the signal
                // docs/browser-destinations.md needs to propose "remove".
                expect(result.error, `${destination.label} (${destination.url}) failed: ${result.error}`).toBeNull();
                expect(result.status).toBeLessThan(400);
            },
            PROBE_TIMEOUT_MS + 5_000
        );
    }

    it(
        'checks deadlocked.wiki against deadlock.wiki (REQ-browser-tool-catalog)',
        async () => {
            const deadlocked = await probe(DEADLOCKED_WIKI_URL);
            const deadlock = await probe(DEADLOCK_WIKI_URL);
            printRow('deadlocked.wiki', 'reference', DEADLOCKED_WIKI_URL, deadlocked);
            printRow('deadlock.wiki', 'reference', DEADLOCK_WIKI_URL, deadlock);
            // Deliberately no assertion here: the whole point of this probe
            // pair is that neither answer is assumed. The printed rows are
            // the evidence docs/browser-destinations.md records.
        },
        (PROBE_TIMEOUT_MS + 5_000) * 2
    );
});
