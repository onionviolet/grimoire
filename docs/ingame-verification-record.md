# In-game verification record

Status: scaffold, not yet run. Date scaffolded: 2026-08-06.

This is the one fork-only place every human-gated piece of evidence Phase 1
needs lives, one row per check, sitting beside `docs/rigged-preview-spike.md`
as the same kind of artifact. No agent can run Deadlock and no headless
process can produce an fps number, so every row below ships with its steps,
its fixture, and its pass criterion already filled in. The only thing
missing is the thing only a running game can supply: the Verdict, and
whatever a fail or a blocked verdict pulls in with it.

## Rules for filling this in

- A passing check is a written verdict naming what was run and what
  happened. Type `pass` in the Verdict cell; no attachment is required,
  because the written verdict is the evidence.
- A failing check additionally attaches the screenshot, clip, or log that
  shows it, in the Evidence cell (or the Notes cell on a ConVar row).
- A failed check gets a written root-cause note, in the Root cause cell (or
  the Notes cell on a ConVar row), before anyone decides whether the fix
  belongs in this phase or in a new one. That call is the user's, made after
  the agent proposes a size: files touched, whether the change crosses the
  main and renderer process boundary, and whether it moves a shipped
  format.
- `blocked` is a legitimate verdict for a check whose preconditions are not
  available right now. It requires a stated reason, in the same Root
  cause / Notes cell a fail would use.
- The phase is not done while any Verdict cell is blank.
- Wherever a proposed fixture (a named mod, hero, or pool) is not available,
  substitute your own and note the substitution in the Notes/Root cause
  cell if it changes what the row is actually checking.

The command that checks all of this mechanically:

```
node scripts/check-verification-record.mjs --strict
```

Without `--strict` the same command only checks structure (every row
present, every scaffolded cell filled, every filled verdict well-formed),
which is what lets the repository suite stay green while this record is
still being worked through. With `--strict` it additionally requires every
Verdict cell to be non-blank, which is this phase's completion gate.

## Table 1: In-game sweep (REQ-ingame-verification-sweep)

| ID | Check | Fixture | Steps | Pass looks like | Verdict | Evidence | Root cause |
| --- | --- | --- | --- | --- | --- | --- | --- |
| IG-01 | Forge one staged sound edit and one staged texture edit into a single VPK, mount it, hear the sound and see the texture. | A hero with both a sound and a texture edit staged in Foundry in the same session, for example Seven (gigawatt_prisoner): a sound swap on an ability line plus a texture edit on his card portrait. | 1. In Foundry, stage a sound edit on one of Seven's ability lines and a texture edit on Seven's card portrait. 2. Open the combined review tray and confirm both edits are listed. 3. Forge to Export to produce a single VPK (Forge to Install also exercises this if testing the install path instead). 4. Mount the exported VPK, or confirm the installed build is enabled. 5. In game, trigger the ability to hear the swapped sound, and open the hero card to see the swapped texture. | Both the swapped sound plays on the ability trigger and the swapped texture renders on the hero card, from the single VPK the combined tray built. | | | |
| IG-02 | Cancel the native save dialog instead of exporting, and confirm the mod library and the staged edits are exactly as they were. | The same staged sound and texture edits from IG-01, still pending. | 1. With the sound and texture edits still staged, choose Forge to Export. 2. When the native OS save dialog opens, click Cancel instead of choosing a location. 3. Return to Foundry and check My changes / the staged edit tray. 4. Check Installed for any new or altered mod entry. | No VPK was written, the staged edits are still listed exactly as before, and Installed shows no new, removed, or reordered mod. | | | |
| IG-03 | The forge-install path end to end. | One staged sound or texture edit, forged via Install rather than Export. | 1. Stage one edit in Foundry. 2. Choose Forge to Install rather than Export. 3. Confirm the combined review tray, then confirm the install. 4. Check Installed for the new build, then launch Deadlock and confirm the edit is active in game. | The build appears in Installed as enabled, and the effect (sound or visual) is present in a live game session with no manual mounting step. | | | |
| IG-04 | Forge-install rollback when slot allocation fails. | A game install whose Foundry-managed slots are exhausted or deliberately made unwritable, so the next forge-install's slot allocation fails. | 1. Fill or block the slots Foundry allocates builds into (for example by manually occupying every pakNN slot Foundry would use). 2. Stage an edit and choose Forge to Install. 3. Let slot allocation fail. 4. Check Installed and the mod library for any partial or orphaned entry. | The install reports a failure to the user, and Installed and the mod library are left exactly as they were before the attempt: no partial mod, no orphaned slot, no orphaned file. | | | |
| IG-05 | Forge-install rollback when metadata fails. | A staged edit whose forge-install is interrupted after the VPK is written but before metadata is finalized, for example by making the metadata sidecar file temporarily read-only or the folder briefly inaccessible. | 1. Stage an edit and choose Forge to Install. 2. Interrupt or block the metadata write step specifically, after the VPK itself would already be written. 3. Observe the reported outcome. 4. Check Installed, the mod library, and the game's addon folder for any leftover VPK or partial metadata. | The install reports a failure, and no partial mod, orphaned VPK, or inconsistent metadata is left behind: Installed and the addon folder both look exactly as before the attempt. | | | |
| IG-06 | Mount a merged VPK built from a reviewed source order and confirm the mod the review named as winner is the one the engine loads. | Two installed mods that both write the identical VPK entry path, for example two competing hero skin mods, or a hero mod and a Foundry build both touching the same texture entry. | 1. Open the merge review panel over the two conflicting mods and record the exact reviewed source order it shows, verbatim. 2. Note the effective winner the review panel names for the contested entry. 3. Build and mount the merged VPK. 4. In game, load the content at that entry path (open the hero card, hear the sound, or view the texture, whichever the contested entry is) and note which mod's content actually appears. | The mod the review panel named as winner is the one whose content the engine actually loads. Record both the reviewed source order and the observed winner side by side in the Evidence cell, so a tie between two mods claiming the identical entry path is attributable to a written order rather than to chance. | | | |
| IG-07 | Confirm an AssetSourcesPanel audition of an installed VPK matches what the engine plays. | An installed VPK sound mod on a hero, for example a downloaded or forged sound swap on Seven (gigawatt_prisoner). | 1. Open the Asset Sources panel for the installed mod's sound entry. 2. Play the audition clip from the sources panel and note what it sounds like. 3. Launch Deadlock, trigger the same in-game sound (ability, voice line, or global cue), and compare. | The clip played by the sources panel's audition matches, sound for sound, what the engine plays in a live game session for that entry. | | | |
| IG-08 | Re-forge that swap and confirm it sounds identical to the first forge. | The same installed swap from IG-07. | 1. Note or record what the IG-07 swap sounds like in game. 2. Remove or disable the installed build. 3. Re-forge the identical swap from the same staged source. 4. Reinstall and confirm in game again. | The re-forged swap sounds identical to the first forge, both in the sources panel audition and in a live game session. This is the idempotency claim the audition parity check rests on. | | | |
| IG-09 | Hero sound case: downloaded third-party mod. | A downloaded third-party GameBanana sound mod that replaces one of Seven's (gigawatt_prisoner) ability lines. | 1. Download and install a third-party hero sound mod for Seven from GameBanana via the Browse tab. 2. Enable it in Installed. 3. Launch Deadlock, pick Seven, and trigger the replaced ability. | The mod's replacement sound plays on the ability trigger, matching what the mod's own preview or description claims. | | | |
| IG-10 | Hero sound case: forged mod. | A Foundry-forged sound swap on one of Seven's ability lines, distinct from the entry used in IG-09. | 1. In Foundry, stage a sound edit on a different Seven ability line than IG-09. 2. Forge to Install. 3. Launch Deadlock, pick Seven, and trigger that ability. | The forged replacement sound plays on the ability trigger, matching the source clip staged in Foundry. | | | |
| IG-11 | Hero sound case: disabled mod. | Either the IG-09 or IG-10 mod, disabled rather than removed. | 1. In Installed, disable the hero sound mod from IG-09 or IG-10 without deleting it. 2. Launch Deadlock, pick Seven, and trigger the same ability. | The stock, unmodified ability sound plays; none of the disabled mod's replacement is heard. | | | |
| IG-12 | Hero sound case: multi-clip pool. | A Foundry sound pool assigned to one of Seven's ability lines, with at least two clips. | 1. In Foundry, build or select a multi-clip pool of at least two sound clips assigned to one of Seven's ability entries. 2. Enable launch shuffle for that pool. 3. Trigger the ability across several game launches or plays. | More than one of the pool's clips is heard across repeated triggers, not always the same single clip. | | | |
| IG-13 | Voice sound case: downloaded third-party mod. | A downloaded third-party GameBanana voice mod that replaces one of Paige's (bookworm) voice lines. | 1. Download and install a third-party voice mod for Paige. 2. Enable it in Installed. 3. Launch Deadlock, pick Paige, and trigger the replaced voice line (for example a kill or ability voice line). | The mod's replacement voice line plays, matching what the mod's own preview or description claims. | | | |
| IG-14 | Voice sound case: forged mod. | A Foundry-forged voice swap on a different Paige voice line than IG-13. | 1. Stage a voice sound edit on a different Paige voice line in Foundry. 2. Forge to Install. 3. Launch Deadlock, pick Paige, and trigger that line. | The forged replacement voice line plays, matching the source clip staged in Foundry. | | | |
| IG-15 | Voice sound case: disabled mod. | Either the IG-13 or IG-14 mod, disabled rather than removed. | 1. Disable the voice mod from IG-13 or IG-14 in Installed, without deleting it. 2. Launch Deadlock, pick Paige, and trigger the same voice line. | The stock voice line plays; none of the disabled mod's replacement is heard. | | | |
| IG-16 | Voice sound case: multi-clip pool. | A Foundry sound pool of at least two clips assigned to one of Paige's voice line entries. | 1. Build or select a multi-clip pool of at least two voice clips assigned to a Paige voice line entry. 2. Enable launch shuffle for that pool. 3. Trigger the line across several game launches or plays. | More than one of the pool's clips is heard across repeated triggers. | | | |
| IG-17 | Global sound case: downloaded third-party mod. | A downloaded third-party GameBanana announcer or ambience sound mod. | 1. Download and install a third-party global sound mod (announcer or ambience). 2. Enable it in Installed. 3. Launch Deadlock and trigger the replaced global event (an announcer line or an ambience cue). | The mod's replacement global sound plays on the triggering event. | | | |
| IG-18 | Global sound case: forged mod. | A Foundry-forged sound swap on a different global entry than IG-17 (announcer or ambience). | 1. Stage a sound edit on a global announcer or ambience entry in Foundry, distinct from IG-17's entry. 2. Forge to Install. 3. Launch Deadlock and trigger that global event. | The forged replacement global sound plays on the triggering event. | | | |
| IG-19 | Global sound case: disabled mod. | Either the IG-17 or IG-18 mod, disabled rather than removed. | 1. Disable the global sound mod from IG-17 or IG-18 in Installed, without deleting it. 2. Launch Deadlock and trigger the same global event. | The stock global sound plays; none of the disabled mod's replacement is heard. | | | |
| IG-20 | Global sound case: multi-clip pool. | A Foundry sound pool of at least two clips assigned to one global entry (announcer or ambience). | 1. Build or select a multi-clip pool of at least two clips assigned to a global sound entry. 2. Enable launch shuffle for that pool. 3. Trigger the global event across several game launches or plays. | More than one of the pool's clips is heard across repeated triggers. | | | |
| IG-21 | Where the `minimap` portrait variant actually appears in game, so the `portraitVariantLabelKey` label resolving for it is honest. | Any hero's portrait family with a minimap variant present, checked against the actual minimap during a match. | 1. Note which portrait family member `portraitVariantLabelKey` resolves as the minimap variant for a hero. 2. Join or start a match and observe the minimap during play. 3. Compare what actually renders there against the labelled minimap variant asset. | The portrait asset labelled minimap by `portraitVariantLabelKey` is the one actually shown on the in-game minimap, so the label is honest. | | | |
| IG-22 | Where the `small` portrait variant actually appears in game, so the `portraitVariantLabelKey` label resolving for it is honest. | The same hero's portrait family, small variant, checked against wherever it actually appears in game (for example a compact HUD element or scoreboard row). | 1. Note which portrait family member `portraitVariantLabelKey` resolves as the small variant for a hero. 2. Join or start a match and look at every compact hero portrait surface (scoreboard, kill feed, HUD). 3. Compare what actually renders there against the labelled small variant asset. | The portrait asset labelled small by `portraitVariantLabelKey` is the one actually shown wherever a compact hero portrait appears in game, so the label is honest. | | | |

## Table 2: Rigged preview (REQ-rigged-preview-release-gate)

Reference `docs/rigged-preview-spike.md` section 8 for the full setup and
reasoning; the steps below narrow to checks 1, 2, and 3 per section 9's
next step 2, on Seven (`gigawatt_prisoner`), the worst case on every
measured axis in the spike.

| ID | Check | Fixture | Steps | Pass looks like | Verdict | Evidence | Root cause |
| --- | --- | --- | --- | --- | --- | --- | --- |
| RP-01 | Does the whole model animate together, including the separate gun and headgear meshes? (`docs/rigged-preview-spike.md` section 8 check 1) | Seven (gigawatt_prisoner), rigged preview enabled per section 8's setup (temporarily set `USE_RIGGED_PREVIEW = true` in `heroPoseRenderFeatures.ts`, or tick Cloth in the dev Leva panel). | 1. Run `pnpm dev` and open Seven's Locker hero page. 2. Enable the rigged preview per section 8's setup instructions. 3. Watch the idle animation play. 4. Confirm every separate mesh, including the gun and headgear, moves together with the body. | The entire model animates together, including the separate gun and headgear meshes, exactly as section 8 check 1 describes for a PASS. | | | |
| RP-02 | Does the NPR outline or rim swim or detach while orbiting during the idle? (`docs/rigged-preview-spike.md` section 8 check 2) | Seven (gigawatt_prisoner), rigged preview enabled, same setup as RP-01. | 1. With the rigged preview running on Seven, orbit the camera around the model while the idle plays. 2. Watch the silhouette edge and the rim highlight along the shoulders and head. | The rim stays locked to the silhouette as limbs move, with no lag, floating, or bind-pose ghosting, exactly as section 8 check 2 describes for a PASS. | | | |
| RP-03 | Frame budget: the gate. (`docs/rigged-preview-spike.md` section 8 check 3) | Seven (gigawatt_prisoner), the worst case on every measured axis per the spike. | 1. Set cloth off and rigged on for Seven's preview (the decoupled flag in `heroPoseRenderFeatures.ts`). 2. Open DevTools' Performance panel, or add a stats overlay. 3. Record 10 seconds with the static preview (rigged off), at the same hero and the same window size. 4. Record 10 seconds with the rigged preview on, at the same hero and the same window size. 5. Read the median frame time of each run, not the average. 6. Compute the delta between the two medians. 7. Note the device pixel ratio the canvas settled on for the run. | State the reading against all three bands, verbatim: within about 1 ms of static is ship-viable; 1 to 3 ms worse is investigate; more than 3 ms worse, or a drop below 30 fps on mid-range hardware, is a fail. A measured delta landing exactly on a band edge is recorded in the more conservative band; that is the rule, so the reading cannot be argued either way after the fact. If Seven cannot be measured at all, the verdict is blocked with the reason, and the release flag (`RELEASE_RENDER_FLAGS.rigged` in `src/components/locker/HeroPoseViewer.tsx`) is left at its current value rather than moved on absent evidence. | | | |

## Table 3: ConVar readings (REQ-performance-convar-safer-experimentation)

Every How to read cell names the console command to run: type the ConVar
key with no value into the developer console and press Enter, and it
prints the current value. Record that raw printed value verbatim in the
Reading cell, with no normalization.

CV-01 goes first, ahead of its declared order in `HUD_CONVARS`, because it
is an inverted flag and the requirement itself calls it out to be checked
first.

| ID | ConVar key | How to read | Reading | Verdict | Notes |
| --- | --- | --- | --- | --- | --- |
| CV-01 | `citadel_damage_offscreen_indicator_disabled` | In the developer console, type `citadel_damage_offscreen_indicator_disabled` with no value and press Enter. The console prints the current value; record it in the Reading cell verbatim, unnormalized. | | | This is an inverted flag: `on` maps to `citadel_damage_offscreen_indicator_disabled false`, `off` maps to `true`, per `HUD_CONVARS` in `electron/main/services/performanceUserControls.ts`. Check the raw reading against that existing on/off mapping rather than normalizing it away. |
| CV-02 | `citadel_unit_status_use_new` | In the developer console, type `citadel_unit_status_use_new` with no value and press Enter; record the printed value. | | | |
| CV-03 | `citadel_unit_status_use_v2` | In the developer console, type `citadel_unit_status_use_v2` with no value and press Enter; record the printed value. | | | |
| CV-04 | `citadel_unit_status_single_bar_mode` | In the developer console, type `citadel_unit_status_single_bar_mode` with no value and press Enter; record the printed value. | | | |
| CV-05 | `citadel_unit_status_use_v2_for_nonplayers` | In the developer console, type `citadel_unit_status_use_v2_for_nonplayers` with no value and press Enter; record the printed value. | | | |
| CV-06 | `citadel_unit_status_allies_see_thru_walls` | In the developer console, type `citadel_unit_status_allies_see_thru_walls` with no value and press Enter; record the printed value. | | | |
| CV-07 | `citadel_damage_text_show_effectiveness` | In the developer console, type `citadel_damage_text_show_effectiveness` with no value and press Enter; record the printed value. | | | |
| CV-08 | `citadel_hud_objective_health_enabled` | In the developer console, type `citadel_hud_objective_health_enabled` with no value and press Enter; record the printed value (the control's expected range is 0 to 2). | | | `performanceUserControls.ts` currently comments this key as unsupported. Once this reading is in, correct that comment either way: confirm it is genuinely unsupported by stock `gameinfo.gi`, or remove the comment if the reading shows otherwise. |
| CV-09 | `citadel_unit_status_allies_see_thru_walls_max_distance` | In the developer console, type `citadel_unit_status_allies_see_thru_walls_max_distance` with no value and press Enter; record the printed value. | | | |
| CV-10 | `citadel_minimap_unit_click_radius` | In the developer console, type `citadel_minimap_unit_click_radius` with no value and press Enter; record the printed value. | | | |
| CV-11 | `citadel_minimap_player_width` | In the developer console, type `citadel_minimap_player_width` with no value and press Enter; record the printed value. | | | |
| CV-12 | `citadel_minimap_local_player_width` | In the developer console, type `citadel_minimap_local_player_width` with no value and press Enter; record the printed value. | | | |
| CV-13 | `citadel_minimap_max_icon_shrink` | In the developer console, type `citadel_minimap_max_icon_shrink` with no value and press Enter; record the printed value. | | | |
| CV-14 | `citadel_minimap_overlap_scan_distance` | In the developer console, type `citadel_minimap_overlap_scan_distance` with no value and press Enter; record the printed value. | | | |
| CV-15 | `citadel_minimap_zip_line_thickness` | In the developer console, type `citadel_minimap_zip_line_thickness` with no value and press Enter; record the printed value. | | | |
| CV-16 | `minimap_update_rate_hz` | In the developer console, type `minimap_update_rate_hz` with no value and press Enter; record the printed value. | | | |

## What happens to these readings

Once every row above is filled in, the 16 readings from Table 3 are typed
into the `engineDefault` fields beside `gameDefault` in
`electron/main/services/performanceUserControls.ts`, one per key: seven in
`HUD_CONVARS`, nine in `ADVANCED_GAMEINFO_CONVARS`. Until then those fields
stay `null`.
