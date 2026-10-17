import type { MergePathPolicy } from '../types/mergeRecipe';

export function normalizeMergePolicy(policy: MergePathPolicy = { include: [], exclude: [] }): MergePathPolicy {
  const normalize = (paths: string[]) => {
    if (!Array.isArray(paths) || paths.length > 100) throw new Error('Merge path policy exceeds its limit');
    return [...new Set(paths.map(path => {
      if (typeof path !== 'string') throw new Error('Invalid merge path');
      const normalized = path.trim().replace(/\\/g, '/').toLowerCase();
      if (!normalized || normalized.length > 512 || normalized.startsWith('/') || /[:*?]/.test(normalized) || [...normalized].some(character => character.charCodeAt(0) < 32) || normalized.split('/').some(part => part === '..' || part === '.')) throw new Error('Use exact game paths or folder prefixes ending in /');
      return normalized;
    }))].sort();
  };
  if (!policy || typeof policy !== 'object') throw new Error('Invalid merge path policy');
  return { include: normalize(policy.include), exclude: normalize(policy.exclude) };
}
export function mergePathSelected(path: string, policy: MergePathPolicy): boolean {
  const normalized = path.replace(/\\/g, '/').toLowerCase();
  const matches = (rule: string) => rule.endsWith('/') ? normalized.startsWith(rule) : normalized === rule;
  return (!policy.include.length || policy.include.some(matches)) && !policy.exclude.some(matches);
}
