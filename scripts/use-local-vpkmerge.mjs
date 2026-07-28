// Fork-engine packaging. This repository deliberately consumes the sibling
// onionviolet/vpkmerge checkout while its fork-only engine changes await a
// published fork release.
//
// Copies the sibling `../vpkmerge` release build into `resources/vpkmerge/`,
// so a packaged app ships OUR engine instead of the pinned upstream release.
//
// Why this is needed: the Foundry's Global sounds tab calls
// `vpkmerge catalog globalsounds`, which the pinned v0.19.0 binary does not
// have, so a packaged build without this step shows an error in that tab.
// `pnpm dev` does not need it (modMerger.ts auto-detects the sibling build),
// but `electron-builder` packages whatever sits in resources/.
//
// This also writes a `.local-build` marker beside the binary (see the bottom of
// this file). `postinstall` (fetch-vpkmerge.mjs) checks for that marker and
// leaves the copy alone, so a later `pnpm install` no longer clobbers it. To go
// back to the pinned release, delete the marker and run `pnpm fetch-vpkmerge`.
//
// Packaging is therefore just:
//
//     pnpm use-local-vpkmerge && pnpm package:win
//
// Once onionviolet/vpkmerge publishes a pinned release containing these engine
// changes, replace this packaging step with that release's verified assets.

import { copyFile, mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const ASSET_NAME = {
    win32: 'vpkmerge-windows-x86_64.exe',
    linux: 'vpkmerge-linux-x86_64',
    darwin: 'vpkmerge-macos-aarch64',
}[process.platform];

if (!ASSET_NAME) {
    console.error(`[use-local-vpkmerge] unsupported platform ${process.platform}`);
    process.exit(1);
}

const built = resolve(
    root,
    '..',
    'vpkmerge',
    'target',
    'release',
    process.platform === 'win32' ? 'vpkmerge.exe' : 'vpkmerge'
);
const dest = join(root, 'resources', 'vpkmerge', ASSET_NAME);

try {
    await stat(built);
} catch {
    console.error(
        `[use-local-vpkmerge] no local build at ${built}\n` +
            `  Build it first:\n` +
            `    cd ../vpkmerge && cargo build --release -p vpkmerge-cli\n` +
            `  (on Windows the msvc toolchain is required:\n` +
            `    cargo +stable-x86_64-pc-windows-msvc build --release -p vpkmerge-cli)`
    );
    process.exit(1);
}

await mkdir(dirname(dest), { recursive: true });
await copyFile(built, dest);

// Marker that tells postinstall (fetch-vpkmerge.mjs) to leave this copy alone.
// Without it, ANY `pnpm install` re-fetches the sha-pinned upstream release over
// the local build, silently producing a packaged app whose Global sounds tab
// errors because the pinned engine has no `catalog globalsounds`. The failure
// arrives one command later than its cause, which is the worst kind.
// Delete this file (or run `pnpm fetch-vpkmerge`) to go back to the pin.
await writeFile(
    join(dirname(dest), '.local-build'),
    `${built}\n${new Date().toISOString()}\n`
);
// This fork build also carries the YCoCg encode fix used by Foundry's icon
// replacement path. Keep a separate capability marker: the stock release can
// otherwise produce garbled colours for a mixed subset of item icons.
await writeFile(join(dirname(dest), '.ycocg-icon-safe'), `${built}\n`);

console.log(`[use-local-vpkmerge] ${built}\n  -> ${dest}`);
console.log('[use-local-vpkmerge] marked local; postinstall will not overwrite it.');
