import type { TextureCategory, TextureEntry } from '../../types/foundry';
import type { FoundryStagedEdit } from './buildTray';

/** Serializable visual authoring input. This stays separate from the current
 * immediate-install IPC so a later combined forge can reproduce the edit. */
export interface VisualReplacementDraft {
  entryPath: string;
  imagePath: string;
  name: string;
  category: TextureCategory;
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

function portraitFamilyKey(path: string): string {
  const normalized = path.replace(/\\/g, '/').toLowerCase();
  const slash = normalized.lastIndexOf('/');
  const directory = normalized.slice(0, slash + 1);
  const base = normalized.slice(slash + 1).replace(/\.[^.]+$/, '');
  // State labels are suffixes in the asset filename, not display metadata.
  return `${directory}${base.replace(/(?:[_-](?:low[_-]?hp|gloat|minimap|portrait|card))+$/g, '')}`;
}
