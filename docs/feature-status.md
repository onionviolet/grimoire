# Feature status

Status snapshot: 2026-07-28, based on `main` at v1.25.169. This is an
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
  a PNG drop/pick and create a tracked local mod.
- **Read-only merge analysis.** The main process exposes source order, parsed
  entries, collisions, winners, and unreadable-VPK warnings without mutating
  mods.

## Confirmed gaps

1. **Chat Wheel visual editor.** There is no radial preview, slot form editor,
   typed/lossless YAML model, inline YAML validation, or direct manipulation.
   `Start a new wheel` can appear to do nothing because the same starter YAML
   is already loaded; creation happens only on Save & install. See
   [chat-wheel.md](./chat-wheel.md).
2. **Combined Foundry output.** The build tray reviews staged edits, collision
   winners, and the final write set, but it does not yet bake selected sound,
   texture, recolor, and model edits into one VPK.
3. **Foundry models and broad asset browsing.** There is no usable Foundry
   model-export/viewer entry point. Thumbnail browsing is intentionally limited
   to ability icons, item icons, and hero images; model, VFX, and other large
   categories remain deferred.
4. **Non-MP3 Sound Forge input.** Sound swaps require MP3. A decoder/transcoder
   has not been bundled for WAV, OGG, FLAC, or M4A input.
5. **Advanced merge composition.** Read-only analysis is present, but merge
   recipes, editable include/exclude path policy, merge-content presets, and
   rebuild diffs are not.
6. **Locker cosmetics consolidation.** The proposed single managed VPK for
   applied hero cards/cosmetics is design-only; current picker and launch-shuffle
   behaviour remains separate.
7. **High-fidelity animated 3D previews.** Static/posed previews work where
   assets permit, but rigged animation playback remains intentionally gated
   off pending fidelity work.

## History and branch safety

- No local branch is ahead of `main` with unmerged feature commits, and the
  recent reflog shows the Foundry sound-workbench work landed before v1.25.169.
- `codex/chat-wheel-tab` is not a feature branch to merge: compared with
  `main`, it removes Chat Wheel and many other fork features. Treat it as an
  old/reductive experiment, not recovery material.

## Release follow-up

The release workflow now needs to be committed with the forked `vpkmerge`
sidecar build step. Cut a new version rather than replacing v1.25.169, because
that published build contains the upstream engine that lacks
`catalog globalsounds`.

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
| Combined Foundry output | staged-edit serializers for every supported kind | one confirmed named VPK with the reviewed write set | collision, cancellation and installed-state regression tests |
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

The first parallel batch (A-C) and the D/E source-panel batch are implemented
in this worktree. The shared `AssetSourcesInspection` contract now drives
visual-card and sound-row inspection, including exact compiled sound clips and
event containers, portrait-path families, priority winners, and unreadable
VPK blocking. Visual and sound changes each now have a supported staged-edit
serializer, so the dependency gate for F is met.

Combined Foundry output (F) has **not** started: it still needs its explicit
named-VPK confirmation and atomic build/cancel implementation. Models, VFX,
and advanced composition (G) remain blocked. The remaining release work for
this batch is the packaged Windows smoke record described below.

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

### 2. Chat Wheel Editor v1 — make the existing feature understandable

1. Replace `Start a new wheel` with `Create new wheel`, including an unsaved
   changes confirmation and an explicit statement that installation occurs only
   on Save & install.
2. Parse the supported ChatLane YAML into a typed editor model while retaining
   unknown fields and comments on round-trip.
3. Add a non-destructive live radial preview: menu navigation, icons, labels,
   command summaries, and invalid/empty-slot indicators. Clicking a preview
   slot focuses the matching editor control.
4. Add a form editor for wheel settings, menus, slots, and commands, with
   synchronized Advanced YAML and converter-backed inline validation.
5. Test reset confirmation, lossless round-trip, preview layout/navigation,
   and converter failures before removing the experimental gate.

### 3. Foundry sources, existing mods, and randomization

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
