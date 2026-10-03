import { createHash, randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { basename, dirname, join, resolve } from 'path';
import { getUserDataPath } from '../utils/paths';
import { scanMods, runExclusiveModMutation, type Mod } from './mods';
import { fingerprintFile } from './fileMatch';
import { findChunkSiblingNames } from './vpk';
import { getAutoexecPath } from './autoexec';
import { getGameinfoPath, metaKeyFor, getModScanRootPaths, getDisabledPath, isReservedPriorityVpkArtifact } from './deadlock';
import { migrateModMetadata, getModMetadata, setModMetadata, type ModMetadata } from './metadata';
import { moveSafetySnapshot, assertVpkSafety } from './modSafety';
import { assertCanMoveLoadedGameMods, syncRunningGameModSnapshotFromMods } from './gameSessionMods';
import { loadSettings, saveSettings } from './settings';
import { assertRecoveryPath, hasRecoveryFile, placeRecoveryFile, pruneRecoveryFiles, retainRecoveryFile, writeRecoveryJson } from './recoveryBackup';
import { clearRecoveryJournal, createRecoveryJournal, journalMetadataMoves, journalRecoveryMetadata, rollbackRecoveryMetadata, beginRecoveryMutation, journalRecoveryPaths, previewInterruptedRecovery, readRecoveryJournal, rollbackRecoveryJournal, type RecoveryJournal } from './recoveryJournal';
import type { InterruptedRecovery, ProfileRecoveryPreview, ProfileRecoverySummary } from '../../../src/types/profileRecovery';

interface RecoveryMod {
  id: string;
  name: string;
  path: string;
  enabled: boolean;
  priorityMod: boolean;
  hashes: string[];
  files?: string[];
  metadata?: ModMetadata;
}
interface RecoveryPoint extends ProfileRecoverySummary {
  version: 1 | 2;
  deadlockPath: string;
  activeProfileId: string | null;
  mods: RecoveryMod[];
  autoexec: string | null;
  gameinfo: string | null;
  performanceState?: string | null;
}
const HISTORY_LIMIT = 10;
const MAX_CONFIG_BYTES = 4 * 1024 * 1024;
const performanceStatePath = (deadlockPath: string) => join(dirname(getGameinfoPath(deadlockPath)), 'grimoire-performance.json');
const directory = () => join(getUserDataPath(), 'profile-recovery');
function pointPath(id: string): string {
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error('Invalid recovery point ID');
  return join(directory(), `${id}.json`);
}
async function readConfig(path: string): Promise<string | null> {
  try {
    await assertRecoveryPath(path);
    if ((await fs.stat(path)).size > MAX_CONFIG_BYTES) throw new Error('Configuration exceeds recovery size limit');
    return (await fs.readFile(path)).toString('base64');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}
async function writeConfig(path: string, value: string | null, journal?: RecoveryJournal, reviewed?: string | null): Promise<void> {
  await assertRecoveryPath(path);
  if (journal) await journalRecoveryPaths(journal, [{ path, hash: value === null ? undefined : createHash('sha256').update(Buffer.from(value, 'base64')).digest('hex') }]);
  if (value === null) {
    if (journal) await beginRecoveryMutation(journal);
    if (reviewed !== undefined && await readConfig(path) !== reviewed) throw new Error('Reviewed configuration changed before deletion');
    await fs.unlink(path).catch((error: NodeJS.ErrnoException) => { if (error.code !== 'ENOENT') throw error; });
    return;
  }
  await fs.mkdir(dirname(path), { recursive: true });
  const temp = `${path}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temp, Buffer.from(value, 'base64'));
    if (journal) await beginRecoveryMutation(journal);
    if (reviewed !== undefined && await readConfig(path) !== reviewed) throw new Error('Reviewed configuration changed before replacement');
    await fs.rename(temp, path);
  } finally {
    await fs.unlink(temp).catch(() => {});
  }
}
async function setFiles(path: string): Promise<string[]> {
  await assertRecoveryPath(path);
  return [path, ...findChunkSiblingNames(basename(path), await fs.readdir(dirname(path))).sort().map(name => join(dirname(path), name))];
}
async function hashes(path: string): Promise<string[]> {
  const result: string[] = [];
  for (const file of await setFiles(path)) { await assertRecoveryPath(file); result.push((await fingerprintFile(file)).sha256); }
  return result;
}
async function capture(deadlockPath: string, profileName: string, current?: Mod[]): Promise<RecoveryPoint> {
  const mods = current ?? await scanMods(deadlockPath);
  const entries: RecoveryMod[] = [];
  for (const mod of mods) {
    const files = await setFiles(mod.path);
    const retained: string[] = [];
    for (const file of files) retained.push(await retainRecoveryFile(file));
    entries.push({ id: mod.id, name: mod.name, path: mod.path, enabled: mod.enabled,
      priorityMod: !!getModMetadata(mod.metaKey)?.priorityMod, metadata: getModMetadata(mod.metaKey), hashes: retained, files: files.map(file => basename(file)) });
  }
  return { version: 2, id: randomUUID(), createdAt: new Date().toISOString(), profileName,
    modCount: entries.length, enabledCount: entries.filter(mod => mod.enabled).length,
    deadlockPath: resolve(deadlockPath), activeProfileId: loadSettings().activeProfileId ?? null,
    mods: entries, autoexec: await readConfig(getAutoexecPath(deadlockPath)), gameinfo: await readConfig(getGameinfoPath(deadlockPath)), performanceState: await readConfig(performanceStatePath(deadlockPath)) };
}
/** Caller already owns the mod mutation lock. A failed capture blocks mutation. */
export async function captureProfileRecoveryUnlocked(deadlockPath: string, profileName: string, current?: Mod[], purpose?: 'isolation'): Promise<ProfileRecoverySummary> {
  if (await readRecoveryJournal(deadlockPath)) throw new Error('Resolve interrupted recovery before creating another restore point');
  const point = await capture(deadlockPath, profileName, current);
  point.purpose = purpose;
  await fs.mkdir(directory(), { recursive: true });
  await writeRecoveryJson(pointPath(point.id), point);
  await cleanupRecoveryHistory(point.id);
  return summary(point);
}
/** Cleanup uses every actual point file, never the intentionally forgiving UI list. */
async function cleanupRecoveryHistory(newId: string): Promise<void> {
  try {
    await assertRecoveryPath(directory());
    const names = await fs.readdir(directory());
    const points: RecoveryPoint[] = [];
    for (const name of names.filter(name => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.json$/.test(name))) {
      // Any read, validation or original-installation error aborts cleanup before deletion.
      points.push(await readPoint(name.slice(0, -5)));
    }
    const isolationPath = join(directory(), 'isolation.json');
    await assertRecoveryPath(isolationPath);
    let protectedId: string | null = null;
    try {
      const isolation: unknown = JSON.parse(await fs.readFile(isolationPath, 'utf8'));
      if (!isolation || typeof isolation !== 'object' || !('recoveryPointId' in isolation) ||
          typeof isolation.recoveryPointId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(isolation.recoveryPointId)) {
        throw new Error('Invalid protected recovery point');
      }
      protectedId = isolation.recoveryPointId;
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    if (protectedId && !points.some(point => point.id === protectedId)) throw new Error('Protected recovery point is missing');
    points.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
    const remove = points.filter(point => point.id !== newId && point.id !== protectedId).slice(HISTORY_LIMIT - 1);
    const removedIds = new Set(remove.map(point => point.id));
    const keep = new Set<string>();
    for (const point of points.filter(point => !removedIds.has(point.id))) for (const mod of point.mods) for (const hash of mod.hashes) keep.add(hash);
    for (const point of remove) await fs.unlink(pointPath(point.id));
    await pruneRecoveryFiles(keep);
  } catch {
    // Capture succeeded. Unknown ownership keeps all remaining point files and blobs.
  }
}
async function readPoint(id: string): Promise<RecoveryPoint> {
  await assertRecoveryPath(pointPath(id));
  const raw = await fs.readFile(pointPath(id), 'utf8');
  const point = JSON.parse(raw) as RecoveryPoint;
  const validConfig = (value: unknown): boolean => {
    if (value === null) return true;
    if (typeof value !== 'string' || value.length > Math.ceil(MAX_CONFIG_BYTES / 3) * 4) return false;
    return Buffer.from(value, 'base64').toString('base64') === value && Buffer.from(value, 'base64').length <= MAX_CONFIG_BYTES;
  };
  if (!point || (point.version !== 1 && point.version !== 2) || point.id !== id || !Array.isArray(point.mods) ||
    typeof point.deadlockPath !== 'string' || !point.deadlockPath || resolve(point.deadlockPath) !== point.deadlockPath ||
    (point.purpose !== undefined && point.purpose !== 'isolation') || typeof point.profileName !== 'string' || typeof point.createdAt !== 'string' || !Number.isFinite(Date.parse(point.createdAt)) ||
    (point.activeProfileId !== null && typeof point.activeProfileId !== 'string') ||
    !validConfig(point.autoexec) || !validConfig(point.gameinfo) ||
    (point.performanceState !== undefined && !validConfig(point.performanceState)) || point.modCount !== point.mods.length ||
    point.enabledCount !== point.mods.filter(mod => mod?.enabled === true).length) throw new Error('Invalid recovery point');
  const roots = [...getModScanRootPaths(point.deadlockPath), getDisabledPath(point.deadlockPath)].map(root => resolve(root));
  const paths = new Set<string>();
  for (const mod of point.mods) {
    if (!mod || typeof mod.id !== 'string' || !mod.id || typeof mod.name !== 'string' ||
      typeof mod.enabled !== 'boolean' || typeof mod.priorityMod !== 'boolean' ||
      (mod.metadata !== undefined && (!mod.metadata || typeof mod.metadata !== 'object' || Array.isArray(mod.metadata))) ||
      typeof mod.path !== 'string' || resolve(mod.path) !== mod.path || !roots.includes(dirname(mod.path)) ||
      !basename(mod.path).toLowerCase().endsWith('_dir.vpk') || paths.has(mod.path) ||
      (basename(dirname(mod.path)) === 'grimoire' && isReservedPriorityVpkArtifact(basename(mod.path))) ||
      !Array.isArray(mod.hashes) || !mod.hashes.length || !mod.hashes.every(hash => typeof hash === 'string' && /^[0-9a-f]{64}$/.test(hash))) throw new Error('Invalid recovery asset');
    await assertRecoveryPath(mod.path);
    if (point.version === 2) {
      const files = mod.files;
      const allowed = files ? [basename(mod.path), ...findChunkSiblingNames(basename(mod.path), files).sort()] : [];
      if (!Array.isArray(files) || files.length !== mod.hashes.length || JSON.stringify(files) !== JSON.stringify(allowed) ||
          files.some(name => basename(name) !== name || name.includes('\\'))) throw new Error('Invalid retained recovery asset');
    }
    paths.add(mod.path);
  }
  return point;
}
function summary(point: RecoveryPoint): ProfileRecoverySummary {
  return { id: point.id, createdAt: point.createdAt, profileName: point.profileName, modCount: point.modCount, enabledCount: point.enabledCount, retainedBytes: point.version === 2, purpose: point.purpose };
}
export async function listProfileRecoveryPoints(): Promise<ProfileRecoverySummary[]> {
  const result: ProfileRecoverySummary[] = [];
  const names = await fs.readdir(directory()).catch((error: NodeJS.ErrnoException) => { if (error.code === 'ENOENT') return []; throw error; });
  for (const name of names.filter(name => name.endsWith('.json'))) {
    try { result.push(summary(await readPoint(name.slice(0, -5)))); } catch { /* Damaged points are never offered for restore. */ }
  }
  return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
}
interface ReviewedConfig { path: string; value: string | null }
interface Resolution { configs: ReviewedConfig[]; preview: ProfileRecoveryPreview; matches: Map<RecoveryMod, Mod>; retained: RecoveryMod[] }
async function resolvePoint(point: RecoveryPoint, deadlockPath: string, current: Mod[]): Promise<Resolution> {
  if (resolve(deadlockPath) !== point.deadlockPath) throw new Error('Recovery point belongs to a different game installation');
  const live = new Map<Mod, string[]>();
  for (const mod of current) live.set(mod, await hashes(mod.path));
  const matches = new Map<RecoveryMod, Mod>();
  const retained: RecoveryMod[] = [];
  const issues: ProfileRecoveryPreview['issues'] = [];
  const used = new Set<string>();
  for (const saved of point.mods) {
    let candidates = current.filter(mod => JSON.stringify(live.get(mod)) === JSON.stringify(saved.hashes));
    if (!candidates.length && point.version === 2) {
      candidates = [];
      for (const mod of current) {
        if (live.get(mod)?.[0] !== saved.hashes[0]) continue;
        const files = await setFiles(mod.path);
        const stem = basename(mod.path).replace(/_dir\.vpk$/, '');
        const savedStem = basename(saved.path).replace(/_dir\.vpk$/, '');
        let partial = true;
        for (let index = 0; index < files.length; index++) {
          const expectedName = index === 0 ? basename(saved.path) : savedStem + basename(files[index]).slice(stem.length);
          const savedIndex = saved.files!.indexOf(expectedName);
          if (savedIndex < 0 || live.get(mod)?.[index] !== saved.hashes[savedIndex]) partial = false;
        }
        for (const hash of saved.hashes) if (!await hasRecoveryFile(hash)) partial = false;
        if (partial) candidates.push(mod);
      }
    }
    const candidate = candidates[0];
    if (!candidate) {
      const changed = current.some(mod => mod.id === saved.id || mod.path === saved.path);
      let available = point.version === 2 && !changed;
      for (const hash of saved.hashes) if (!await hasRecoveryFile(hash)) available = false;
      if (available) retained.push(saved);
      else issues.push({ name: saved.name, reason: changed ? 'changed' : 'missing' });
    }
    else if (candidates.length > 1 || used.has(candidate.id)) issues.push({ name: saved.name, reason: 'ambiguous' });
    else { matches.set(saved, candidate); used.add(candidate.id); }
  }
  const configs: ReviewedConfig[] = [];
  for (const path of [getAutoexecPath(deadlockPath), getGameinfoPath(deadlockPath), performanceStatePath(deadlockPath)]) configs.push({ path, value: await readConfig(path) });
  const state = { point, retained: retained.map(mod => mod.id), live: current.map(mod => ({ id: mod.id, path: mod.path, enabled: mod.enabled, hashes: live.get(mod) })), configs, activeProfileId: loadSettings().activeProfileId };
  return { matches, retained, configs, preview: { point: summary(point), issues, canRestore: issues.length === 0,
    reviewToken: createHash('sha256').update(JSON.stringify(state)).digest('hex'),
    recoverCount: retained.length, disableCount: current.filter(mod => mod.enabled && !used.has(mod.id)).length } };
}
export async function previewProfileRecovery(deadlockPath: string, id: string): Promise<ProfileRecoveryPreview> {
  return runExclusiveModMutation(async () => (await resolvePoint(await readPoint(id), deadlockPath, await scanMods(deadlockPath))).preview);
}

/** Stage every file before placement, so swaps never overwrite another VPK. */
async function moveSets(moves: Array<{ from: string; to: string }>, journal: RecoveryJournal): Promise<void> {
  const steps: Array<{ from: string; temp: string; to: string; location: string }> = [];
  const sources = new Set<string>();
  for (const move of moves) {
    const sourceFiles = await setFiles(move.from);
    const sourceStem = basename(move.from).replace(/_dir\.vpk$/, '');
    const targetStem = basename(move.to).replace(/_dir\.vpk$/, '');
    for (const file of sourceFiles) {
      const to = file === move.from ? move.to : join(dirname(move.to), targetStem + basename(file).slice(sourceStem.length));
      steps.push({ from: file, to, temp: join(dirname(file), `recovery-${randomUUID()}.tmp`), location: file });
      sources.add(file);
    }
  }
  const targets = new Set<string>();
  for (const step of steps) {
    if (targets.has(step.to)) throw new Error('Recovery contains conflicting target paths');
    targets.add(step.to);
    try {
      await assertRecoveryPath(step.to);
      await fs.access(step.to);
      if (!sources.has(step.to) && (await fingerprintFile(step.to)).sha256 !== (await fingerprintFile(step.from)).sha256) throw new Error('Recovery target is occupied');
    }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    await fs.mkdir(dirname(step.to), { recursive: true });
  }
  const entries: Array<{ path: string; hash: string }> = [];
  for (const step of steps) {
    const hash = (await fingerprintFile(step.from)).sha256;
    entries.push({ path: step.from, hash }, { path: step.temp, hash }, { path: step.to, hash });
  }
  await journalRecoveryPaths(journal, entries);
  await beginRecoveryMutation(journal);
  try {
    for (const step of steps) { await fs.rename(step.from, step.temp); step.location = step.temp; }
    for (const step of steps) { await fs.rename(step.temp, step.to); step.location = step.to; }
  } catch (error) {
    const failures: string[] = [];
    for (const step of [...steps].reverse()) {
      if (step.location === step.to) {
        try { await fs.rename(step.to, step.temp); step.location = step.temp; } catch (rollback) { failures.push(String(rollback)); }
      }
    }
    for (const step of [...steps].reverse()) {
      if (step.location === step.temp) {
        try { await fs.rename(step.temp, step.from); } catch (rollback) { failures.push(String(rollback)); }
      }
    }
    throw new Error(`${String(error)}${failures.length ? `; file rollback incomplete: ${failures.join('; ')}` : ''}`);
  }
  const safetyMoves = moves.map(move => ({ ...move, temp: `${move.from}.${randomUUID()}.recovery` }));
  for (const move of safetyMoves) moveSafetySnapshot(move.from, move.temp);
  for (const move of safetyMoves) moveSafetySnapshot(move.temp, move.to);
}
async function applyPointUnlocked(point: RecoveryPoint, deadlockPath: string, journal: RecoveryJournal, approvedToken?: string, verifyReviewedState?: () => Promise<void>): Promise<void> {
  const current = await scanMods(deadlockPath);
  const resolution = await resolvePoint(point, deadlockPath, current);
  if (!resolution.preview.canRestore) throw new Error('Recovery assets are missing, changed or ambiguous');
  const token = approvedToken ?? resolution.preview.reviewToken;
  if (token !== resolution.preview.reviewToken) throw new Error('Recovery review is stale');
  await verifyReviewedState?.();
  // These are the approved preimages, captured by resolution before safety waits.
  for (const config of resolution.configs) {
    if (config.path === performanceStatePath(deadlockPath) && (point.version !== 2 || point.performanceState === undefined)) continue;
    await journalRecoveryPaths(journal, [{ path: config.path, expectedBefore: config.value === null ? null : createHash('sha256').update(Buffer.from(config.value, 'base64')).digest('hex') }]);
  }
  const reviewedValue = (path: string) => resolution.configs.find(config => config.path === path)!.value;
  const running = await syncRunningGameModSnapshotFromMods(current);
  if (running?.running) throw new Error('Game is running');
  assertCanMoveLoadedGameMods(current.filter(mod => mod.enabled));
  // Incomplete or deleted sets are checked in userData, keeping the approved game setup untouched.
  const checkRoot = join(directory(), `check-${randomUUID()}`);
  try {
    for (const saved of point.mods.filter(mod => mod.enabled)) {
      const mod = resolution.matches.get(saved);
      if (mod && JSON.stringify(await hashes(mod.path)) === JSON.stringify(saved.hashes)) {
        await assertVpkSafety(mod.path, { name: saved.name });
      } else {
        const checkPath = join(checkRoot, saved.id.replace(/[^a-zA-Z0-9-]/g, ''), basename(saved.path));
        for (let index = 0; index < saved.files!.length; index++) await placeRecoveryFile(saved.hashes[index], join(dirname(checkPath), saved.files![index]));
        await assertVpkSafety(checkPath, { name: saved.name });
      }
    }
  } finally { await fs.rm(checkRoot, { recursive: true, force: true }); }
  const afterSafety = await resolvePoint(point, deadlockPath, await scanMods(deadlockPath));
  if (afterSafety.preview.reviewToken !== token) throw new Error('Recovery review changed during safety check');
  await verifyReviewedState?.();
  // Fill missing chunks only when every remaining byte matches the retained set.
  for (const [saved, mod] of resolution.matches) if (point.version === 2) {
    const stem = basename(mod.path).replace(/_dir\.vpk$/, '');
    const savedStem = basename(saved.path).replace(/_dir\.vpk$/, '');
    for (let index = 1; index < saved.files!.length; index++) {
      const path = join(dirname(mod.path), stem + saved.files![index].slice(savedStem.length));
      try { await fs.access(path); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        await journalRecoveryPaths(journal, [{ path, hash: saved.hashes[index] }]);
        await beginRecoveryMutation(journal);
        await placeRecoveryFile(saved.hashes[index], path);
      }
    }
  }
  // Hydrate missing sets into a unique disabled filename before any enabled placement.
  for (const saved of resolution.retained) {
    const path = join(getDisabledPath(deadlockPath), `recovery-${randomUUID()}_dir.vpk`);
    const stem = basename(path).replace(/_dir\.vpk$/, '');
    const originalStem = basename(saved.path).replace(/_dir\.vpk$/, '');
    const files = saved.files!;
    for (let i = 0; i < files.length; i++) {
      const target = i === 0 ? path : join(dirname(path), stem + files[i].slice(originalStem.length));
      await journalRecoveryPaths(journal, [{ path: target, hash: saved.hashes[i] }]);
      await beginRecoveryMutation(journal);
      await placeRecoveryFile(saved.hashes[i], target);
    }
    await journalRecoveryMetadata(journal, [metaKeyFor(path)]);
    setModMetadata(metaKeyFor(path), { ...saved.metadata, modUid: saved.id, modName: saved.name, priorityMod: saved.priorityMod || undefined });
    resolution.matches.set(saved, { id: saved.id, name: saved.name, enabled: false, path, fileName: basename(path), metaKey: metaKeyFor(path), priority: 0, size: (await fs.stat(path)).size, installedAt: point.createdAt });
  }
  const selected = new Set([...resolution.matches.values()].map(mod => mod.id));
  const moves = [...resolution.matches].filter(([saved, mod]) => resolve(saved.path) !== resolve(mod.path)).map(([saved, mod]) => ({ from: mod.path, to: saved.path }));
  for (const mod of current) if (mod.enabled && !selected.has(mod.id)) {
    moves.push({ from: mod.path, to: join(getDisabledPath(deadlockPath), `recovery-${randomUUID()}_${basename(mod.path)}`) });
  }
  await journalRecoveryMetadata(journal, [...moves.flatMap(move => [metaKeyFor(move.from), metaKeyFor(move.to)]), ...point.mods.map(mod => metaKeyFor(mod.path))]);
  await moveSets(moves, journal);
  const metadataMoves = moves.map(move => ({ from: metaKeyFor(move.from), to: metaKeyFor(move.to) }));
  await journalMetadataMoves(journal, metadataMoves);
  migrateModMetadata(metadataMoves);
  for (const saved of point.mods) {
    const key = metaKeyFor(saved.path);
    if (!!getModMetadata(key)?.priorityMod !== saved.priorityMod) setModMetadata(key, { priorityMod: saved.priorityMod || undefined });
  }
  await writeConfig(getAutoexecPath(deadlockPath), point.autoexec, journal, reviewedValue(getAutoexecPath(deadlockPath)));
  await writeConfig(getGameinfoPath(deadlockPath), point.gameinfo, journal, reviewedValue(getGameinfoPath(deadlockPath)));
  if (point.version === 2 && point.performanceState !== undefined) await writeConfig(performanceStatePath(deadlockPath), point.performanceState, journal, reviewedValue(performanceStatePath(deadlockPath)));
  const settings = loadSettings();
  settings.activeProfileId = point.activeProfileId;
  saveSettings(settings);
}
export async function restoreProfileRecovery(deadlockPath: string, id: string, reviewToken: string): Promise<void> {
  return runExclusiveModMutation(async () => {
    const point = await readPoint(id);
    const current = await scanMods(deadlockPath);
    const { preview } = await resolvePoint(point, deadlockPath, current);
    if (!preview.canRestore || !reviewToken || preview.reviewToken !== reviewToken) throw new Error('Recovery review is stale or assets cannot be restored. Preview again.');
    const journal = await createRecoveryJournal(deadlockPath, loadSettings().activeProfileId ?? null);
    try { await applyPointUnlocked(point, deadlockPath, journal, reviewToken); await clearRecoveryJournal(); }
    catch (error) {
      try { await recoverInterruptedUnlocked(deadlockPath); }
      catch (failure) { throw new Error(`Restore failed: ${String(error)}; rollback incomplete: ${String(failure)}`); }
      throw new Error(`Restore failed and previous state was restored: ${String(error)}`);
    }
  });
}
async function recoverInterruptedUnlocked(deadlockPath: string, token?: string): Promise<void> {
  const preview = await previewInterruptedRecovery(deadlockPath);
  if (!preview) throw new Error('No interrupted recovery');
  const existing = await readRecoveryJournal(deadlockPath);
  if (existing && !existing.mutationStarted) {
    if (token && token !== preview.reviewToken) throw new Error('Interrupted recovery review is stale');
    await clearRecoveryJournal(); return;
  }
  const current = await scanMods(deadlockPath);
  const running = await syncRunningGameModSnapshotFromMods(current);
  if (running?.running) throw new Error('Game is running');
  assertCanMoveLoadedGameMods(current.filter(mod => mod.enabled));
  const journal = await rollbackRecoveryJournal(deadlockPath, token ?? preview.reviewToken);
  rollbackRecoveryMetadata(journal);
  const settings = loadSettings(); settings.activeProfileId = journal.activeProfileId; saveSettings(settings);
  await clearRecoveryJournal();
}
export function getInterruptedProfileRecovery(deadlockPath: string): Promise<InterruptedRecovery | null> {
  return runExclusiveModMutation(() => previewInterruptedRecovery(deadlockPath));
}
export function recoverInterruptedProfileRecovery(deadlockPath: string, token: string): Promise<void> {
  return runExclusiveModMutation(() => recoverInterruptedUnlocked(deadlockPath, token));
}
/** Isolation owns the lock. Capture first so the original setup is always retained. */
export async function captureIsolationRecoveryUnlocked(deadlockPath: string): Promise<ProfileRecoverySummary> {
  return captureProfileRecoveryUnlocked(deadlockPath, 'isolation', undefined, 'isolation');
}
export async function applyIsolationRecoveryUnlocked(deadlockPath: string, id: string, enabledIds: string[], verifyReviewedState?: () => Promise<void>): Promise<void> {
  const point = await readPoint(id);
  await verifyReviewedState?.();
  if (await readRecoveryJournal(deadlockPath)) throw new Error('Resolve interrupted recovery first');
  const enabled = new Set(enabledIds);
  const trial = { ...point, activeProfileId: null, mods: point.mods.map(mod => ({ ...mod,
    enabled: enabled.has(mod.id), path: enabled.has(mod.id) ? mod.path : join(getDisabledPath(deadlockPath), `isolation-${mod.id.replace(/[^a-zA-Z0-9-]/g, '')}_${basename(mod.path)}`) })) };
  trial.enabledCount = trial.mods.filter(mod => mod.enabled).length;
  const journal = await createRecoveryJournal(deadlockPath, loadSettings().activeProfileId ?? null);
  try { await applyPointUnlocked(trial, deadlockPath, journal, undefined, verifyReviewedState); await clearRecoveryJournal(); }
  catch (error) { await recoverInterruptedUnlocked(deadlockPath); throw error; }
}

export async function restoreIsolationRecoveryUnlocked(deadlockPath: string, id: string, verifyReviewedState?: () => Promise<void>): Promise<void> {
  const point = await readPoint(id);
  await verifyReviewedState?.();
  const journal = await createRecoveryJournal(deadlockPath, loadSettings().activeProfileId ?? null);
  try { await applyPointUnlocked(point, deadlockPath, journal, undefined, verifyReviewedState); await clearRecoveryJournal(); }
  catch (error) { await recoverInterruptedUnlocked(deadlockPath); throw error; }
}
