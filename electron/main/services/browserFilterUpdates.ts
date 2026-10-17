import { createHash, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';
import { githubRateLimiter } from './rateLimiter';
import type { BrowserFilterListInfo } from '../../../src/types/browserFilter';

export const FILTER_ASSETS = [
    'easylist/easylist.txt', 'peter-lowe/serverlist.txt',
    'ublock-origin/badware.txt', 'ublock-origin/filters-2020.txt',
    'ublock-origin/filters-2021.txt', 'ublock-origin/filters-2022.txt',
    'ublock-origin/filters-2023.txt', 'ublock-origin/filters-2024.txt',
    'ublock-origin/filters.txt', 'ublock-origin/quick-fixes.txt',
    'ublock-origin/resource-abuse.txt', 'ublock-origin/unbreak.txt',
    'easylist/easyprivacy.txt', 'ublock-origin/privacy.txt',
];
export interface BrowserFilterBundle {
    filters: string;
    resources: string;
    info: BrowserFilterListInfo;
}
const updatePath = () => join(app.getPath('userData'), 'browser-filter-update.json');
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_BUNDLE_BYTES = 24 * 1024 * 1024;

export function filterBundleHash(bundle: BrowserFilterBundle): string {
    return createHash('sha256').update(bundle.filters).update('\0').update(bundle.resources).digest('hex');
}

export async function readFilterUpdate(): Promise<BrowserFilterBundle | null> {
    try {
        if ((await fs.stat(updatePath())).size > MAX_BUNDLE_BYTES) throw new Error('Stored filter update exceeds the size limit.');
        const record = JSON.parse(await fs.readFile(updatePath(), 'utf8'));
        const bundle = record.bundle as BrowserFilterBundle;
        if (!bundle || typeof bundle.filters !== 'string' || typeof bundle.resources !== 'string'
            || !/^[a-f0-9]{40}$/.test(bundle.info?.revision) || bundle.info.source !== 'updated'
            || typeof bundle.info.fetchedAt !== 'string' || !Number.isFinite(Date.parse(bundle.info.fetchedAt))
            || record.sha256 !== filterBundleHash(bundle)) throw new Error('Stored filter update is invalid.');
        JSON.parse(bundle.resources);
        return bundle;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw error;
    }
}

/** One atomic replacement. Failed downloads/validation never reach this writer. */
export async function saveFilterUpdate(bundle: BrowserFilterBundle): Promise<void> {
    const path = updatePath();
    const staging = `${path}.${randomUUID()}.tmp`;
    try {
        const text = JSON.stringify({ sha256: filterBundleHash(bundle), bundle });
        if (Buffer.byteLength(text) > MAX_BUNDLE_BYTES) throw new Error('Stored filter update exceeds the size limit.');
        await fs.writeFile(staging, text, { flag: 'wx' });
        await fs.rename(staging, path);
    } finally {
        await fs.rm(staging, { force: true });
    }
}

export async function removeFilterUpdate(): Promise<void> {
    await fs.rm(updatePath(), { force: true });
}

async function downloadText(url: string, fetcher: typeof fetch): Promise<string> {
    await githubRateLimiter.acquire();
    const response = await fetcher(url, {
        headers: { 'User-Agent': 'Grimoire-filter-update', Accept: 'application/vnd.github+json' },
        signal: AbortSignal.timeout(20_000), redirect: 'error',
    });
    if (!response.ok) throw new Error(`Filter source returned HTTP ${response.status}.`);
    if (!response.body) throw new Error('Filter source returned an empty body.');
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
        for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            bytes += value.byteLength;
            if (bytes > MAX_FILE_BYTES) throw new Error('Filter source exceeds the size limit.');
            chunks.push(value);
        }
    } finally {
        await reader.cancel();
    }
    return Buffer.concat(chunks).toString('utf8');
}

/** Called only by Check for updates. Resolve once, then use immutable URLs. */
export async function fetchFilterUpdate(fetcher: typeof fetch = fetch): Promise<BrowserFilterBundle> {
    const commit = JSON.parse(await downloadText('https://api.github.com/repos/ghostery/adblocker/commits/master', fetcher));
    if (!/^[a-f0-9]{40}$/.test(commit.sha)) throw new Error('Filter source did not return a commit revision.');
    const prefix = `https://raw.githubusercontent.com/ghostery/adblocker/${commit.sha}/packages/adblocker/assets`;
    const parts: string[] = [];
    let bytes = 0;
    // Sequential requests respect the shared limiter rather than starting a burst.
    for (const asset of FILTER_ASSETS) {
        const text = await downloadText(`${prefix}/${asset}`, fetcher);
        if (text.length < 2_000 || /^\s*</.test(text)) throw new Error(`Filter asset ${asset} is truncated or invalid.`);
        bytes += Buffer.byteLength(text);
        if (bytes > MAX_BUNDLE_BYTES / 2) throw new Error('Filter update exceeds the size limit.');
        parts.push(`! ${asset}\n${text}`);
    }
    if (bytes < 1_500_000) throw new Error('Filter update is incomplete.');
    const resources = await downloadText(`${prefix}/ublock-origin/resources.json`, fetcher);
    JSON.parse(resources);
    return { filters: parts.join('\n'), resources,
        info: { revision: commit.sha, fetchedAt: new Date().toISOString(), source: 'updated' } };
}
