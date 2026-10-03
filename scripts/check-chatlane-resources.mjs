import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const resourceRoot = resolve(repoRoot, 'resources', 'chatlane');
const required = ['base-commands.json', 'red2.bin', 'starter.yml', 'LICENSE', 'PROVENANCE.md'];
const missing = required.filter((name) => !existsSync(resolve(resourceRoot, name)));
const expectedHashes = {
  'base-commands.json': 'b72fdb471cc12a2bd1f10ea8966913a6defeace03e2a4c509161d9c9e73f6d84',
  'red2.bin': 'a423805a7bd4163a5559631398dae54c2ac9724956c9ab4ef2fe2f93ec43ca64',
};
const mismatches = Object.entries(expectedHashes).filter(([name, expected]) => {
  const path = resolve(resourceRoot, name);
  return existsSync(path) && createHash('sha256').update(readFileSync(path)).digest('hex') !== expected;
}).map(([name]) => name);

if (missing.length || mismatches.length) {
  console.error(`Native ChatLane resource check failed: ${[missing.length && `missing ${missing.join(', ')}`, mismatches.length && `unverified data ${mismatches.join(', ')}`].filter(Boolean).join('; ')}`);
  process.exitCode = 1;
} else {
  console.log('Native ChatLane resources verified for Windows, macOS and Linux. No external converter runtime required.');
}
