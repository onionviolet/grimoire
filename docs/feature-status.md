# Feature status

Status snapshot: **2026-09-01**, reconciled against the working tree by reading
the code rather than the docs. The two "Shipped" sections date from the
2026-07-28 audit ([spec-audit-prompt.md](./spec-audit-prompt.md)) and its three
waves and are kept as shipped history; the gap and verification sections were
rewritten on 2026-09-01, when eleven entries turned out to have shipped during
v1.27 and v1.27.1 without ever being trued up here.

This is an implementation inventory, not a substitute for in-game validation.
It holds **no forward plan**: see [.planning/ROADMAP.md](../.planning/ROADMAP.md)
for the current milestone and [.planning/BACKLOG.md](../.planning/BACKLOG.md)
for everything else.

## Shipped 2026-07-30

- **Global sound categorisation reads the mods, not their download titles.**
  The Locker's Global sound rail classified installed mods from their GameBanana
  category name, which put six item-sound mods on the Announcer shelf, every
  player melee sound under a category named `Shared`, and the NPC content under
  `Other`. Classification now runs on the entries inside each mod's own VPK
  (`useDiscoveredSoundPaths` over the cached directory parse), with path rules
  ahead of word-matching, and `shared`/`other` replaced by a single
  `Needs classification` queue. Empty categories are still rendered and the
  Visuals rail still carries sound-shaped buckets; both are Stage 1 layout work.
- **A sound row names what it changes.** Expanding a global sound mod used to
  say it recorded no entry paths; it now reads them from the VPK, which also
  surfaces collisions between two mods writing the same sound.
- **Foundry's hero workshop scopes its icon browse to that hero**, including
  assets attributed by filename rather than by folder, and hero dropdowns show
  hero names instead of engine codenames.
- **An empty Foundry catalog explains itself** through a diagnostics disclosure
  (which pak, from when, how many entries, which cache) with a rebuild action.
- **User-supplied images keep the name the user picked** instead of showing
  their content hash (upstream issue #261).

## Shipped, but still experimental

- **Chat Wheel YAML workflow.** ChatLane VPKs can be opened, edited as YAML,
  validated, and installed as managed add-ons. Enable it in Settings >
  Experimental > Chat Wheel.
- **Foundry Sound Workbench.** Hero, voice, and global sounds can be browsed
  and auditioned. It supports annotations with searchable personal labels,
  notes, and tags; write-set conflict inspection; managed-change replacement or
  conflict disablement; selected-clip and seeded-library pool modes; and a
  `My changes` view backed by the normal mod state.
- **Foundry texture and item replacement.** The supported catalog cards accept
  a PNG drop/pick, run an exact-path preflight, and stage the replacement in the
  build tray. Nothing is installed until the user forges
  (`components/foundry/LibraryBrowse.tsx:57`).
- **Combined Foundry output.** Staged sound and visual edits are reviewed as one
  write set with collision winners, then built into a single named VPK that the
  user saves through a native dialog (`services/foundryForge.ts:45`,
  `ipc/foundry.ts:104`, `components/foundry/FoundryBuildTray.tsx:48`). It is
  export-only when saved that way: build parts never enter Installed, and a
  cancelled save leaves both the mod library and the staged edits untouched.
  Install is now offered alongside it (see below); the export contract itself is
  unchanged. As of wave 2 the tray is shared by both Foundry modes, so an edit staged in the hero-first
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
- **Foundry builds can be installed, not only exported.** The build tray's
  confirmation now offers Install to Grimoire beside Export VPK. Both run the
  identical reviewed request through `buildFoundryForgeVpk`, so the stale-review
  rejection and the built-VPK write-set check apply equally; install then
  registers the result as a normal local mod carrying `foundryBuild` provenance
  (the main-derived write set plus one part per edit and the original request)
  (`ipc/mods.ts` `foundry:forgeInstall`, `services/foundryForge.ts:describeFoundryBuild`).
  Export is unchanged and still leaves the mod library untouched.
- **`My changes` covers every kind, not only sounds.** The old `My sound
  changes` sub-tool is now `My changes`
  (`components/foundry/MyChanges.tsx` + the pure `changeList.ts`): it lists
  sound swaps, installed builds (one row per part), and legacy texture
  replacements, with a category filter (including Portraits & hero images),
  sort, path-aware search, per-row exact-path winner resolution, jump to the
  winner, rename/enable/delete through the normal store, and a rebuild from the
  recorded request. The hero workshop gets the same view scoped to that hero.
  Fixes a latent bug on the way past: the sub-tool label read `foundry.subtools.mySounds`,
  a key that never existed in the en catalog, so the rail rendered the raw id.
- **Launch shuffle over Foundry changes.** A change can be opted into a launch
  pool from `My changes`. The pool is not "all my changes": it is the set of
  changes that contend for the same exact game paths, computed as connected
  components over their recorded write sets (`lib/foundryChanges.ts`). At launch
  one member of each pool is enabled and the rest are turned off, mirroring the
  Locker's per-hero pick. Opting one change in makes that whole pool exclusive,
  because a non-member left enabled would win the same path by load order and
  the shuffle would appear to do nothing. Membership is keyed on the content
  hash, never on `mod.id`/`metaKey` (both are pakNN-derived and change on every
  toggle, so a persisted opt-in keyed on either would detach the first time it
  ran). Changes with no recorded paths cannot be pooled and say so rather than
  offering a dead control. This is the "safe, event-level persisted pool" that
  section 2 required before any shuffle over installed VPKs: it now generalizes
  from sound events to any asset path.
  The Foundry pool is resolved before the Locker's plans and owns every mod it
  manages, so a Foundry sound swap (which is also `isLockerManagedSound`) cannot
  be driven by two planners inside one batch.
- **Foundry and the Locker link both ways.** A hero shelf in `My changes` opens
  `/locker?hero=<name>`, which resolves the name against the loaded category
  list and jumps to that hero; the Locker hero view has an Edit in Foundry entry
  that opens `/foundry?hero=<name>`. Foundry derives the linked hero from the
  URL rather than copying it into state, so the link is authoritative while
  present and backing out clears it. An unrecognized name leaves the user on the
  grid instead of guessing a hero.

## Confirmed gaps

**Reconciled 2026-09-01** against the working tree. The previous list dated
from 2026-07-28 and had gone badly stale: eleven of its entries shipped during
v1.27 and v1.27.1. Those are recorded, with evidence, in the "Closed by the
truth pass" table of [.planning/BACKLOG.md](../.planning/BACKLOG.md); do not
re-derive them from an older revision of this file.

What is genuinely still missing, in the order it would be worth building:

1. **Foundry model edits have no forge serializer.** `FoundryForgeEdit`
   (`src/types/foundry.ts:423`) admits `sound`, `texture`, and `recolor`. The
   tray refuses a model edit explicitly rather than dropping it silently, and
   there is no model surface to stage one from anyway. Backlog B-01.
2. **Foundry models, VFX, and broad thumbnail browsing.** No model
   export/viewer entry point; browsing stays deliberately limited to ability
   icons, item icons, and hero images. Backlog B-02.
3. **Advanced merge composition.** Merge recipes, editable include/exclude
   path policy, merge-content presets, and rebuild diffs are absent, and a
   reviewed order cannot be applied to a selection containing a merged mod.
   Backlog B-03.
4. **Animation retarget and in-preview ability VFX.** The rigged export path
   ships and its frame cost was measured; retarget and in-preview VFX were
   never built. Backlog B-04.

Two further items are decisions rather than gaps: where the social TOS gate
fires (B-05) and whether to fork `grimoire-social` or upstream the dormant
wave 3 work (B-07, disposition recorded in ADR-018).

## Verification status

The Foundry and Locker verification debt that dominated this document in July
is largely discharged. `node scripts/check-verification-record.mjs --strict`
passes: 42 rows, 0 blank, every verdict filled, with the app tier settled
unattended by `scripts/verify-in-app.mjs` and the engine tier carrying reasoned
per-row deferrals.

What remains is three `unrun-verify` entries in
[.planning/WINDOWS.md](../.planning/WINDOWS.md), each needing a real Deadlock
install or a Windows machine. **They are deferred by decision (2026-09-01) and
gate nothing.** That register is their only home; do not copy them back here.

The standing caveat still holds and should not be overstated in user-facing
copy: a pass in the app tier proves Grimoire wrote the intended bytes to the
intended path. It proves nothing about whether the Source 2 engine loads,
plays, or draws them.

## History and branch safety

- `main` is the only branch. The v1.27.5 phase branches and the v1.28
  absorption branch were merged and deleted on 2026-09-01; `upstream/main` is
  fully absorbed as of that date.
- `codex/chat-wheel-tab` is not a feature branch to merge: compared with
  `main`, it removes Chat Wheel and many other fork features. Treat it as an
  old/reductive experiment, not recovery material.

## Release follow-up

The packaged Windows smoke record does not block a release (decided
2026-07-28, unchanged). The fork's support destination was decided and applied
during v1.27; the updater modal no longer points at the upstream Discord.

Forward-looking plans no longer live in this file. Current-milestone work is in
[.planning/ROADMAP.md](../.planning/ROADMAP.md); everything else is in
[.planning/BACKLOG.md](../.planning/BACKLOG.md). The v1.25-era plan that used
to sit here is archived at
[archive/feature-status-next-version-plan.md](./archive/feature-status-next-version-plan.md).
