import { createHash, randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { basename, dirname, join, resolve } from 'path';
import { getUserDataPath } from '../utils/paths';
import { scanMods, disableModUnlocked, runExclusiveModMutation, type Mod } from './mods';
import { fingerprintFile } from './fileMatch';
import { findChunkSiblingNames } from './vpk';
import { getAutoexecPath } from './autoexec';
import { getGameinfoPath, metaKeyFor, getModScanRootPaths, getDisabledPath } from './deadlock';
import { migrateModMetadata, getModMetadata, setModMetadata } from './metadata';
import { moveSafetySnapshot, assertVpkSafety } from './modSafety';
import { assertCanMoveLoadedGameMods, syncRunningGameModSnapshotFromMods } from './gameSessionMods';
import { loadSettings, saveSettings } from './settings';
import type { ProfileRecoveryPreview, ProfileRecoverySummary } from '../../../src/types/profileRecovery';

interface RecoveryMod {
  id: string;
  name: string;
  path: string;
  enabled: boolean;
  priorityMod: boolean;
  hashes: string[];
}
interface RecoveryPoint extends ProfileRecoverySummary {
  version: 1;
  deadlockPath: string;
  activeProfileId: string | null;
  mods: RecoveryMod[];
  autoexec: string | null;
  gameinfo: string | null;
}
const HISTORY_LIMIT = 10;
const MAX_CONFIG_BYTES = 4 * 1024 * 1024;
const directory = () => join(getUserDataPath(), 'profile-recovery');
function pointPath(id: string): string {
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error('Invalid recovery point ID');
  return join(directory(), `${id}.json`);
}
async function readConfig(path: string): Promise<string | null> {
  try {
    if ((await fs.stat(path)).size > MAX_CONFIG_BYTES) throw new Error('Configuration exceeds recovery size limit');
    return (await fs.readFile(path)).toString('base64');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}
async function writeConfig(path: string, value: string | null): Promise<void> {
  if (value === null) {
    await fs.unlink(path).catch((error: NodeJS.ErrnoException) => { if (error.code !== 'ENOENT') throw error; });
    return;
  }
  await fs.mkdir(dirname(path), { recursive: true });
  const temp = `${path}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temp, Buffer.from(value, 'base64'));
    await fs.rename(temp, path);
  } finally {
    await fs.unlink(temp).catch(() => {});
  }
}
async function setFiles(path: string): Promise<string[]> {
  return [path, ...findChunkSiblingNames(basename(path), await fs.readdir(dirname(path))).sort().map(name => join(dirname(path), name))];
}
async function hashes(path: string): Promise<string[]> {
  const result: string[] = [];
  for (const file of await setFiles(path)) result.push((await fingerprintFile(file)).sha256);
  return result;
}
async function capture(deadlockPath: string, profileName: string, current?: Mod[]): Promise<RecoveryPoint> {
  const mods = current ?? await scanMods(deadlockPath);
  const entries: RecoveryMod[] = [];
  for (const mod of mods) entries.push({ id: mod.id, name: mod.name, path: mod.path, enabled: mod.enabled,
    priorityMod: !!getModMetadata(mod.metaKey)?.priorityMod, hashes: await hashes(mod.path) });
  return { version: 1, id: randomUUID(), createdAt: new Date().toISOString(), profileName,
    modCount: entries.length, enabledCount: entries.filter(mod => mod.enabled).length,
    deadlockPath: resolve(deadlockPath), activeProfileId: loadSettings().activeProfileId ?? null,
    mods: entries, autoexec: await readConfig(getAutoexecPath(deadlockPath)), gameinfo: await readConfig(getGameinfoPath(deadlockPath)) };
}
/** Caller already owns the mod mutation lock. A failed capture blocks mutation. */
export async function captureProfileRecoveryUnlocked(deadlockPath: string, profileName: string, current?: Mod[]): Promise<void> {
  const point = await capture(deadlockPath, profileName, current);
  await fs.mkdir(directory(), { recursive: true });
  const final = pointPath(point.id);
  const temp = `${final}.tmp`;
  try {
    await fs.writeFile(temp, JSON.stringify(point));
    await fs.rename(temp, final);
  } finally { await fs.unlink(temp).catch(() => {}); }
  const points = await listProfileRecoveryPoints();
  for (const old of points.filter(entry => entry.id !== point.id).slice(HISTORY_LIMIT - 1)) await fs.unlink(pointPath(old.id));
}
async function readPoint(id: string): Promise<RecoveryPoint> {
  const raw = await fs.readFile(pointPath(id), 'utf8');
  const point = JSON.parse(raw) as RecoveryPoint;
  const validConfig = (value: unknown): boolean => {
    if (value === null) return true;
    if (typeof value !== 'string' || value.length > Math.ceil(MAX_CONFIG_BYTES / 3) * 4) return false;
    return Buffer.from(value, 'base64').toString('base64') === value && Buffer.from(value, 'base64').length <= MAX_CONFIG_BYTES;
  };
  if (!point || point.version !== 1 || point.id !== id || !Array.isArray(point.mods) ||
    typeof point.deadlockPath !== 'string' || !point.deadlockPath || resolve(point.deadlockPath) !== point.deadlockPath ||
    typeof point.profileName !== 'string' || typeof point.createdAt !== 'string' || !Number.isFinite(Date.parse(point.createdAt)) ||
    (point.activeProfileId !== null && typeof point.activeProfileId !== 'string') ||
    !validConfig(point.autoexec) || !validConfig(point.gameinfo) || point.modCount !== point.mods.length ||
    point.enabledCount !== point.mods.filter(mod => mod?.enabled === true).length) throw new Error('Invalid recovery point');
  const roots = [...getModScanRootPaths(point.deadlockPath), getDisabledPath(point.deadlockPath)].map(root => resolve(root));
  const paths = new Set<string>();
  for (const mod of point.mods) {
    if (!mod || typeof mod.id !== 'string' || !mod.id || typeof mod.name !== 'string' ||
      typeof mod.enabled !== 'boolean' || typeof mod.priorityMod !== 'boolean' ||
      typeof mod.path !== 'string' || resolve(mod.path) !== mod.path || !roots.includes(dirname(mod.path)) ||
      !basename(mod.path).toLowerCase().endsWith('_dir.vpk') || paths.has(mod.path) ||
      !Array.isArray(mod.hashes) || !mod.hashes.length || !mod.hashes.every(hash => typeof hash === 'string' && /^[0-9a-f]{64}$/.test(hash))) throw new Error('Invalid recovery asset');
    paths.add(mod.path);
  }
  return point;
}
function summary(point: RecoveryPoint): ProfileRecoverySummary {
  return { id: point.id, createdAt: point.createdAt, profileName: point.profileName, modCount: point.modCount, enabledCount: point.enabledCount };
}
export async function listProfileRecoveryPoints(): Promise<ProfileRecoverySummary[]> {
  const result: ProfileRecoverySummary[] = [];
  const names = await fs.readdir(directory()).catch((error: NodeJS.ErrnoException) => { if (error.code === 'ENOENT') return []; throw error; });
  for (const name of names.filter(name => name.endsWith('.json'))) {
    try { result.push(summary(await readPoint(name.slice(0, -5)))); } catch { /* Damaged points are never offered for restore. */ }
  }
  return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
}
interface Resolution { preview: ProfileRecoveryPreview; matches: Map<RecoveryMod, Mod> }
async function resolvePoint(point: RecoveryPoint, deadlockPath: string, current: Mod[]): Promise<Resolution> {
  if (resolve(deadlockPath) !== point.deadlockPath) throw new Error('Recovery point belongs to a different game installation');
  const live = new Map<Mod, string[]>();
  for (const mod of current) live.set(mod, await hashes(mod.path));
  const matches = new Map<RecoveryMod, Mod>();
  const issues: ProfileRecoveryPreview['issues'] = [];
  const used = new Set<string>();
  for (const saved of point.mods) {
    const candidates = current.filter(mod => JSON.stringify(live.get(mod)) === JSON.stringify(saved.hashes));
    const candidate = candidates[0];
    if (!candidate) issues.push({ name: saved.name, reason: current.some(mod => mod.id === saved.id || mod.path === saved.path) ? 'changed' : 'missing' });
    else if (candidates.length > 1 || used.has(candidate.id)) issues.push({ name: saved.name, reason: 'ambiguous' });
    else { matches.set(saved, candidate); used.add(candidate.id); }
  }
  const state = { point, live: current.map(mod => ({ id: mod.id, path: mod.path, enabled: mod.enabled, hashes: live.get(mod) })),
    autoexec: await readConfig(getAutoexecPath(deadlockPath)), gameinfo: await readConfig(getGameinfoPath(deadlockPath)), activeProfileId: loadSettings().activeProfileId };
  return { matches, preview: { point: summary(point), issues, canRestore: issues.length === 0,
    reviewToken: createHash('sha256').update(JSON.stringify(state)).digest('hex'),
    disableCount: current.filter(mod => mod.enabled && !used.has(mod.id)).length } };
}
export async function previewProfileRecovery(deadlockPath: string, id: string): Promise<ProfileRecoveryPreview> {
  return runExclusiveModMutation(async () => (await resolvePoint(await readPoint(id), deadlockPath, await scanMods(deadlockPath))).preview);
}

/** Stage every file before placement, so swaps never overwrite another VPK. */
async function moveSets(moves: Array<{ from: string; to: string }>): Promise<void> {
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
    try { await fs.access(step.to); if (!sources.has(step.to)) throw new Error('Recovery target is occupied'); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    await fs.mkdir(dirname(step.to), { recursive: true });
  }
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
async function applyPointUnlocked(point: RecoveryPoint, deadlockPath: string): Promise<void> {
  const current = await scanMods(deadlockPath);
  const resolution = await resolvePoint(point, deadlockPath, current);
  if (!resolution.preview.canRestore) throw new Error('Recovery assets are missing, changed or ambiguous');
  await syncRunningGameModSnapshotFromMods(current);
  assertCanMoveLoadedGameMods(current.filter(mod => mod.enabled));
  for (const [saved, mod] of resolution.matches) if (saved.enabled) await assertVpkSafety(mod.path, { name: saved.name });
  const selected = new Set([...resolution.matches.values()].map(mod => mod.id));
  for (const mod of current) if (mod.enabled && !selected.has(mod.id)) await disableModUnlocked(deadlockPath, mod.id);
  const moves = [...resolution.matches].filter(([saved, mod]) => resolve(saved.path) !== resolve(mod.path)).map(([saved, mod]) => ({ from: mod.path, to: saved.path }));
  await moveSets(moves);
  migrateModMetadata(moves.map(move => ({ from: metaKeyFor(move.from), to: metaKeyFor(move.to) })));
  for (const saved of point.mods) {
    const key = metaKeyFor(saved.path);
    if (!!getModMetadata(key)?.priorityMod !== saved.priorityMod) setModMetadata(key, { priorityMod: saved.priorityMod || undefined });
  }
  await writeConfig(getAutoexecPath(deadlockPath), point.autoexec);
  await writeConfig(getGameinfoPath(deadlockPath), point.gameinfo);
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
    const rollback = await capture(deadlockPath, 'rollback', current);
    try { await applyPointUnlocked(point, deadlockPath); }
    catch (error) {
      try { await applyPointUnlocked(rollback, deadlockPath); }
      catch (failure) { throw new Error(`Restore failed: ${String(error)}; rollback incomplete: ${String(failure)}`); }
      throw new Error(`Restore failed and previous state was restored: ${String(error)}`);
    }
  });
}
