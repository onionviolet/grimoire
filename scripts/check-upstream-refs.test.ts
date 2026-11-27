import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, expect, test } from 'vitest';

const checker = fileURLToPath(new URL('./check-upstream-refs.mjs', import.meta.url));
const zero = '0'.repeat(40);
let repo: string;
let upstream: string;
let main: string;
let unsafe: string;
let clean: string;
let tag: string;
let tree: string;

function git(...args: string[]) {
  return execFileSync('git', ['-c', 'user.name=Grimoire Test', '-c', 'user.email=test@example.invalid', ...args], {
    cwd: repo, encoding: 'utf8', input: '',
  }).trim();
}

function commit(message: string, parent?: string) {
  return git('commit-tree', tree, '-m', message, ...(parent ? ['-p', parent] : []));
}

function update(localOid: string, remoteOid: string, ref = 'refs/heads/topic') {
  const localRef = localOid === zero ? '(delete)' : ref;
  return `${localRef} ${localOid} ${ref} ${remoteOid}\n`;
}

function checkPush(input: string) {
  return spawnSync(process.execPath, [checker, '--pre-push', 'origin'], {
    cwd: repo, encoding: 'utf8', input,
  });
}

beforeAll(() => {
  repo = mkdtempSync(join(tmpdir(), 'grimoire-refs-'));
  git('init', '-q', '--initial-branch=main', '--object-format=sha1');
  tree = git('mktree');
  upstream = commit('Upstream squash subject (#321)');
  git('update-ref', 'refs/remotes/upstream/main', upstream);
  main = commit('Already published on the default branch (#654)', upstream);
  git('update-ref', 'refs/remotes/origin/main', main);
  git('update-ref', 'refs/heads/main', main);
  unsafe = commit('Introduces a backlink (#456)', main);
  clean = commit('Clean successor', unsafe);
  git('tag', '--no-sign', '-am', 'Annotated release', 'release', unsafe);
  tag = git('rev-parse', 'refs/tags/release');
}, 60_000);

afterAll(() => {
  if (repo) rmSync(repo, { recursive: true, force: true });
});

test('checks a new branch tip while main is checked out', () => {
  const result = checkPush(update(unsafe, zero));
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('says #456');
  expect(result.stderr).not.toContain('says #654');
  expect(result.stderr).not.toContain('says #321');
}, 30_000);

test('checks only commits beyond the advertised old tip of an existing ref', () => {
  expect(checkPush(update(clean, unsafe)).status).toBe(0);
  expect(checkPush(update(clean, main)).stderr).toContain('says #456');
}, 30_000);

test('checks each update and ignores deletions and non-commit tags', () => {
  const harmless = update(zero, unsafe) + update(tree, zero, 'refs/tags/tree');
  expect(checkPush(harmless).status).toBe(0);
  expect(checkPush('').status).toBe(0);
  const result = checkPush(harmless + update(tag, zero, 'refs/tags/release')
    + update(clean, main, 'refs/heads/other'));
  expect(result.status).toBe(1);
  expect(result.stderr.match(/says #456/g)).toHaveLength(1);
}, 30_000);

test('scans the proposed history when the destination tip is absent locally', () => {
  const result = checkPush(update(clean, 'a'.repeat(40)));
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('says #456');
  expect(result.stderr).toContain('says #654');
  expect(result.stderr).not.toContain('says #321');
}, 30_000);
