import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { join } from 'path';
import { getUserDataPath } from '../utils/paths';
import { assertRecoveryPath, writeRecoveryJson } from './recoveryBackup';
import { analyzeMerge } from './modMerger';
import { scanMods, runExclusiveModMutation } from './mods';
import { getModMetadata } from './metadata';
import { resolveVpkIdentity } from './vpkIdentity';
import { parseVpkEntryIndex } from './vpk';
import { normalizeMergePolicy, mergePathSelected } from '../../../src/lib/mergePathPolicy';
import type { MergeRecipe, MergeRecipeReview, MergePathPolicy } from '../../../src/types/mergeRecipe';
import type { MergeAnalysisResult } from '../../../src/types/mod';

const file = () => join(getUserDataPath(), 'merge-recipes.json');
export async function listMergeRecipes(): Promise<MergeRecipe[]> {
  await assertRecoveryPath(file());
  try {
    if ((await fs.stat(file())).size > 2 * 1024 * 1024) throw new Error('Merge recipes exceed their storage limit');
    const records: unknown = JSON.parse(await fs.readFile(file(), 'utf8'));
    if (!Array.isArray(records) || records.length > 30) throw new Error('Invalid merge recipes');
    for (const record of records) {
      if (!record || !/^[a-f0-9-]{36}$/.test(record.id) || typeof record.name !== 'string' || record.name.length > 120 || typeof record.strict !== 'boolean' ||
        !Array.isArray(record.sources) || record.sources.length < 2 || record.sources.length > 500 ||
        record.sources.some((source: MergeRecipe['sources'][number]) => !source || !/^[a-f0-9]{64}$/.test(source.sha256) || typeof source.name !== 'string') ||
        !Array.isArray(record.outputs) || record.outputs.length > 10000 || record.outputs.some((output: MergeRecipe['outputs'][number]) => !output || typeof output.path !== 'string' || !Number.isSafeInteger(output.crc) || !Number.isSafeInteger(output.size))) throw new Error('Invalid merge recipe');
      record.policy = normalizeMergePolicy(record.policy);
    }
    return records;
  } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
}
async function outputs(gamePath: string, analysis: MergeAnalysisResult, policy: MergePathPolicy) {
  const mods = await scanMods(gamePath);
  const result = new Map<string, MergeRecipe['outputs'][number]>();
  const allowed = new Set(analysis.outputPaths);
  for (const source of analysis.sources) {
    const mod = mods.find(mod => mod.id === source.modId);
    if (!mod) throw new Error('Merge source is no longer available');
    const entries = parseVpkEntryIndex(mod.path);
    if (!entries) throw new Error('Merge source is unreadable');
    for (const entry of entries) if (allowed.has(entry.path.toLowerCase()) && mergePathSelected(entry.path, policy)) result.set(entry.path.toLowerCase(), { path: entry.path.toLowerCase(), crc: entry.crc, size: entry.size });
  }
  if (result.size > 10000) throw new Error('A saved recipe supports up to 10,000 output paths');
  return [...result.values()].sort((a, b) => a.path.localeCompare(b.path));
}
export function saveMergeRecipe(gamePath: string, args: { name: string; modIds: string[]; strict: boolean; policy: MergePathPolicy; reviewToken: string }): Promise<void> {
  return runExclusiveModMutation(async () => {
    if (typeof args.name !== 'string' || !args.name.trim() || args.name.trim().length > 120 || typeof args.strict !== 'boolean') throw new Error('Invalid merge recipe name');
    const policy = normalizeMergePolicy(args.policy);
    const analysis = await analyzeMerge(gamePath, args.modIds, { flatten: true, respectOrder: true, pathPolicy: policy });
    if (!args.reviewToken || args.reviewToken !== analysis.reviewToken || analysis.unreadableModIds.length) throw new Error('Merge recipe needs a fresh complete review');
    const mods = await scanMods(gamePath);
    const sources: MergeRecipe['sources'] = [];
    for (const source of [...analysis.sources].reverse()) {
      const mod = mods.find(mod => mod.id === source.modId)!;
      const meta = getModMetadata(mod.metaKey);
      sources.push({ sha256: (await resolveVpkIdentity(mod.path)).sha256.toLowerCase(), name: mod.name,
        gameBananaId: meta?.gameBananaId, gameBananaFileId: meta?.gameBananaFileId, vpkIndex: meta?.vpkIndex });
    }
    const recipeOutputs = await outputs(gamePath, analysis, policy);
    if (args.reviewToken !== (await analyzeMerge(gamePath, args.modIds, { flatten: true, respectOrder: true, pathPolicy: policy })).reviewToken) throw new Error('Merge sources changed during recipe capture');
    const records = await listMergeRecipes();
    const name = args.name.trim();
    const existing = records.find(record => record.name === name);
    const next = [...records.filter(record => record.name !== name), { id: existing?.id ?? randomUUID(), name, strict: args.strict, policy, sources, outputs: recipeOutputs, createdAt: new Date().toISOString() }];
    if (next.length > 30 || Buffer.byteLength(JSON.stringify(next)) > 2 * 1024 * 1024) throw new Error('Merge recipe storage is full');
    await writeRecoveryJson(file(), next);
  });
}
export function reviewMergeRecipe(gamePath: string, id: string, modIds: string[]): Promise<MergeRecipeReview> {
  return runExclusiveModMutation(async () => {
    const recipe = (await listMergeRecipes()).find(recipe => recipe.id === id);
    if (!recipe) throw new Error('Merge recipe is no longer available');
    const selected = await analyzeMerge(gamePath, modIds, { flatten: true });
    const mods = await scanMods(gamePath);
    const candidates = await Promise.all(selected.sources.map(async source => {
      const mod = mods.find(mod => mod.id === source.modId)!;
      return { mod, sha256: (await resolveVpkIdentity(mod.path)).sha256.toLowerCase(), meta: getModMetadata(mod.metaKey) };
    }));
    const order: string[] = [];
    for (const source of recipe.sources) {
      const matches = candidates.filter(candidate => candidate.sha256 === source.sha256 ||
        source.gameBananaId !== undefined && source.gameBananaFileId !== undefined && candidate.meta?.gameBananaId === source.gameBananaId &&
        candidate.meta.gameBananaFileId === source.gameBananaFileId && candidate.meta.vpkIndex === source.vpkIndex);
      if (matches.length !== 1 || order.includes(matches[0].mod.id)) throw new Error('Select the same unambiguous sources before loading this recipe');
      order.push(matches[0].mod.id);
    }
    if (order.length !== candidates.length) throw new Error('The selected sources differ from the recipe');
    const analysis = await analyzeMerge(gamePath, order, { flatten: true, respectOrder: true, pathPolicy: recipe.policy });
    const current = await outputs(gamePath, analysis, recipe.policy);
    const before = new Map(recipe.outputs.map(output => [output.path, output]));
    const after = new Map(current.map(output => [output.path, output]));
    return { recipe, analysis, added: current.filter(output => !before.has(output.path)).map(output => output.path),
      removed: recipe.outputs.filter(output => !after.has(output.path)).map(output => output.path),
      changed: current.filter(output => before.has(output.path) && (before.get(output.path)!.crc !== output.crc || before.get(output.path)!.size !== output.size)).map(output => output.path) };
  });
}
