// Structural guard over docs/ingame-verification-record.md.
//
// The record scaffolds every human-gated check Phase 1 needs (D-09): exact
// steps, the fixture to use, and what a pass looks like are filled in by a
// plan; only the Verdict, and anything a fail or blocked verdict pulls in
// with it, is the human's to fill after a real game session. This script
// makes the completion rule mechanical instead of remembered:
//
//   - Without --strict: only structure is checked. A blank verdict is fine,
//     which is what lets the repository suite stay green while the record
//     is still being filled in.
//   - With --strict: zero blank verdicts are tolerated. This is the phase's
//     own completion gate (D-10).
//
// It also enforces the evidence rules from the CONTEXT decisions: a fail
// needs both evidence and a root cause (D-08, D-11), a blocked needs a
// stated reason (D-10), and a verdict word outside the fixed vocabulary is
// rejected so a half-typed note cannot read as a verdict.
//
// Amendment 2026-08-06 (D-19..D-25): every row also carries a Tier, `app` or
// `engine`. A fourth verdict, `deferred`, is legal only on an `engine` row --
// it means the project consciously accepted the engine half untested for
// now, which is a different claim than `blocked` (a check that could not run
// and someone still owes). `deferred` on an `app` row is an error, because an
// app row has a runner (`scripts/verify-in-app.mjs`) that can settle it.
//
// Run with: node scripts/check-verification-record.mjs [path] [--strict]

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

// The two row schemas the record uses, keyed off their header row. A table's
// schema is read from its own header, not assumed from position, so column
// order within a schema does not matter as long as the header names match.
const CHECK_FIELDS = ['ID', 'Tier', 'Check', 'Fixture', 'Steps', 'Pass looks like', 'Verdict', 'Evidence', 'Root cause'];
const CONVAR_FIELDS = ['ID', 'Tier', 'ConVar key', 'How to read', 'Reading', 'Verdict', 'Notes'];

// `deferred` was added alongside `Tier` (amendment 2026-08-06, D-19..D-25): it
// differs from `blocked` in that it is a *conscious* acceptance of an
// untested engine-only half, not an unavailable precondition someone still
// owes. It is only legal on an `engine`-tier row -- see Rule 9 below.
const VERDICT_WORDS = new Set(['pass', 'fail', 'blocked', 'deferred']);
const TIER_WORDS = new Set(['app', 'engine']);

// The full expected ID inventory, held here so a row silently deleted from
// the doc is caught rather than just quietly missing.
function rangeIds(prefix, start, end) {
  const ids = [];
  for (let n = start; n <= end; n += 1) {
    ids.push(`${prefix}-${String(n).padStart(2, '0')}`);
  }
  return ids;
}

const EXPECTED_IDS = [
  ...rangeIds('IG', 1, 23),
  ...rangeIds('RP', 1, 3),
  ...rangeIds('CV', 1, 16),
];

function isPipeRow(line) {
  return line.trim().startsWith('|');
}

// A markdown table separator row: only pipes, dashes, colons, and
// whitespace, and at least one dash. Deliberately loose about alignment
// markers (:---, ---:, :---:) since the doc's exact style is not load
// bearing here.
function isSeparatorRow(line) {
  const trimmed = line.trim();
  if (!trimmed) return false;
  return /^[|:\-\s]+$/.test(trimmed) && trimmed.includes('-');
}

// Unwraps a cell that is entirely wrapped in ** or `, so an ID or key
// written in bold or as code is still matched. Only unwraps when the
// marker covers the whole cell, so partial emphasis inside a sentence is
// left alone.
function cleanCell(raw) {
  let cell = raw.trim();
  for (const marker of ['**', '`']) {
    if (cell.length > marker.length * 2 && cell.startsWith(marker) && cell.endsWith(marker)) {
      cell = cell.slice(marker.length, cell.length - marker.length).trim();
      break;
    }
  }
  return cell;
}

function splitRow(line) {
  let trimmed = line.trim();
  if (trimmed.startsWith('|')) trimmed = trimmed.slice(1);
  if (trimmed.endsWith('|')) trimmed = trimmed.slice(0, -1);
  return trimmed.split('|').map(cleanCell);
}

function normalizeHeaderCell(cell) {
  return cell.trim().toLowerCase();
}

function matchSchema(headerCells) {
  const normalized = headerCells.map(normalizeHeaderCell);
  const checkHeader = CHECK_FIELDS.map(normalizeHeaderCell);
  const convarHeader = CONVAR_FIELDS.map(normalizeHeaderCell);
  if (normalized.length === checkHeader.length && normalized.every((c, i) => c === checkHeader[i])) {
    return 'check';
  }
  if (normalized.length === convarHeader.length && normalized.every((c, i) => c === convarHeader[i])) {
    return 'convar';
  }
  return null;
}

function buildRow(schema, cells) {
  const fields = schema === 'check' ? CHECK_FIELDS : CONVAR_FIELDS;
  const row = { schema };
  fields.forEach((field, index) => {
    row[field] = cells[index] ?? '';
  });
  return row;
}

/** Reads the markdown, finds the pipe tables, keys each table's schema off
 *  its own header row, and returns the rows as plain-object records with
 *  their cells trimmed. Column order beyond the header is never assumed. */
export function parseVerificationRecord(text) {
  const lines = text.split(/\r?\n/);
  const rows = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (isPipeRow(line)) {
      const headerCells = splitRow(line);
      const schema = matchSchema(headerCells);
      const nextLine = lines[i + 1] ?? '';
      if (schema && isSeparatorRow(nextLine)) {
        i += 2;
        while (i < lines.length && isPipeRow(lines[i])) {
          rows.push(buildRow(schema, splitRow(lines[i])));
          i += 1;
        }
        continue;
      }
    }
    i += 1;
  }
  return rows;
}

/** Runs the completion and evidence rules over the parsed rows. Returns the
 *  problems found plus counts of total rows, filled verdicts, and blank
 *  verdicts. options.strict selects the completion gate (D-10). */
export function checkVerificationRecord(text, options = {}) {
  const strict = Boolean(options.strict);
  const rows = parseVerificationRecord(text);
  const problems = [];

  // Rule 1: row inventory. Exactly the 41 expected IDs, each exactly once,
  // no others.
  const seenCounts = new Map();
  for (const row of rows) {
    const id = row.ID;
    seenCounts.set(id, (seenCounts.get(id) ?? 0) + 1);
  }
  for (const id of EXPECTED_IDS) {
    const count = seenCounts.get(id) ?? 0;
    if (count === 0) {
      problems.push({ code: 'missing-id', id, message: `missing row ${id}` });
    } else if (count > 1) {
      problems.push({ code: 'duplicate-id', id, message: `row ${id} appears ${count} times` });
    }
  }
  const expectedSet = new Set(EXPECTED_IDS);
  for (const id of seenCounts.keys()) {
    if (!expectedSet.has(id)) {
      problems.push({ code: 'unexpected-id', id, message: `unexpected row id ${id}, not in the expected inventory` });
    }
  }

  let filledVerdicts = 0;
  let blankVerdicts = 0;

  for (const row of rows) {
    const id = row.ID;
    const verdict = row.Verdict ?? '';
    const tier = row.Tier ?? '';

    // Rule 9: tier vocabulary. Every row must declare exactly `app` or
    // `engine` -- an unknown or blank Tier is rejected outright, because
    // Rule 10 below cannot reason about a row whose tier it does not know.
    if (!TIER_WORDS.has(tier)) {
      problems.push({ code: 'unknown-tier', id, message: `${id}: unrecognised Tier "${tier}"` });
    }

    // Rule 2: scaffold completeness (D-09). These are what the plan fills
    // in; only the verdict is the human's.
    if (row.schema === 'check') {
      if (!row.Check) problems.push({ code: 'scaffold-incomplete', id, message: `${id}: Check cell is empty` });
      if (!row.Fixture) problems.push({ code: 'scaffold-incomplete', id, message: `${id}: Fixture cell is empty` });
      if (!row.Steps) problems.push({ code: 'scaffold-incomplete', id, message: `${id}: Steps cell is empty` });
      if (!row['Pass looks like']) {
        problems.push({ code: 'scaffold-incomplete', id, message: `${id}: Pass looks like cell is empty` });
      }
    } else if (row.schema === 'convar') {
      if (!row['ConVar key']) problems.push({ code: 'scaffold-incomplete', id, message: `${id}: ConVar key cell is empty` });
      if (!row['How to read']) problems.push({ code: 'scaffold-incomplete', id, message: `${id}: How to read cell is empty` });
    }

    if (verdict === '') {
      blankVerdicts += 1;
      // Rule 8: completion gate (D-10), only under strict.
      if (strict) {
        problems.push({ code: 'blank-verdict', id, message: `${id}: Verdict is blank` });
      }
      continue;
    }

    filledVerdicts += 1;

    // Rule 3: verdict vocabulary (D-10). Anything outside pass/fail/blocked
    // is rejected so a half-typed note cannot read as a verdict.
    if (!VERDICT_WORDS.has(verdict)) {
      problems.push({ code: 'unknown-verdict', id, message: `${id}: unrecognised verdict "${verdict}"` });
      continue;
    }

    const evidence = row.schema === 'check' ? row.Evidence : row.Notes;
    const rootCause = row.schema === 'check' ? row['Root cause'] : row.Notes;

    // Rule 4: evidence (D-08). A pass needs no attachment; the written
    // verdict is the evidence.
    // Rule 5: root cause (D-11). Comes before any fix-here-versus-new-phase
    // call.
    if (verdict === 'fail') {
      if (!evidence) problems.push({ code: 'fail-missing-evidence', id, message: `${id}: fail verdict has no evidence` });
      if (!rootCause) problems.push({ code: 'fail-missing-root-cause', id, message: `${id}: fail verdict has no root cause` });
    }

    // Rule 6: blocked reason (D-10). Blocked is legitimate; blocked without
    // a reason is not.
    if (verdict === 'blocked' && !rootCause) {
      problems.push({ code: 'blocked-missing-reason', id, message: `${id}: blocked verdict has no stated reason` });
    }

    // Rule 10: `deferred` (D-22) is legal only on an `engine`-tier row -- an
    // `app` row has a runner that can settle it, so `deferred` there is an
    // error rather than an honest gap. It also requires a stated reason in
    // the same cell `blocked` uses, same as Rule 6, because "the project
    // consciously accepted this gap" is a claim that needs the reason on
    // record, not assumed.
    if (verdict === 'deferred') {
      if (tier !== 'engine') {
        problems.push({
          code: 'deferred-on-app-row',
          id,
          message: `${id}: deferred is only legal on an engine-tier row (this row is Tier "${tier}")`,
        });
      }
      if (!rootCause) {
        problems.push({ code: 'deferred-missing-reason', id, message: `${id}: deferred verdict has no stated reason` });
      }
    }

    // Rule 7: reading present. A recorded pass with no number recorded
    // nothing.
    if (verdict === 'pass' && row.schema === 'convar' && !row.Reading) {
      problems.push({ code: 'convar-pass-missing-reading', id, message: `${id}: pass verdict has no Reading` });
    }
  }

  return {
    ok: problems.length === 0,
    problems,
    totalRows: rows.length,
    filledVerdicts,
    blankVerdicts,
  };
}

function defaultTarget() {
  return join(root, 'docs', 'ingame-verification-record.md');
}

function main() {
  const args = process.argv.slice(2);
  const strict = args.includes('--strict');
  const pathArg = args.find((a) => !a.startsWith('--'));
  const target = pathArg ? resolve(pathArg) : defaultTarget();

  let text;
  try {
    text = readFileSync(target, 'utf8');
  } catch (err) {
    console.error(`verification record: could not read ${target}: ${err.message}`);
    return 1;
  }

  const result = checkVerificationRecord(text, { strict });

  console.log(
    `verification record: ${result.totalRows} rows, ${result.filledVerdicts} verdict(s) filled, ${result.blankVerdicts} blank${strict ? ' (strict)' : ''}`,
  );

  for (const problem of result.problems) {
    console.error(`  ${problem.id ?? '?'}: ${problem.message}`);
  }

  return result.ok ? 0 : 1;
}

// Only run when invoked directly, so importing this module for tests does
// not exit the process, matching scripts/check-encoding.mjs.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(main());
}
