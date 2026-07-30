/** Presentation rules for the "upload your own" portrait variant slots.
 *
 *  Kept out of the component so the reveal contract is testable, and because
 *  the regression this guards is invisible in review: the slots once rested at
 *  a flat opacity-30 with no recovery path, under a hover overlay that added
 *  bg-black/55, so hovering a dimmed portrait made it *darker*. That is the
 *  exact inverse of what was asked for, and it survived for a day.
 *
 *  When the shared card primitive lands (structural cause S6), this is the
 *  behaviour it should absorb.
 */

const BASE =
  'max-h-full max-w-full object-contain transition-[filter,opacity] duration-200 motion-reduce:transition-none';

/** An empty slot rests subdued so a filled slot reads first, but hover and
 *  keyboard focus restore full colour and full opacity: showing base art is
 *  pointless if you can never see what is actually there before replacing it.
 *
 *  `group-focus-within` rather than `focus-visible`, which this repo has
 *  already shipped a reveal through that never fired under plain `:focus`.
 */
export function variantPreviewClass(hasPick: boolean): string {
  if (hasPick) return BASE;
  return `${BASE} opacity-50 grayscale-[0.35] group-hover:opacity-100 group-hover:grayscale-0 group-focus-within:opacity-100 group-focus-within:grayscale-0`;
}
