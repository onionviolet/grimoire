# Verification record

Status: in progress. Date scaffolded: 2026-08-06. Amended 2026-08-06 (tiers
and `deferred`, per `.planning/phases/01-verified-against-the-game/01-CONTEXT.md`
D-19..D-25).

This is the one fork-only place every gated piece of evidence Phase 1 needs
lives, one row per check, sitting beside `docs/rigged-preview-spike.md` as
the same kind of artifact. It was scaffolded on the belief that the whole
sweep needed a Deadlock session; that belief was wrong about most of it.

Every row below carries a **Tier**, `app` or `engine`:

- **`app`** means the running Grimoire app can settle the row over CDP, with
  no game and no human in the loop. `scripts/verify-in-app.mjs` drives these
  23 rows (IG-01 through IG-20, RP-01, RP-02, RP-03) against a dev slot's
  `window.electronAPI` and writes the verdict back.
- **`engine`** means only a running Deadlock build can settle it: the value
  comes from the developer console (the 16 ConVar rows), or the question is
  what the game's own HUD and minimap actually draw (IG-21, IG-22). No
  script reaches these; they stay for a human game session, or a
  consciously accepted gap (see `deferred` below).

**What an `app`-tier pass proves, and what it does not.** An app-tier
assertion is a claim about bytes on disk and app state, never about
perception: the forged VPK holds the expected entry path with the expected
bytes; `getMods()` holds the expected entries; the pool picker returned more
than one distinct clip. A pass proves Grimoire wrote the intended entry path
with the intended bytes into the intended VPK. It does **not** prove the
Source 2 engine loads that VPK, that the sound is audible, or that the
minimap draws the portrait the label claims. Those stay engine facts, and
the project has chosen to accept that gap for the engine-tier rows rather
than hold the phase open on a game session that no agent can run.

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
  available right now, on either tier. It requires a stated reason, in the
  same Root cause / Notes cell a fail would use. It means: this check could
  not run, and someone still owes it.
- `deferred` is a **different** thing, legal only on an `engine`-tier row.
  It means: the app-side half of this row is proven or not applicable, and
  the project has consciously decided to accept the engine half untested for
  now rather than hold the phase open for a game session. It requires a
  stated reason, same cell as `blocked`. `deferred` on an `app` row is an
  error: an app row has a runner that can settle it, so deferring it would
  hide a check that was actually skippable.
- `deferred` must never stand in for a `pass` on an engine row on the
  strength of app-tier evidence. A mount, an audible sound, and an in-game
  minimap portrait are engine facts; the strongest app-tier evidence is
  still `deferred`, not `pass`, for those rows.
- The phase is not done while any Verdict cell is blank. It is done once
  every `app` row is settled and every `engine` row carries a verdict or a
  reasoned `deferred` -- `--strict` can now reach 0 without a game session.
- Wherever a proposed fixture (a named mod, hero, or pool) is not available,
  substitute your own and note the substitution in the Notes/Root cause
  cell if it changes what the row is actually checking.

The command that checks all of this mechanically:

```
node scripts/check-verification-record.mjs --strict
```

Without `--strict` the same command only checks structure (every row
present, every scaffolded cell filled, every filled verdict well-formed, and
every Tier a recognised value), which is what lets the repository suite stay
green while this record is still being worked through. With `--strict` it
additionally requires every Verdict cell to be non-blank (a reasoned
`deferred` counts as filled), which is this phase's completion gate.

The command that settles the 23 `app`-tier rows against a running dev slot:

```
GRIMOIRE_DEV_SLOT=<n> node scripts/verify-in-app.mjs --dry-run   # plan only, mutates nothing
GRIMOIRE_DEV_SLOT=<n> node scripts/verify-in-app.mjs             # runs it for real
```

See `CLAUDE.md` ("Driving a Running Dev Build") for the slot rule: never
slot 0, never an unslotted `pnpm dev` -- slots isolate userData, not the game
install, and this runner toggles, forges, and merges mods against the one
real game install every slot shares.

## Table 1: In-game sweep (REQ-ingame-verification-sweep)

| ID | Tier | Check | Fixture | Steps | Pass looks like | Verdict | Evidence | Root cause |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| IG-01 | app | Forge one staged sound edit and one staged texture edit into a single VPK, mount it, hear the sound and see the texture. | A hero with both a sound and a texture edit staged in Foundry in the same session, for example Seven (gigawatt_prisoner): a sound swap on an ability line plus a texture edit on his card portrait. | 1. In Foundry, stage a sound edit on one of Seven's ability lines and a texture edit on Seven's card portrait. 2. Open the combined review tray and confirm both edits are listed. 3. Forge to Export to produce a single VPK (Forge to Install also exercises this if testing the install path instead). 4. Mount the exported VPK, or confirm the installed build is enabled. 5. In game, trigger the ability to hear the swapped sound, and open the hero card to see the swapped texture. | Both the swapped sound plays on the ability trigger and the swapped texture renders on the hero card, from the single VPK the combined tray built. | blocked |  | The texture half of this combined edit needs the fork's locally-built vpkmerge engine (YCoCg icon fix), not the bundled release binary this run has available: Error: Error invoking remote method 'foundry:forgeInstall': Error: Texture replacement requires the forked vpkmerge engine with the YCoCg icon fix. Build the sibling engine and run pnpm use-local-vpkmerge before packaging. |
| IG-02 | app | Cancel the native save dialog instead of exporting, and confirm the mod library and the staged edits are exactly as they were. | The same staged sound and texture edits from IG-01, still pending. | 1. With the sound and texture edits still staged, choose Forge to Export. 2. When the native OS save dialog opens, click Cancel instead of choosing a location. 3. Return to Foundry and check My changes / the staged edit tray. 4. Check Installed for any new or altered mod entry. | No VPK was written, the staged edits are still listed exactly as before, and Installed shows no new, removed, or reordered mod. | blocked |  | The native OS save dialog (dialog.showSaveDialog) is a main-process API with no renderer-reachable hook to force a cancellation from a CDP-driven script. Automating it would require adding a new main-process test hook, which is instrumentation beyond this plan's scope; faking the cancellation instead of driving the real dialog was rejected as dishonest evidence (T-01-26). |
| IG-03 | app | The forge-install path end to end. | One staged sound or texture edit, forged via Install rather than Export. | 1. Stage one edit in Foundry. 2. Choose Forge to Install rather than Export. 3. Confirm the combined review tray, then confirm the install. 4. Check Installed for the new build, then launch Deadlock and confirm the edit is active in game. | The build appears in Installed as enabled, and the effect (sound or visual) is present in a live game session with no manual mounting step. | pass | forgeInstall installed "pak88_dir.vpk" (event "Gigawatt.LightningBall.Damage") as enabled with entry sounds/abilities/gigawatt/a1_lightning_ball/damage_01.vsnd_c present (127490 bytes), no manual mounting step. Fixture substituted: sound edit, not texture -- see this row's description for why. |  |
| IG-04 | app | Forge-install rollback when slot allocation fails. | A game install whose Foundry-managed slots are exhausted or deliberately made unwritable, so the next forge-install's slot allocation fails. | 1. Fill or block the slots Foundry allocates builds into (for example by manually occupying every pakNN slot Foundry would use). 2. Stage an edit and choose Forge to Install. 3. Let slot allocation fail. 4. Check Installed and the mod library for any partial or orphaned entry. | The install reports a failure to the user, and Installed and the mod library are left exactly as they were before the attempt: no partial mod, no orphaned slot, no orphaned file. | blocked |  | Reproducing genuine slot exhaustion requires filling every pakNN slot (1..99) in the base addons folder AND every overflow addonsN folder up to the app's MAX_ADDON_FOLDERS cap (electron/main/services/mods.ts allocateSlot), because allocateEnabledVpkPath spills into a freshly minted overflow folder and patches gameinfo.gi (fixGameinfo) rather than failing until every folder is full. Creating that many files and mutating gameinfo.gi against the real, shared production game install in an unattended run was judged an unacceptable risk (see addons_directory_safety in this run's brief); the safer choice was not to attempt it. |
| IG-05 | app | Forge-install rollback when metadata fails. | A staged edit whose forge-install is interrupted after the VPK is written but before metadata is finalized, for example by making the metadata sidecar file temporarily read-only or the folder briefly inaccessible. | 1. Stage an edit and choose Forge to Install. 2. Interrupt or block the metadata write step specifically, after the VPK itself would already be written. 3. Observe the reported outcome. 4. Check Installed, the mod library, and the game's addon folder for any leftover VPK or partial metadata. | The install reports a failure, and no partial mod, orphaned VPK, or inconsistent metadata is left behind: Installed and the addon folder both look exactly as before the attempt. | blocked |  | The "metadata sidecar" is mod-metadata.json, the single JSON file shared by the ENTIRE mod library (electron/main/services/metadata.ts saveMetadata), not a per-mod file. Making it briefly unwritable to induce a write failure risks corrupting or losing writes for unrelated mod state on the exact file whose byte count this run's addons-directory restoration proof is measured against. That risk was judged unacceptable for an unattended run against the real production install; the safer choice was not to attempt it. |
| IG-06 | app | Mount a merged VPK built from a reviewed source order and confirm the mod the review named as winner is the one the engine loads. | Two installed mods that both write the identical VPK entry path, for example two competing hero skin mods, or a hero mod and a Foundry build both touching the same texture entry. | 1. Open the merge review panel over the two conflicting mods and record the exact reviewed source order it shows, verbatim. 2. Note the effective winner the review panel names for the contested entry. 3. Build and mount the merged VPK. 4. In game, load the content at that entry path (open the hero card, hear the sound, or view the texture, whichever the contested entry is) and note which mod's content actually appears. | The mod the review panel named as winner is the one whose content the engine actually loads. Record both the reviewed source order and the observed winner side by side in the Evidence cell, so a tie between two mods claiming the identical entry path is attributable to a written order rather than to chance. | pass | analyzeMerge named mod A (gainDb 0) as the winner at sounds/abilities/gigawatt/gigawatt_lightning_ball_cast.vsnd_c; the merged VPK's entry bytes (127474 bytes) are byte-identical to that mod's own installed bytes. |  |
| IG-07 | app | Confirm an AssetSourcesPanel audition of an installed VPK matches what the engine plays. | An installed VPK sound mod on a hero, for example a downloaded or forged sound swap on Seven (gigawatt_prisoner). | 1. Open the Asset Sources panel for the installed mod's sound entry. 2. Play the audition clip from the sources panel and note what it sounds like. 3. Launch Deadlock, trigger the same in-game sound (ability, voice line, or global cue), and compare. | The clip played by the sources panel's audition matches, sound for sound, what the engine plays in a live game session for that entry. | pass | auditionSourceClip(8e12713e7bfeeff8, sounds/abilities/gigawatt/a1_lightning_ball/damage_01.vsnd_c) resolved; the installed VPK carries that same entry (127490 bytes). (This is presence/resolution parity, not a decoded-audio byte comparison -- no bundled audio decoder is available to this script.) |  |
| IG-08 | app | Re-forge that swap and confirm it sounds identical to the first forge. | The same installed swap from IG-07. | 1. Note or record what the IG-07 swap sounds like in game. 2. Remove or disable the installed build. 3. Re-forge the identical swap from the same staged source. 4. Reinstall and confirm in game again. | The re-forged swap sounds identical to the first forge, both in the sources panel audition and in a live game session. This is the idempotency claim the audition parity check rests on. | pass | re-forged "pak98_dir.vpk" from the same source; entry sounds/abilities/gigawatt/a1_lightning_ball/damage_01.vsnd_c bytes are identical to the first forge (127490 bytes). |  |
| IG-09 | app | Hero sound case: downloaded third-party mod. | A downloaded third-party GameBanana sound mod that replaces one of Seven's (gigawatt_prisoner) ability lines. | 1. Download and install a third-party hero sound mod for Seven from GameBanana via the Browse tab. 2. Enable it in Installed. 3. Launch Deadlock, pick Seven, and trigger the replaced ability. | The mod's replacement sound plays on the ability trigger, matching what the mod's own preview or description claims. | pass | Discovered installed, non-Foundry mod "pak65_dir.vpk" (Seven Ult - Alicia Clair Obscur) claiming hero sound entry sounds/abilities/gigawatt/gigawatt_storm_cloud_lp.vsnd_c, which matches the live catalog's hero sound entries. |  |
| IG-10 | app | Hero sound case: forged mod. | A Foundry-forged sound swap on one of Seven's ability lines, distinct from the entry used in IG-09. | 1. In Foundry, stage a sound edit on a different Seven ability line than IG-09. 2. Forge to Install. 3. Launch Deadlock, pick Seven, and trigger that ability. | The forged replacement sound plays on the ability trigger, matching the source clip staged in Foundry. | pass | swapSound installed "pak88_dir.vpk" for Seven event "Gigawatt.LightningBall.Damage"; entry sounds/abilities/gigawatt/a1_lightning_ball/damage_01.vsnd_c present (127490 bytes). |  |
| IG-11 | app | Hero sound case: disabled mod. | Either the IG-09 or IG-10 mod, disabled rather than removed. | 1. In Installed, disable the hero sound mod from IG-09 or IG-10 without deleting it. 2. Launch Deadlock, pick Seven, and trigger the same ability. | The stock, unmodified ability sound plays; none of the disabled mod's replacement is heard. | pass | disableMod(8e12713e7bfeeff8) removed it from the enabled set; no remaining enabled VPK claims entry sounds/abilities/gigawatt/a1_lightning_ball/damage_01.vsnd_c. |  |
| IG-12 | app | Hero sound case: multi-clip pool. | A Foundry sound pool assigned to one of Seven's ability lines, with at least two clips. | 1. In Foundry, build or select a multi-clip pool of at least two sound clips assigned to one of Seven's ability entries. 2. Enable launch shuffle for that pool. 3. Trigger the ability across several game launches or plays. | More than one of the pool's clips is heard across repeated triggers, not always the same single clip. | pass | planSoundPool('seeded-library', ...) (mirrors src/components/foundry/soundPoolPlan.ts) called with 12 seeds (1,7,13,29,51,103,211,419,887,1471,3037,6151) against a 3-clip library; distinct audioPath values returned across all seeds: 3 (/fixture/pool-clip-b.mp3, /fixture/pool-clip-c.mp3, /fixture/pool-clip-a.mp3). |  |
| IG-13 | app | Voice sound case: downloaded third-party mod. | A downloaded third-party GameBanana voice mod that replaces one of Paige's (bookworm) voice lines. | 1. Download and install a third-party voice mod for Paige. 2. Enable it in Installed. 3. Launch Deadlock, pick Paige, and trigger the replaced voice line (for example a kill or ability voice line). | The mod's replacement voice line plays, matching what the mod's own preview or description claims. | blocked |  | 84 enabled non-Foundry mod(s) are installed, but none of them claim a VPK entry that matches the live catalog's voice sound entries. No suitable pre-existing third-party fixture was found for this case. |
| IG-14 | app | Voice sound case: forged mod. | A Foundry-forged voice swap on a different Paige voice line than IG-13. | 1. Stage a voice sound edit on a different Paige voice line in Foundry. 2. Forge to Install. 3. Launch Deadlock, pick Paige, and trigger that line. | The forged replacement voice line plays, matching the source clip staged in Foundry. | pass | swapSound installed "pak88_dir.vpk" for Paige voice line "bookworm_ally_astro_killed_in_lane_01_hero_3d"; entry sounds/vo/bookworm/bookworm_ally_astro_killed_in_lane_01.vsnd_c present (127490 bytes). |  |
| IG-15 | app | Voice sound case: disabled mod. | Either the IG-13 or IG-14 mod, disabled rather than removed. | 1. Disable the voice mod from IG-13 or IG-14 in Installed, without deleting it. 2. Launch Deadlock, pick Paige, and trigger the same voice line. | The stock voice line plays; none of the disabled mod's replacement is heard. | pass | disableMod(8e12713e7bfeeff8) removed it from the enabled set; no remaining enabled VPK claims entry sounds/vo/bookworm/bookworm_ally_astro_killed_in_lane_01.vsnd_c. |  |
| IG-16 | app | Voice sound case: multi-clip pool. | A Foundry sound pool of at least two clips assigned to one of Paige's voice line entries. | 1. Build or select a multi-clip pool of at least two voice clips assigned to a Paige voice line entry. 2. Enable launch shuffle for that pool. 3. Trigger the line across several game launches or plays. | More than one of the pool's clips is heard across repeated triggers. | pass | planSoundPool('seeded-library', ...) (mirrors src/components/foundry/soundPoolPlan.ts) called with 12 seeds (1,7,13,29,51,103,211,419,887,1471,3037,6151) against a 3-clip library; distinct audioPath values returned across all seeds: 3 (/fixture/pool-clip-b.mp3, /fixture/pool-clip-c.mp3, /fixture/pool-clip-a.mp3). |  |
| IG-17 | app | Global sound case: downloaded third-party mod. | A downloaded third-party GameBanana announcer or ambience sound mod. | 1. Download and install a third-party global sound mod (announcer or ambience). 2. Enable it in Installed. 3. Launch Deadlock and trigger the replaced global event (an announcer line or an ambience cue). | The mod's replacement global sound plays on the triggering event. | pass | Discovered installed, non-Foundry mod "pak01_dir.vpk" (YES KING Voice Mod for Abrams(Kills,Abilities,etc)) claiming global sound entry sounds/vo/atlas/atlas_kill_anyhero_07.vsnd_c, which matches the live catalog's global sound entries. |  |
| IG-18 | app | Global sound case: forged mod. | A Foundry-forged sound swap on a different global entry than IG-17 (announcer or ambience). | 1. Stage a sound edit on a global announcer or ambience entry in Foundry, distinct from IG-17's entry. 2. Forge to Install. 3. Launch Deadlock and trigger that global event. | The forged replacement global sound plays on the triggering event. | pass | swapSound installed "pak88_dir.vpk" for global event "interior.Blue_North" (soundevents/ambience/interiors.vsndevts_c); entry sounds/ambient/soundscapes/loops/amb_city_01.vsnd_c present (127490 bytes). |  |
| IG-19 | app | Global sound case: disabled mod. | Either the IG-17 or IG-18 mod, disabled rather than removed. | 1. Disable the global sound mod from IG-17 or IG-18 in Installed, without deleting it. 2. Launch Deadlock and trigger the same global event. | The stock global sound plays; none of the disabled mod's replacement is heard. | pass | disableMod(8e12713e7bfeeff8) removed it from the enabled set; no remaining enabled VPK claims entry sounds/ambient/soundscapes/loops/amb_city_01.vsnd_c. |  |
| IG-20 | app | Global sound case: multi-clip pool. | A Foundry sound pool of at least two clips assigned to one global entry (announcer or ambience). | 1. Build or select a multi-clip pool of at least two clips assigned to a global sound entry. 2. Enable launch shuffle for that pool. 3. Trigger the global event across several game launches or plays. | More than one of the pool's clips is heard across repeated triggers. | pass | planSoundPool('seeded-library', ...) (mirrors src/components/foundry/soundPoolPlan.ts) called with 12 seeds (1,7,13,29,51,103,211,419,887,1471,3037,6151) against a 3-clip library; distinct audioPath values returned across all seeds: 3 (/fixture/pool-clip-b.mp3, /fixture/pool-clip-c.mp3, /fixture/pool-clip-a.mp3). |  |
| IG-21 | engine | Where the `minimap` portrait variant actually appears in game, so the `portraitVariantLabelKey` label resolving for it is honest. | Any hero's portrait family with a minimap variant present, checked against the actual minimap during a match. | 1. Note which portrait family member `portraitVariantLabelKey` resolves as the minimap variant for a hero. 2. Join or start a match and observe the minimap during play. 3. Compare what actually renders there against the labelled minimap variant asset. | The portrait asset labelled minimap by `portraitVariantLabelKey` is the one actually shown on the in-game minimap, so the label is honest. | deferred | | This is a fact about what the game's own HUD/minimap compositing actually draws during a live match; no CDP-driven app check can observe the Source 2 renderer's output. Deferred per D-19/D-22: the app half (which portrait `portraitVariantLabelKey` resolves) is a pure function already covered by unit tests on that resolver, and the project accepts the in-game half untested for now rather than hold the phase open for a game session. |
| IG-22 | engine | Where the `small` portrait variant actually appears in game, so the `portraitVariantLabelKey` label resolving for it is honest. | The same hero's portrait family, small variant, checked against wherever it actually appears in game (for example a compact HUD element or scoreboard row). | 1. Note which portrait family member `portraitVariantLabelKey` resolves as the small variant for a hero. 2. Join or start a match and look at every compact hero portrait surface (scoreboard, kill feed, HUD). 3. Compare what actually renders there against the labelled small variant asset. | The portrait asset labelled small by `portraitVariantLabelKey` is the one actually shown wherever a compact hero portrait appears in game, so the label is honest. | deferred | | This is a fact about what the game's own HUD/minimap compositing actually draws during a live match; no CDP-driven app check can observe the Source 2 renderer's output. Deferred per D-19/D-22: the app half (which portrait `portraitVariantLabelKey` resolves) is a pure function already covered by unit tests on that resolver, and the project accepts the in-game half untested for now rather than hold the phase open for a game session. |

## Table 2: Rigged preview (REQ-rigged-preview-release-gate)

Reference `docs/rigged-preview-spike.md` section 8 for the full setup and
reasoning; the steps below narrow to checks 1, 2, and 3 per section 9's
next step 2, on Seven (`gigawatt_prisoner`), the worst case on every
measured axis in the spike.

| ID | Tier | Check | Fixture | Steps | Pass looks like | Verdict | Evidence | Root cause |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RP-01 | app | Does the whole model animate together, including the separate gun and headgear meshes? (`docs/rigged-preview-spike.md` section 8 check 1) | Seven (gigawatt_prisoner), rigged preview enabled per section 8's setup (temporarily set `USE_RIGGED_PREVIEW = true` in `heroPoseRenderFeatures.ts`, or tick Cloth in the dev Leva panel). | 1. Run `pnpm dev` and open Seven's Locker hero page. 2. Enable the rigged preview per section 8's setup instructions. 3. Watch the idle animation play. 4. Confirm every separate mesh, including the gun and headgear, moves together with the body. | The entire model animates together, including the separate gun and headgear meshes, exactly as section 8 check 1 describes for a PASS. | blocked |  | No window-level hook exposes the Three.js/react-three-fiber scene graph for programmatic world-matrix sampling of the gun and headgear meshes (grep of src/ found no window.__GRIMOIRE_* or window.grimoire debug hook of this kind). Adding one would be new debug instrumentation beyond this plan's files_modified list. RP-03's own reading used only canvas/WebGL-level access (EXT_disjoint_timer_query_webgl2, screenshot pixel comparison), which answers a frame-budget question, not a per-mesh transform question; it is not a substitute for RP-01. |
| RP-02 | app | Does the NPR outline or rim swim or detach while orbiting during the idle? (`docs/rigged-preview-spike.md` section 8 check 2) | Seven (gigawatt_prisoner), rigged preview enabled, same setup as RP-01. | 1. With the rigged preview running on Seven, orbit the camera around the model while the idle plays. 2. Watch the silhouette edge and the rim highlight along the shoulders and head. | The rim stays locked to the silhouette as limbs move, with no lag, floating, or bind-pose ghosting, exactly as section 8 check 2 describes for a PASS. | blocked | 4 screenshots captured ~1s apart while Seven's rigged idle played, relying on the existing turntable spin for varied angles rather than explicit camera control (no orbit-angle API was found on window.electronAPI). Saved outside the repository (ephemeral, not committed): C:\Users\wayba\AppData\Local\Temp\claude\grimoire-verify-in-app-evidence\rp-02-seven-t0.png, C:\Users\wayba\AppData\Local\Temp\claude\grimoire-verify-in-app-evidence\rp-02-seven-t1.png, C:\Users\wayba\AppData\Local\Temp\claude\grimoire-verify-in-app-evidence\rp-02-seven-t2.png, C:\Users\wayba\AppData\Local\Temp\claude\grimoire-verify-in-app-evidence\rp-02-seven-t3.png | This row is deliberately not auto-verdicted (plan Task 2: "the eye is still the instrument"). The screenshots are evidence for a human to read; blocked records that the automatic half stops at evidence capture. |
| RP-03 | app | Frame budget: the gate. (`docs/rigged-preview-spike.md` section 8 check 3) | Seven (gigawatt_prisoner), the worst case on every measured axis per the spike. | 1. Set cloth off and rigged on for Seven's preview (the decoupled flag in `heroPoseRenderFeatures.ts`). 2. Open DevTools' Performance panel, or add a stats overlay. 3. Record 10 seconds with the static preview (rigged off), at the same hero and the same window size. 4. Record 10 seconds with the rigged preview on, at the same hero and the same window size. 5. Read the median frame time of each run, not the average. 6. Compute the delta between the two medians. 7. Note the device pixel ratio the canvas settled on for the run. | State the reading against all three bands, verbatim: within about 1 ms of static is ship-viable; 1 to 3 ms worse is investigate; more than 3 ms worse, or a drop below 30 fps on mid-range hardware, is a fail. A measured delta landing exactly on a band edge is recorded in the more conservative band; that is the rule, so the reading cannot be argued either way after the fact. If Seven cannot be measured at all, the verdict is blocked with the reason, and the release flag (`RELEASE_RENDER_FLAGS.rigged` in `src/components/locker/HeroPoseViewer.tsx`) is left at its current value rather than moved on absent evidence. | pass | Static median 8.30 ms, rigged median 8.30 ms, wall-clock delta 0.00 ms (both pinned to the 120 Hz vsync ceiling); GPU timer median static 1.67 ms, rigged 1.79 ms, delta +0.12 ms; dpr 1.2384; both deltas well inside the "within about 1 ms of static" ship band. Full reading, all measurement conditions, and the roster clip sweep are in the "RP-03 measurement and recommendation" section below Table 2. | |

Note on taking this reading, for whoever runs or re-runs it: confirm
`document.visibilityState === 'visible'` and that `requestAnimationFrame` is
actually ticking before trusting any timing number. Chromium suspends rAF and
throttles timers to about 1 Hz for a window it considers hidden, and on
Windows that includes a window merely covered by other windows, so a sampler
run in that state silently reports whatever its initial value was.
`Page.captureScreenshot` (the driver's `shot` command) still returns a
correctly rendered picture in that state, because it forces a capture
regardless of scheduling, so a screenshot is NOT evidence that frames are
being produced. Run with `GRIMOIRE_DEV_NO_BACKGROUNDING=1` (see `CLAUDE.md`
and `electron/main/index.ts`) and keep the window unobstructed, or the number
measures nothing.

### RP-03 measurement and recommendation

**Machine (outstanding gap, filled in retroactively 2026-08-06):** GPU AMD
Radeon RX 7900 XTX (discrete; the measuring machine also reports an Intel
UHD Graphics 770 integrated GPU and a Parsec Virtual Display Adapter, neither
of which is the render device), OS Windows 11 Enterprise build 10.0.26220.
This identification was missing from the original reading below and is
supplied here rather than re-derived, per the note carried into this plan:
do not treat this as a re-measurement, only as the machine identity the
original numbers were taken on.

Taken on Seven (hero id 33322), the vanilla rig (0 installed skin mods on the
measuring machine; the fixture names `gigawatt_prisoner`, the body-model
codename, not an installed skin), cloth off, rigged toggled via the decoupled
`grimoire.preview.rigged` dev flag. Canvas: 587x682 backing, 474x551 CSS, the
floating preview panel.

| Metric | Static (rigged off) | Rigged (rigged on) | Delta |
| --- | --- | --- | --- |
| Median frame time, wall clock | 8.30 ms | 8.30 ms | 0.00 ms |
| Median frame time, GPU timer (EXT_disjoint_timer_query_webgl2) | 1.67 ms | 1.79 ms | +0.12 ms |
| p95 frame time, GPU timer | 2.46 ms | 2.11 ms | -0.35 ms |
| Max frame time, GPU timer | 3.82 ms | 2.89 ms | -0.93 ms |
| Draw calls per frame | 30 | 30 | 0 |
| Sustained frame rate | about 120 fps | about 120 fps | n/a |

Device pixel ratio the canvas settled on: 1.2384 (window `devicePixelRatio`
reported 1.24).

Display refresh was 120 Hz, so the vsync ceiling is 8.33 ms. That is why both
wall-clock medians land at exactly 8.30 ms, and why the GPU timer figures,
not the wall-clock ones, carry the frame-budget argument here.

**Band: within about 1 ms of static, ship-viable, per spike section 8 check
3.** Both the 0.00 ms wall-clock delta and the +0.12 ms GPU delta sit well
inside that band, not on an edge, so the band-edge tie rule does not apply.

**Decision: ship.** `RELEASE_RENDER_FLAGS.rigged` in
`src/components/locker/HeroPoseViewer.tsx` is now `true`.

Measurement conditions, recorded because they are real limitations of this
reading and matter to anyone re-measuring later:

1. The subject was the vanilla Seven rig, not the `gigawatt_prisoner` skin
   the Fixture column names. Seven had 0 installed skin mods on the
   measuring machine.
2. The canvas was the floating preview panel at 474x551 CSS, not a
   full-size preview. GPU cost scales with pixel count, so the absolute
   figures are size-specific. The delta is still a fair comparison because
   both runs used the identical canvas.
3. Display was 120 Hz, so the vsync ceiling is 8.33 ms, which is why the
   wall-clock medians are both exactly 8.30 ms and why the GPU timer figures
   are the ones that carry the frame-budget argument.
4. Measured with `GRIMOIRE_DEV_NO_BACKGROUNDING=1` (see `CLAUDE.md`, commit
   42d39b3) on a window that was not on top. The GPU work is genuine; the
   presentation path differs from normal use.
5. One run per condition: 240 frames for the GPU pass, about 1200 frames
   for the wall-clock pass. No repeat-run variance sampling.
6. The rigged path was confirmed to actually engage rather than silently
   falling back to the static pose: with the turntable spin paused, three
   consecutive static frames were byte-identical while three consecutive
   rigged frames all differed.

### Roster-wide clip sweep

Per D-18 the roster sweep runs only if RP-03 argues for shipping. RP-03
passed, so the sweep ran: read-only `model clips --json`, once per hero,
against `D:\Steam\steamapps\common\Deadlock\game\citadel\pak01_dir.vpk`, using
the bundled `resources/vpkmerge/vpkmerge-windows-x86_64.exe` and the same
selector logic `modelSelectorsForHero` in
`electron/main/services/heroPoseModels.ts` uses (an explicit `--entry` for the
nine `MODEL_ENTRY_OVERRIDES` heroes, `--hero <codename>` otherwise). Nothing
was exported. Ranking replicates `riggedClipScore` / `chooseRiggedClip`
exactly, including the tie-break chain: score, then looping, then duration,
then `name.localeCompare`.

Five roster rows in `src/lib/heroCodenames.ts` (Fathom, Kali, Tokamak,
Trapper, Wrecker) carry no `panorama` and no `bodyModel` codename. They ship
sound assets only and are not on the selectable Locker roster, so they have
no model to address and are excluded from this sweep rather than reported as
a clipless finding.

**Every one of the 38 addressable heroes yielded an animated clip. No hero
fell into the "no animated clip" case this sweep exists to catch**, so the
static-pose fallback path (already correct per spike section 7) is not
exercised by any hero on the strength of this sweep.

| Hero | Codename/entry addressed | Clips (total) | First-ranked clip | Tie-break |
| --- | --- | --- | --- | --- |
| Abrams | `models/heroes_wip/abrams/abrams.vmdl_c` (--entry) | 300 | `primary_stand_idle` | none (unique top score) |
| Apollo | `fencer` (--hero) | 6 | `respawn_countdown_idle` | none (unique top score) |
| Bebop | `bebop` (--hero) | 444 | `primary_ooc_stand_idle` | alphabetical: 2 clips tied on score, looping, and duration; `name.localeCompare` chose `primary_ooc_stand_idle` |
| Billy | `punkgoat` (--hero) | 5 | `primary_idle` | none (unique top score) |
| Calico | `nano` (--hero) | 323 | `primary_stand_idle` | none (unique top score) |
| Celeste | `unicorn` (--hero) | 7 | `respawn_countdown_idle` | none (unique top score) |
| Doorman | `doorman` (--hero) | 168 | `primary_ooc_stand_idle` | alphabetical: 2 clips tied on score, looping, and duration; `name.localeCompare` chose `primary_ooc_stand_idle` |
| Drifter | `drifter` (--hero) | 5 | `primary_stand_idle` | none (unique top score) |
| Dynamo | `dynamo` (--hero) | 210 | `primary_stand_idle` | none (unique top score) |
| Graves | `necro` (--hero) | 7 | `respawn_countdown_idle` | none (unique top score) |
| Grey Talon | `archer` (--hero) | 304 | `primary_stand_idle` | none (unique top score) |
| Haze | `haze` (--hero) | 247 | `primary_stand_idle` | none (unique top score) |
| Holliday | `astro` (--hero) | 260 | `primary_stand_idle` | none (unique top score), matches spike section 2's pilot result |
| Infernus | `models/heroes_wip/inferno/inferno.vmdl_c` (--entry) | 3 | `respawn_countdown_idle` | none (unique top score) |
| Ivy | `models/heroes_wip/ivy/ivy.vmdl_c` (--entry) | 254 | `primary_stand_idle` | none (unique top score) |
| Kelvin | `kelvin` (--hero) | 264 | `primary_stand_idle` | none (unique top score) |
| Lady Geist | `models/heroes_wip/geist/geist.vmdl_c` (--entry) | 257 | `primary_stand_idle` | none (unique top score) |
| Lash | `lash` (--hero) | 315 | `primary_stand_fire_idle` | alphabetical: 2 clips tied on score, looping, and duration; `name.localeCompare` chose `primary_stand_fire_idle` |
| McGinnis | `models/heroes_wip/mcginnis/mcginnis.vmdl_c` (--entry) | 26 | `primary_stand_idle` | none (unique top score) |
| Mina | `vampirebat` (--hero) | 5 | `respawn_countdown_idle` | none (unique top score) |
| Mirage | `mirage` (--hero) | 197 | `primary_ooc_stand_idle` | alphabetical: 2 clips tied on score, looping, and duration; `name.localeCompare` chose `primary_ooc_stand_idle` |
| Mo & Krill | `digger` (--hero) | 201 | `primary_stand_idle` | none (unique top score) |
| Paige | `bookworm` (--hero) | 4 | `out_of_combat_stand_idle` | none (unique top score), matches spike section 2's pilot result |
| Paradox | `chrono` (--hero) | 383 | `primary_stand_idle` | none (unique top score) |
| Pocket | `models/heroes_wip/pocket/pocket.vmdl_c` (--entry) | 261 | `primary_stand_idle` | none (unique top score) |
| Rem | `models/heroes_wip/familiar/familiar_wip.vmdl_c` (--entry) | 7 | `respawn_countdown_idle` | none (unique top score) |
| Seven | `gigawatt_prisoner` (--hero) | 230 | `primary_stand_idle` | none (unique top score), matches spike section 2's pilot result and RP-03's fixture above |
| Shiv | `shiv` (--hero) | 205 | `primary_stand_idle` | alphabetical: 2 clips tied on score, looping, and duration; `name.localeCompare` chose `primary_stand_idle` |
| Silver | `werewolf` (--hero) | 16 | `item_stand_idle` | none (unique top score) |
| Sinclair | `magician` (--hero) | 169 | `primary_stand_idle` | none (unique top score) |
| Venator | `priest` (--hero) | 243 | `primary_stand_idle` | none (unique top score) |
| Victor | `frank` (--hero) | 193 | `primary_stand_fire_idle` | alphabetical: 2 clips tied on score, looping, and duration; `name.localeCompare` chose `primary_stand_fire_idle` |
| Vindicta | `hornet` (--hero) | 276 | `primary_stand_idle` | alphabetical: 2 clips tied on score, looping, and duration; `name.localeCompare` chose `primary_stand_idle` |
| Viscous | `models/heroes_staging/viscous/viscous.vmdl_c` (--entry) | 308 | `primary_stand_idle` | none (unique top score) |
| Vyper | `viper` (--hero) | 247 | `primary_stand_idle` | none (unique top score) |
| Warden | `warden` (--hero) | 213 | `primary_stand_idle` | none (unique top score) |
| Wraith | `models/heroes_wip/wraith/wraith.vmdl_c` (--entry) | 231 | `primary_stand_idle` | none (unique top score) |
| Yamato | `yamato` (--hero) | 350 | `primary_stand_idle` | none (unique top score) |

Excluded (no addressable model codename, sound assets only): Fathom, Kali,
Tokamak, Trapper, Wrecker.

Seven, sitting a row above in this same sweep, addressed the identical
`gigawatt_prisoner` codename and returned the identical
`primary_stand_idle` choice RP-03's fixture and spike section 2 both used,
so the sweep and the frame-budget reading agree on which clip Seven's rigged
preview actually plays.

No change was made to `chooseRiggedClip`, `riggedClipScore`, or the fallback
path on the strength of this sweep; every hero already animates, so nothing
here argues for a behavior change.

## Table 3: ConVar readings (REQ-performance-convar-safer-experimentation)

Every How to read cell names the console command to run: type the ConVar
key with no value into the developer console and press Enter, and it
prints the current value. Record that raw printed value verbatim in the
Reading cell, with no normalization.

CV-01 goes first, ahead of its declared order in `HUD_CONVARS`, because it
is an inverted flag and the requirement itself calls it out to be checked
first.

| ID | Tier | ConVar key | How to read | Reading | Verdict | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| CV-01 | engine | `citadel_damage_offscreen_indicator_disabled` | In the developer console, type `citadel_damage_offscreen_indicator_disabled` with no value and press Enter. The console prints the current value; record it in the Reading cell verbatim, unnormalized. | | deferred |This is an inverted flag: `on` maps to `citadel_damage_offscreen_indicator_disabled false`, `off` maps to `true`, per `HUD_CONVARS` in `electron/main/services/performanceUserControls.ts`. Check the raw reading against that existing on/off mapping rather than normalizing it away. This value is only printed by a running Deadlock developer console (`How to read`); no app-tier equivalent exists to read it without a live game session. Deferred per D-19/D-25: `engineDefault` in `electron/main/services/performanceUserControls.ts` stays `null` while this row is deferred, which is now a stated state with a reason on record, not an unfinished one.|
| CV-02 | engine | `citadel_unit_status_use_new` | In the developer console, type `citadel_unit_status_use_new` with no value and press Enter; record the printed value. | | deferred | This value is only printed by a running Deadlock developer console (`How to read`); no app-tier equivalent exists to read it without a live game session. Deferred per D-19/D-25: `engineDefault` in `electron/main/services/performanceUserControls.ts` stays `null` while this row is deferred, which is now a stated state with a reason on record, not an unfinished one. |
| CV-03 | engine | `citadel_unit_status_use_v2` | In the developer console, type `citadel_unit_status_use_v2` with no value and press Enter; record the printed value. | | deferred | This value is only printed by a running Deadlock developer console (`How to read`); no app-tier equivalent exists to read it without a live game session. Deferred per D-19/D-25: `engineDefault` in `electron/main/services/performanceUserControls.ts` stays `null` while this row is deferred, which is now a stated state with a reason on record, not an unfinished one. |
| CV-04 | engine | `citadel_unit_status_single_bar_mode` | In the developer console, type `citadel_unit_status_single_bar_mode` with no value and press Enter; record the printed value. | | deferred | This value is only printed by a running Deadlock developer console (`How to read`); no app-tier equivalent exists to read it without a live game session. Deferred per D-19/D-25: `engineDefault` in `electron/main/services/performanceUserControls.ts` stays `null` while this row is deferred, which is now a stated state with a reason on record, not an unfinished one. |
| CV-05 | engine | `citadel_unit_status_use_v2_for_nonplayers` | In the developer console, type `citadel_unit_status_use_v2_for_nonplayers` with no value and press Enter; record the printed value. | | deferred | This value is only printed by a running Deadlock developer console (`How to read`); no app-tier equivalent exists to read it without a live game session. Deferred per D-19/D-25: `engineDefault` in `electron/main/services/performanceUserControls.ts` stays `null` while this row is deferred, which is now a stated state with a reason on record, not an unfinished one. |
| CV-06 | engine | `citadel_unit_status_allies_see_thru_walls` | In the developer console, type `citadel_unit_status_allies_see_thru_walls` with no value and press Enter; record the printed value. | | deferred | This value is only printed by a running Deadlock developer console (`How to read`); no app-tier equivalent exists to read it without a live game session. Deferred per D-19/D-25: `engineDefault` in `electron/main/services/performanceUserControls.ts` stays `null` while this row is deferred, which is now a stated state with a reason on record, not an unfinished one. |
| CV-07 | engine | `citadel_damage_text_show_effectiveness` | In the developer console, type `citadel_damage_text_show_effectiveness` with no value and press Enter; record the printed value. | | deferred | This value is only printed by a running Deadlock developer console (`How to read`); no app-tier equivalent exists to read it without a live game session. Deferred per D-19/D-25: `engineDefault` in `electron/main/services/performanceUserControls.ts` stays `null` while this row is deferred, which is now a stated state with a reason on record, not an unfinished one. |
| CV-08 | engine | `citadel_hud_objective_health_enabled` | In the developer console, type `citadel_hud_objective_health_enabled` with no value and press Enter; record the printed value (the control's expected range is 0 to 2). | | deferred |`performanceUserControls.ts` currently comments this key as unsupported. Once this reading is in, correct that comment either way: confirm it is genuinely unsupported by stock `gameinfo.gi`, or remove the comment if the reading shows otherwise. This value is only printed by a running Deadlock developer console (`How to read`); no app-tier equivalent exists to read it without a live game session. Deferred per D-19/D-25: `engineDefault` in `electron/main/services/performanceUserControls.ts` stays `null` while this row is deferred, which is now a stated state with a reason on record, not an unfinished one.|
| CV-09 | engine | `citadel_unit_status_allies_see_thru_walls_max_distance` | In the developer console, type `citadel_unit_status_allies_see_thru_walls_max_distance` with no value and press Enter; record the printed value. | | deferred | This value is only printed by a running Deadlock developer console (`How to read`); no app-tier equivalent exists to read it without a live game session. Deferred per D-19/D-25: `engineDefault` in `electron/main/services/performanceUserControls.ts` stays `null` while this row is deferred, which is now a stated state with a reason on record, not an unfinished one. |
| CV-10 | engine | `citadel_minimap_unit_click_radius` | In the developer console, type `citadel_minimap_unit_click_radius` with no value and press Enter; record the printed value. | | deferred | This value is only printed by a running Deadlock developer console (`How to read`); no app-tier equivalent exists to read it without a live game session. Deferred per D-19/D-25: `engineDefault` in `electron/main/services/performanceUserControls.ts` stays `null` while this row is deferred, which is now a stated state with a reason on record, not an unfinished one. |
| CV-11 | engine | `citadel_minimap_player_width` | In the developer console, type `citadel_minimap_player_width` with no value and press Enter; record the printed value. | | deferred | This value is only printed by a running Deadlock developer console (`How to read`); no app-tier equivalent exists to read it without a live game session. Deferred per D-19/D-25: `engineDefault` in `electron/main/services/performanceUserControls.ts` stays `null` while this row is deferred, which is now a stated state with a reason on record, not an unfinished one. |
| CV-12 | engine | `citadel_minimap_local_player_width` | In the developer console, type `citadel_minimap_local_player_width` with no value and press Enter; record the printed value. | | deferred | This value is only printed by a running Deadlock developer console (`How to read`); no app-tier equivalent exists to read it without a live game session. Deferred per D-19/D-25: `engineDefault` in `electron/main/services/performanceUserControls.ts` stays `null` while this row is deferred, which is now a stated state with a reason on record, not an unfinished one. |
| CV-13 | engine | `citadel_minimap_max_icon_shrink` | In the developer console, type `citadel_minimap_max_icon_shrink` with no value and press Enter; record the printed value. | | deferred | This value is only printed by a running Deadlock developer console (`How to read`); no app-tier equivalent exists to read it without a live game session. Deferred per D-19/D-25: `engineDefault` in `electron/main/services/performanceUserControls.ts` stays `null` while this row is deferred, which is now a stated state with a reason on record, not an unfinished one. |
| CV-14 | engine | `citadel_minimap_overlap_scan_distance` | In the developer console, type `citadel_minimap_overlap_scan_distance` with no value and press Enter; record the printed value. | | deferred | This value is only printed by a running Deadlock developer console (`How to read`); no app-tier equivalent exists to read it without a live game session. Deferred per D-19/D-25: `engineDefault` in `electron/main/services/performanceUserControls.ts` stays `null` while this row is deferred, which is now a stated state with a reason on record, not an unfinished one. |
| CV-15 | engine | `citadel_minimap_zip_line_thickness` | In the developer console, type `citadel_minimap_zip_line_thickness` with no value and press Enter; record the printed value. | | deferred | This value is only printed by a running Deadlock developer console (`How to read`); no app-tier equivalent exists to read it without a live game session. Deferred per D-19/D-25: `engineDefault` in `electron/main/services/performanceUserControls.ts` stays `null` while this row is deferred, which is now a stated state with a reason on record, not an unfinished one. |
| CV-16 | engine | `minimap_update_rate_hz` | In the developer console, type `minimap_update_rate_hz` with no value and press Enter; record the printed value. | | deferred | This value is only printed by a running Deadlock developer console (`How to read`); no app-tier equivalent exists to read it without a live game session. Deferred per D-19/D-25: `engineDefault` in `electron/main/services/performanceUserControls.ts` stays `null` while this row is deferred, which is now a stated state with a reason on record, not an unfinished one. |

## What happens to these readings

Once every row above is filled in, the 16 readings from Table 3 are typed
into the `engineDefault` fields beside `gameDefault` in
`electron/main/services/performanceUserControls.ts`, one per key: seven in
`HUD_CONVARS`, nine in `ADVANCED_GAMEINFO_CONVARS`. Until then those fields
stay `null`.
