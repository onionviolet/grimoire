import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'fs';
import { createHash } from 'crypto';
import { join } from 'path';
import { tmpdir } from 'os';
import type { Mod, MergedModInfo } from '../../../src/types/mod';
import type { ModMetadata } from './metadata';
const h = vi.hoisted(() => ({ root: '', mods: [] as Mod[], metadata: {} as Record<string, ModMetadata> }));
vi.mock('electron', () => ({ app: { getPath: () => h.root, getAppPath: () => process.cwd(), getVersion: () => '1.30.1', isPackaged: false } }));
vi.mock('../utils/paths', () => ({ getUserDataPath: () => h.root }));
vi.mock('./settings', () => ({ loadSettings: () => ({}) }));
vi.mock('./mods', () => ({ scanMods: async () => {
  const path = join(h.root, 'merged_dir.vpk');
  try { const stat = await fs.stat(path); return [...h.mods, { id: 'merged', path, metaKey: path, fileName: 'merged_dir.vpk', name: 'Merged', enabled: true, priority: 1, size: stat.size } as Mod]; }
  catch { return h.mods; }
}, runExclusiveModMutation: async (work: () => Promise<unknown>) => work(),
  allocateEnabledVpkPath: async () => join(h.root, 'merged_dir.vpk'), disableModUnlocked: vi.fn(), enableModUnlocked: vi.fn() }));
vi.mock('./metadata', () => ({ getModMetadata: (key: string) => h.metadata[key], setModMetadata: (key: string, value: ModMetadata) => { h.metadata[key] = { ...h.metadata[key], ...value }; }, removeModMetadata: (key: string) => { delete h.metadata[key]; } }));
vi.mock('./deadlock', () => ({ metaKeyFor: (path: string) => path }));
vi.mock('./gameSessionMods', () => ({ assertCanMoveLoadedGameMod: () => {}, assertCanMoveLoadedGameMods: () => {}, syncRunningGameModSnapshotFromMods: async () => null }));
vi.mock('./modSafety', () => ({ assertVpkSafety: async () => {}, carryVpkSafety: async () => 'same', moveSafetySnapshot: () => {} }));
vi.mock('./profiles', () => ({ retargetProfileModSha: () => {} }));
vi.mock('./portableProfile', () => ({ encodeShareCode: (text: string) => text }));
vi.mock('./vpkIdentity', () => ({ resolveVpkIdentity: async (path: string) => ({ sha256: createHash('sha256').update(await fs.readFile(path)).digest('hex') }) }));
import { writeNativeVpk } from './nativeVpk';
import { parseVpkDirectory, readVpkEntryBytes } from './vpk';
import { analyzeMerge, mergeMods } from './modMerger';
import { listMergeRecipes, saveMergeRecipe, reviewMergeRecipe } from './mergeRecipes';
const policy = { include: ['sounds/'], exclude: ['sounds/drop.txt'] };
async function source(id: string, entries: Record<string, string>, priority: number) {
  const path = join(h.root, `${id}_dir.vpk`);
  await fs.writeFile(path, writeNativeVpk(new Map(Object.entries(entries).map(([path, text]) => [path, Buffer.from(text)]))));
  const mod = { id, path, metaKey: id, name: id, fileName: `${id}_dir.vpk`, priority, enabled: false, size: (await fs.stat(path)).size } as Mod;
  h.mods.push(mod); h.metadata[id] = { gameBananaId: priority, gameBananaFileId: priority + 100 };
  return mod;
}
beforeEach(async () => { h.root = await fs.mkdtemp(join(await fs.realpath(tmpdir()), 'grimoire-merge-recipe-')); h.mods = []; h.metadata = {}; });
afterEach(async () => fs.rm(h.root, { recursive: true, force: true }));
describe('reviewed merge recipes with real VPKs', () => {
  it('saves reusable order and filters, detects changed outputs, and rejects a stale build before installation', async () => {
    await source('a', { 'sounds/shared.txt': 'A', 'sounds/drop.txt': 'drop', 'models/other.txt': 'model' }, 1);
    const b = await source('b', { 'sounds/shared.txt': 'B', 'sounds/only-b.txt': 'only B' }, 2);
    const review = await analyzeMerge(h.root, ['b', 'a'], { flatten: true, respectOrder: true, pathPolicy: policy });
    expect(review.outputPaths).toEqual(['sounds/only-b.txt', 'sounds/shared.txt']);
    expect(review.collisions[0].winnerModId).toBe('b');
    await saveMergeRecipe(h.root, { name: 'Sound mix', strict: false, policy, modIds: ['b', 'a'], reviewToken: review.reviewToken! });
    const recipe = (await listMergeRecipes())[0];
    const loaded = await reviewMergeRecipe(h.root, recipe.id, ['a', 'b']);
    expect(loaded.added).toEqual([]); expect(loaded.changed).toEqual([]);
    await fs.writeFile(b.path, writeNativeVpk(new Map([['sounds/shared.txt', Buffer.from('changed B')], ['sounds/new.txt', Buffer.from('new')]])));
    const changed = await reviewMergeRecipe(h.root, recipe.id, ['a', 'b']);
    expect(changed.changed).toEqual(['sounds/shared.txt']); expect(changed.added).toEqual(['sounds/new.txt']); expect(changed.removed).toEqual(['sounds/only-b.txt']);
    await expect(mergeMods(h.root, ['a', 'b'], { name: 'Mix', sourceOrder: ['b', 'a'], pathPolicy: policy, reviewToken: review.reviewToken })).rejects.toThrow('stale');
    await expect(fs.stat(join(h.root, 'merged_dir.vpk'))).rejects.toMatchObject({ code: 'ENOENT' });
  });
  it('reviews nested merges as their actual leaves and builds the same filtered winner set', async () => {
    const a = await source('a', { 'sounds/shared.txt': 'A', 'sounds/drop.txt': 'drop', 'models/other.txt': 'model' }, 1);
    const b = await source('b', { 'sounds/shared.txt': 'B', 'sounds/only-b.txt': 'only B' }, 2);
    const c = await source('c', { 'sounds/only-c.txt': 'C' }, 3);
    await source('parent', { 'sounds/shared.txt': 'stale packed parent' }, 4);
    h.metadata.parent.merged = { id: 'parent-merge', createdAt: new Date().toISOString(), shareCode: '', sources: await Promise.all([a, b].map(async mod => ({ fileName: mod.fileName, modName: mod.name, enabledAtMergeTime: false, priorityAtMergeTime: mod.priority,
      sha256AtMergeTime: createHash('sha256').update(await fs.readFile(mod.path)).digest('hex') }))) } as MergedModInfo;
    const review = await analyzeMerge(h.root, ['parent', c.id], { flatten: true, pathPolicy: policy });
    expect(review.sources.map(source => source.modId).sort()).toEqual(['a', 'b', 'c']);
    const order = [...review.sources].reverse().map(source => source.modId);
    const built = await mergeMods(h.root, ['parent', c.id], { name: 'Reviewed nested mix', sourceOrder: order, reviewToken: review.reviewToken, pathPolicy: policy });
    expect(parseVpkDirectory(built.mod.path)?.filter(path => path.startsWith('sounds/')).sort()).toEqual(['sounds/only-b.txt', 'sounds/only-c.txt', 'sounds/shared.txt']);
    expect(readVpkEntryBytes(built.mod.path, 'sounds/shared.txt')?.toString()).toBe('A');
    expect(h.metadata[built.mod.metaKey].merged?.pathPolicy).toEqual(policy);
  });
});
