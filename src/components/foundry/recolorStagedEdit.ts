import type { FoundryAssetSourcesInspection, HeroEffectExportRequest, RecolorForgeRequest } from '../../types/foundry';
import { canonicalHeroName } from '../../lib/lockerUtils';
import type { FoundryStagedEdit } from './buildTray';
import { normalizeEntryPath } from './buildTray';

/**
 * Serializable recolor work ready for the combined-output tray. The request
 * carries the exact normalized VPK entries the bake writes (discovered from
 * the real bake output at staging time), so the reviewed write set and the
 * forged VPK's contents cannot drift apart.
 */
export interface RecolorStagedEdit extends FoundryStagedEdit {
  kind: 'recolor';
  request: RecolorForgeRequest;
}

/** What a recolor authoring surface has to supply to stage safely. `inspect`
 *  is the read-only exact-path source inspection; `confirm` is the
 *  acknowledgement that an already-enabled owner is being layered over, not
 *  edited. Field names mirror `VisualStageContext` so the two staging flows
 *  cannot drift on the checks they share. */
export interface RecolorStageContext {
  heroName: string;
  /** Tray title for the staged edit (e.g. "{{hero}} recolor"). */
  title: string;
  request: HeroEffectExportRequest;
  /** Main-process entry discovery: bake (or reuse the cached bake) and list
   *  the real output. Never a renderer-side path guess. */
  discoverEntries: (req: HeroEffectExportRequest) => Promise<string[]>;
  inspect: (paths: string[]) => Promise<FoundryAssetSourcesInspection>;
  /** Async because the acknowledgement is a real modal, not window.confirm. */
  confirm: (modNames: string[]) => boolean | Promise<boolean>;
  unreadableMessage: string;
}

/**
 * The one staging path a recolor goes through before it reaches the build
 * tray. Nothing here installs, enables, or reorders: the entries come from the
 * real bake output, an unreadable VPK blocks the ambiguous action outright,
 * and an enabled owner only needs an explicit acknowledgement that this
 * becomes a separate layered replacement. Returns `null` when the user
 * declines that acknowledgement.
 */
export async function prepareRecolorStagedEdit(ctx: RecolorStageContext): Promise<RecolorStagedEdit | null> {
  const entries = await ctx.discoverEntries(ctx.request);
  if (!entries.length) throw new Error('The recolor bake produced no VPK entries; nothing can be staged.');
  const sources = await ctx.inspect(entries);
  if (sources.unreadableMods.length > 0) {
    // The caller's message may carry a {{mods}} placeholder naming the
    // unreadable VPKs; the mod list is only known here, after inspection.
    throw new Error(
      ctx.unreadableMessage.replace(
        /\{\{mods\}\}/g,
        sources.unreadableMods.map((mod) => mod.modName).join(', '),
      ),
    );
  }
  const enabled = sources.sources.filter((source) => source.enabled);
  if (enabled.length > 0 && !(await ctx.confirm(enabled.map((source) => source.modName)))) return null;
  return {
    // The id is derived from the hero alone, so re-staging the same hero
    // replaces in place through the tray's id filter instead of appending a
    // second recolor edit.
    id: `recolor:${canonicalHeroName(ctx.heroName)}`,
    kind: 'recolor',
    title: ctx.title,
    affectedFiles: [...new Set(entries.map(normalizeEntryPath).filter(Boolean))].sort(),
    precedence: 0,
    request: { ...ctx.request, entries },
  };
}
