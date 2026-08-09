import { describe, expect, it } from 'vitest';
import { derivePakDescription, isUnnamedPakName } from './derivedPakName';

describe('isUnnamedPakName', () => {
  it('detects the exact bare pak slot strings, case-insensitively and with surrounding whitespace tolerated', () => {
    expect(isUnnamedPakName('Pak92')).toBe(true);
    expect(isUnnamedPakName('pak92')).toBe(true);
    expect(isUnnamedPakName('PAK7')).toBe(true);
    expect(isUnnamedPakName('  pak92  ')).toBe(true);
  });

  it('does not detect a name that merely begins with the letters followed by a space and a word', () => {
    expect(isUnnamedPakName('Pak Rat')).toBe(false);
    expect(isUnnamedPakName('Pak92 Extra')).toBe(false);
  });

  it('does not detect an empty, null or undefined name', () => {
    expect(isUnnamedPakName('')).toBe(false);
    expect(isUnnamedPakName(null)).toBe(false);
    expect(isUnnamedPakName(undefined)).toBe(false);
  });
});

describe('derivePakDescription', () => {
  it('returns the unknown variant when deriving from an empty path list', () => {
    expect(derivePakDescription([])).toEqual({ kind: 'unknown' });
  });

  it('returns a derived variant holding the leaf name with a remainder of zero for one path', () => {
    expect(derivePakDescription(['sound/announcer/intro_01.vsnd'])).toEqual({
      kind: 'derived',
      entries: ['intro_01.vsnd'],
      extra: 0,
    });
  });

  it('returns all three leaf names in stable sorted order with a remainder of zero for three paths', () => {
    expect(
      derivePakDescription([
        'sound/announcer/round_end.vsnd',
        'sound/announcer/kill_streak.vsnd',
        'sound/announcer/first_blood.vsnd',
      ])
    ).toEqual({
      kind: 'derived',
      entries: ['first_blood.vsnd', 'kill_streak.vsnd', 'round_end.vsnd'],
      extra: 0,
    });
  });

  it('returns the first three leaf names and a remainder of four for seven paths', () => {
    expect(
      derivePakDescription([
        'sound/announcer/one.vsnd',
        'sound/announcer/two.vsnd',
        'sound/announcer/three.vsnd',
        'sound/announcer/four.vsnd',
        'sound/announcer/five.vsnd',
        'sound/announcer/six.vsnd',
        'sound/announcer/seven.vsnd',
      ])
    ).toEqual({
      kind: 'derived',
      entries: ['five.vsnd', 'four.vsnd', 'one.vsnd'],
      extra: 4,
    });
  });

  it('collapses identical leaf names to one entry and counts distinct leaves as the remainder', () => {
    expect(
      derivePakDescription([
        'sound/announcer/shared.vsnd',
        'sound/other/shared.vsnd',
        'sound/announcer/one.vsnd',
        'sound/other/two.vsnd',
        'sound/other/three.vsnd',
        'sound/other/four.vsnd',
        'sound/other/five.vsnd',
      ])
    ).toEqual({
      kind: 'derived',
      entries: ['five.vsnd', 'four.vsnd', 'one.vsnd'],
      extra: 3,
    });
  });

  it('treats a path with no separator as its own leaf name', () => {
    expect(derivePakDescription(['intro.vsnd'])).toEqual({
      kind: 'derived',
      entries: ['intro.vsnd'],
      extra: 0,
    });
  });

  it('honors an explicit limit so the render site never hardcodes the cap', () => {
    expect(
      derivePakDescription(
        [
          'sound/announcer/one.vsnd',
          'sound/announcer/two.vsnd',
          'sound/announcer/three.vsnd',
          'sound/announcer/four.vsnd',
          'sound/announcer/five.vsnd',
          'sound/announcer/six.vsnd',
          'sound/announcer/seven.vsnd',
        ],
        2
      )
    ).toEqual({
      kind: 'derived',
      entries: ['five.vsnd', 'four.vsnd'],
      extra: 5,
    });
  });
});
