# Remaining work, phased

Written 2026-07-28 against `main` at v1.25.170; reconciled the same day against
the working tree at v1.25.171 by a full run of
[spec-audit-prompt.md](./spec-audit-prompt.md) (sections A-J). Every `[doc]` tag
below has been promoted or deleted. Companion to
[feature-status.md](./feature-status.md), which inventories the Foundry slices.
This document covers **everything the docs promise that is not shipped**, across
every doc, sequenced into phases with dependencies and exit gates.

## Evidence discipline (read first)

Doc status headers in this repo have drifted badly behind the code. Three
examples found on 2026-07-28: `locker-hero-card-apply.md` said "design (not yet
built)" for a pipeline that ships end to end; `ability-vfx-recolor.md` said the
Locker UI was unbuilt and the engine was a local dev binary, when
`HeroColorPicker.tsx` ships and the engine is a pinned `v0.19.0` release; a
Foundry gap read as missing because the feature lives in a shared component
rather than the file grepped.

So each item below is tagged:

- **[verified]** — the gap was confirmed by reading the code on 2026-07-28.

The `[doc]` tag (gap asserted by a design doc, not re-verified) is retired: the
audit resolved every one of them. Reintroduce it only for a newly written doc.

## Phase 0 — Truth pass **[done 2026-07-28]**

The spec audit ran across sections A-J. Corrected headers landed in
`feature-status.md`, `ability-vfx-recolor.md`, `3d-preview-fidelity-plan.md`,
and `locker-hero-card-apply.md`. Four claims were wrong in the code's favour
(combined output, audio transcoding, VFX roster, the rigged 3D spine) and one
was wrong in the doc's favour (the Locker missing-source warning).

Re-run the audit after any release that touches Foundry or the Locker.

## Phase 1 — Release integrity **[not a gate; post-release verification]**

Ungated 2026-07-28: releases no longer wait on this. It is still worth doing,
and it is still true that nothing here has been validated against the game.

1. Packaged Windows smoke test: open Global sounds, confirm
   `catalog globalsounds`, replace a normal icon and a DXT5-YCoCg icon, read the
   engine version in Settings.
2. Stage one sound and one texture, forge them into a single VPK, and confirm
   the exported VPK mounts and both edits appear in game. This is the newest and
   least-exercised path; it has never been run end to end by a human.
3. Promote the YCoCg icon fix from the fork engine into the packaged engine
   ([foundry-handoff.md](./foundry-handoff.md):85) so a packaged replace does not
   garble depending on which icon was picked.

Do this whenever a build and the game are both in front of you, and fix forward
if it finds something.

Depends on: nothing. Blocks: nothing.

## Phase 2 — Foundry combined output (slice F) **[verified: largely shipped]**

Both items below are done. Sound staging (`SoundBrowse.tsx:1034`) and visual
staging (`LibraryBrowse.tsx:66`) feed one reviewed write set; the tray confirms
write set + collision winners (`FoundryBuildTray.tsx:48`); `foundryForge.ts`
re-derives the review in main, rejects a stale confirmation (`:50`), and refuses
to export a VPK whose entries do not match (`:73`). The build is export-only by
design (`ipc/foundry.ts:101`).

Closed 2026-07-28 (wave 0.5):

1. ~~Staged sound edits skip the exact-path preflight.~~ Fixed at
   `SoundBrowse.tsx:1043`. Staging now blocks on an uninspectable VPK and
   requires acknowledgement of enabled owners, matching `LibraryBrowse.tsx:57`.
   The install path's disable/replace resolutions are deliberately not offered
   at staging time: staging must not change enabled state or precedence.
2. ~~Stale MP3-only copy.~~ Removed from `FoundryBuildTray.tsx`, and the
   `foundry.sound.swap.drop` catalog value was corrected (its stale en string was
   overriding an accurate component fallback, so users saw the wrong text). The
   orphan `foundry.sound.swap.mp3only` key was deleted, and the staging toast
   now uses its own `staged` key instead of reusing the install path's `done`,
   which had been claiming a staged edit was installed.

Closed 2026-07-28 (wave 2):

3. ~~No installed-state regression test for cancellation.~~ The cancel path is
   now covered at the orchestrator level. The real defect was not where this
   item assumed: `ipc/foundry.ts`'s `finally` did fire on a cancelled save
   dialog, but `buildFoundryForgeVpk`'s own `finally` could reject an
   already-successful build when a per-part cleanup rejected, orphaning the
   merged temp directory it was about to return. Part cleanups are now
   best-effort, and build/export/cleanup moved into
   `forgeAndExportFoundryVpk` so a cleanup failure can never rewrite the
   user-visible outcome. Cancelling now reports it and keeps the staged edits;
   only a real export clears the tray.

Also landed in wave 2, beyond the original item text:

- The tray reached only catalog (tool-first) mode. `HeroWorkshop`, the primary
  hero-first flow, rendered no tray at all, so an edit staged there could never
  be reviewed or forged. Both modes now share one tray and one staged-edit list.
- `TextureBrowse` had no staging affordance; it now stages through the same
  `prepareVisualStagedEdit` path as `LibraryBrowse`, so the two cannot drift.
- `window.confirm` replaced with an in-app confirmation showing the output name,
  the full exact write set, and the collision winners.
- A missing-source preflight over `foundry:checkAudioPaths` blocks a forge whose
  recorded audio or PNG has moved, and a failed check blocks rather than
  proceeding.

Still open:

`FoundryForgeEdit` admits only `sound` and `texture`: recolor and model have no
serializer, and the tray refuses them explicitly rather than silently dropping
them.

Exit gate: a manual forge of one sound and one texture into a single VPK, and a
real native-save-dialog cancel. Neither has been run against the game.

Depends on: nothing. Slice G is no longer blocked behind the build itself.

## Phase 3 — Source-panel actions (slices D/E completion) **[items 1, 2, 4 landed 2026-07-28, wave 1]**

`AssetSourcesPanel` is mounted on sound rows (hero and global, via the shared
`SoundRow`), texture cards, the texture lightbox, and library browse.

Closed 2026-07-28 (wave 1):

1. ~~Panel actions.~~ Audition (extracted from the owning VPK via
   `foundry:auditionSourceClip`, not the game paks), open-in-Installed
   (`/?focusMod=<id>`, consumed by `Installed.tsx`), enable/disable through
   `appStore.toggleMod`, shuffle-pool add/remove lifted into `SoundRow`, and
   create-replacement handed back to the row's swap panel. Precedence is never
   touched, no third-party VPK is written, and an unreadable VPK blocks every
   action that depends on knowing the real owner, naming the VPK at fault.
2. ~~`MySoundChanges` context.~~ Per-change winner resolution over the recorded
   write set, a jump to the winning mod, shared annotation editing, and a
   re-forge from `soundSwap.reforge` that refuses to start when a recorded
   audio file has moved. Legacy swaps carry no recorded write set and say so
   rather than guessing.
4. ~~Pool editor completion.~~ The exact clip-to-audio write set is listed
   before Forge, the seed is recorded (`SoundSwapInfo.poolSeed`) and shown in
   `My sound changes`, and `Shuffle now` redraws the seed the build will record.

Still open:

3. Surface the existing hero sound launch-shuffle controls in Foundry with a
   link back to Locker. Global-sound shuffle only after an event-level
   persisted pool is defined.

Exit gate: verification against a downloaded third-party mod, a forged mod, a
disabled mod, and a multi-clip pool, in game. None of that has been done: the
landed work is covered by unit tests and the repository gate only.

Depends on: nothing (the C contract is stable and fixture-covered).

## Phase 4 — Merge composition (roadmap milestones 2-5) **[verified]**

From [vpk-composition-roadmap.md](./vpk-composition-roadmap.md). Milestone 1
(`analyze-merge`) is complete in the main process
(`services/modMerger.ts:517`, read-only, `entryCount: null` distinguishes an
unreadable VPK from an empty one at `:574`) but reaches no renderer: the chain
stops at `preload/index.ts:335` + `types/electron.ts:841` with no `api.ts`
wrapper; wave 1 added that wrapper and the review UI on top of it. Milestones
2-5 are genuinely absent — no recipe schema, no path policy, nothing half-wired. They are staged deliberately so each is separately
releasable:

- **4a. Review UI and ordering. [landed 2026-07-28, wave 1]** Grouped
  collisions, effective winner per collided path, and winner-first source
  reordering in the new composition workflow only, carried through `merge-mods`
  as `sourceOrder` (`components/MergeReviewPanel.tsx`,
  `services/modMerger.ts`). The legacy merge path sends no order and is
  unchanged; add-sources shows the same review read-only. A reviewed order is
  refused when a VPK is unreadable or a merged mod is selected. Not yet
  verified in game: no merged VPK built from a reviewed order has been mounted.
- **4b. Recipe schema and rebuilds.** Optional versioned recipe (source
  identities, order, policy) stored beside `MergedModInfo`. Missing recipe =
  legacy default. Exit gate: transaction rollback and legacy-merge reconstruction
  tests.
- **4c. Prefix/path policy.** Include/exclude/winner rules compiled into a
  deterministic split/repack plan; build to temp, validate the tree, embed
  provenance, atomically replace.
- **4d. Composition UX.** Editable merged contents, content presets (model, VFX,
  sounds, UI), rebuild diffs, source-update review, recipe export/import as
  optional portable-profile fields only.

Depends on: 4a → 4b → 4c → 4d, strictly. Do not start 4c before the recipe schema
is versioned, or the path policy has nowhere durable to live.

## Phase 5 — Ability VFX recolor roster **[verified: roster is done]**

The two-hero claim was stale. 38 heroes carry a pinned recipe
(`COLOR_CODENAME_BY_HERO`, `heroColors.ts:55`), and every one resolves to a
matching `recipe_for` arm in `vpkmerge-core/src/hero_recolor.rs:71`.
`RECIPE_CACHE_VERSION` is v7 for that coverage.

What actually remains:

1. Per-hero in-game confirmation of the recolored abilities (no screenshots on
   record for any hero but Paige).
2. Replace the `'particle-only'` error-substring test at
   `HeroColorPicker.tsx:291` with a typed engine error code, and test it. Today a
   reworded engine message would make the picker retry a doomed preview on every
   slider tick.

Exit gate: per-hero, an in-game screenshot of the recolored abilities.

Depends on: nothing. Runs independently of everything else.

## Phase 6 — Performance config **[6b landed 2026-07-28, wave 2]**

`PRESET_ID` is still a single constant (`performanceConfigData.ts`), so there is
still no multi-preset applier.

Closed 2026-07-28 (wave 2):

- **6b.** ~~Phase A of [performance-convars-followup-plan.md](./performance-convars-followup-plan.md).~~
  Per-control reset now removes Grimoire's line for that key (dropping the
  sidecar override, uncommenting nothing, leaving untagged lines alone) instead
  of writing an app-chosen number, via `clearPerformanceConvars` and the
  `clear-performance-convars` channel. Value-state badges are computed in the
  main process from `convarStates`, the only side that can see the sidecar, the
  markers, and the preset data at once. Out-of-range values are badged and
  require explicit confirmation; the slider no longer parks on a clamped
  position as if that were the file's real value. Toggles and sliders both stage
  into an explicit pending panel with apply and discard.

  Two root causes were fixed along the way that the item text did not name:
  `readHudConvarValues` filtered to HUD keys only, so `convarValues` never
  carried an advanced key and every slider reported "using the game default"
  forever; and the authoritative game defaults lived in a renderer constant,
  which is exactly the app-chosen-value-as-game-default problem. Defaults now
  live in `performanceConfigData.ts` and the card derives from status.
  `setPerformanceAdvancedConvars` also stopped silently dropping out-of-range
  input while reporting success.

Still open:

- **6a.** Phase 2 of [performance-config-integration.md](./performance-config-integration.md):
  id-keyed multi-preset applier + manifest UI over the curated Sqooky upstream.

Unverified against the game: the eight advanced `gameDefault` numbers were moved
from the renderer, not read off a running build. HUD `gameDefault` is `null` for
all eight toggles, so an unset toggle is badged "Game default" but cannot preview
what the game will actually do (`citadel_damage_offscreen_indicator_disabled` is
an inverted flag and the one to check first). Filling these in is data-only.

`video.txt` auto-apply stays out of scope (machine-specific; guided merge only).

## Phase 7 — 3D preview fidelity **[verified: 7a and 7b are done]**

From [3d-preview-fidelity-plan.md](./3d-preview-fidelity-plan.md). Phases 1-4 of
that plan have landed:

- **7a. The rigged spine: BUILT, and now measured (wave 3, 2026-07-28).** The
  "Grimoire always passes `--pose`" premise was stale. `services/heroPoseModels.ts`
  ships a rigged sibling export that deliberately omits `--pose` to keep the
  skeleton, skin, and one ranked animated clip (`:171`, `:882`, `:972`),
  alongside the legacy static bake (`:169`). Full evidence in
  [rigged-preview-spike.md](./rigged-preview-spike.md).

  All three pilots (astro, bookworm, gigawatt_prisoner) export and pick a looping
  idle clip; every primitive carries `JOINTS_0`, so nothing is left in bind pose.
  Measured against the installed pak: **+9.3% glb size** (+1.48 to +3.03 MB), and
  the rigged export is *faster* than static because it skips pose baking. The NPR
  layer cannot swim under animation: no inverted-hull shell survives either
  export, the cel/rim is fragment-stage on the skinned normal, and the one vertex
  write lands after `<skinning_vertex>`. All 15 material extras are byte-identical
  static vs rigged.

  **Recommendation: ship gated, do not default on.** The blocker is that no fps
  number exists and none can be produced headlessly, so the frame-budget figure
  in the report is an estimate and is labelled as one. Two prerequisites:

  1. ~~`riggedPreviewEnabled` is welded to the cloth flag.~~ Fixed 2026-07-28.
     Rigged now has its own dev switch (`flags.rigged`), so it can be measured
     without the WIP cloth sim. Cloth still implies rigged, which is correct: a
     sim needs a skeleton. Off in released builds, like cloth.
  2. **Still open:** a human measures fps on Seven (`gigawatt_prisoner`), the
     worst case on every axis. Procedure and pass/fail criteria are in section 8
     of the report. Turn on Preview > Debug > Rigged, leave Cloth off.

  Also corrected: the `--require-pose` comment named six clipless WIP heroes.
  Re-checked against the pak, Apollo, Billy, Celeste, Mina and Paige all ship
  pose clips now; only plain `familiar` is still clipless (Rem is already pinned
  away from it). The guard itself was left alone.
- **7b. Cloth/jiggle: BUILT.** `src/lib/useClothSim.ts` with `clothMath.test.ts`,
  `feModel.test.ts`, and solver-stability harness tests. Material/lighting parity
  and NPR are likewise built (`deadlockMaterial.ts`, `source2Preview/`,
  `source2NprMaterial.ts`, all tested).
- **7c. Custom-animation retarget: not started**, and no longer blocked. No
  bone-map or retarget code exists anywhere in `src/` or `electron/`. In-game
  APPLY via `.vnmclip_c` re-encode stays deferred; preview-only.
- **7d. Ambient passive FX**, then **7e. authentic ability casts: not started**,
  also unblocked.

Exit gate per sub-phase: a named pilot hero (Paige, Dynamo, Seven) rendering
correctly with a measured frame budget.

Depends on: nothing. Start 7c with a bone-map JSON for one pilot hero.

## Phase 8 — Social **[verified]**

`Discover.tsx` + `ipc/social.ts` ship behind `experimentalSocial`. Phase 1's
client half is done: 14 IPC handlers (`ipc/social.ts:50`-`:117`), Discover with
NSFW gating (`Discover.tsx:54`), Publish/Edit/MyPublished dialogs, the account
section with deletion (`SocialAccountSection.tsx:47`), and async `safeStorage`
persistence (`socialAuth.ts:96`). The session bearer stays in main-process module
memory (`services/social.ts:130`); `SocialSessionStatus` carries no token field
(`types/social.ts:13`) and preload exposes no accessor — confirmed.

One drift worth a decision, not a bug: the TOS gate fires at first *publish* and
is localStorage-backed (`PublishDialog.tsx:14`, `:23`), where the design put it
at first login. Unbuilt, from [social-architecture.md](./social-architecture.md):

Closed 2026-07-28 (wave 3):

- **8a (Phase 1.5).** ~~GameBanana revalidation cron, the "11/12 mods available"
  badge, "mods I'm missing" against local install state, owner-only view stats,
  better offline/error states.~~ Worker side: migration 0005 (append-only),
  `src/cron/revalidateMods.ts` on a weekly trigger, and `ViewCounterDO`. Client
  side: availability and missing-mods badges, owner-only view count, and offline
  vs service-busy states split out from the generic error banner. Reasoning is in
  ADR-017 (new ADR; no existing ADR was edited).

  Two decisions worth knowing without opening the ADR. **Views never write to D1
  on the request path**: a view goes to one of 8 hashed `ViewCounterDO` shards
  via `waitUntil`, accumulates in DO storage, and flushes to D1 on a 5-minute
  alarm. D1 writes are bounded by distinct profiles viewed per window, not by
  view volume, so a profile viewed 10,000 times in an hour costs at most 12
  writes. This matters because D1's free tier is a hard cliff, not throttling: a
  viral profile on a direct-increment design would take publish and like down
  with it. **The cron paces at 4 req/sec serial**, half the interactive client
  limiter, with a hard 500-request / 200-profile per-run budget and a 6-day
  memo table, because nobody is waiting on a cron and GameBanana is
  volunteer-run. Probes are three-state: a 429/5xx/timeout is "could not tell",
  never cached and never recorded, so the profile is re-picked next run rather
  than badged pessimistically wrong.

  Not built, deliberately: the admin analytics dashboard. It appears in the
  doc's Phase 1.5 list but was outside the wave's scope.

Still open:

- **8b (Phase 2).** Comments, search, follows, collections, Discord OAuth.

Blocking before the Worker deploys: **migration 0005 has not been applied
anywhere**, and the routes select the new columns, so they will fail against a
pre-migration DB. The cron has also never run: the probe shape is unverified
against a real deleted or archived submission.

Depends on: the Worker side (`../grimoire-social`) leads every item; the client
follows. 8b carries moderation cost that was postponed deliberately — re-decide
before starting, do not drift into it.

## Phase 8.5 — Banked from the wave 4 planning pass (2026-07-28)

Scoped but deliberately not started. Recorded here so the reasoning is not lost.

**The important one: verification debt.** Four waves have landed with a green
repository gate and **zero in-game validation**. That is the real risk on this
board, and no amount of further code reduces it. The cheapest useful hour:

1. Forge one sound and one texture into a single VPK, save it, mount it, and
   confirm you hear and see both.
2. Cancel the save dialog once and confirm nothing changed in Installed.
3. Mount a merged VPK built from a reviewed source order.
4. Enable `Preview > Debug > Rigged` (leave Cloth off) and look at Seven
   (`gigawatt_prisoner`), per section 8 of
   [rigged-preview-spike.md](./rigged-preview-spike.md).

If any of those fails, that failure outranks everything below it.

**Deploy landmine, social 1.5.** Migration 0005 is applied nowhere and the
profile routes select its columns, so `/v1/profiles` returns 500 until it runs.
Harmless today (nothing is deployed) and ordering-sensitive whenever the Worker
next ships. Apply the migration before deploying, not after.

**Updater housekeeping (new, not previously tracked).**
`services/updater.ts` has no cleanup path of any kind: electron-updater's
download cache accumulates old installers and stale partial downloads under the
per-user updater cache, and nothing prunes them. Add a bounded sweep (keep the
pending install for the current target, drop everything older) on a successful
install or at startup. Local `release/` output is a separate, developer-side
concern and is gitignored.

**Sibling-repo drift, and the shim holding it together.** The wave 3 wire fields
were committed to `../grimoire-social` but cannot be pushed: that repo's only
remote is `Slush97/grimoire-social`, which this fork does not own, and CI checks
it out fresh. So a local build resolves the new fields through the on-disk
workspace link and CI does not. `ProfileDetailWithAvailability`
(`src/types/social.ts`) widens `ProfileDetail` to bridge that gap.

**Decided 2026-07-29: this fork relies on the upstream deployment**
(`grimoire-social.slusheliott.workers.dev`), so the revalidation cron and view
counter added in wave 3 will not run against it. The four availability fields
are therefore expected to be absent, not null, and the client now distinguishes
the two: absent means "this service does not report it" and renders nothing,
null means "reports it, has not checked this profile yet" and shows the neutral
badge. Without that split every Discover card carried a permanent "not checked
yet" badge advertising a check that was never coming.

Consequences to keep in mind: the availability badge, the gone-mods list and
owner view counts are dormant UI against the upstream service, and the three
commits in `../grimoire-social` are unpublished local work. To activate any of
it, either fork `grimoire-social` to `onionviolet` (repoint the sibling remote,
`ci.yml`'s hardcoded `repository:` checkout, and the baked
`GRIMOIRE_SOCIAL_BASE_URL` in `release.yml`, then deploy with migration 0005),
or offer the cron and counter upstream as a pull request.

Note for any future sibling-repo change: **the local gate cannot catch this
class of break.** `pnpm typecheck` resolves the sibling from disk, so it stays
green while CI fails. Verify by temporarily reverting the sibling file and
running `pnpm exec tsc -b --force`.

**Deferred client work, in rough value order:**

1. Social gone-mods list: render GameBanana's own mod titles in place of the
   current `GameBanana: #123, #456` tooltip. Client-only, no Worker change, no
   new translation key (decided 2026-07-28: reuse upstream data rather than
   author new copy).
2. The TOS gate drift (`PublishDialog.tsx:14`): design puts it at first login,
   the code fires it at first publish and stores acceptance in localStorage.
   **This is a decision, not a bug.** Either move the gate or correct the design
   doc; do not let an agent pick.
3. Phase 4b, the merge recipe schema. Assessed 2026-07-28 as **the least
   important thing on the board**: pure groundwork for 4c/4d, no standalone
   user benefit, and nothing breaks without it. Do not start it before the
   Foundry work below, and not at all unless 4c is actually wanted.

**Blocked on a clean working tree:** Phase 2's remaining item (recolor and model
serializers for `FoundryForgeEdit`) and Phase 3 item 3 (launch-shuffle controls
in Foundry). Both were kept out of wave 4 only because `src/components/foundry/*`
had uncommitted local work in flight.

## Phase 9 — Blocked / deliberately deferred

Do not start these because adjacent UI exists:

- **Foundry models, VFX and broad thumbnail browsing (slice G)** — blocked on a
  trustworthy path catalog. The Phase 2 dependency is now satisfied.
- ~~**Audio format conversion.**~~ **Shipped, and the decision was "bundle".**
  `ffmpeg-static` is a dependency (`package.json:62`), asar-unpacked
  (`electron-builder.yml:41`), and `prepareAudioForMint`
  (`services/audioConversion.ts:38`) transcodes non-MP3 input on the way into
  `buildHeroSoundSwapVpk` (`services/foundryCatalog.ts:257`). The picker already
  advertises WAV/FLAC/M4A/AAC/OGG/Opus (`SoundBrowse.tsx:1123`) and now honours
  it. Two follow-ups: the build tray still tells users the opposite
  (`FoundryBuildTray.tsx:81`), and `audioConversion.ts` has no test.
- **Locker overflow renderer polish (W11)** of
  [multi-folder-addon-overflow.md](./multi-folder-addon-overflow.md) — marked
  optional; only if a user-visible problem appears.

## Suggested batching

Reordered after the 2026-07-28 audit: Phase 0 is done, Phase 2 is nearly done,
and Phase 7a turned out to be already built.

| Batch | Contents | Rationale |
| --- | --- | --- |
| 1 | Phase 2 items 1-2, Phase 1 | The sound preflight is the only live correctness gap found; the tray copy is a one-line fix; the smoke record is still owed |
| 2 | ~~Phase 3~~ (items 1, 2, 4 landed wave 1), Phase 5 item 2 | Both Foundry/Locker surfaces, both small and independently ownable |
| 3 | Phase 6b, Phase 4a | Small, self-contained, separately releasable |
| 4 | Phase 7c, Phase 8a | Long-lead work with real technical risk, now unblocked |

Every batch ends with the repository gate: focused Vitest files, then
`pnpm typecheck`, `pnpm lint`, `pnpm test`.
