#!/usr/bin/env node
// Fetches the stock upstream Slush97/vpkmerge v0.19.0 release asset. That is
// deliberate: this script's only job is to give a developer machine a
// working binary after `pnpm install`, nothing more. Runs as a postinstall
// step via electron-builder's extraResources so a dev build can package
// vpkmerge alongside the Electron app.
//
// The packaged release gets the fork engine a different way:
// `.github/workflows/release.yml` checks out `onionviolet/vpkmerge` at a
// pinned commit SHA, runs `cargo build` against it, then
// `pnpm use-local-vpkmerge` overwrites whatever this script fetched with
// that build before packaging.
//
// The stock asset predates the fork's YCoCg icon fix, so
// `electron/main/services/foundryTextureReplace.ts` refuses texture
// replacement against it rather than producing wrong colours. This script
// deletes the `.ycocg-icon-safe` marker on every install (see below) so a
// stock binary can never inherit a local build's attestation.
//
// Promoting a checksum-pinned `onionviolet/vpkmerge` release into the
// ASSETS table below remains future work this phase decided not to start;
// see D-02 in docs/fork-maintenance.md.
//
// Pinned to a specific vpkmerge release tag so a vpkmerge release doesn't
// silently change grimoire's behavior. Bump VPKMERGE_VERSION and the matching
// EXPECTED_SHA256 values together.

import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { chmod, mkdir, readFile, rm, stat, unlink } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { get as httpsGet } from 'node:https';
import { pipeline } from 'node:stream/promises';

const VPKMERGE_VERSION = 'v0.19.0';

const ASSETS = {
    'linux-x64':  { name: 'vpkmerge-linux-x86_64',      sha256: 'fc33ee3ea6ea551fb5866e0077effb725da16e935eab07c1a2a407f10028a92c' },
    'darwin-arm64': { name: 'vpkmerge-macos-aarch64',    sha256: '418f650dd6afff9228d8fa9c289bb1a4a01488191bb54636b69aaca0c4f8be28' },
    'win32-x64':  { name: 'vpkmerge-windows-x86_64.exe', sha256: '7c85e2e5830621e4a6cd4dea848cb23b57fa0272b87e044e59a571424e9d52d0' },
};

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '..', 'resources', 'vpkmerge');

function platformKey() {
    return `${process.platform}-${process.arch}`;
}

function downloadUrl(assetName) {
    return `https://github.com/Slush97/vpkmerge/releases/download/${VPKMERGE_VERSION}/${assetName}`;
}

async function sha256File(path) {
    const hash = createHash('sha256');
    hash.update(await readFile(path));
    return hash.digest('hex');
}

async function fileExistsWithHash(path, expected) {
    try {
        await stat(path);
    } catch {
        return false;
    }
    const actual = await sha256File(path);
    return actual === expected;
}

function download(url, destPath, redirectsLeft = 5) {
    return new Promise((resolve, reject) => {
        const req = httpsGet(url, { headers: { 'User-Agent': 'grimoire-fetch-vpkmerge' } }, (res) => {
            if (res.statusCode && [301, 302, 303, 307, 308].includes(res.statusCode)) {
                if (redirectsLeft <= 0) {
                    reject(new Error(`Too many redirects fetching ${url}`));
                    return;
                }
                const next = res.headers.location;
                res.resume();
                if (!next) {
                    reject(new Error(`Redirect from ${url} had no Location header`));
                    return;
                }
                resolve(download(next, destPath, redirectsLeft - 1));
                return;
            }
            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode} fetching ${url}`));
                res.resume();
                return;
            }
            const out = createWriteStream(destPath);
            pipeline(res, out).then(resolve).catch(reject);
        });
        req.on('error', reject);
    });
}

async function main() {
    const key = platformKey();
    const asset = ASSETS[key];
    if (!asset) {
        console.warn(`[fetch-vpkmerge] No vpkmerge binary published for ${key}; skipping. Mod merging will be unavailable on this platform.`);
        return;
    }

    await mkdir(outDir, { recursive: true });
    const destPath = join(outDir, asset.name);

    // LOCAL BUILD GUARD (fork-only concern, but harmless upstream).
    // `pnpm use-local-vpkmerge` drops a `.local-build` marker beside the binary.
    // Without this check, any `pnpm install` re-fetches the pinned release over
    // that local engine, and the resulting package loses whatever unreleased
    // verbs it carried (for this fork: `catalog globalsounds`, so the Global
    // sounds tab errors). The break surfaces one command later than its cause,
    // during packaging or at runtime, which makes it expensive to diagnose.
    // Skipping is the safe default: a stale local engine is visible in the
    // Settings engine card, an overwritten one is not.
    try {
        await stat(join(outDir, '.local-build'));
        console.log(
            `[fetch-vpkmerge] ${asset.name} is a local build (.local-build marker present); leaving it alone.\n` +
                `  Run \`pnpm fetch-vpkmerge\` after deleting that marker to restore the pinned ${VPKMERGE_VERSION} release.`
        );
        return;
    } catch {
        // No marker: normal pinned-release behaviour below.
    }

    if (await fileExistsWithHash(destPath, asset.sha256)) {
        await rm(join(outDir, '.ycocg-icon-safe'), { force: true });
        console.log(`[fetch-vpkmerge] ${asset.name} already present and matches sha256; skipping download.`);
        return;
    }

    const url = downloadUrl(asset.name);
    console.log(`[fetch-vpkmerge] Downloading ${VPKMERGE_VERSION}/${asset.name}`);
    const tempPath = `${destPath}.partial`;
    try {
        await download(url, tempPath);
        const actual = await sha256File(tempPath);
        if (actual !== asset.sha256) {
            throw new Error(
                `sha256 mismatch for ${asset.name}: expected ${asset.sha256}, got ${actual}. Refusing to install possibly tampered binary.`
            );
        }
        const { rename } = await import('node:fs/promises');
        await rename(tempPath, destPath);
        // A restored pinned release must not inherit the fork-only YCoCg
        // capability marker. The Foundry replacement guard treats this marker
        // as an explicit packaging attestation.
        await rm(join(outDir, '.ycocg-icon-safe'), { force: true });
        if (process.platform !== 'win32') {
            await chmod(destPath, 0o755);
        }
        console.log(`[fetch-vpkmerge] Installed ${asset.name} to ${destPath}`);
    } catch (err) {
        try { await unlink(tempPath); } catch { /* ignore */ }
        throw err;
    }
}

main().catch((err) => {
    console.error(`[fetch-vpkmerge] FAILED: ${err.message}`);
    process.exit(1);
});
