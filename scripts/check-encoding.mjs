// Fails on cp1252-round-tripped text ("mojibake") in source and catalogs.
//
// v1.26.1 shipped 77 corrupted sequences: commit 2ea87f0 wrote UTF-8 bytes that
// had been decoded as Windows-1252 and re-encoded, so a middle dot, an ellipsis
// and an em dash each turned into a two- or three-character sequence starting
// U+00C2 or U+00E2. The Foundry global sound catalog alone rendered over 1500
// corrupted text nodes. An earlier round of the same fault was hand-fixed the
// same evening, so this is a recurring class, not an incident.
//
// Review does not catch it: the corruption is invisible in a diff unless you are
// looking for it, and invisible in the dev build whenever the fix happens to sit
// uncommitted in the working tree, which is exactly how it shipped.
//
// THIS FILE IS DELIBERATELY PURE ASCII. Every character it hunts for is written
// as a numeric escape. Spelling them literally would make the file trip its own
// check, and would make the checker itself a carrier for the corruption it
// exists to prevent. Keep it that way; there is a test that enforces it.
//
// Run with: pnpm encoding:check   (exits non-zero on any hit)

import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

const SCAN_DIRS = ['src', 'electron', 'scripts'];
const SCAN_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|json|css|html)$/;
const SKIP_DIRS = new Set(['node_modules', 'dist', 'out', 'build', '.git']);

// What each byte in 0x80-0x9F becomes when read as cp1252, in byte order. This
// table is the whole reason a Latin-1 detector is not good enough: Latin-1
// leaves those bytes as C1 controls, so it never sees the ellipsis or em-dash
// forms and would have caught only 3 of the 77 sequences that shipped. The five
// slots cp1252 leaves undefined (0x81, 0x8D, 0x8F, 0x90, 0x9D) do survive as C1
// controls and are included so the class stays contiguous with the byte range.
const CP1252_HIGH_CODES = [
  0x20ac, 0x0081, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021,
  0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0x008d, 0x017d, 0x008f,
  0x0090, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014,
  0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x009d, 0x017e, 0x0178,
];

const u = (code) => '\\u' + code.toString(16).toUpperCase().padStart(4, '0');
const cp1252Class = `[${CP1252_HIGH_CODES.map(u).join('')}]`;

// Each pattern is a multi-character signature on purpose. Bare U+00C2, U+00E2
// and U+00C3 are legitimate letters in French, Portuguese, Romanian and
// Vietnamese catalogs, so matching them alone would fire on correct
// translations. `[\s\S]` rather than `.` so a corrupted sequence is still caught
// when its trailing character is exotic.
const PATTERNS = [
  {
    // U+00C2 then a Latin-1 punctuation/symbol: the corrupted form of one
    // U+00A0-U+00BF character (middle dot, guillemets, copyright, nbsp).
    source: `${u(0x00c2)}[${u(0x00a0)}-${u(0x00bf)}]`,
    label: 'U+00C2 + Latin-1 punctuation (was a single U+00Ax-U+00Bx character)',
  },
  {
    // U+00E2 U+20AC x: the e2 80 xx family, i.e. em dash, en dash, ellipsis,
    // curly quotes, bullet. By far the commonest form.
    source: `${u(0x00e2)}${u(0x20ac)}[\\s\\S]`,
    label: 'U+00E2 U+20AC sequence (was an em/en dash, ellipsis, or curly quote)',
  },
  {
    // U+00E2 then any other cp1252 replacement, covering the rest of the
    // e2 8x/9x planes (arrows, math symbols, trademark).
    source: `${u(0x00e2)}${cp1252Class}[\\s\\S]`,
    label: 'U+00E2 + cp1252 replacement (was a U+2xxx character)',
  },
  {
    // Text that has been round-tripped twice.
    source: `${u(0x00c3)}[${u(0x201a)}${u(0x00a2)}]`,
    label: 'double round-trip (U+00C3 lead)',
  },
  {
    // Bytes were already lost, not merely misread. The original character
    // cannot be recovered from the file alone, so report it separately.
    source: u(0xfffd),
    label: 'U+FFFD replacement character (bytes were lost, not just misread)',
  },
].map(({ source, label }) => ({ re: new RegExp(source, 'g'), label }));

// Cheap bail-out: no signature can exist without one of these lead characters.
const LEADS = new RegExp(`[${u(0x00c2)}${u(0x00e2)}${u(0x00c3)}${u(0xfffd)}]`);

function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (SKIP_DIRS.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (SCAN_EXT.test(e.name)) out.push(p);
  }
  return out;
}

/** Every mojibake sequence in `text`, as {line, label, match} records. Exported
 *  so tests can assert both directions without touching the filesystem. */
export function findMojibake(text) {
  const hits = [];
  if (!LEADS.test(text)) return hits;

  const lines = text.split(/\r?\n/);
  for (const { re, label } of PATTERNS) {
    for (let i = 0; i < lines.length; i++) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(lines[i])) !== null) {
        hits.push({ line: i + 1, label, match: m[0], context: lines[i].trim().slice(0, 120) });
      }
    }
  }
  return hits;
}

function main() {
  const files = SCAN_DIRS.flatMap((d) => walk(join(root, d)));
  const hits = [];

  for (const file of files) {
    const rel = relative(root, file).split(sep).join('/');
    for (const hit of findMojibake(readFileSync(file, 'utf8'))) {
      hits.push({ ...hit, file: rel });
    }
  }

  if (hits.length === 0) {
    console.log(`encoding: clean (${files.length} files scanned)`);
    return 0;
  }

  const fileCount = new Set(hits.map((h) => h.file)).size;
  console.error(`encoding: found ${hits.length} mojibake sequence(s) in ${fileCount} file(s).\n`);
  for (const h of hits) {
    const codepoints = [...h.match]
      .map((c) => 'U+' + c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0'))
      .join(' ');
    console.error(`  ${h.file}:${h.line}  ${h.label}`);
    console.error(`    matched ${codepoints}`);
    console.error(`    ${h.context}`);
  }
  console.error(`
This is UTF-8 text that was decoded as Windows-1252 and re-encoded. Restore the
intended character rather than deleting it: U+00C2 U+00B7 was a middle dot,
U+00E2 U+20AC U+00A6 an ellipsis, U+00E2 U+20AC U+201D an em dash. Then check
the editor or tool that wrote the file, because it will keep doing this.
`);
  return 1;
}

// Only scan when invoked directly, so importing this module for tests does not
// exit the process.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(main());
}
