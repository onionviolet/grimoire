#!/usr/bin/env node
// Keep fork catalog/texture capabilities while carrying the checksumless-v2 fix.
// Only the build checkout changes; neither remote repository is written to.
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const READER_FIX = '4396ad7a00528ce3b70af9a7d7bb74ceac9b3747';
const engine = resolve(process.argv[2] ?? '../vpkmerge');
const git = (args, options = {}) => execFileSync('git', ['-C', engine, ...args], {
    encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...options,
});
git(['fetch', '--quiet', '--no-tags', 'https://github.com/Slush97/vpkmerge.git', READER_FIX]);
const patch = git(['show', '--format=', '--binary', READER_FIX, '--',
    'Cargo.toml', 'Cargo.lock', 'vendor/valve_pak', 'vpkmerge-core/tests/optional_checksums.rs']);
if (!patch.trim()) throw new Error('Pinned reader fix produced an empty patch');
try {
    git(['apply', '--reverse', '--check', '-'], { input: patch });
    console.log(`[patch-release-engine] reader fix already applied: ${READER_FIX}`);
} catch {
    git(['apply', '--check', '-'], { input: patch });
    git(['apply', '-'], { input: patch });
    console.log(`[patch-release-engine] applied pinned reader fix: ${READER_FIX}`);
}
