/**
 * The one producer of the "which mod is responsible for this" target.
 *
 * Asking that question has exactly one answer across the app: Installed with
 * the named mod focused, `/?focusMod=<id>`, consumed by the focus effect in
 * `src/pages/Installed.tsx` near line 975. Hand-building this string at a call
 * site is how four surfaces ended up with four spellings before, so every
 * producer routes through this helper.
 */
export function focusModPath(modId: string): string {
  return `/?focusMod=${encodeURIComponent(modId)}`;
}
