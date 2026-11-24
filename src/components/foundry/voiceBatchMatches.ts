import type { VoiceLine } from '../../types/foundry';
import { compiledSoundEntry } from './soundStagedEdit';

export const AUDIO_EXTENSION = /\.(?:mp3|wav|ogg|flac|m4a|aac|opus)$/i;
const stem = (value: string) => (value.split(/[\\/]/).at(-1) ?? '').replace(/\.vsnd(?:_c)?$/i, '').toLowerCase();

export function matchVoiceBatch(files: File[], lines: VoiceLine[]) {
  const byName = new Map<string, Set<string>>();
  for (const line of lines) for (const path of line.vsnd) {
    const target = compiledSoundEntry(path);
    for (const name of [stem(path), line.event.toLowerCase()]) {
      const matches = byName.get(name) ?? new Set<string>();
      matches.add(target);
      byName.set(name, matches);
    }
  }
  const rows = files.map(file => {
    const candidates = [...(byName.get(stem(file.name.replace(AUDIO_EXTENSION, ''))) ?? [])];
    return { file, candidates };
  });
  const claims = new Map<string, number>();
  for (const { candidates } of rows) {
    if (candidates.length === 1) claims.set(candidates[0], (claims.get(candidates[0]) ?? 0) + 1);
  }
  return rows.map(row => ({ ...row, target: row.candidates.length === 1 && claims.get(row.candidates[0]) === 1 ? row.candidates[0] : null }));
}
