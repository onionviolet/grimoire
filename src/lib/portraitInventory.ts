import type { Mod } from '../types/mod';
import { canonicalHeroName } from './lockerUtils';

/** The installed portrait read model. Exact VPK entries are claims; a hero name
 * and a variant are only ways to file and label those claims. */
export type PortraitProvenance = 'locker' | 'forged' | 'downloaded' | 'imported' | 'third-party';

export interface PortraitInventoryEntry {
  key: string;
  modId: string;
  metaKey: string;
  name: string;
  enabled: boolean;
  priority: number;
  hero: string;
  variants: string[];
  /** Exact recorded `.vtex_c` entry paths. Empty means the source was not recorded. */
  paths: string[];
  provenance: PortraitProvenance;
  managed: boolean;
}

export interface PortraitInventory {
  byHero: Map<string, PortraitInventoryEntry[]>;
  all: PortraitInventoryEntry[];
}

const canonicalPath = (path: string) => path.replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();

function variantFor(path: string): string {
  const base = path.split('/').pop()?.replace(/\.vtex_c$/i, '') ?? '';
  const match = base.match(/_(card_critical|card_gloat|vertical|minimap|small|card)$/i);
  return match?.[1].toLowerCase() ?? 'other';
}

export function portraitProvenanceOf(mod: Mod): PortraitProvenance {
  if (mod.lockerCosmetics) return 'locker';
  if (mod.textureReplacement || mod.foundryBuild) return 'forged';
  if (typeof mod.gameBananaId === 'number' && mod.gameBananaId > 0) return 'downloaded';
  if (mod.isUnknown) return 'third-party';
  return 'imported';
}

interface Draft { hero: string; paths: Set<string>; variants: Set<string>; }

function draftFor(drafts: Map<string, Draft>, heroName: string): Draft | null {
  const hero = canonicalHeroName(heroName);
  if (!hero) return null;
  const existing = drafts.get(hero);
  if (existing) return existing;
  const draft = { hero, paths: new Set<string>(), variants: new Set<string>() };
  drafts.set(hero, draft);
  return draft;
}

function addRecorded(draft: Draft | null, paths: readonly string[]) {
  if (!draft) return;
  for (const candidate of paths) {
    const path = canonicalPath(candidate);
    if (!path.endsWith('.vtex_c')) continue;
    draft.paths.add(path);
    draft.variants.add(variantFor(path));
  }
}

/** Fold recorded portrait signals into one entry for each (mod, hero) pair. */
export function buildPortraitInventory(mods: readonly Mod[]): PortraitInventory {
  const byHero = new Map<string, PortraitInventoryEntry[]>();
  const all: PortraitInventoryEntry[] = [];
  for (const mod of mods) {
    const drafts = new Map<string, Draft>();
    if (mod.textureReplacement) {
      addRecorded(draftFor(drafts, mod.textureReplacement.heroName ?? mod.lockerHero ?? ''), [mod.textureReplacement.entryPath]);
    }
    if (mod.foundryBuild) {
      for (const part of mod.foundryBuild.parts) {
        if (part.kind !== 'texture') continue;
        addRecorded(draftFor(drafts, part.heroName ?? mod.lockerHero ?? ''), part.entries);
      }
    }
    if (mod.lockerCosmetics) {
      for (const card of mod.lockerCosmetics.cards) {
        const draft = draftFor(drafts, card.heroName);
        if (!draft) continue;
        // The Locker manifest records its selected variants, but not the exact
        // emitted VPK entries. Preserve that knowledge without inventing paths.
        card.variants.forEach((variant) => draft.variants.add(variant));
      }
    }
    for (const draft of drafts.values()) {
      const entry: PortraitInventoryEntry = {
        key: `${mod.id}:${draft.hero}`,
        modId: mod.id,
        metaKey: mod.metaKey,
        name: mod.name || mod.fileName.replace(/_dir\.vpk$/i, ''),
        enabled: mod.enabled,
        priority: mod.priority,
        hero: draft.hero,
        variants: [...draft.variants].sort(),
        paths: [...draft.paths].sort(),
        provenance: portraitProvenanceOf(mod),
        managed: Boolean(mod.lockerCosmetics || mod.textureReplacement || mod.foundryBuild),
      };
      const list = byHero.get(entry.hero) ?? [];
      list.push(entry);
      byHero.set(entry.hero, list);
      all.push(entry);
    }
  }
  for (const list of byHero.values()) list.sort(compareEntries);
  return { byHero, all };
}

function compareEntries(a: PortraitInventoryEntry, b: PortraitInventoryEntry) {
  return Number(b.enabled) - Number(a.enabled) || a.priority - b.priority || a.name.localeCompare(b.name);
}

export interface PortraitClaimOverlap { path: string; entryKeys: string[]; }

/** Only recorded paths and enabled mods participate, so this can under-report only. */
export function overlappingClaims(entries: readonly PortraitInventoryEntry[]): PortraitClaimOverlap[] {
  const claims = new Map<string, string[]>();
  for (const entry of entries) {
    if (!entry.enabled) continue;
    for (const path of new Set(entry.paths)) claims.set(path, [...(claims.get(path) ?? []), entry.key]);
  }
  return [...claims.entries()]
    .filter(([, keys]) => keys.length > 1)
    .map(([path, entryKeys]) => ({ path, entryKeys }))
    .sort((a, b) => a.path.localeCompare(b.path));
}