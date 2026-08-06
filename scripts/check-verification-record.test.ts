import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain .mjs script, no type declarations
import { checkVerificationRecord, parseVerificationRecord } from './check-verification-record.mjs';

// Every fixture here is a small inline markdown string built from the local
// factory functions below, matching the repo's inline-factory convention
// (TESTING.md: no shared fixtures directory). None of this reads the real
// docs/ingame-verification-record.md, which would couple the guard's own
// tests to the doc's current fill state.

interface CheckRowFields {
  id: string;
  Check: string;
  Fixture: string;
  Steps: string;
  'Pass looks like': string;
  Verdict: string;
  Evidence: string;
  'Root cause': string;
}

interface ConvarRowFields {
  id: string;
  'ConVar key': string;
  'How to read': string;
  Reading: string;
  Verdict: string;
  Notes: string;
}

function makeCheckRow(id: string, overrides: Partial<CheckRowFields> = {}): CheckRowFields {
  return {
    id,
    Check: `${id} check`,
    Fixture: `${id} fixture`,
    Steps: `${id} steps`,
    'Pass looks like': `${id} pass looks like`,
    Verdict: 'pass',
    Evidence: '',
    'Root cause': '',
    ...overrides,
  };
}

function makeConvarRow(id: string, overrides: Partial<ConvarRowFields> = {}): ConvarRowFields {
  return {
    id,
    'ConVar key': `${id}_key`,
    'How to read': `${id} how to read`,
    Reading: `${id} reading`,
    Verdict: 'pass',
    Notes: '',
    ...overrides,
  };
}

function padded(prefix: string, n: number): string {
  return `${prefix}-${String(n).padStart(2, '0')}`;
}

function defaultCheckRows(): CheckRowFields[] {
  const rows: CheckRowFields[] = [];
  for (let n = 1; n <= 22; n += 1) rows.push(makeCheckRow(padded('IG', n)));
  for (let n = 1; n <= 3; n += 1) rows.push(makeCheckRow(padded('RP', n)));
  return rows;
}

function defaultConvarRows(): ConvarRowFields[] {
  const rows: ConvarRowFields[] = [];
  for (let n = 1; n <= 16; n += 1) rows.push(makeConvarRow(padded('CV', n)));
  return rows;
}

function renderCheckTable(rows: CheckRowFields[]): string {
  const header = '| ID | Check | Fixture | Steps | Pass looks like | Verdict | Evidence | Root cause |';
  const sep = '| --- | --- | --- | --- | --- | --- | --- | --- |';
  const body = rows
    .map(
      (r) =>
        `| ${r.id} | ${r.Check} | ${r.Fixture} | ${r.Steps} | ${r['Pass looks like']} | ${r.Verdict} | ${r.Evidence} | ${r['Root cause']} |`,
    )
    .join('\n');
  return [header, sep, body].join('\n');
}

function renderConvarTable(rows: ConvarRowFields[]): string {
  const header = '| ID | ConVar key | How to read | Reading | Verdict | Notes |';
  const sep = '| --- | --- | --- | --- | --- | --- |';
  const body = rows
    .map((r) => `| ${r.id} | ${r['ConVar key']} | ${r['How to read']} | ${r.Reading} | ${r.Verdict} | ${r.Notes} |`)
    .join('\n');
  return [header, sep, body].join('\n');
}

function buildRecord(opts: { checkRows?: CheckRowFields[]; convarRows?: ConvarRowFields[] } = {}): string {
  const checkRows = opts.checkRows ?? defaultCheckRows();
  const convarRows = opts.convarRows ?? defaultConvarRows();
  return [
    '# Fixture verification record',
    '',
    'Preamble text unrelated to parsing.',
    '',
    renderCheckTable(checkRows),
    '',
    renderConvarTable(convarRows),
    '',
  ].join('\n');
}

describe('checkVerificationRecord', () => {
  it('passes a well-formed complete record under both non-strict and strict', () => {
    const text = buildRecord();
    expect(checkVerificationRecord(text, { strict: false }).ok).toBe(true);
    expect(checkVerificationRecord(text, { strict: true }).ok).toBe(true);
  });

  it('lets a blank verdict pass non-strict but fails it under strict', () => {
    const checkRows = defaultCheckRows();
    checkRows[0].Verdict = '';
    const text = buildRecord({ checkRows });

    const loose = checkVerificationRecord(text, { strict: false });
    expect(loose.ok).toBe(true);
    expect(loose.blankVerdicts).toBe(1);

    const strict = checkVerificationRecord(text, { strict: true });
    expect(strict.ok).toBe(false);
    expect(strict.problems.some((p: { code: string; id: string }) => p.code === 'blank-verdict' && p.id === 'IG-01')).toBe(
      true,
    );
  });

  it('rejects a missing ID', () => {
    const checkRows = defaultCheckRows().filter((r) => r.id !== 'IG-05');
    const text = buildRecord({ checkRows });
    const result = checkVerificationRecord(text);
    expect(result.ok).toBe(false);
    expect(result.problems.some((p: { code: string; id: string }) => p.code === 'missing-id' && p.id === 'IG-05')).toBe(
      true,
    );
  });

  it('rejects a duplicate ID', () => {
    const checkRows = defaultCheckRows();
    checkRows.push(makeCheckRow('IG-01'));
    const text = buildRecord({ checkRows });
    const result = checkVerificationRecord(text);
    expect(result.ok).toBe(false);
    expect(
      result.problems.some((p: { code: string; id: string }) => p.code === 'duplicate-id' && p.id === 'IG-01'),
    ).toBe(true);
  });

  it('rejects an unrecognised verdict word', () => {
    const checkRows = defaultCheckRows();
    checkRows[0].Verdict = 'maybe';
    const text = buildRecord({ checkRows });
    const result = checkVerificationRecord(text);
    expect(result.ok).toBe(false);
    expect(
      result.problems.some((p: { code: string; id: string }) => p.code === 'unknown-verdict' && p.id === 'IG-01'),
    ).toBe(true);
  });

  it('rejects a fail verdict with no evidence', () => {
    const checkRows = defaultCheckRows();
    checkRows[0] = makeCheckRow('IG-01', { Verdict: 'fail', Evidence: '', 'Root cause': 'root cause given' });
    const text = buildRecord({ checkRows });
    const result = checkVerificationRecord(text);
    expect(result.ok).toBe(false);
    expect(
      result.problems.some(
        (p: { code: string; id: string }) => p.code === 'fail-missing-evidence' && p.id === 'IG-01',
      ),
    ).toBe(true);
  });

  it('rejects a fail verdict with no root cause', () => {
    const checkRows = defaultCheckRows();
    checkRows[0] = makeCheckRow('IG-01', { Verdict: 'fail', Evidence: 'a screenshot', 'Root cause': '' });
    const text = buildRecord({ checkRows });
    const result = checkVerificationRecord(text);
    expect(result.ok).toBe(false);
    expect(
      result.problems.some(
        (p: { code: string; id: string }) => p.code === 'fail-missing-root-cause' && p.id === 'IG-01',
      ),
    ).toBe(true);
  });

  it('rejects a blocked verdict with no stated reason', () => {
    const checkRows = defaultCheckRows();
    checkRows[0] = makeCheckRow('IG-01', { Verdict: 'blocked', 'Root cause': '' });
    const text = buildRecord({ checkRows });
    const result = checkVerificationRecord(text);
    expect(result.ok).toBe(false);
    expect(
      result.problems.some(
        (p: { code: string; id: string }) => p.code === 'blocked-missing-reason' && p.id === 'IG-01',
      ),
    ).toBe(true);
  });

  it('rejects a check row with an empty Steps cell', () => {
    const checkRows = defaultCheckRows();
    checkRows[0].Steps = '';
    const text = buildRecord({ checkRows });
    const result = checkVerificationRecord(text);
    expect(result.ok).toBe(false);
    expect(
      result.problems.some(
        (p: { code: string; id: string }) => p.code === 'scaffold-incomplete' && p.id === 'IG-01',
      ),
    ).toBe(true);
  });

  it('rejects a ConVar row marked pass with no Reading', () => {
    const convarRows = defaultConvarRows();
    convarRows[0].Reading = '';
    const text = buildRecord({ convarRows });
    const result = checkVerificationRecord(text);
    expect(result.ok).toBe(false);
    expect(
      result.problems.some(
        (p: { code: string; id: string }) => p.code === 'convar-pass-missing-reading' && p.id === 'CV-01',
      ),
    ).toBe(true);
  });

  it('parses a mixed record with both schemas correctly', () => {
    const text = buildRecord();
    const rows = parseVerificationRecord(text) as Array<{ schema: string; ID: string }>;
    expect(rows).toHaveLength(41);
    expect(rows.filter((r) => r.schema === 'check')).toHaveLength(25);
    expect(rows.filter((r) => r.schema === 'convar')).toHaveLength(16);

    const result = checkVerificationRecord(text);
    expect(result.totalRows).toBe(41);
    expect(result.ok).toBe(true);
  });
});
