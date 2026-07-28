// Fails the install early, and readably, when the sibling grimoire-social
// checkout is missing.
//
// Why this exists: package.json declares `@grimoire/social-types` as
// `workspace:*`, and pnpm-lock.yaml resolves it to
// `link:../grimoire-social/packages/social-types`. There is no
// pnpm-workspace.yaml, so nothing tells pnpm to *verify* that path. On a clean
// clone `pnpm install` therefore prints "Done" and exits 0, having created a
// symlink that points at nothing. The failure only surfaces later as ~25
// TypeScript errors, of which 4 are the real cause (TS2307 "Cannot find module
// '@grimoire/social-types'") and the rest are implicit-any noise cascading from
// them. Nothing in that output says "clone a second repo".
//
// Wired as `preinstall` so the message lands before the useless install rather
// than after it. CI already checks both repos out side by side, so this passes
// there unchanged.
//
// Run standalone with: node scripts/check-sibling-repos.mjs

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));

/** Sibling checkouts this repo resolves packages from, relative to the repo root. */
const SIBLINGS = [
    {
        // Must match the `link:` target in pnpm-lock.yaml.
        path: '../grimoire-social/packages/social-types',
        package: '@grimoire/social-types',
        repo: 'https://github.com/Slush97/grimoire-social.git',
        // The shared package declares zod as a peer dep and resolves it from
        // its OWN node_modules, so the sibling needs its own install too.
        needsOwnInstall: true,
    },
];

const missing = SIBLINGS.filter((s) => !existsSync(join(root, s.path, 'package.json')));

if (missing.length > 0) {
    const lines = ['', 'Missing sibling repository checkout.', ''];
    for (const s of missing) {
        lines.push(
            `  ${s.package} is a workspace dependency resolved from:`,
            `    ${resolve(root, s.path)}`,
            '  ...which does not exist. Clone it next to this repo:',
            '',
            `    cd ${resolve(root, '..')}`,
            `    git clone ${s.repo}`,
            ...(s.needsOwnInstall ? ['    cd grimoire-social && pnpm install'] : []),
            ''
        );
    }
    lines.push(
        'Then re-run pnpm install here. Without it, install "succeeds" but',
        'typecheck and build fail with unresolved-module errors.',
        ''
    );
    console.error(lines.join('\n'));
    process.exit(1);
}
