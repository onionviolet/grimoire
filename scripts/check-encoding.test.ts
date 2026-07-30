import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain .mjs script, no type declarations
import { findMojibake } from './check-encoding.mjs';

// This file is pure ASCII on purpose, like the checker it tests: the guard
// scans scripts/, so literal mojibake fixtures here would fail the very check
// they exist to verify. Every character is written as an escape.
const MIDDLE_DOT = '\u00B7';
const ELLIPSIS = '\u2026';
const EM_DASH = '\u2014';
const NBSP = '\u00A0';

/** Builds the mojibake form of a string the way the bug does: encode as UTF-8,
 *  then decode those bytes as cp1252. Using the real transform rather than
 *  hand-typed sequences means the fixtures cannot drift from the fault. */
function corrupt(text: string): string {
  const bytes = new TextEncoder().encode(text);
  return new TextDecoder('windows-1252').decode(bytes);
}

describe('findMojibake', () => {
  it('reproduces the exact sequences that shipped in v1.26.1', () => {
    // Sanity-check the fixture generator against bytes found in the packaged
    // app, so a broken generator cannot make the rest of these tests vacuous.
    expect(corrupt(MIDDLE_DOT)).toBe('\u00C2\u00B7');
    expect(corrupt(ELLIPSIS)).toBe('\u00E2\u20AC\u00A6');
    expect(corrupt(EM_DASH)).toBe('\u00E2\u20AC\u201D');
  });

  it('catches the middle dot, the character that shipped 1500+ times', () => {
    const hits = findMojibake(`"summary": "{{files}} files ${corrupt(MIDDLE_DOT)} precedence"`);
    expect(hits).toHaveLength(1);
    expect(hits[0].line).toBe(1);
  });

  it('catches the cases a Latin-1 detector would miss', () => {
    // Both live in the 0x80-0x9F range, which Latin-1 maps to C1 controls
    // rather than to the cp1252 punctuation that actually appears.
    expect(findMojibake(`"preparing": "Preparing${corrupt(ELLIPSIS)}"`)).not.toHaveLength(0);
    expect(findMojibake(`"hint": "Reversible ${corrupt(EM_DASH)} you can restore"`)).not.toHaveLength(0);
  });

  it('catches curly quotes, bullets, en dashes and the trademark sign', () => {
    const chars = ['\u2018', '\u2019', '\u201C', '\u201D', '\u2022', '\u2013', '\u2122'];
    for (const ch of chars) {
      const cp = ch.codePointAt(0)!.toString(16).toUpperCase();
      expect(findMojibake(`x ${corrupt(ch)} y`), `expected a hit for U+${cp}`).not.toHaveLength(0);
    }
  });

  it('catches non-breaking space, guillemets and the copyright sign', () => {
    for (const ch of [NBSP, '\u00AB', '\u00BB', '\u00A9']) {
      expect(findMojibake(`x ${corrupt(ch)} y`)).not.toHaveLength(0);
    }
  });

  it('catches text that was round-tripped twice', () => {
    expect(findMojibake(corrupt(corrupt(MIDDLE_DOT)))).not.toHaveLength(0);
  });

  it('catches the replacement character, where bytes were already lost', () => {
    expect(findMojibake('label: "Open VPK\uFFFD"')).not.toHaveLength(0);
  });

  it('reports the line number so the message is actionable', () => {
    const hits = findMojibake(`clean\nclean\nbroken ${corrupt(MIDDLE_DOT)}\nclean`);
    expect(hits).toHaveLength(1);
    expect(hits[0].line).toBe(3);
  });

  it('passes clean text containing the correct characters', () => {
    expect(findMojibake(`a ${MIDDLE_DOT} b ${ELLIPSIS} c ${EM_DASH} d \u2019 e ${NBSP} f`)).toEqual([]);
  });

  it('does not fire on legitimate accented letters in translated catalogs', () => {
    // These share the lead characters the detector keys on. Matching those
    // alone would break every French, Portuguese, Romanian and Vietnamese
    // catalog. The real fr catalog carries 30 of them and must scan clean.
    const real = [
      'C\u00E2blage requis',
      'Pr\u00EAt \u00E0 l\u2019emploi',
      '\u00C2ge minimum',
      'Configura\u00E7\u00E3o',
      'Ac\u00E7\u00E3o n\u00E3o permitida',
      '\u00CEnt\u00E2lnire',
      'C\u1EA7n thi\u1EBFt',
      'Ph\u1EA7n m\u1EC1m \u0111\u00E3 c\u00E0i \u0111\u1EB7t',
    ];
    for (const s of real) {
      expect(findMojibake(s), `false positive on: ${JSON.stringify(s)}`).toEqual([]);
    }
  });

  it('passes plain ASCII without scanning further', () => {
    expect(findMojibake('const x = "hello world";')).toEqual([]);
  });

  it('keeps the checker itself pure ASCII', () => {
    // The checker must not contain the characters it hunts for, or it becomes
    // a carrier for the corruption and trips its own check.
    const file = readFileSync(fileURLToPath(new URL('./check-encoding.mjs', import.meta.url)));
    expect([...file].filter((b) => b > 127)).toEqual([]);
  });

  it('keeps this test file pure ASCII too', () => {
    const file = readFileSync(fileURLToPath(import.meta.url));
    expect([...file].filter((b) => b > 127)).toEqual([]);
  });
});
