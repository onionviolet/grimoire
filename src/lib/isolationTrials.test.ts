import { describe, expect, it } from 'vitest';
import type { ModIsolationSession } from '../types/recovery';
import { advanceIsolationTrial } from './isolationTrials';
const start = (): ModIsolationSession => ({ id: 'session', recoveryPointId: 'point', createdAt: '', phase: 'baseline-testing', candidates: ['a', 'b', 'c', 'd'].map(id => ({ id, name: id })), testIds: [], steps: 0, reviewToken: '', strategy: 'delta' });
function isolate(crashes: (ids: string[]) => boolean) {
  let session = advanceIsolationTrial(start(), 'works');
  for (let count = 0; count < 40 && session.phase === 'ready'; count++) {
    session = advanceIsolationTrial({ ...session, phase: 'testing' }, crashes(session.testIds) ? 'crashes' : 'works');
  }
  return session;
}
describe('human-feedback isolation trials', () => {
  it('rechecks the original failing setup after the empty baseline and refuses a non-reproducing report', () => {
    const ready = advanceIsolationTrial(start(), 'works');
    expect(ready.trialKind).toBe('original'); expect(ready.testIds).toEqual(['a', 'b', 'c', 'd']);
    expect(advanceIsolationTrial({ ...ready, phase: 'testing' }, 'works').phase).toBe('inconclusive');
    expect(advanceIsolationTrial(start(), 'crashes').phase).toBe('inconclusive');
  });
  it('confirms the remaining single candidate actually reproduces the reported crash', () => {
    const result = isolate(ids => ids.includes('c'));
    expect(result.phase).toBe('complete'); expect(result.candidates.map(mod => mod.id)).toEqual(['c']); expect(result.interactingSet).toBe(false);
  });
  it('retains interacting mods instead of accusing one working half', () => {
    const result = isolate(ids => ids.includes('a') && ids.includes('d'));
    expect(result.phase).toBe('complete'); expect(result.candidates.map(mod => mod.id)).toEqual(['a', 'd']); expect(result.interactingSet).toBe(true);
  });
});
