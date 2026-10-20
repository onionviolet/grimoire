import { createHash, randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { join, resolve } from 'path';
import { scanMods, runExclusiveModMutation } from './mods';
import { findChunkSiblingNames } from './vpk';
import { getAutoexecPath } from './autoexec';
import { getGameinfoPath } from './deadlock';
import { dirname, basename } from 'path';
import { fingerprintFile } from './fileMatch';
import { captureIsolationRecoveryUnlocked, applyIsolationRecoveryUnlocked, restoreIsolationRecoveryUnlocked } from './profileRecovery';
import { assertRecoveryPath, recoveryDirectory, writeRecoveryJson } from './recoveryBackup';
import { readRecoveryJournal, writeJournaledIsolation } from './recoveryJournal';
import type { ModIsolationSession } from '../../../src/types/recovery';
import { advanceIsolationTrial } from '../../../src/lib/isolationTrials';

interface StoredSession extends ModIsolationSession { gamePath: string; originalIds: string[] }
const sessionPath = () => join(recoveryDirectory(), 'isolation.json');
async function readSession(gamePath: string): Promise<StoredSession | null> {
  await assertRecoveryPath(sessionPath());
  let session: StoredSession;
  try { session = JSON.parse(await fs.readFile(sessionPath(), 'utf8')) as StoredSession; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
  if (session.gamePath !== resolve(gamePath) || !/^[0-9a-f-]{36}$/.test(session.id) || !/^[0-9a-f-]{36}$/.test(session.recoveryPointId) ||
      !Array.isArray(session.candidates) || !session.candidates.every(mod => mod && typeof mod.id === 'string' && typeof mod.name === 'string') ||
      !Array.isArray(session.originalIds) || !session.originalIds.every(id => typeof id === 'string') ||
      !Array.isArray(session.testIds) || !session.testIds.every(id => typeof id === 'string' && session.originalIds.includes(id)) ||
      !['baseline-ready', 'baseline-testing', 'ready', 'testing', 'complete', 'inconclusive'].includes(session.phase) ||
      !Number.isSafeInteger(session.steps) || session.steps < 0 || typeof session.reviewToken !== 'string') throw new Error('Invalid isolation session');
  if (session.strategy !== undefined && (session.strategy !== 'delta' ||
      session.trialKind !== undefined && !['original', 'subset', 'complement'].includes(session.trialKind) ||
      session.partitionCount !== undefined && (!Number.isSafeInteger(session.partitionCount) || session.partitionCount < 2 || session.partitionCount > session.candidates.length) ||
      session.trialIndex !== undefined && (!Number.isSafeInteger(session.trialIndex) || session.trialIndex < 0 || session.trialIndex >= (session.partitionCount ?? 2)))) throw new Error('Invalid isolation trial state');
  return session;
}
async function liveToken(gamePath: string): Promise<string> {
  const mods = await scanMods(gamePath);
  const state = [];
  for (const mod of mods) {
    await assertRecoveryPath(mod.path);
    const chunks = findChunkSiblingNames(basename(mod.path), await fs.readdir(dirname(mod.path))).sort();
    const hashes = [];
    for (const path of [mod.path, ...chunks.map(name => join(dirname(mod.path), name))]) {
      await assertRecoveryPath(path); hashes.push((await fingerprintFile(path)).sha256);
    }
    state.push({ id: mod.id, path: mod.path, enabled: mod.enabled, hashes });
  }
  const configs = [];
  for (const path of [getAutoexecPath(gamePath), getGameinfoPath(gamePath), join(dirname(getGameinfoPath(gamePath)), 'grimoire-performance.json')]) {
    await assertRecoveryPath(path);
    try { configs.push((await fingerprintFile(path)).sha256); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; configs.push(null); }
  }
  return createHash('sha256').update(JSON.stringify({ mods: state.sort((a, b) => a.path.localeCompare(b.path)), configs })).digest('hex');
}
async function validateReview(gamePath: string, session: StoredSession, token: string): Promise<void> {
  if (!token || token !== session.reviewToken || token !== await liveToken(gamePath)) throw new Error('Isolation review is stale. Restore the original setup before restarting.');
  if (await readRecoveryJournal(gamePath)) throw new Error('Resolve interrupted recovery first');
}
export function getModIsolationSession(gamePath: string): Promise<ModIsolationSession | null> {
  return runExclusiveModMutation(async () => {
    const session = await readSession(gamePath);
    return session ? { ...session, restoreReviewToken: await liveToken(gamePath) } : null;
  });
}
export function startModIsolation(gamePath: string): Promise<ModIsolationSession> {
  return runExclusiveModMutation(async () => {
    if (await readSession(gamePath)) throw new Error('Restore the previous isolation session first');
    if (await readRecoveryJournal(gamePath)) throw new Error('Resolve interrupted recovery first');
    const mods = (await scanMods(gamePath)).filter(mod => mod.enabled);
    if (!mods.length) throw new Error('No enabled user mods to isolate');
    const point = await captureIsolationRecoveryUnlocked(gamePath);
    const session: StoredSession = { id: randomUUID(), gamePath: resolve(gamePath), recoveryPointId: point.id,
      createdAt: new Date().toISOString(), candidates: mods.map(mod => ({ id: mod.id, name: mod.name })), originalIds: mods.map(mod => mod.id),
      testIds: [], steps: 0, phase: 'baseline-ready', strategy: 'delta', reviewToken: await liveToken(gamePath) };
    await writeRecoveryJson(sessionPath(), session);
    return session;
  });
}
export function applyModIsolationTrial(gamePath: string, token: string): Promise<ModIsolationSession> {
  return runExclusiveModMutation(async () => {
    const session = await readSession(gamePath);
    if (!session || !['baseline-ready', 'ready'].includes(session.phase)) throw new Error('No isolation trial is ready');
    await validateReview(gamePath, session, token);
    await applyIsolationRecoveryUnlocked(gamePath, session.recoveryPointId, session.testIds, async () => {
      if (token !== await liveToken(gamePath)) throw new Error('Isolation review changed before mutation');
    }, async journal => {
      session.phase = session.phase === 'baseline-ready' ? 'baseline-testing' : 'testing';
      session.reviewToken = await liveToken(gamePath);
      await writeJournaledIsolation(journal, session);
    });
    return session;
  });
}
/** Feedback comes only from a person after testing. Launcher exit status never enters this flow. */
export function recordModIsolationResult(gamePath: string, token: string, result: 'works' | 'crashes'): Promise<ModIsolationSession> {
  return runExclusiveModMutation(async () => {
    const session = await readSession(gamePath);
    if (!session || !['baseline-testing', 'testing'].includes(session.phase) || !['works', 'crashes'].includes(result)) throw new Error('Invalid isolation feedback');
    await validateReview(gamePath, session, token);
    session.steps++;
    if (session.strategy === 'delta') {
      Object.assign(session, advanceIsolationTrial(session, result));
    } else if (session.phase === 'baseline-testing') {
      if (result === 'crashes') session.phase = 'inconclusive';
      else session.phase = 'ready';
    } else {
      session.candidates = session.candidates.filter(mod => result === 'crashes' ? session.testIds.includes(mod.id) : !session.testIds.includes(mod.id));
      session.phase = !session.candidates.length ? 'inconclusive' : session.candidates.length === 1 ? 'complete' : 'ready';
    }
    if (session.phase === 'ready' && session.strategy !== 'delta') session.testIds = session.candidates.slice(0, Math.max(1, Math.ceil(session.candidates.length / 2))).map(mod => mod.id);
    await writeRecoveryJson(sessionPath(), session);
    return session;
  });
}
export function finishModIsolation(gamePath: string, token: string): Promise<void> {
  return runExclusiveModMutation(async () => {
    const session = await readSession(gamePath);
    if (!session) throw new Error('No isolation session');
    if (!token || token !== await liveToken(gamePath)) throw new Error('Restore review is stale. Review the current setup again.');
    if (await readRecoveryJournal(gamePath)) throw new Error('Resolve interrupted recovery first');
    await restoreIsolationRecoveryUnlocked(gamePath, session.recoveryPointId, async () => {
      if (token !== await liveToken(gamePath)) throw new Error('Restore review changed before mutation');
    }, journal => writeJournaledIsolation(journal, null));
  });
}
