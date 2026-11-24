import { describe, expect, it } from 'vitest';
import type { VoiceLine } from '../../types/foundry';
import { matchVoiceBatch } from './voiceBatchMatches';

const line = (event: string, ...vsnd: string[]): VoiceLine => ({
  event, vsnd, hero: 'fixture', label: event, duration: 1, caption: null,
});
const file = (name: string) => new File([], name);

describe('voice batch staging', () => {
  it('matches an exact clip stem or single-clip event and preserves unmatched files for review', () => {
    const rows = matchVoiceBatch([file('PART_ONE.wav'), file('OneVoice.mp3'), file('other.ogg')], [
      line('Pool', 'sounds/voice/part_one.vsnd', 'sounds/voice/part_two.vsnd'),
      line('OneVoice', 'sounds/voice/one.vsnd'),
    ]);
    expect(rows.map(row => row.target)).toEqual(['sounds/voice/part_one.vsnd_c', 'sounds/voice/one.vsnd_c', null]);
  });

  it('does not pick for a multi-clip event or when two files claim the same output', () => {
    const rows = matchVoiceBatch([file('Pool.mp3'), file('one.wav'), file('OneVoice.mp3')], [
      line('Pool', 'sounds/voice/part_one.vsnd', 'sounds/voice/part_two.vsnd'),
      line('OneVoice', 'sounds/voice/one.vsnd'),
    ]);
    expect(rows.map(row => row.target)).toEqual([null, null, null]);
    expect(rows.map(row => row.candidates.length)).toEqual([2, 1, 1]);
  });
});
