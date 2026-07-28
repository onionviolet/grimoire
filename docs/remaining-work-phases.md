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

## Phase 1 — Release integrity **[verified: no smoke record exists]**

1. Packaged Windows smoke test: open Global sounds, confirm
   `catalog globalsounds`, replace a normal icon and a DXT5-YCoCg icon, read the
   engine version in Settings.
2. Promote the YCoCg icon fix from the fork engine into the packaged engine
   ([foundry-handoff.md](./foundry-handoff.md):85) so a packaged replace does not
   garble depending on which icon was picked.

Exit gate: a recorded smoke run naming the exact packaged build and engine
version. Until then nothing here is "game-validated".

Depends on: nothing. Run first, run in parallel with everything.

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

Still open:

3. No installed-state regression test for cancellation, and `FoundryForgeEdit`
   admits only `sound` and `texture` — recolor and model have no serializer.

Exit gate: a cancellation regression test, and a manual forge of one sound and
one texture into a single VPK.

Depends on: nothing. Slice G is no longer blocked behind the build itself.

## Phase 3 — Source-panel actions (slices D/E completion) **[verified]**

`AssetSourcesPanel` is inspect-only and is mounted on sound rows (hero and
global, via the shared `SoundRow`), texture cards, the texture lightbox, and
library browse. Missing:

1. Panel actions: audition the current source, open its owner in Installed,
   enable/disable through the normal mod store, add/remove from a launch shuffle
   pool, create a replacement from that source. Never silently change precedence;
   no direct-overwrite action for third-party VPKs.
2. `MySoundChanges`: event-level active-winner context, jump to the source or
   conflict row, annotation access, re-forge from recorded assignments.
3. Surface the existing hero sound launch-shuffle controls in Foundry with a link
   back to Locker. Global-sound shuffle only after an event-level persisted pool
   is defined.
4. Pool editor completion: exact target-to-audio assignment shown before Forge,
   seed persisted and displayed in forged-mod metadata, `Shuffle now` preview.

Exit gate: discovery, seed, cancel, and rollback tests; verification against a
downloaded third-party mod, a forged mod, a disabled mod, and a multi-clip pool.

Depends on: nothing (the C contract is stable and fixture-covered).

## Phase 4 — Merge composition (roadmap milestones 2-5) **[verified]**

From [vpk-composition-roadmap.md](./vpk-composition-roadmap.md). Milestone 1
(`analyze-merge`) is complete in the main process
(`services/modMerger.ts:517`, read-only, `entryCount: null` distinguishes an
unreadable VPK from an empty one at `:574`) but reaches no renderer: the chain
stops at `preload/index.ts:335` + `types/electron.ts:841` with no `api.ts`
wrapper. Milestones 2-5 are genuinely absent — no recipe schema, no path policy,
nothing half-wired. They are staged deliberately so each is separately
releasable:

- **4a. Review UI and ordering.** Show analysis before confirmation: grouped
  collisions, effective winner, source reordering in the new workflow only.
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

## Phase 6 — Performance config **[verified]**

Confirmed absent: `PRESET_ID` is a single constant
(`performanceConfigData.ts:32`), so there is no multi-preset applier; the card
offers only a bulk `resetPerformanceConfigOverrides`
(`PerformanceConfigCard.tsx:295`), a card-level applied/edited badge (`:208`),
and a per-control "using game default" hint (`:360`). An out-of-range stored
value is silently replaced by the control default (`:333`).


- **6a.** Phase 2 of [performance-config-integration.md](./performance-config-integration.md):
  id-keyed multi-preset applier + manifest UI over the curated Sqooky upstream.
- **6b.** Phase A of [performance-convars-followup-plan.md](./performance-convars-followup-plan.md):
  per-control reset-to-game-default, value-state badges (default / preset / user
  override / unsupported), out-of-range warning instead of silent clamp, pending
  vs applied summary.

`video.txt` auto-apply stays out of scope (machine-specific; guided merge only).

Depends on: 6b is independently shippable and cheaper; do it first.

## Phase 7 — 3D preview fidelity **[verified: 7a and 7b are done]**

From [3d-preview-fidelity-plan.md](./3d-preview-fidelity-plan.md). Phases 1-4 of
that plan have landed:

- **7a. The rigged spine: BUILT.** The "Grimoire always passes `--pose`" premise
  was stale. `services/heroPoseModels.ts` ships a rigged sibling export that
  deliberately omits `--pose` to keep the skeleton, skin, and one ranked animated
  clip (`:171`, `:882`, `:972`), alongside the legacy static bake (`:169`).
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

- **8a (Phase 1.5).** GameBanana revalidation cron and the "11/12 mods available"
  badge, "mods I'm missing" resolution against local install state, owner-only
  view stats, admin analytics, better offline/error states.
- **8b (Phase 2).** Comments, search, follows, collections, Discord OAuth.

Depends on: the Worker side (`../grimoire-social`) leads every item; the client
follows. 8b carries moderation cost that was postponed deliberately — re-decide
before starting, do not drift into it.

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
| 2 | Phase 3, Phase 5 item 2 | Both Foundry/Locker surfaces, both small and independently ownable |
| 3 | Phase 6b, Phase 4a | Small, self-contained, separately releasable |
| 4 | Phase 7c, Phase 8a | Long-lead work with real technical risk, now unblocked |

Every batch ends with the repository gate: focused Vitest files, then
`pnpm typecheck`, `pnpm lint`, `pnpm test`.
