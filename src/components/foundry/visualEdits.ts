import type { FoundryAssetSourcesInspection, TextureCategory, TextureEntry } from '../../types/foundry';
import type { FoundryStagedEdit } from './buildTray';

/** Serializable visual authoring input. This stays separate from the current
 * immediate-install IPC so a later combined forge can reproduce the edit. */
export interface VisualReplacementDraft {
  entryPath: string;
  imagePath: string;
  name: string;
  category: TextureCategory;
  /** Hero the catalog entry belongs to, when it knew one. Grouping and the
   *  Locker cross-link only; the entry path stays the ownership key. */
  heroName?: string;
}

/** A visual replacement writes one exact VPK entry and retains its PNG input. */
export interface VisualStagedEdit extends FoundryStagedEdit {
  kind: 'texture';
  source: VisualReplacementDraft;
}

/** Convert a catalog replacement into the stable, serializable tray contract.
 * It is pure: no IPC or installed-mod state is changed here. */
export function serializeVisualReplacement(draft: VisualReplacementDraft): VisualStagedEdit {
  const entryPath = draft.entryPath.replace(/\\/g, '/').replace(/^\/+/, '');
  return {
    id: `texture:${entryPath}`,
    kind: 'texture',
    title: draft.name.trim() || 'Texture replacement',
    affectedFiles: [entryPath],
    precedence: 0,
    source: { ...draft, entryPath },
  };
}

/** What a visual authoring surface has to supply to stage safely. `inspect` is
 * the read-only exact-path source inspection; `confirm` is the acknowledgement
 * that an already-enabled owner is being layered over, not edited. */
export interface VisualStageContext {
  item: TextureEntry;
  catalog: readonly TextureEntry[];
  imagePath: string;
  name: string;
  inspect: (paths: string[]) => Promise<FoundryAssetSourcesInspection>;
  /** Async because the acknowledgement is a real modal, not window.confirm. */
  confirm: (modNames: string[]) => boolean | Promise<boolean>;
  unreadableMessage: string;
  /** Resolved hero display name for `item.hero` (the catalog stores codenames).
   *  Callers own the roster map, so they resolve it; omitted means unscoped. */
  heroName?: string;
}

/**
 * The one staging path every visual authoring surface goes through, so the
 * catalog grid and the hero-scoped texture list cannot drift apart on which
 * checks run.  Nothing here installs, enables, or reorders: an unreadable VPK
 * blocks the ambiguous action outright, and an enabled owner only needs an
 * explicit acknowledgement that this becomes a separate layered replacement.
 * Returns `null` when the user declines that acknowledgement.
 */
export async function prepareVisualStagedEdit(context: VisualStageContext): Promise<VisualStagedEdit | null> {
  const sources = await context.inspect(visualAssetInspectionPaths(context.item, context.catalog));
  if (sources.unreadableMods.length > 0) throw new Error(context.unreadableMessage);
  const enabled = sources.sources.filter((source) => source.enabled);
  if (enabled.length > 0 && !(await context.confirm(enabled.map((source) => source.modName)))) return null;
  return serializeVisualReplacement({
    entryPath: context.item.path,
    imagePath: context.imagePath,
    name: context.name,
    category: context.item.category,
    // Driven by the catalog's own hero field, not by the label: an entry with
    // no hero stays unscoped rather than being guessed into a hero pile.
    heroName: context.item.hero ? (context.heroName?.trim() || context.item.hero) : undefined,
  });
}

/** The catalog calls hero cards, portraits, and their state variants one visual
 * family. Only group entries sharing a directory and a conservative basename;
 * unrelated art for the same hero is never pulled into a destructive preflight. */
export function visualAssetInspectionPaths(item: TextureEntry, catalog: readonly TextureEntry[]): string[] {
  if (item.category !== 'hero-image') return [item.path];
  const family = portraitFamilyKey(item.path);
  return catalog
    .filter((candidate) => candidate.category === 'hero-image' && portraitFamilyKey(candidate.path) === family)
    .map((candidate) => candidate.path);
}

/** Strip the non-semantic tail the pak appends to a portrait basename: an
 *  optional content-hash token (hex, kept conservative by requiring a digit so
 *  a real word never matches) and the source-format token compiled into the
 *  name (`astro_card_gloat_psd` -> `astro_card_gloat`). Exported so the
 *  variant labeling in portraitFamily diffs the same cleaned basename this
 *  module keys families on. */
export function stripPortraitFileTokens(basename: string): string {
  return basename
    .replace(/_(?=[0-9a-f]*\d)[0-9a-f]{6,}$/, '')
    .replace(/_(?:psd|png|tga|jpe?g)$/, '');
}

/** The family stem two portrait-state paths must share to be one visual family.
 *  Exported so the portrait editor names the same family the preflight inspects,
 *  rather than re-deriving (and possibly narrowing) it. */
export function portraitFamilyKey(path: string): string {
  const normalized = path.replace(/\\/g, '/').toLowerCase();
  const slash = normalized.lastIndexOf('/');
  const directory = normalized.slice(0, slash + 1);
  const base = stripPortraitFileTokens(normalized.slice(slash + 1).replace(/\.[^.]+$/, ''));
  // State labels are suffixes in the asset filename, not display metadata. The
  // live pak's vocabulary (scanned 2026-07-29): card / card_gloat /
  // card_critical / mm / sm / vertical, stacked after the hero stem.
  return `${directory}${base.replace(/(?:[_-](?:low[_-]?hp|gloat|critical|minimap|portrait|card|mm|sm|vertical))+$/g, '')}`;
}
