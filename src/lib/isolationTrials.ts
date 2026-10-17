import type { ModIsolationSession } from '../types/recovery';

function trial(session: ModIsolationSession): ModIsolationSession {
  const count = Math.min(session.candidates.length, session.partitionCount ?? 2);
  const index = session.trialIndex ?? 0;
  const block = session.candidates.slice(Math.floor(index * session.candidates.length / count), Math.floor((index + 1) * session.candidates.length / count));
  const ids = new Set(block.map(mod => mod.id));
  return { ...session, phase: 'ready', partitionCount: count,
    testIds: session.candidates.filter(mod => session.trialKind === 'complement' ? !ids.has(mod.id) : ids.has(mod.id)).map(mod => mod.id) };
}
/** Delta debugging only shrinks to groups a person reports crashing. Working
 * halves do not implicate their complements, which can hide mod interactions. */
export function advanceIsolationTrial(session: ModIsolationSession, result: 'works' | 'crashes'): ModIsolationSession {
  if (session.phase === 'baseline-testing') {
    return result === 'crashes' ? { ...session, phase: 'inconclusive' }
      : { ...session, phase: 'ready', trialKind: 'original', testIds: session.candidates.map(mod => mod.id) };
  }
  if (session.phase !== 'testing') throw new Error('No isolation trial is awaiting feedback');
  if (session.trialKind === 'original' && result === 'works') return { ...session, phase: 'inconclusive' };
  if (result === 'crashes') {
    const candidates = session.candidates.filter(mod => session.testIds.includes(mod.id));
    if (!candidates.length) return { ...session, phase: 'inconclusive' };
    if (candidates.length === 1) return { ...session, candidates, phase: 'complete', interactingSet: false, partitionCount: undefined, trialIndex: undefined, trialKind: undefined };
    return trial({ ...session, candidates, trialKind: 'subset', trialIndex: 0, partitionCount: Math.min(candidates.length, Math.max(2, (session.partitionCount ?? 3) - 1)) });
  }
  const partitions = session.partitionCount ?? 2;
  const index = (session.trialIndex ?? 0) + 1;
  if (index < partitions) return trial({ ...session, trialIndex: index });
  if (session.trialKind === 'subset' && partitions > 2) return trial({ ...session, trialKind: 'complement', trialIndex: 0 });
  if (partitions >= session.candidates.length) return { ...session, phase: 'complete', interactingSet: true, partitionCount: undefined, trialIndex: undefined, trialKind: undefined };
  return trial({ ...session, partitionCount: Math.min(session.candidates.length, partitions * 2), trialKind: 'subset', trialIndex: 0 });
}
