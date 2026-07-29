/** Which Foundry source actions an incomplete inspection actually invalidates.
 *
 *  `inspectFoundryAssetSources` records a mod in `unreadableMods` before any
 *  path matching happens, so the unreadable set is "VPKs in the library that
 *  would not open", not "VPKs that contend for the inspected paths". Gating
 *  every action on it therefore disabled every source panel in the app when one
 *  unrelated file in the library was an archive renamed to `*_dir.vpk`.
 *
 *  The split below is by what each action depends on:
 *
 *  - Enabling or disabling a **listed** source is allowed. That source's
 *    identity came out of its own readable directory; what an unrelated
 *    unparseable file contains does not change it, and the mod store, not this
 *    panel, is the enabled-state authority either way.
 *  - Creating a replacement stays gated. The replacement's value is the claim
 *    that it will win these paths, and an unread VPK is exactly the thing that
 *    could refute it.
 *
 *  Nothing here guesses whether an unreadable VPK is relevant: a file that will
 *  not open cannot be asked what it contains. The one thing that *is* known is
 *  enablement, which the mod store reports independently of parsing, so a
 *  disabled unreadable VPK cannot win a path while it stays off.
 */

/** Structural, and deliberately not the exported inspection type: `detectedType`
 *  is optional so lane A's detected-file-type report can populate it without
 *  this module or the panel changing shape. */
export interface UnreadableSourceMod {
  modId: string;
  modName: string;
  enabled: boolean;
  /** Populated once lane A reports the real header of a non-VPK ("7-Zip
   *  archive", "ZIP archive"). Absent until then; the UI renders it only when
   *  present rather than printing a placeholder. */
  detectedType?: string | null;
}

export interface SourceGatingInput {
  unreadableMods: readonly UnreadableSourceMod[];
}

export interface SourceGating {
  /** Every unreadable mod, in inspection order, for the warning list. */
  unreadable: UnreadableSourceMod[];
  /** Comma-joined names for the single-line warning. */
  unreadableNames: string;
  /** Unreadable and enabled: the genuinely uncertain set, because these are the
   *  only ones the game would load at all. */
  enabledUnreadable: UnreadableSourceMod[];
  /** Unreadable but disabled: contents unknown, runtime effect known to be none
   *  while they stay off. */
  disabledUnreadable: UnreadableSourceMod[];
  /** True when the ownership picture is partial. Drives the warning, not a lock. */
  incomplete: boolean;
  /** Toggling a listed source never depends on the unread file. Always false;
   *  named rather than inlined so the rule is one testable statement. */
  toggleBlocked: boolean;
  /** The winner of a newly minted path is what an unread VPK makes ambiguous. */
  replacementBlocked: boolean;
}

export function computeSourceGating(result: SourceGatingInput | null | undefined): SourceGating {
  const unreadable = [...(result?.unreadableMods ?? [])];
  return {
    unreadable,
    unreadableNames: unreadable.map((mod) => mod.modName).join(', '),
    enabledUnreadable: unreadable.filter((mod) => mod.enabled),
    disabledUnreadable: unreadable.filter((mod) => !mod.enabled),
    incomplete: unreadable.length > 0,
    toggleBlocked: false,
    replacementBlocked: unreadable.length > 0,
  };
}
