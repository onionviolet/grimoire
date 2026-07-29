# Foundry changes: parallel work plan

Follow-up work after `My changes`, the forge-install path, and the contended-path
launch shuffle landed. Written to be run by several agents at once; each lane
below is a self-contained prompt.

**Read first:** [feature-status.md](./feature-status.md) (shipped list + gaps 2a-2c)
and the invariants in its "Delivery contract" section. The one that governs every
lane here: **exact normalized VPK entry paths are the ownership key. Labels, hero
names, and mod metadata are never a substitute.** Installed/Locker remains the
only authority for enabled state.

## Ground truth from the 2026-07-29 live drive

Diagnosed against a real 131-mod library, and the reason lanes A and B exist:

- Six installed "mods" were not VPKs. Headers read `0xafbc7a37` (7-Zip) and
  `0x04034b50` (ZIP): archives renamed to `*_dir.vpk`, each containing one real
  VPK that was never extracted. The game cannot load them, so they had never
  worked. Removed on 2026-07-29; contents recovered to
  `Documents/grimoire-recovered-mods`.
- Because `AssetSourcesPanel` blocks on `unreadableMods.length > 0` globally,
  those six disabled Disable/Enable and Create a replacement in **every** sources
  panel in the app. Removing them unblocked the panel immediately (verified:
  `unreadableMods: []`).

## Lane board

| Lane | Can start now | Owns | Must not touch | Done when |
| --- | --- | --- | --- | --- |
| A - VPK identity gate | yes | install/import validation, impostor reconcile | ownership/priority rules | no non-VPK can be installed; existing ones are surfaced |
| B - scoped source blocking | yes | `AssetSourcesPanel` gating + remedy UI | the inspection contract in `foundryAssetSources.ts` | a readable source is actionable while an unrelated VPK is unreadable |
| C - grouped pool view | yes | `MyChanges` pool-first rendering | `changeList.ts` row model, `foundryChanges.ts` planner | a pool reads as one unit with its members and winner |
| D - alternatives gallery | after C | thumbnails/preview per pool member | pool grouping semantics | picking an alternative is visual, like the Locker skins panel |
| E - portrait editor | yes (own surface) | crop/fit/variant authoring before staging | the staging contract in `visualEdits.ts` | what you see is what the card shows |
| F - sound tool surfacing | yes | row-level affordances in the sound browser | `SoundImportEditor` internals | trim/gain/loop are visible without opening Swap |

Run A, B, C, E, F concurrently. D waits for C's pool component to exist.
A and B both touch the unreadable-VPK story but in different files; A is main
process + install paths, B is the renderer panel.

---

## Lane A - stop installing files that are not VPKs

Every install path checks the filename extension and never the magic bytes:
`electron/main/ipc/mods.ts:1176` tests `lower.endsWith('.vpk')`. The app already
validates the magic on merge *output* (`services/modMerger.ts:251`,
`VPK_MAGIC = 0x55aa1234`), so the check exists and is simply not applied on the
way in.

1. Add a single shared validator (magic + version) in `services/vpk.ts`, and call
   it from every path that adopts a file as an installed mod: custom import,
   archive extraction results, one-click install, drag-drop, and the
   `resolveVpkIdentity` adoption path. Reject with the detected type by name
   ("this is a 7-Zip archive, not a VPK") rather than a generic failure.
2. When extraction yields an archive containing exactly one VPK, install that VPK
   rather than the archive. That is precisely what failed for the six files
   above, and it is the difference between a working mod and an inert one.
3. Add a startup reconcile that flags already-installed impostors, with the
   detected type, and offers extract-and-repair where the archive contains a VPK.
   Do not auto-delete: a user's addons folder is theirs.
4. Tests: a ZIP and a 7z renamed to `_dir.vpk` are both rejected; a real v1 and a
   real v2 VPK are both accepted; an archive wrapping one VPK installs the inner
   file; the reconcile reports an impostor without removing it.

## Lane B - block the ambiguous action, not the whole panel

`const blocked = (result?.unreadableMods.length ?? 0) > 0` in
`src/components/foundry/AssetSourcesPanel.tsx:97` is one flag for every action,
and `inspectFoundryAssetSources` adds a mod to `unreadableMods` before any path
matching, so an unreadable VPK that has nothing to do with the inspected asset
still disables everything.

1. Split the gate by what each action actually depends on:
   - Enable/disable a **listed** source: allow. Its identity is known; toggling it
     does not depend on what an unparseable file contains. Show the incomplete
     picture as a warning, not a lock.
   - Create a replacement: keep it gated, because the resulting winner is what is
     ambiguous. Do not widen this without a path-level argument.
2. Make the warning actionable: name the unreadable mods (it already does), and
   add a way to reach them - open in Installed, and a "why" that reports the
   detected file type from lane A once that exists.
3. Consider reporting *whether* an unreadable VPK could even matter. It cannot be
   known from its entries, so do not guess; state the uncertainty precisely
   instead of implying every action is unsafe.
4. Tests: a readable source stays actionable while an unrelated mod is
   unreadable; the replacement path stays blocked; the warning lists every
   unreadable mod.

## Lane C - grouped pool view

`groupFoundryShufflePools(mods)` in `src/lib/foundryChanges.ts` already returns
`{ mods, entries }` per contended-path pool, and the launch planner consumes it.
The UI currently exposes a pool only as a tooltip on each row, so a user cannot
see a pool as a thing.

1. Add a pool-first mode to `MyChanges` (a view toggle beside the sort control).
   One card per pool: the shared path(s), each member as an alternative, the
   current runtime winner marked, and a pool-level shuffle opt-in that toggles
   every member at once.
2. Keep the flat list as the default. The pool view is for deciding between
   alternatives; the flat list is for finding one thing.
3. Reuse the existing winner resolution rather than recomputing it: the detail
   panel already resolves winners per exact path.
4. A pool of one is not interesting - collapse or hide it, and say why a change is
   not in any pool (nothing else writes its paths).
5. Tests: pool cards match `groupFoundryShufflePools` exactly; the pool-level
   opt-in adds every member; a single-member pool renders in the reduced form.

## Lane D - alternatives gallery (after C)

Make choosing between pool members visual, in the shape of
`components/locker/HeroSkinsPanel.tsx`.

1. Visual changes have a recorded source image
   (`textureReplacement.imageFileName`, `foundryBuild.parts[].sourceFileName`)
   and the build request retains the absolute path, so a thumbnail is derivable.
   Sound members get the existing audition button instead of a thumbnail.
2. Agree a cache budget before building. The Foundry thumbnail protocol
   (`FOUNDRY_THUMB_SCHEME`) already exists; reuse it rather than inventing a
   second cache, and state an explicit bound.
3. Do not let the gallery imply an enabled state it does not own. Selecting an
   alternative goes through the same mod-store toggle as everything else.

## Lane E - portrait editor

A portrait replacement today is a raw PNG drop: no crop, no fit preview, no
variant awareness. `prepareVisualStagedEdit` already groups a portrait family
(normal / low-HP / gloat / minimap) via `portraitFamilyKey` for the preflight, so
the family is known; the authoring surface just ignores it.

1. Build an editor that previews the user's image against the real target: the
   actual card dimensions read from the template, with crop and scale.
   `components/locker/LockerImageCropper.tsx` is the starting point.
2. Make the family explicit: show every discovered variant, let one image apply
   across all of them, and allow a per-variant override. The preflight already
   inspects the family, so the editor must not stage a narrower set than the
   preflight warned about.
3. Stage through `prepareVisualStagedEdit` unchanged. The editor authors an
   image; it must not acquire its own install path.
4. Tests: the crop maps to the template's real dimensions; a family edit stages
   one edit per variant; a per-variant override wins over the family image.

## Lane F - surface the sound tools

Nothing regressed here - `SoundImportEditor` still has the waveform, draggable
trim handles, play-selection preview, match-volume normalizer, manual gain, and
loop mode. They are one modal deep behind **Swap**, so the row reads as if the
workbench is gone.

1. Put the state on the row: when a change has recorded trim/gain, say so
   (`soundSwap.reforge.trimStartMs/trimEndMs/gainDb` are persisted).
2. Offer a direct route to retune an existing change rather than re-authoring it
   from scratch.
3. Do not fork the editor. Any new affordance opens the same component.

---

## Repository gate (every lane)

Run the lane's Vitest files, then `pnpm typecheck`, `pnpm lint`, `pnpm test`,
`pnpm i18n:check`, and `pnpm i18n:manifest` if any catalog key changed. New user
strings go in `src/locales/en/translation.json` only. No em-dashes.

Drive the running app with `scripts/dev-driver.mjs` before claiming a lane works:

```bash
GRIMOIRE_DEV_CDP_PORT=9222 pnpm dev
node scripts/dev-driver.mjs click "button:has-text(My changes)"
node scripts/dev-driver.mjs evalfile ./check.js
```

`window.__grimoireStore` is exposed in dev builds only, so a store action can be
exercised without the UI gesture that normally triggers it. Note the app takes a
single-instance lock: close any running Grimoire first, and kill leftover
`electron` processes if the CDP port does not open.

**Honesty requirement.** Nothing in this area has been verified against a running
Deadlock. A lane may claim its own tests and a live drive; it may not claim the
game loads the result. Record what was not verified, as gaps 2a-2c do.
