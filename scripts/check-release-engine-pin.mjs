// Guards the release workflow's forked-engine checkout against silently
// becoming a moving ref, and against the packaging step outrunning the
// bundling step that puts the fork's engine into the shipped artifact.
//
// `.github/workflows/release.yml` checks out `onionviolet/vpkmerge`, builds
// it with cargo, and bundles the result via `pnpm use-local-vpkmerge` before
// `electron-builder` packages the app (see D-02, docs/fork-maintenance.md).
// That pipeline only does what it claims to do if three things stay true:
//
//   1. the `onionviolet/vpkmerge` checkout is pinned to a full 40-character
//      commit SHA, never a branch or tag. A moving ref means a release build
//      is not reproducible, and whoever controls that branch controls what
//      ships in the next tagged release.
//   2. the `pnpm use-local-vpkmerge` bundling step runs before the
//      `electron-builder` packaging step. Bundling after packaging would
//      still produce a build, but it would ship the stock vpkmerge binary
//      while the workflow log claims the fork engine was bundled.
//   3. `scripts/use-local-vpkmerge.mjs` still writes both the `.local-build`
//      and `.ycocg-icon-safe` marker files. `foundryTextureReplace.ts`
//      trusts the second one as its capability attestation; if the script
//      stops writing it, a packaged fork build would silently lose the
//      YCoCg icon-safety check it depends on.
//
// Plain node, no dependencies. Exits non-zero with a specific message naming
// what failed. Run with: pnpm engine-pin:check

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));

const WORKFLOW_PATH = resolve(root, '.github', 'workflows', 'release.yml');
const USE_LOCAL_VPKMERGE_PATH = resolve(root, 'scripts', 'use-local-vpkmerge.mjs');

const FORK_REPO = 'onionviolet/vpkmerge';
const FULL_SHA_RE = /^[0-9a-f]{40}$/;

function fail(message) {
  console.error(`[check-release-engine-pin] FAILED: ${message}`);
  process.exitCode = 1;
}

function findForkVpkmergePin(workflowText) {
  const lines = workflowText.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    if (!lines[i].includes(`repository: ${FORK_REPO}`)) continue;
    // The `ref:` for this checkout step lives on a nearby line within the
    // same step block (a `with:` mapping under one `- uses: actions/checkout@...`
    // step). Scan forward until the next step boundary (`- name:`) or a
    // generous line budget, so unrelated formatting does not defeat this.
    for (let j = i + 1; j < Math.min(i + 15, lines.length); j += 1) {
      if (/^\s*-\s*name:/.test(lines[j])) break;
      const refMatch = lines[j].match(/^\s*ref:\s*['"]?([^'"\s#]+)['"]?/);
      if (refMatch) {
        return { ref: refMatch[1], lineIndex: i };
      }
    }
    return { ref: null, lineIndex: i };
  }
  return null;
}

function findLineIndex(lines, predicate) {
  for (let i = 0; i < lines.length; i += 1) {
    if (predicate(lines[i])) return i;
  }
  return -1;
}

function main() {
  let workflowText;
  try {
    workflowText = readFileSync(WORKFLOW_PATH, 'utf8');
  } catch (err) {
    fail(`could not read ${WORKFLOW_PATH}: ${err.message}`);
    return;
  }

  // Invariant 1: the fork checkout exists and is pinned to a full commit SHA.
  const pin = findForkVpkmergePin(workflowText);
  if (!pin) {
    fail(
      `no checkout step in release.yml names "repository: ${FORK_REPO}". ` +
        'The release workflow must check out the forked engine explicitly.'
    );
    return;
  }
  if (!pin.ref || !FULL_SHA_RE.test(pin.ref)) {
    fail(
      `the ${FORK_REPO} checkout's ref is "${pin.ref ?? '(none found)'}", not a full 40-character ` +
        'commit SHA. A moving ref (a branch or tag) means a release build is not reproducible, ' +
        'and whoever controls that ref controls what ships in the next tagged release. ' +
        'Pin it to a full commit SHA.'
    );
    return;
  }

  // Invariant 2: bundling the local build happens before packaging, so the
  // fork engine actually ends up in the shipped artifact.
  const lines = workflowText.split(/\r?\n/);
  const useLocalIndex = findLineIndex(lines, (l) => l.includes('pnpm use-local-vpkmerge'));
  const builderIndex = findLineIndex(lines, (l) => l.includes('electron-builder') && l.includes('--win'));
  if (useLocalIndex === -1) {
    fail('release.yml no longer runs "pnpm use-local-vpkmerge"; the fork engine would never be bundled.');
    return;
  }
  if (builderIndex === -1) {
    fail('release.yml no longer runs an electron-builder --win packaging step.');
    return;
  }
  if (useLocalIndex > builderIndex) {
    fail(
      'the "pnpm use-local-vpkmerge" bundling step runs after the electron-builder packaging step. ' +
        'Bundling after packaging ships the stock vpkmerge binary while the workflow log still claims ' +
        'the fork engine was bundled. Move the bundling step earlier.'
    );
    return;
  }

  // Invariant 3: the marker writes electron/main/services/foundryTextureReplace.ts
  // relies on are still present in use-local-vpkmerge.mjs.
  let useLocalText;
  try {
    useLocalText = readFileSync(USE_LOCAL_VPKMERGE_PATH, 'utf8');
  } catch (err) {
    fail(`could not read ${USE_LOCAL_VPKMERGE_PATH}: ${err.message}`);
    return;
  }
  for (const marker of ['.local-build', '.ycocg-icon-safe']) {
    if (!useLocalText.includes(marker)) {
      fail(
        `scripts/use-local-vpkmerge.mjs no longer writes the "${marker}" marker. ` +
          'electron/main/services/foundryTextureReplace.ts trusts this marker as its capability ' +
          'attestation; removing the write would silently disable that check for a packaged fork build.'
      );
      return;
    }
  }

  console.log(`[check-release-engine-pin] OK: ${FORK_REPO} pinned to ${pin.ref}`);
}

main();
