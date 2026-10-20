import { createHash, randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { dirname, join, relative, resolve } from 'path';
import { getUserDataPath } from '../utils/paths';
import { scanMods, runExclusiveModMutation } from './mods';
import { getCitadelPath, getGameinfoPath, getGrimoirePath, isReservedPriorityVpkArtifact } from './deadlock';
import { getAutoexecPath } from './autoexec';
import { findChunkSiblingNames } from './vpk';
import { fingerprintFile } from './fileMatch';
import { assertRecoveryPath, writeRecoveryJson } from './recoveryBackup';
import { loadSettings } from './settings';
import type { SetupTestHistory, SetupTestRecord, SetupTestSnapshot } from '../../../src/types/setupTestHistory';

const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const historyPath = () => join(getUserDataPath(), 'setup-test-history.json');
async function stableHash(path: string, optional = false): Promise<string | null> {
  await assertRecoveryPath(path);
  try {
    const before = await fs.stat(path, { bigint: true });
    const hash = (await fingerprintFile(path)).sha256;
    const after = await fs.stat(path, { bigint: true });
    if (before.ino !== after.ino || before.size !== after.size || before.mtimeNs !== after.mtimeNs || before.ctimeNs !== after.ctimeNs) {
      throw new Error('Setup changed while its test identity was being read.');
    }
    return hash;
  } catch (error) {
    if (optional && (error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}
async function snapshot(gamePath: string): Promise<SetupTestSnapshot> {
  const installationKey = digest(resolve(gamePath));
  const baseFingerprint = (await stableHash(join(getCitadelPath(gamePath), 'pak01_dir.vpk')))!;
  const mods = [];
  for (const mod of (await scanMods(gamePath)).filter(mod => mod.enabled).sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id))) {
    const chunks = findChunkSiblingNames(mod.fileName, await fs.readdir(dirname(mod.path))).sort();
    const hashes = [];
    for (const path of [mod.path, ...chunks.map(name => join(dirname(mod.path), name))]) hashes.push(await stableHash(path));
    mods.push({ name: mod.name, sha256: digest(hashes), priority: mod.priority, placement: relative(getCitadelPath(gamePath), mod.path).replace(/\\/g, '/') });
  }
  const configs = [];
  for (const path of [getGameinfoPath(gamePath), getAutoexecPath(gamePath), join(getCitadelPath(gamePath), 'grimoire-performance.json')]) {
    configs.push(await stableHash(path, true));
  }
  const managed: Array<[string, string | null]> = [];
  const priorityRoot = getGrimoirePath(gamePath);
  await assertRecoveryPath(priorityRoot);
  const artifacts = await fs.readdir(priorityRoot, { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => { if (error.code === 'ENOENT') return []; throw error; });
  for (const artifact of artifacts.filter(entry => isReservedPriorityVpkArtifact(entry.name)).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!artifact.isFile()) throw new Error('Managed Locker artifact is not a regular file');
    managed.push([artifact.name, await stableHash(join(priorityRoot, artifact.name))]);
  }
  // Names and the active profile label do not alter the running setup.
  const launchOptions = loadSettings().steamLaunchOptions;
  return { installationKey, baseFingerprint, modCount: mods.length, managedFileCount: managed.length, mods,
    reviewToken: digest({ installationKey, baseFingerprint, mods: mods.map(({ sha256, priority, placement }) => [sha256, priority, placement]), managed, configs, launchOptions }) };
}
async function loadRecords(): Promise<SetupTestRecord[]> {
  const path = historyPath();
  await assertRecoveryPath(path);
  try {
    if ((await fs.stat(path)).size > 2 * 1024 * 1024) throw new Error('Setup test history exceeds its size limit.');
    const records: unknown = JSON.parse(await fs.readFile(path, 'utf8'));
    if (!Array.isArray(records) || records.length > 100 || records.some(record => !record ||
      !/^[0-9a-f-]{36}$/.test(record.id) || !['works', 'crashes'].includes(record.result) ||
      !Number.isFinite(Date.parse(record.testedAt)) || typeof record.note !== 'string' || record.note.length > 300 ||
      ![record.reviewToken, record.installationKey, record.baseFingerprint].every(hash => typeof hash === 'string' && /^[0-9a-f]{64}$/.test(hash)) ||
      !Array.isArray(record.mods) || record.mods.length !== record.modCount || record.mods.length > 10000 ||
      record.mods.some((mod: SetupTestSnapshot['mods'][number]) => !mod || typeof mod.name !== 'string' || typeof mod.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(mod.sha256) || !Number.isSafeInteger(mod.priority) || mod.placement !== undefined && (typeof mod.placement !== 'string' || mod.placement.length > 4096)))) {
      throw new Error('Invalid setup test history.');
    }
    return records;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}
export function getSetupTestHistory(gamePath: string): Promise<SetupTestHistory> {
  return runExclusiveModMutation(async () => {
    const current = await snapshot(gamePath);
    const records = (await loadRecords()).filter(record => record.installationKey === current.installationKey)
      .map(record => ({ ...record, current: record.reviewToken === current.reviewToken, sameBuild: record.baseFingerprint === current.baseFingerprint }));
    return { current, records: records.reverse() };
  });
}
export function recordSetupTest(gamePath: string, reviewToken: string, result: 'works' | 'crashes', note = ''): Promise<void> {
  return runExclusiveModMutation(async () => {
    if (!['works', 'crashes'].includes(result) || typeof note !== 'string' || note.length > 300) throw new Error('Invalid setup test feedback.');
    const current = await snapshot(gamePath);
    if (reviewToken !== current.reviewToken) throw new Error('Setup changed since review. Refresh before recording a test.');
    const records = await loadRecords();
    // A second pass catches external edits during a long scan, not just app mutations.
    if ((await snapshot(gamePath)).reviewToken !== reviewToken) throw new Error('Setup changed during test capture.');
    records.push({ ...current, id: randomUUID(), testedAt: new Date().toISOString(), result, note: note.trim() });
    await writeRecoveryJson(historyPath(), records.slice(-100));
  });
}
