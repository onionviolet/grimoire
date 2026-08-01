// Fails on commit messages that would create a backlink in the upstream repo.
//
// This repository is the fork onionviolet/grimoire. Upstream (Slush97/grimoire)
// is read-only. GitHub does not respect that boundary on its own: a fork commit
// whose message says "#261" or links a github.com upstream issue makes GitHub
// post a "referenced"/"cross-referenced" entry in the upstream timeline, under
// this account's name. It looks like we commented there. We did not.
//
// That already happened: upstream 261 carries a reference from 826f66a, and
// upstream 313/324/326 carry one from the c2184d4 absorb-merge. The events are
// permanent. Editing the referencing text afterwards does NOT remove them (that
// was measured, not assumed), which is the whole reason this runs before the
// message is committed rather than after.
//
// What is safe:
//   - repository files (docs/, comments, this file). GitHub builds timeline
//     backlinks from conversation and commit-message text, not file contents.
//   - anything inside backticks. Code spans are not autolinked, which is why
//     the `... (#113)` quoted commit title in fork issue 13 never linked
//     upstream while the bare #326 two lines down did.
//   - https://redirect.github.com/<owner>/<repo>/issues/<n>, which GitHub
//     documents as the way to point at an issue without generating a backlink.
//
// Run with: pnpm refs:check                    (unpushed commits)
//           node scripts/check-upstream-refs.mjs --message-file <path>
//           node scripts/check-upstream-refs.mjs --range <rev-range>

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const UPSTREAM_SLUG = 'Slush97/grimoire';

// Bare "#n" resolves against whichever repository renders it, so the number
// alone cannot say who it means. This fork's own issues are two digits; every
// upstream number that has ever caused a backlink here is three. The floor is
// the whole heuristic: raise it (and this comment) when fork issue numbers get
// within striking distance of it, or the gate starts rejecting our own refs.
const UPSTREAM_NUMBER_FLOOR = 100;

const args = process.argv.slice(2);
const messageFile = valueOf('--message-file');
const range = valueOf('--range');

function valueOf(flag) {
  const i = args.indexOf(flag);
  return i === -1 ? null : args[i + 1];
}

function git(...argv) {
  return execFileSync('git', argv, { encoding: 'utf8' });
}

function hasRef(ref) {
  try {
    git('rev-parse', '--verify', '--quiet', ref);
    return true;
  } catch {
    return false;
  }
}

// Strip what GitHub will not autolink, so the scan sees only live references.
function stripInert(text) {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`\n]*`/g, ' ')
    .replace(/https:\/\/redirect\.github\.com\/\S*/g, ' ');
}

const RULES = [
  {
    id: 'upstream-url',
    test: /https?:\/\/(?:www\.)?github\.com\/Slush97\/[\w.-]+\/(?:issues|pull|discussions)\/(\d+)/gi,
    describe: (m) =>
      `links ${m[0]} (a github.com upstream URL backlinks the upstream timeline)`,
    fix: (m) => `https://redirect.github.com/${UPSTREAM_SLUG}/issues/${m[1]}`,
  },
  {
    id: 'cross-repo-ref',
    test: /\bSlush97\/[\w.-]+#(\d+)\b/g,
    describe: (m) => `names ${m[0]} (an explicit cross-repository reference)`,
    fix: (m) => `https://redirect.github.com/${UPSTREAM_SLUG}/issues/${m[1]}`,
  },
  {
    id: 'bare-upstream-number',
    test: /(?<![\w/#-])#(\d+)\b/g,
    filter: (m) => Number(m[1]) >= UPSTREAM_NUMBER_FLOOR,
    describe: (m) =>
      `says ${m[0]}, which is in the upstream number range (>= ${UPSTREAM_NUMBER_FLOOR})`,
    fix: (m) => `https://redirect.github.com/${UPSTREAM_SLUG}/issues/${m[1]}`,
  },
];

function scan(label, message) {
  const text = stripInert(message);
  const hits = [];
  for (const rule of RULES) {
    rule.test.lastIndex = 0;
    for (const m of text.matchAll(rule.test)) {
      if (rule.filter && !rule.filter(m)) continue;
      hits.push({ label, rule: rule.id, describe: rule.describe(m), fix: rule.fix(m) });
    }
  }
  return hits;
}

let subjects = [];

if (messageFile) {
  subjects = [{ label: 'commit message', message: readFileSync(messageFile, 'utf8') }];
} else {
  let rev = range;
  if (!rev) {
    rev = hasRef('origin/main') ? 'origin/main..HEAD' : 'HEAD~1..HEAD';
  }
  // Upstream's own commits carry "(#326)" subjects from its squash merges.
  // Those numbers already point at upstream from upstream; merging them here
  // creates nothing new, so anything reachable from upstream/main is exempt.
  const revListArgs = ['rev-list', ...rev.split(' ')];
  if (hasRef('upstream/main')) revListArgs.push('--not', 'upstream/main');
  const shas = git(...revListArgs).split('\n').map((s) => s.trim()).filter(Boolean);
  subjects = shas.map((sha) => ({
    label: `${sha.slice(0, 7)} ${git('log', '-1', '--format=%s', sha).trim()}`,
    message: git('log', '-1', '--format=%B', sha),
  }));
}

const findings = subjects.flatMap(({ label, message }) => scan(label, message));

if (findings.length === 0) process.exit(0);

console.error('Upstream backlink guard: commit message would post to the upstream timeline.\n');
for (const f of findings) {
  console.error(`  ${f.label}`);
  console.error(`    ${f.describe}`);
  console.error(`    use instead: ${f.fix}`);
}
console.error(
  '\nUpstream (' +
    UPSTREAM_SLUG +
    ') is read-only for this fork. Reword the message, wrap the reference in\n' +
    'backticks if it is only quoting a commit title, or use the redirect.github.com URL.\n' +
    'Provenance that only needs recording, not linking, belongs in docs/.\n' +
    'See AGENTS.md, "Cross-reference hygiene".',
);
process.exit(1);
