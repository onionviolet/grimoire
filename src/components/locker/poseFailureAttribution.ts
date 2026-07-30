import type { HeroPoseSkinSource } from '../../types/portrait';

/**
 * Working out which installed skin broke a hero's 3D pose export.
 *
 * The viewer exports the whole enabled stack at once, so a failure only ever
 * says "this stack cannot be posed". That is enough for the banner inside the
 * panel, but not for a badge on a card: the grid has to point at a file. This
 * is the narrowing step between the two.
 *
 * Lives outside HeroPoseViewer.tsx so that file can stay a components-only
 * module (react-refresh), and so the logic is testable without a renderer.
 */

/** Above this many stacked skins, a failing stack is not narrowed down: each
 *  probe is a real vpkmerge export, and a deep stack would cost more than the
 *  badge is worth. The viewer's own banner still reports the failure. */
export const MAX_ATTRIBUTION_PROBES = 6;

/**
 * Work out which VPKs in a failing stack are the broken ones.
 *
 * Only called once a vanilla export has already succeeded, which proves the
 * installed stack (not the hero, not Grimoire) is at fault. One source is
 * unambiguous by elimination. Several means probing them one at a time, since
 * "the stack failed" does not say which member broke it, and a badge on the
 * wrong card is worse than no badge.
 *
 * `probe` resolves true when that source alone can be posed. An empty result is
 * the honest answer for a stack whose members each export fine on their own:
 * the combination is what fails, so no single skin deserves the blame.
 */
export async function attributeBrokenSkinSources(
  sources: HeroPoseSkinSource[],
  probe: (source: HeroPoseSkinSource) => Promise<boolean>,
  isCancelled: () => boolean = () => false,
  maxProbes: number = MAX_ATTRIBUTION_PROBES
): Promise<string[]> {
  if (sources.length === 0) return [];
  if (sources.length === 1) return [sources[0].metaKey];
  if (sources.length > maxProbes) return [];

  const broken: string[] = [];
  for (const source of sources) {
    if (isCancelled()) return [];
    let ok = false;
    try {
      ok = await probe(source);
    } catch {
      ok = false;
    }
    if (!ok) broken.push(source.metaKey);
  }
  return isCancelled() ? [] : broken;
}
