# Feature status

Status snapshot: 2026-07-28, re-verified against the working tree at v1.25.171
by the audit in [spec-audit-prompt.md](./spec-audit-prompt.md), then updated on
2026-07-28 for wave 1 (Foundry source actions and merge review), wave 2
(combined Foundry output, performance ConVar provenance), and wave 3 (rigged
preview measurement, social phase 1.5). This is an
implementation inventory, not a substitute for the manual in-game validation
required before a release.

## Shipped, but still experimental

- **Chat Wheel YAML workflow.** ChatLane VPKs can be opened, edited as YAML,
  validated, and installed as managed add-ons. Enable it in Settings >
  Experimental > Chat Wheel.
- **Foundry Sound Workbench.** Hero, voice, and global sounds can be browsed
  and auditioned. It supports annotations with searchable personal labels,
  notes, and tags; write-set conflict inspection; managed-change replacement or
  conflict disablement; selected-clip and seeded-library pool modes; and a
  `My sound changes` view backed by the normal mod state.
- **Foundry texture and item replacement.** The supported catalog cards accept
  a PNG drop/pick, run an exact-path preflight, and stage the replacement in the
  build tray. Nothing is installed until the user forges
  (`components/foundry/LibraryBrowse.tsx:57`).
- **Combined Foundry output.** Staged sound and visual edits are reviewed as one
  write set with collision winners, then built into a single named VPK that the
  user saves through a native dialog (`services/foundryForge.ts:45`,
  `ipc/foundry.ts:104`, `components/foundry/FoundryBuildTray.tsx:48`). It is
  deliberately export-only: build parts never enter Installed, and a cancelled
  save leaves both the mod library and the staged edits untouched. As of wave 2
  the tray is shared by both Foundry modes, so an edit staged in the hero-first
  `HeroWorkshop` is reviewable and forgeable rather than stranded; `TextureBrowse`
  stages through the same path as `LibraryBrowse`; the confirmation is in-app and
  shows the full exact write set; and a missing recorded source file (audio or
  PNG) blocks the forge by name instead of failing partway through the build.
- **Discover mod availability and owner view stats.** Discover cards and the
  owner's published rows carry an "N of M mods available" badge fed by a weekly
  GameBanana revalidation cron in the companion Worker; a profile that has never
  been revalidated reads as unknown rather than as healthy. The detail rail adds
  a separate local "mods you do not have" badge (upstream availability and local
  install state are different questions and are kept visually distinct), plus an
  owner-only view count. Offline and service-busy are now distinct states with
  their own retry, split out from the generic error banner
  (`components/social/availability.ts`, `socialErrors.ts`, `Discover.tsx`).
  Requires migration 0005 applied and the Worker deployed: see below.
- **Rigged hero preview (dev-only, measured not shipped).** The no-`--pose`
  rigged export, its clip ranking, and the viewer fallback all exist and are
  measured in [rigged-preview-spike.md](./rigged-preview-spike.md). It is dark in
  every shipped build and is not user-reachable. Do not describe it as a feature.
- **Per-ConVar provenance in the performance card.** Every user-facing HUD and
  advanced ConVar carries a main-process-computed state (game default, managed
  preset, user override, unsupported) plus an out-of-range flag, badged per
  control (`services/performanceConfig.ts`, `components/performance/
  PerformanceConfigCard.tsx`). A per-control reset removes Grimoire's line for
  that key rather than writing an app-chosen number, an out-of-range stored value
  requires explicit confirmation instead of a silent clamp, and edits stage into
  a pending panel with apply and discard rather than auto-committing.
- **Non-MP3 sound input.** WAV, OGG, FLAC, M4A, AAC, and Opus are transcoded
  locally to MP3 by the bundled FFmpeg before the mint path runs
  (`services/audioConversion.ts:38`, `services/foundryCatalog.ts:257`).
- **Read-only merge analysis, now surfaced.** The main process exposes source
  order, parsed entries, collisions, winners, and unreadable-VPK warnings
  without mutating mods, and the renderer shows them before a merge is
  confirmed (`components/MergeReviewPanel.tsx`). The new composition workflow
  can reorder sources winner-first and carries that order through
  `merge-mods` as `sourceOrder`; the legacy merge path sends no order and is
  unchanged. Add-sources shows the same review read-only.
- **Actionable Foundry asset sources.** The sources panel auditions what an
  installed VPK actually writes (extracted from that VPK, not the game paks),
  opens the owner in Installed, toggles enablement through the normal mod
  store, adds or removes a shuffle-pool target, and hands the row back control
  to mint a replacement (`components/foundry/AssetSourcesPanel.tsx`). An
  unreadable VPK blocks every action that depends on knowing the true owner.
  `My sound changes` resolves which recorded clip path it actually loses and to
  whom, jumps to that winner, edits the shared annotation, and re-forges from
  the recorded assignments, refusing to start when a recorded audio file has
  moved (`components/foundry/MySoundChanges.tsx`).

## Confirmed gaps

1. **Combined output covers sound and texture only.** `FoundryForgeEdit`
   (`src/types/foundry.ts:320`) admits `sound` and `texture`; recolor and model
   edits have no staged-edit serializer and cannot enter a combined build.
1b. **Social phase 1.5 is unrunnable until the Worker ships.** Migration 0005
   has not been applied anywhere and the profile routes select its columns, so
   they fail against a pre-migration DB. The revalidation cron has never run:
   its GameBanana probe shape is unverified against a real deleted or archived
   submission, and the `ViewCounterDO` `v2` migration entry is deploy-time
   behaviour that was never exercised. Nothing here is verified end to end.
1c. **No fps measurement exists for the rigged preview.** The flag is no longer
   welded to cloth (fixed 2026-07-28: rigged has its own dev switch, so the
   animated path can be measured without the WIP cloth sim riding along), but
   nobody has taken the reading yet. Until someone measures Seven
   (`gigawatt_prisoner`, the worst case on every axis) per section 8 of
   [rigged-preview-spike.md](./rigged-preview-spike.md), the release flag stays
   false and the static posed preview remains the default.
1d. **The updater never cleans up after itself.** `services/updater.ts` has no
   pruning path: electron-updater's download cache keeps old installers and
   stale partial downloads, and nothing removes them. Banked in Phase 8.5 of
   [remaining-work-phases.md](./remaining-work-phases.md).
1a. **Performance ConVar game defaults are unverified against the game.** The
   eight advanced defaults were moved out of the renderer constant that held
   them, not read off a running build, so a wrong number badges an untagged
   stock line as "Your override". All eight HUD toggles carry a null game
   default, so an unset toggle is badged honestly but cannot preview what the
   game will do. Both are data-only fixes once someone reads the console.
2. **Asset source actions are unverified in game.** The panel and
   `My sound changes` now carry the full action set, but no in-game check has
   confirmed that an audition of an installed VPK's clip matches what the
   engine plays, or that a re-forged swap sounds identical to the original.
3. **Foundry models and broad asset browsing.** There is no usable Foundry
   model-export/viewer entry point. Thumbnail browsing is intentionally limited
   to ability icons, item icons, and hero images; model, VFX, and other large
   categories remain deferred.
4. **Advanced merge composition.** The review and reviewed source order have
   landed. Merge recipes, editable include/exclude path policy, merge-content
   presets, and rebuild diffs are still absent, and a reviewed order cannot be
   applied to a selection containing a merged mod (flattening contributes
   leaves the review never showed, so the merger rejects it).
5. **High-fidelity animated 3D previews.** Material/lighting parity, NPR, and
   cloth have landed, and a rigged (no-`--pose`) export path exists
   (`services/heroPoseModels.ts:972`). Animation retarget and in-preview ability
   VFX remain unbuilt.

## History and branch safety

- No local branch is ahead of `main` with unmerged feature commits, and the
  recent reflog shows the Foundry sound-workbench work landed before v1.25.169.
- `codex/chat-wheel-tab` is not a feature branch to merge: compared with
  `main`, it removes Chat Wheel and many other fork features. Treat it as an
  old/reductive experiment, not recovery material.

## Release follow-up

The forked `vpkmerge` sidecar workflow shipped in the published
`v1.25.170` release.

**The packaged Windows smoke record no longer blocks a release** (decided
2026-07-28). It is tracked as post-release verification, not as a gate. The
factual position is unchanged and should not be overstated in user-facing copy:
no packaged build has been exercised against the game for this line of work, and
the combined Foundry forge in particular has never been run end to end by a
human. Run the checklist in section 1 below when a build and the game are both
in front of you, and fix forward if it finds something.

## Next-version implementation plan

### Delivery contract and sequencing

This roadmap is intentionally split into independently releasable slices. A
slice is complete only when its data contract, UI, error/rollback behaviour,
and automated checks land together; a visible control is not a substitute for
the corresponding exact-path inspection or preflight.

| Slice | Depends on | Deliverable | Exit gate |
| --- | --- | --- | --- |
| Release integrity | pinned sidecar workflow | a newly versioned packaged build using the forked engine | Windows smoke test and reported engine version |
| Chat Wheel Editor v1 | ChatLane converter | understandable creation flow, editable YAML with immediate converter feedback, and non-destructive preview | reset/validation/round-trip tests; manual conversion smoke |
| Asset sources foundation | mod store + read-only merge analysis | normalized-path owner query with enabled/disabled contenders, provenance, uncertainty, and winner | fixture tests for ordering, third-party and unreadable VPKs |
| Sound sources and pools | asset sources foundation | event-row source inspection, safe actions, assignment preview and persisted seed | discovery, seed, cancel and rollback tests |
| Visual replacement preflight | asset sources foundation | source panel and explicit preflight on existing visual cards | portrait-family and single-icon path fixtures |
| Combined Foundry output | staged-edit serializers for every supported kind | one confirmed named VPK with the reviewed write set | collision, cancellation and installed-state regression tests (landed wave 2; a live forge and a real save-dialog cancel are still unrun) |
| Models, VFX and advanced composition | trustworthy catalog paths + composition design | only bounded, inspectable extensions of the source/preflight model | performance and correctness budgets agreed before UI exposure |

**Non-negotiable invariants.** Exact normalized VPK paths are the ownership
key; labels, hero names, and mod metadata are never used as a substitute.
Installed/Locker remains the only enabled-state authority. A Foundry action may
open, request, or display a mod-store change, but may not silently change load
order or overwrite a third-party VPK. A failed or unreadable inspection blocks
ambiguous forge operations and leaves all installed mods unchanged. New IPC
responses must be serializable and have renderer-side empty/error states.

**Implementation order.** Implement and verify the first five slices before
attempting combined output. Keep the experimental Chat Wheel gate until its
validation and usability gates pass. Do not start models, arbitrary global
shuffle, format conversion, merge recipes, or broad thumbnail classes merely
because adjacent UI exists; each remains separately gated by the requirements
below.

### Parallel execution board

The work below is runnable in parallel when each lane changes only its stated
contract. An integration owner lands shared type/preload/IPC additions first
or resolves the small additive conflicts before merging; no lane may change the
mod-store enabled-state rules or VPK priority semantics.

| Lane | Can start now | Owns | Consumes / must wait for | Completion handoff |
| --- | --- | --- | --- | --- |
| A — release integrity | yes | workflow, sidecar packaging, version and smoke checklist | none | exact packaged build version, sidecar version, Windows smoke record |
| B — Chat Wheel | yes | page, ChatLane IPC/service, Chat Wheel tests | converter fixture | validated YAML contract; no parser/model changes without a round-trip fixture |
| C — source foundation | yes | normalized path inspector, ownership types, VPK-directory fixtures | mod scan + directory parser | serializable `AssetSourcesInspection`; lower priority is the winner |
| D — visual sources | after C contract is stable | shared source panel and portrait/icon/texture callers | C only | path-family mapping tests and no write-side effects |
| E — sound sources/pools | after C contract is stable; existing sound inspector may bridge the gap | sound-row panel, pool assignment/seed metadata, My sound changes | C for the generic panel; sound swap contract | exact compiled clip/event paths and cancellation/rollback tests |
| F — combined output | after D and E have staged-edit serializers | tray forge IPC and final named-VPK confirmation | D + E + collision model | atomic build/cancel behaviour, final write set, collision winners |
| G — models/VFX/composition | blocked until trustworthy path catalog and F are complete | viewer/export, bounded browsing, merge-review extensions | F plus performance budget | explicit supported-path list, cache budget, manual fidelity sign-off |

**Suggested batches.** Run A, B, and C together. Once C's IPC/type contract
is merged, run D and E together. Run F only after both report their supported
write-set serializers; G remains intentionally blocked. Every batch finishes
with focused tests in its lane, then integration runs the repository gate.
When a lane needs a new shared field, it must add it additively and provide a
fixture before another lane consumes it. This prevents parallel UI work from
guessing source ownership or priority rules.

### Current implementation update

The automated portions of A-C are complete: the release workflow is published,
Chat Wheel has form authoring, Advanced YAML, and a live radial preview, and
`AssetSourcesInspection` has
fixture coverage for normalized ownership, priority winners, third-party
entries, and unreadable VPKs. The Windows smoke record is still outstanding.

D and E are **partial**. Visual cards and sound rows can inspect exact source
paths; visual replacement preflight blocks unreadable VPKs and asks before an
enabled conflict creates a separate managed replacement. Portrait-family path
grouping and compiled sound clip/event inspection are covered by unit tests.
The shared panel is inspect-only: it does not yet provide the planned audition,
open-in-Installed, or normal-mod-store enable/disable actions. `My sound
changes` currently supports normal-state enable/disable, rename, and delete,
but not annotation access, jump-to-conflict, or re-forge.

F has **landed**. Both live authoring flows stage into one reviewed write set
(`SoundBrowse.tsx:1034`, `LibraryBrowse.tsx:66`), the tray shows the write set
and collision winners before an explicit confirm
(`FoundryBuildTray.tsx:48`-`:79`), and `foundryForge.ts` builds each part in an
isolated temp directory, merges once, re-derives the review server-side, and
rejects a stale confirmation (`services/foundryForge.ts:50`) or a built VPK
whose entries do not match the confirmed write set (`:73`). The build is
export-only by design.

On 2026-07-28 the staged sound path gained the exact-path preflight it was
missing (`SoundBrowse.tsx:1043`): an uninspectable VPK now blocks staging with
an explanation, and an enabled owner requires an explicit acknowledgement,
mirroring `LibraryBrowse.tsx:57` without offering the install path's
disable/replace resolutions, which would mutate enabled state at staging time.
One exit-gate item remains open: there is no installed-state regression test for
cancellation. Models, VFX, and advanced composition (G) remain blocked.

**Repository verification gate.** Each implementation batch must run the
relevant Vitest files, then `pnpm typecheck`, `pnpm lint`, and the full
`pnpm test` suite. Release integrity additionally requires the packaged Windows
smoke listed below. Any test that invokes a converter or VPK parser must use a
fixture/fake in unit tests and retain one manual packaged smoke test.

### 1. v1.25.170 — engine hotfix and release integrity

1. Commit the release-workflow change that builds the pinned forked
   `vpkmerge` sidecar.
2. Run a packaged Windows smoke test: open Global sounds, confirm
   `catalog globalsounds` works, replace a normal and YCoCg icon, and inspect
   the engine version in Settings.
3. Publish a new version; never replace the v1.25.169 assets.

### 2. Foundry sources, existing mods, and randomization

**What exists now**

- In the hero workshop, `HeroSoundPicker` already shows compatible installed
  hero sound mods—including downloaded and forged mods—before the base-game
  sound browser. Launcher sound shuffling also exists in Locker for eligible
  hero sound mods.
- Before a new sound forge, Foundry scans enabled and disabled VPKs by exact
  write path, including third-party mods. It can disable conflicts or replace a
  managed Foundry change.
- Per-event randomizer-pool authoring already supports replace-all, selected
  targets, N-to-N mapping, and seeded user-library assignments.

**Still missing, and planned for the next feature version**

1. Add a per-sound-row **Existing sources** panel to Foundry. For the exact
   event and compiled clip(s) shown on that row (for example
   `charged_melee_full.vsnd_c`), it must show the current winner and every
   installed or disabled VPK that writes one of those paths. Include
   provenance (`Downloaded`, `Imported`, `Forged`, `Third-party`), write paths,
   priority, and expected load-order winner. Hero-wide `HeroSoundPicker`
   results are supplementary only; both hero and global rows must discover
   third-party sources by VPK entry-path inspection rather than metadata guesses.
2. Provide explicit source actions: audition, enable/disable through the normal
   mod store, open in Installed, add/remove from a launch shuffle pool, and
   create a replacement from that source. Never silently change precedence or
   overwrite a third-party VPK.
3. Surface the existing **hero sound launch-shuffle** controls in Foundry with a
   link back to Locker. Add global-sound shuffle only after defining a safe,
   event-level persisted pool; do not randomize arbitrary installed VPKs.
4. Complete the pool editor: show the exact target-to-audio assignment before
   Forge, persist/display its seed in the forged-mod metadata, and add a
   `Shuffle now` preview. Correct the audio picker so it either accepts only
   MP3 or transparently converts the other advertised formats.
5. Expand `My sound changes` with event-level active-winner context, jump to
   the source/conflict row, annotation access, and re-forge from recorded
   assignments. Keep Installed/Locker as the sole authority for enabled state.
6. Verify hero, voice, and global cases against a downloaded third-party sound
   mod, a forged mod, a disabled mod, and a multi-clip pool. Add regression
   tests for source discovery, winner ordering, seed persistence, cancellation,
   and rollback.

### 3a. Asset-level existing-source inspection across Foundry

Apply the same model to every Foundry catalog target, not only sounds. A player
viewing a portrait, ability icon, item icon, texture, VFX asset, or future model
must be able to answer: **what is currently winning for this exact game path,
what else overrides it, and what happens if I make a new replacement?**

1. Add a shared `Asset sources` panel keyed by exact normalized VPK entry path
   (or an explicit set of paths for one logical asset). Show enabled and
   disabled owners, priority, provenance, affected paths, expected winner, and
   unreadable-VPK uncertainty. Never infer ownership from a display label or
   hero name alone.
2. Start with existing visual catalog cards: hero portraits/cards, ability
   icons, item icons, and replaceable textures. A portrait family must inspect
   every relevant variant together (normal, low-HP, gloat, minimap, and other
   discovered variants), while still showing which individual variant has an
   override.
3. Reuse the panel for sounds by passing the row's event clip paths, then extend
   it to VFX and models only when their catalog/export paths are precise enough
   to compute a trustworthy write set.
4. Provide consistent safe actions: preview the current source where possible;
   open the owner in Installed; enable/disable through the normal mod store;
   inspect conflicts; and create a new replacement. Do not provide a direct
   overwrite action for third-party VPKs.
5. Before forging any texture, portrait, icon, sound, VFX, or model replacement,
   run the same exact-path preflight and require an explicit conflict resolution.
   If a mod cannot be inspected, block the destructive/ambiguous action and
   explain why.
6. Test multi-variant portrait ownership, one-path icon ownership, disabled and
   enabled contenders, priority winner calculation, untracked third-party
   VPKs, and unreadable VPK handling.

### 4. Foundry composition and asset follow-through

1. Wire actual forge flows into the existing build tray and build one named VPK
   only after the user confirms its selected write set and collision winners.
2. Add the first usable model-export/viewer slice, then broaden catalog
   thumbnailing with bounded caching and explicit performance limits.
3. Decide whether to bundle audio conversion. If approved, add conversion,
   licensing notices, size-budget review, and per-format tests; otherwise make
   the UI MP3-only.
4. Add merge-review UI over the existing read-only analysis before attempting
   recipes or path-policy composition.
