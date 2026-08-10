#!/usr/bin/env node
// Fetches the ad/tracker filter lists the in-app browser blocker ships with.
// The set mirrors exactly what @ghostery/adblocker's
// fromPrebuiltAdsAndTracking() would fetch over the network on first run, but
// pinned to the tag matching the installed package so each release is
// reproducible and the packaged app never depends on a runtime fetch (which
// is how blocking used to silently degrade to a ~40-domain list when the CDN
// was unreachable).
//
// Runs on postinstall when the files are missing and with `--refresh` as part
// of packaging so every release ships current lists.
//
// Output (gitignored, shipped via electron-builder extraResources):
//   resources/filters/filters.txt     - concatenated EasyList/EasyPrivacy/uBO lists
//   resources/filters/resources.json  - uBlock scriptlet resources
//   resources/filters/meta.json       - rule counts + provenance for the Settings card

import { mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { get as httpsGet } from 'node:https';
import { parseFilters } from '@ghostery/adblocker';

// Keep in sync with the installed @ghostery/adblocker version: bump both
// together so the runtime engine and the bundled lists come from the same
// asset generation. GHOSTERY_TAG is the git tag this fork's pinned package
// version was published from.
const GHOSTERY_TAG = 'v2.18.1';
const PREFIX = `https://raw.githubusercontent.com/ghostery/adblocker/${GHOSTERY_TAG}/packages/adblocker/assets`;

// Same subscription set as `adsAndTrackingLists` in
// node_modules/@ghostery/adblocker/dist/esm/fetch.js.
const LISTS = [
    'easylist/easylist.txt',
    'peter-lowe/serverlist.txt',
    'ublock-origin/badware.txt',
    'ublock-origin/filters-2020.txt',
    'ublock-origin/filters-2021.txt',
    'ublock-origin/filters-2022.txt',
    'ublock-origin/filters-2023.txt',
    'ublock-origin/filters-2024.txt',
    'ublock-origin/filters.txt',
    'ublock-origin/quick-fixes.txt',
    'ublock-origin/resource-abuse.txt',
    'ublock-origin/unbreak.txt',
    'easylist/easyprivacy.txt',
    'ublock-origin/privacy.txt',
];
const RESOURCES_URL = `${PREFIX}/ublock-origin/resources.json`;

const here = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(here, '..', 'resources', 'filters');
const refresh = process.argv.includes('--refresh');

// Every list in the set is tens of KB at minimum; EasyList alone is ~2 MB.
// These floors exist so a truncated or error-page response fails the build
// loudly instead of shipping a silently weak blocker.
const LIST_MIN_BYTES = 2_000;
const MIN_TOTAL_BYTES = 1_500_000;

function download(url) {
    return new Promise((resolvePromise, reject) => {
        const req = httpsGet(
            url,
            { headers: { 'User-Agent': 'grimoire-fetch-filter-lists' } },
            (res) => {
                if (res.statusCode && [301, 302, 303, 307, 308].includes(res.statusCode)) {
                    const next = res.headers.location;
                    res.resume();
                    if (!next) {
                        reject(new Error(`Redirect without Location from ${url}`));
                        return;
                    }
                    resolvePromise(download(new URL(next, url).href));
                    return;
                }
                if (res.statusCode !== 200) {
                    res.resume();
                    reject(new Error(`GET ${url} failed: HTTP ${res.statusCode}`));
                    return;
                }
                const chunks = [];
                res.on('data', (chunk) => chunks.push(chunk));
                res.on('end', () => resolvePromise(Buffer.concat(chunks).toString('utf-8')));
                res.on('error', reject);
            }
        );
        req.on('error', reject);
    });
}

async function exists(path) {
    try {
        await stat(path);
        return true;
    } catch {
        return false;
    }
}

async function main() {
    const filtersPath = join(OUT_DIR, 'filters.txt');
    const resourcesPath = join(OUT_DIR, 'resources.json');
    const metaPath = join(OUT_DIR, 'meta.json');

    if (!refresh && (await exists(filtersPath)) && (await exists(resourcesPath))) {
        console.log('[filter-lists] Bundled lists already present; pass --refresh to re-fetch.');
        return;
    }

    await mkdir(OUT_DIR, { recursive: true });

    const fetched = await Promise.all(
        LISTS.map(async (rel) => {
            const url = `${PREFIX}/${rel}`;
            const text = await download(url);
            if (text.length < LIST_MIN_BYTES) {
                throw new Error(`List ${url} looks truncated (${text.length} bytes).`);
            }
            return { rel, text };
        })
    );

    const resources = await download(RESOURCES_URL);
    try {
        JSON.parse(resources);
    } catch {
        throw new Error(`${RESOURCES_URL} is not valid JSON.`);
    }

    const header = [
        '! Grimoire bundled filter lists',
        `! Generated by scripts/fetch-filter-lists.mjs from ghostery/adblocker ${GHOSTERY_TAG}`,
        `! Fetched ${new Date().toISOString()}`,
    ];
    const parts = [header.join('\n')];
    for (const { rel, text } of fetched) {
        parts.push('', `! ===== ${rel} =====`, '');
        parts.push(text.trimEnd());
    }
    const filtersText = `${parts.join('\n').trimEnd()}\n`;
    if (filtersText.length < MIN_TOTAL_BYTES) {
        throw new Error(`Concatenated filters look truncated (${filtersText.length} bytes).`);
    }

    const { networkFilters, cosmeticFilters } = parseFilters(filtersText);
    const meta = {
        tag: GHOSTERY_TAG,
        fetchedAt: new Date().toISOString(),
        sources: [...LISTS.map((rel) => `${PREFIX}/${rel}`), RESOURCES_URL],
        networkFilters: networkFilters.length,
        cosmeticFilters: cosmeticFilters.length,
    };

    await Promise.all([
        writeFile(filtersPath, filtersText, 'utf-8'),
        writeFile(resourcesPath, resources, 'utf-8'),
        writeFile(metaPath, `${JSON.stringify(meta, null, 2)}\n`, 'utf-8'),
    ]);

    const kb = (bytes) => `${(bytes / 1024).toFixed(0)} KB`;
    console.log(
        `[filter-lists] Bundled ${LISTS.length} lists (${kb(filtersText.length)} filters, ` +
            `${kb(resources.length)} resources): ${meta.networkFilters} network + ` +
            `${meta.cosmeticFilters} cosmetic rules.`
    );
}

main().catch((err) => {
    console.error('[filter-lists] Failed to fetch bundled filter lists:', err);
    process.exit(1);
});
