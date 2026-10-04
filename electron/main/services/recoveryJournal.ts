import { promises as fs } from 'fs';
import { basename, dirname, join, resolve } from 'path';
import { createHash } from 'crypto';
import { AsyncLocalStorage } from 'async_hooks';
import { getModScanRootPaths, getDisabledPath, getGameinfoPath, isReservedPriorityVpkArtifact } from './deadlock';
import { getModMetadata, setModMetadata, removeModMetadata, type ModMetadata } from './metadata';
import { loadSettings } from './settings';
import { getAutoexecPath } from './autoexec';
import { fingerprintFile } from './fileMatch';
import { assertRecoveryPath, isWithinRecoveryRoot, placeRecoveryFile, hasRecoveryFile, recoveryDirectory, retainRecoveryFile, writeRecoveryJson } from './recoveryBackup';
import type { InterruptedRecovery } from '../../../src/types/profileRecovery';

interface JournalFile { path: string; before: string | null; allowed: string[] }
export interface RecoveryJournal {
  version: 1; gamePath: string; createdAt: string; files: JournalFile[];
  activeProfileId: string | null;
  metadataMoves: Array<{ from: string; to: string }>;
  mutationStarted: boolean;
  metadataBefore: Record<string, ModMetadata | null>;
  isolation?: { before: string | null; allowed: Array<string | null> };
  launchOptions?: { before: string; after: string };
}
const mutationJournal = new AsyncLocalStorage<RecoveryJournal>();
export const withRecoveryMutationJournal = <T>(journal: RecoveryJournal, operation: () => Promise<T>): Promise<T> => mutationJournal.run(journal, operation);
/** Existing mod operations participate only while a profile transaction owns the lock. */
export async function journalModRename(from: string, to: string): Promise<void> {
  const journal = mutationJournal.getStore();
  if (!journal) return;
  const hash = await fileHash(from);
  if (!hash) throw new Error('Reviewed mod disappeared before rename');
  await journalRecoveryPaths(journal, [{ path: from, hash }, { path: to, hash }]);
  const key = (path: string) => {
    const folder = basename(dirname(path));
    return folder === 'grimoire' || /^addons[1-9]$/.test(folder) ? `${folder}/${basename(path)}` : basename(path);
  };
  if (from.endsWith('_dir.vpk')) await journalRecoveryMetadata(journal, [key(from), key(to)]);
  await beginRecoveryMutation(journal);
}
export async function writeJournaledModConfig(path: string, next: string, before: string): Promise<void> {
  const journal = mutationJournal.getStore();
  if (journal) {
    await journalRecoveryPaths(journal, [{ path, hash: createHash('sha256').update(next).digest('hex'), expectedBefore: createHash('sha256').update(before).digest('hex') }]);
    await beginRecoveryMutation(journal);
  }
  const temp = `${path}.mod-config.tmp`;
  try {
    await fs.writeFile(temp, next);
    if (await fs.readFile(path, 'utf8') !== before) throw new Error('Game configuration changed before repair');
    await fs.rename(temp, path);
  } finally { await fs.unlink(temp).catch(() => {}); }
}
const journalPath = () => join(recoveryDirectory(), 'interrupted.json');
async function fileHash(path: string): Promise<string | null> {
  await assertRecoveryPath(path);
  try { return (await fingerprintFile(path)).sha256; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
}
export async function readRecoveryJournal(gamePath: string): Promise<RecoveryJournal | null> {
  await assertRecoveryPath(journalPath());
  let journal: RecoveryJournal;
  try { journal = JSON.parse(await fs.readFile(journalPath(), 'utf8')) as RecoveryJournal; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
  if (journal.version !== 1 || typeof journal.mutationStarted !== 'boolean' || journal.gamePath !== resolve(gamePath) || !Array.isArray(journal.files) ||
      (!journal.metadataBefore || typeof journal.metadataBefore !== 'object' || Array.isArray(journal.metadataBefore)) || !Array.isArray(journal.metadataMoves) || !Number.isFinite(Date.parse(journal.createdAt)) ||
      (journal.activeProfileId !== null && typeof journal.activeProfileId !== 'string')) throw new Error('Invalid recovery journal');
  if (journal.isolation && (!Array.isArray(journal.isolation.allowed) || [journal.isolation.before, ...journal.isolation.allowed].some(hash => hash !== null && (typeof hash !== 'string' || !/^[0-9a-f]{64}$/.test(hash))))) throw new Error('Invalid isolation journal');
  if (journal.launchOptions && [journal.launchOptions.before, journal.launchOptions.after].some(value => typeof value !== 'string' || value.length > 8192 || /[\r\n\0]/.test(value))) throw new Error('Invalid launch options journal');
  const roots = [...getModScanRootPaths(gamePath), getDisabledPath(gamePath)].map(root => resolve(root));
  const configs = [getGameinfoPath(gamePath), getAutoexecPath(gamePath), join(dirname(getGameinfoPath(gamePath)), 'grimoire-performance.json')];
  const seen = new Set<string>();
  for (const file of journal.files) {
    if (!file || typeof file.path !== 'string' || resolve(file.path) !== file.path || !isWithinRecoveryRoot(file.path, gamePath) || seen.has(file.path) ||
        (!configs.includes(file.path) && (!roots.includes(dirname(file.path)) || (basename(dirname(file.path)) === 'grimoire' && isReservedPriorityVpkArtifact(basename(file.path))) || !/^(?:[^/\\]+_(?:dir|[0-9]{3})\.vpk|recovery-[0-9a-f-]{36}\.tmp)$/.test(basename(file.path)))) ||
        (file.before !== null && (typeof file.before !== 'string' || !/^[0-9a-f]{64}$/.test(file.before))) || !Array.isArray(file.allowed) ||
        !file.allowed.every(hash => typeof hash === 'string' && /^[0-9a-f]{64}$/.test(hash))) throw new Error('Invalid recovery journal path');
    await assertRecoveryPath(file.path);
    seen.add(file.path);
  }
  for (const move of journal.metadataMoves) {
    if (!move || typeof move.from !== 'string' || typeof move.to !== 'string' ||
        !/^(?:(?:grimoire|addons[1-9])\/)?[^/\\]+_dir\.vpk$/i.test(move.from) ||
        !/^(?:(?:grimoire|addons[1-9])\/)?[^/\\]+_dir\.vpk$/i.test(move.to)) throw new Error('Invalid recovery metadata move');
  }
  for (const [key, value] of Object.entries(journal.metadataBefore)) {
    if (!/^(?:(?:grimoire|addons[1-9])\/)?[^/\\]+_dir\.vpk$/i.test(key) ||
        (key.startsWith('grimoire/') && isReservedPriorityVpkArtifact(key.slice(9))) ||
        (value !== null && (!value || typeof value !== 'object' || Array.isArray(value)))) throw new Error('Invalid recovery metadata snapshot');
  }
  return journal;
}
export async function createRecoveryJournal(gamePath: string, activeProfileId: string | null): Promise<RecoveryJournal> {
  if (await readRecoveryJournal(gamePath)) throw new Error('An interrupted recovery must be resolved first');
  const journal: RecoveryJournal = { version: 1, gamePath: resolve(gamePath), createdAt: new Date().toISOString(), files: [], activeProfileId, metadataMoves: [], metadataBefore: {}, mutationStarted: false };
  await writeRecoveryJson(journalPath(), journal);
  return journal;
}
/** Record both the preimage and permitted transaction bytes before touching a path. */
export async function journalRecoveryPaths(journal: RecoveryJournal, paths: Array<{ path: string; hash?: string; expectedBefore?: string | null }>): Promise<void> {
  for (const entry of paths) {
    if (!isWithinRecoveryRoot(entry.path, journal.gamePath)) throw new Error('Recovery path escapes game installation');
    let file = journal.files.find(file => file.path === entry.path);
    if (!file) {
      const current = await fileHash(entry.path);
      if (entry.expectedBefore !== undefined && current !== entry.expectedBefore) throw new Error('Reviewed recovery file changed');
      file = { path: entry.path, before: current === null ? null : await retainRecoveryFile(entry.path), allowed: [] };
      if (entry.expectedBefore !== undefined && file.before !== entry.expectedBefore) throw new Error('Reviewed recovery file changed during backup');
      journal.files.push(file);
    }
    if (entry.hash && !file.allowed.includes(entry.hash)) file.allowed.push(entry.hash);
  }
  await writeRecoveryJson(journalPath(), journal);
}
export async function beginRecoveryMutation(journal: RecoveryJournal): Promise<void> {
  if (journal.mutationStarted) return;
  journal.mutationStarted = true;
  await writeRecoveryJson(journalPath(), journal);
}
export async function journalRecoveryMetadata(journal: RecoveryJournal, keys: string[]): Promise<void> {
  for (const key of keys) if (!Object.hasOwn(journal.metadataBefore, key)) journal.metadataBefore[key] = getModMetadata(key) ? JSON.parse(JSON.stringify(getModMetadata(key))) as ModMetadata : null;
  await writeRecoveryJson(journalPath(), journal);
}
export function rollbackRecoveryMetadata(journal: RecoveryJournal): void {
  for (const key of Object.keys(journal.metadataBefore)) removeModMetadata(key);
  for (const [key, value] of Object.entries(journal.metadataBefore)) if (value) setModMetadata(key, value);
}
export async function journalMetadataMoves(journal: RecoveryJournal, moves: RecoveryJournal['metadataMoves']): Promise<void> {
  journal.metadataMoves.push(...moves);
  await writeRecoveryJson(journalPath(), journal);
}
export async function journalIsolationState(journal: RecoveryJournal): Promise<void> {
  const path = join(recoveryDirectory(), 'isolation.json');
  const before = await fileHash(path);
  journal.isolation = { before: before ? await retainRecoveryFile(path) : null, allowed: [] };
  await writeRecoveryJson(journalPath(), journal);
}
export async function writeJournaledIsolation(journal: RecoveryJournal, session: unknown | null): Promise<void> {
  if (!journal.isolation) throw new Error('Isolation preimage was not journaled');
  journal.isolation.allowed.push(session === null ? null : createHash('sha256').update(JSON.stringify(session)).digest('hex'));
  await writeRecoveryJson(journalPath(), journal);
  await beginRecoveryMutation(journal);
  const path = join(recoveryDirectory(), 'isolation.json');
  if (session === null) await fs.unlink(path);
  else await writeRecoveryJson(path, session);
}
export async function journalLaunchOptions(journal: RecoveryJournal, before: string, after: string): Promise<void> {
  journal.launchOptions = { before, after };
  await writeRecoveryJson(journalPath(), journal);
}
export async function previewInterruptedRecovery(gamePath: string): Promise<InterruptedRecovery | null> {
  const journal = await readRecoveryJournal(gamePath);
  if (!journal) return null;
  const state = [];
  let canRecover = true;
  for (const file of journal.files) {
    const hash = await fileHash(file.path);
    state.push({ path: file.path, hash });
    if (hash !== null && hash !== file.before && !file.allowed.includes(hash)) canRecover = false;
    if (file.before && !await hasRecoveryFile(file.before)) canRecover = false;
  }
  const isolationHash = journal.isolation ? await fileHash(join(recoveryDirectory(), 'isolation.json')) : undefined;
  if (journal.isolation && ((isolationHash !== journal.isolation.before && !journal.isolation.allowed.includes(isolationHash!)) || (journal.isolation.before && !await hasRecoveryFile(journal.isolation.before)))) canRecover = false;
  const launchOptions = journal.launchOptions ? loadSettings().steamLaunchOptions ?? '' : undefined;
  if (journal.launchOptions && launchOptions !== journal.launchOptions.before && launchOptions !== journal.launchOptions.after) canRecover = false;
  return { createdAt: journal.createdAt, fileCount: journal.files.length, canRecover,
    reviewToken: createHash('sha256').update(JSON.stringify({ journal, state, isolationHash, launchOptions, metadata: Object.keys(journal.metadataBefore).map(key => ({ key, value: getModMetadata(key) })), activeProfileId: loadSettings().activeProfileId })).digest('hex') };
}
export async function rollbackRecoveryJournal(gamePath: string, reviewToken: string): Promise<RecoveryJournal> {
  const journal = await readRecoveryJournal(gamePath);
  const preview = await previewInterruptedRecovery(gamePath);
  if (!journal || !preview?.canRecover || preview.reviewToken !== reviewToken) throw new Error('Interrupted recovery review is stale or files changed outside recovery');
  const reviewedIsolation = journal.isolation ? await fileHash(join(recoveryDirectory(), 'isolation.json')) : undefined;
  const reviewedSettings = loadSettings();
  const reviewedMetadata = JSON.stringify(Object.keys(journal.metadataBefore).map(key => getModMetadata(key)));
  const reviewedFiles = new Map<string, string | null>();
  for (const file of journal.files) reviewedFiles.set(file.path, await fileHash(file.path));
  const confirmed = await previewInterruptedRecovery(gamePath);
  if (!confirmed?.canRecover || confirmed.reviewToken !== reviewToken) throw new Error('Interrupted recovery review changed before rollback');
  // Restore all original content before removing newly introduced files. Retry is idempotent.
  const validate = async (file: JournalFile) => {
    const current = await fileHash(file.path);
    if (current !== reviewedFiles.get(file.path) || (current !== null && current !== file.before && !file.allowed.includes(current))) throw new Error('Recovery file changed during rollback');
  };
  for (const file of journal.files) if (file.before) await placeRecoveryFile(file.before, file.path, () => validate(file));
  for (const file of journal.files) if (file.before === null) {
    await validate(file);
    await fs.unlink(file.path).catch((error: NodeJS.ErrnoException) => { if (error.code !== 'ENOENT') throw error; });
  }
  if (journal.isolation) {
    const path = join(recoveryDirectory(), 'isolation.json');
    const validate = async () => {
      if (await fileHash(path) !== reviewedIsolation) throw new Error('Isolation session changed during rollback');
    };
    if (journal.isolation.before) await placeRecoveryFile(journal.isolation.before, path, validate);
    else { await validate(); await fs.unlink(path).catch((error: NodeJS.ErrnoException) => { if (error.code !== 'ENOENT') throw error; }); }
  }
  const settings = loadSettings();
  if (settings.activeProfileId !== reviewedSettings.activeProfileId || journal.launchOptions && settings.steamLaunchOptions !== reviewedSettings.steamLaunchOptions
      || JSON.stringify(Object.keys(journal.metadataBefore).map(key => getModMetadata(key))) !== reviewedMetadata) throw new Error('Recovery metadata or settings changed during rollback');
  return journal;
}
export async function clearRecoveryJournal(): Promise<void> {
  await fs.unlink(journalPath()).catch((error: NodeJS.ErrnoException) => { if (error.code !== 'ENOENT') throw error; });
}
