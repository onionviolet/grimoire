# Requirements: Grimoire

**Defined:** 2026-08-05
**Core Value:** A Deadlock player can change their game and always know exactly what changed, who owns it, and how to undo it.

Requirement IDs are carried verbatim from `.planning/intel/requirements.md` wherever one exists, so the cross-references in `.planning/INGEST-CONFLICTS.md` still resolve. IDs prefixed the same way but absent from the intel set were derived from the nine documents the ingest held out of synthesis (see "Provenance" at the end).

---

## Delivered

Shipped work, confirmed against the working tree at v1.26.20 on 2026-08-05. **These do not map to a phase.** They are recorded here because doc status headers in this repo have drifted in both directions and work has been started three times on things that already shipped.

| Requirement | Evidence |
|-------------|----------|
| **REQ-3d-preview-shared-spine** | `heroPoseModels.ts` ships both the static `--pose` bake and a rigged sibling that keeps skeleton, skin, and one ranked animated clip; `HeroPoseViewer` has the two-attempt rigged-then-static loader. Dev-gated (`RELEASE_RENDER_FLAGS.rigged` is false); the release gate is REQ-rigged-preview-release-gate |
| **REQ-3d-preview-material-parity** | `src/lib/deadlockMaterial.ts`, `src/lib/source2Preview/` (`compileScene`, `drawState`, `debugSummary`), all tested |
| **REQ-3d-preview-npr-and-cloth** | `src/lib/source2NprMaterial.ts` tested; `src/lib/useClothSim.ts` with `clothMath.test.ts`, `feModel.test.ts`, and solver-stability harness tests. Cloth is dev-gated. Known ceilings: cel constants are engine-global and hand-tuned; Valve's DSTF cloth parameters are undecoded |
| **REQ-foundry-vpk-identity-gate** | `services/vpk.ts` magic validation on every adoption path, `services/vpkImpostors.ts` reconcile, `dmmMigration.ts` now imports `checkVpkFile`/`describeVpkRejection`, and `VpkImpostorBanner.tsx` mounted in `Layout.tsx` closes the "existing ones are surfaced" clause that was open on 2026-07-29 |
| **REQ-foundry-scoped-source-blocking** | `components/foundry/sourceGating.ts` splits the gate by what each action depends on; a readable source stays actionable while an unrelated mod is unreadable |
| **REQ-foundry-grouped-pool-view** | Pool-first mode in `MyChanges` over `groupFoundryShufflePools`, with the List/Pools toggle in the sort row. Rendering never exercised against real content: see REQ-renderer-test-harness |
| **REQ-foundry-portrait-editor-and-sound-surfacing** | Lane E portrait editor and lane F row-level sound tooling landed; `seedTrimWindow` in `soundTuning.ts` fits a recorded trim/gain/loop seed to the decoded clip, unit-tested at `soundSeed.test.ts`. Never rendered: see REQ-renderer-test-harness |
| **REQ-global-sound-taxonomy** | Fixed in Pass B (`a87eb6e`): classification runs on the entries inside each mod's own VPK, not the GameBanana category name. `Shared`, `Shared melee`, and `Other` no longer exist as categories; `Needs classification` replaces them. No migration was needed because classification is computed at render time |
| **REQ-sound-inventory-model** | `src/lib/soundInventory.ts` with `soundInventory.test.ts`; one entry per (mod, hero) pair, untagged third-party VPKs become global `other`/`third-party` entries rather than being dropped |
| **REQ-portrait-inventory-model** | `src/lib/portraitInventory.ts` with `portraitInventory.test.ts`, consumed by `HeroCardPicker` and `portraitFamilyView.ts` |
| **REQ-portrait-shelf-cards-ownership** | `HeroCardPicker` mounts `AssetSourcesPanel` over the family's exact slot paths with variant labels. **One side of contested variant 2**, delivered before the journey question was settled |
| **REQ-portrait-randomization-home** | `FoundryPoolList` renders inside `HeroCardPicker` beside the card shuffle toggle, reusing `groupFoundryShufflePools` and `foundryShuffleKey`. **One side of contested variant 2.** Lane 4 (empirical `minimap`/`small` variant labels) is not delivered and is carried by REQ-ingame-verification-sweep |
| **REQ-locker-foundry-shared-hero-frame** | `src/components/common/HeroDetailFrame.tsx` exists and is imported by both `pages/LockerHero.tsx` and `components/foundry/HeroWorkshop.tsx`. **One side of contested variant 3.** Lane 1's status as a prerequisite for lanes 2 to 5 is therefore discharged; the target-state disagreement is not |
| **REQ-locker-honest-failure-states** | `src/stores/poseFailureStore.ts` with `poseFailureStore.test.ts`, written by `HeroPoseViewer` and read by `HeroSkinsPanel` |
| **REQ-vpk-composition-analysis** | `analyzeMerge` in `services/modMerger.ts` is read-only, orders sources by the real merge's rule, distinguishes an unreadable VPK (`entryCount: null`) from an empty one, and excludes inert imprint metadata from collision totals |
| **REQ-vpk-composition-review-and-recipes (milestone 2 only)** | `components/MergeReviewPanel.tsx` shows grouped collisions and the effective winner, and carries a winner-first source order through `merge-mods` as `sourceOrder`. The legacy merge path is unchanged. Milestones 3 to 5 are deferred, see v2 |
| **Combined Foundry output** | Both authoring flows stage into one reviewed write set; the tray shows the full exact write set and collision winners before an in-app confirmation; `foundryForge.ts` re-derives the review in main and rejects a stale confirmation or a built VPK whose entries do not match. Install and export both run the identical reviewed request. Cancellation is covered at the orchestrator level |
| **`My changes` across every kind** | `components/foundry/MyChanges.tsx` plus the pure `changeList.ts`: sound swaps, installed builds (one row per part), and legacy texture replacements, with category filter, sort, path-aware search, per-row winner resolution, jump to winner, rename/enable/delete, and rebuild from the recorded request |
| **Launch shuffle over Foundry changes** | Pools are connected components over recorded write sets (`lib/foundryChanges.ts`), keyed on content hash. The Foundry pool resolves before the Locker's plans and owns every mod it manages |
| **Performance ConVar Phase A** | Per-control reset removes Grimoire's line rather than writing an app-chosen number; main-process `convarStates` computes four-state badges; out-of-range requires explicit confirmation instead of a silent clamp; edits stage into a pending panel with apply and discard. The remaining data-only verification is REQ-performance-convar-safer-experimentation |
| **Audio transcoding** | `ffmpeg-static` bundled and asar-unpacked; `prepareAudioForMint` transcodes WAV/OGG/FLAC/M4A/AAC/Opus to 44.1 kHz stereo MP3 before the mint path, MP3 passing through byte-for-byte. `audioConversion.test.ts` now exists |
| **Updater cache pruning** | `services/updaterCache.ts` `pruneUpdaterCache` runs from `updater.ts` even when the updater is off. `docs/feature-status.md` gap 1d is stale |
| **VFX recolor roster and preview classification** | 38 heroes carry a pinned recipe (`COLOR_CODENAME_BY_HERO`, `RECIPE_CACHE_VERSION` v7), each resolving to a matching `recipe_for` arm. The `'particle-only'` substring match is gone: `previewHeroColor` returns `Promise<string \| null>` classified once in `heroColors.ts`, covered by `heroColors.previewHeroColor.test.ts`. Per-hero in-game screenshots remain owed |
| **Locker hero card apply** | Single Locker-managed cosmetics VPK rebuilt from a selection set; apply, swap, and revert are all "edit the selection set, then rebuild"; a vanished source is reported through `reportMissingSources` into `actionError` |
| **UI consistency pass lanes 1 to 8** | Global sounds is a real tab panel inside the Locker shell (`GlobalSoundShelf`); the shell rule is written down with an audit table; `resolveLockerRoute` plus 8 tests; the visual sweep compared by computed style; `src/lib/uiPrefs.ts` with 19 tests and a Settings reset; `useConfirm` with no `window.confirm` left in `src/`; `common/SearchInput` and `useScrollRestore`; `useEscapeKey`, `useDismissable`, `useSegmentedTabs`, `common/ResultSummary` |
| **REQ-upstream-merge-aug-2026 (Phase A)** | `main..upstream/main` is empty at 2026-08-05; the 10 upstream commits landed in `2924011`. Phases B and C are open, see REQ-upstream-merge-aug-2026 below |
| **Social phase 1 and 1.5** | 14 IPC handlers, Discover with NSFW gating, Publish/Edit/MyPublished, account deletion, async `safeStorage` with the Linux keychain refusal. Phase 1.5 added availability and missing-mods badges, owner-only view counts, and split offline from service-busy. Worker side (migration 0005, `revalidateMods` cron, `ViewCounterDO`) is written but deployed nowhere: see REQ-social-service-disposition |

---

## v1 Requirements

### Verification

- [ ] **REQ-ingame-verification-sweep**: Every path that has only ever been proven by unit tests is exercised against a running Deadlock build and the result is recorded. Covers: forging one sound and one texture into a single VPK and mounting it; cancelling the native save dialog and confirming Installed is untouched; the forge-install path end to end including rollback when slot allocation or metadata fails; mounting a merged VPK built from a reviewed source order; confirming an `AssetSourcesPanel` audition of an installed VPK matches what the engine plays and that a re-forged swap sounds identical; hero, voice, and global sound cases against a downloaded third-party mod, a forged mod, a disabled mod, and a multi-clip pool; and where the `minimap` and `small` portrait variants actually appear, so each gets an honest `VARIANT_LABEL`. **Amended 2026-08-06 (D-19 to D-23):** "against a running Deadlock build" narrows to the 18 rows that genuinely need the engine, which are the 16 ConVar readings and the two portrait-variant clauses. The other 23 rows are settled against the running app over CDP by `pnpm verify:in-app`, asserting bytes and app state rather than perception, and the 18 engine rows carry a `deferred` verdict with a per-row reason. This requirement is satisfiable without a game session, and the record states in its own preamble that an app-tier pass does not prove the engine loads what Grimoire wrote. **Further amended 2026-08-06 (D-24), after verification:** of the 23 app rows, 16 pass and 7 remain `blocked` with per-row reasons. Two of those, IG-01 and IG-02, back ROADMAP Success Criterion 1 and are accepted as outstanding for this phase by explicit decision rather than by default: IG-01 needs the fork's locally-built vpkmerge engine for its texture half, and IG-02 needs a main-process hook to cancel the native save dialog. They stay `blocked` rather than becoming `deferred`, because `deferred` is legal only on an engine row (D-22) and these have a runner that could settle them once those two pieces exist.
- [ ] **REQ-renderer-test-harness**: The renderer lanes that shipped with pure-model coverage only get tests that actually render them. Vitest runs in a node environment with no DOM today, so the pool cards, the alternatives gallery, the audition preview, the sound trim/gain badges, the seeded `SoundImportEditor`, and the portrait editor have never been rendered by any check. Includes the Chat Wheel `chat-wheel:read` and `chat-wheel:starter` VPK round trip, which is untested at the service level.
- [ ] **REQ-rigged-preview-release-gate**: A human measures frames per second on Seven (`gigawatt_prisoner`), the worst case on every axis, with `Preview > Debug > Rigged` on and Cloth off, per section 8 of `docs/rigged-preview-spike.md`, and the ship / gate / per-hero recommendation is written down and applied. The report's frame-budget figure is an arithmetic estimate and is labelled as one; no fps number exists and none can be produced headlessly. **Amended 2026-08-06 (D-21, D-24):** the final clause was wrong. A rAF sampler driven over CDP against a dev slot produces exactly that number, so this stopped being a human checkpoint. Measured on Seven: static and rigged wall-clock medians both 8.30 ms (pinned to a 120 Hz vsync ceiling, which is why the wall figure alone proves only that neither path missed its deadline), and GPU timer medians of 1.67 ms static against 1.79 ms rigged, a delta of +0.12 ms, well inside the ship band. `RELEASE_RENDER_FLAGS.rigged` is now `true`. RP-03 names the measuring machine, an AMD Radeon RX 7900 XTX on Windows 11 Enterprise 10.0.26220, because a frame-time delta is a fact about one machine and the bands were written for mid-range hardware.
- [ ] **REQ-performance-convar-safer-experimentation**: The eight advanced ConVar game defaults are read off a running Deadlock build rather than carried over from the renderer constant that held them, and the eight HUD toggles get a real `gameDefault` instead of null. Today a wrong number badges an untagged stock line as "Your override", and an unset toggle is badged honestly but cannot preview what the game will do. Check `citadel_damage_offscreen_indicator_disabled` first: it is an inverted flag. Data-only once someone reads the console. **Amended 2026-08-06 (D-19 to D-23):** the app-side half shipped in Phase 1: `engineDefault` now exists beside `gameDefault` through the ConVar catalogue, `computeConvarStates`, and the value-state badge, so the catalogue has somewhere to hold what the engine reports. The readings themselves are the 16 `engine`-tier rows CV-01..16, which come from the developer console of a running build and nowhere else; each carries a reasoned `deferred` verdict. This requirement is structurally complete and data-outstanding: nothing more can be built for it until someone reads those 16 values off a running Deadlock.

### Release integrity

- [ ] **REQ-packaged-fork-engine**: A checksum-pinned `onionviolet/vpkmerge` release is promoted in `scripts/fetch-vpkmerge.mjs` and `.github/workflows/release.yml`, replacing the stock v0.19.0 bootstrap, and a packaged Windows build reports that engine version in Settings. The stock asset predates the YCoCg icon fix, so a packaged icon replace garbles or not depending on which icon the user drops on: 197 of 12,561 pak textures are DXT5-YCoCg and they are mixed inside the item-icon category, not absent from it. The packaged smoke is: open Global sounds, confirm `catalog globalsounds`, replace a normal icon and a DXT5-YCoCg icon, read the engine version.
- [ ] **REQ-fork-support-destination**: No fork-owned surface sends a user to the upstream project's support channel. `src/components/UpdateModal.tsx` currently links the main Grimoire Discord, where a fork user could ask for help nobody there can give. Decide the fork's support destination first (or omit the link), then apply that decision consistently. Attribution and the Ko-fi label stay as the third-party-notices ADR requires: they belong to upstream and must say so.
- [ ] **REQ-upstream-merge-aug-2026**: Phases B and C of the temporary ops plan. `structural-refactor-7` is 5 ahead and 38 behind and still holds unmerged work; fold it into `main`. Fast-forward and delete `dev-slot-seeding`, then delete the branches that are fully merged (ahead 0, so deleting discards nothing). Retire `docs/merge-plan-upstream-2026-08.md` once Phase C is done and pushed. Phase A landed; re-verify with `git fetch --all --prune` before starting.
- [ ] **REQ-social-service-disposition**: Decide which Worker a shipped installer points at, and make the client honest about it. Three options are on the table: fork `grimoire-social` to `onionviolet` (repoint the sibling remote, `ci.yml`'s hardcoded checkout, and the baked `GRIMOIRE_SOCIAL_BASE_URL`, then deploy **with migration 0005 applied first**, because the profile routes select its columns and will 500 without it), offer the cron and view counter upstream as a pull request, or leave the surface dormant and say so. Three commits sit unpushed in `../grimoire-social` and `ProfileDetailWithAvailability` is the shim holding CI together; note that `pnpm typecheck` resolves the sibling from disk and stays green while CI fails. Includes two client-side items that only matter once a service is chosen: rendering GameBanana's own mod titles in the gone-mods list in place of the `GameBanana: #123, #456` tooltip, and the TOS gate drift (the design puts it at first login, the code fires it at first publish and stores acceptance in localStorage, which is per-machine and clearable). The TOS gate is a decision, not a bug: move the gate or correct the design doc, do not let an implementer pick.
- [ ] **REQ-experimental-gate-and-doc-drift**: Experimental surfaces are gated where it counts and the docs stop claiming things the code forbids. The Chat Wheel experimental gate is enforced on the sidebar entry but not on the route itself, so the route is reachable with the setting off. `docs/profile-spec.md` line 3 markets the format as portable "between mod managers", which `CLAUDE.md` forbids claiming.

### Foundry build contract

- [ ] **REQ-foundry-forge-edit-kinds**: `FoundryForgeEdit` admits recolor and model edits, so a recolor can enter a combined build instead of being refused by the tray. Today the union is `sound | texture` only. `foundryForge.ts` would also misalign its `built` array against `request.edits` if a third kind were added, because only sound and texture push; fix the loop when the union widens, or keep the type preventing it.
- [ ] **REQ-foundry-sound-shuffle-surfacing**: The existing hero sound launch-shuffle controls are reachable from Foundry with a link back to the Locker, so a user is not sent to a different page to manage a pool they are looking at. Global-sound shuffle is already safe: the event-level persisted pool that was its precondition now generalizes to any asset path.
- [ ] **REQ-foundry-pool-audition-fidelity**: Auditioning a randomizer pool plays every clip in the pool. `useClipPlayer` plays `vsnd[0]` only, and 35% of indexed global events carry more than one clip (max 58), so today's audition hides most of what a pool actually sounds like. The swap itself is unaffected: it runs `--pool all`.

### Locker and Foundry parity

- [ ] **REQ-locker-foundry-parity-lanes**: Lanes 2 to 5 of the parity plan, on the thesis that Locker and Foundry are one object at two moments and each learned only half of the same lesson. Lane 2: Foundry gets the Locker's 3D preview over ad-hoc VPK pose sources, so a staged visual edit is visible on the model before forging. Lane 3: Locker gets Foundry's pre-write disclosure, so an action that overwrites says so first. Lane 4: portrait family handling in Locker and Foundry image sourcing without a file drop. Lane 5: `FoundryHeroGrid` gets the Locker grid's state (favorites, per-hero change counts).
- [ ] **REQ-locker-model-as-stage**: Opening a hero makes the model the page rather than a widget in the corner, and the user can make it do things: play an ability, see the particles that ship with that skin, hear the sound that skin replaces. Everything needed is in the tree and mostly switched off: `ParticleEffect.tsx` renders particle layers behind `USE_EFFECT_PREVIEW = false`, the viewer's `AnimationMixer` plays exactly one clip, and the backend can already enumerate a model's clips. **Competing variant with REQ-locker-foundry-shared-hero-frame** (delivered): making the model the page rebuilds the chrome that frame just froze. Do not assume an outcome.

### Inventory and journey coherence

- [ ] **REQ-global-inventory-coherence**: Global reads as one inventory. It may use an `All content | Visuals | Sounds` filter, but it must not strand someone in an empty sound category while hiding installed global content. Open layout defects re-confirmed live after the classification fix: empty categories still render (`Announcer 0`, `Ambience 0`), the Visuals rail still shows sound-shaped buckets, the header reports `20 mods` on Visuals against `15 mods` on Sounds for one inventory, and `Pak92`/`Pak93` are unusable as list entries. The source is decision-gated and says "do not merge the surfaces yet": compare the existing flows and prototype one shared shell before moving data or deleting a route. **Competing variant with REQ-sound-locker-surface.**
- [ ] **REQ-sound-locker-surface**: A Locker-style home for installed sound mods at its own route (`/locker/sounds` with `/locker/sounds/hero/:hero` and `/locker/sounds/global`), on the reasoning that global sound content has no home at all. **Competing variant with REQ-global-inventory-coherence, and the one place the record is not neutral:** this route was built and then folded back into the Locker shell, because two hero grids for one hero's content was the distance the lane set out to remove. `SoundLocker.tsx` is now `GlobalSoundShelf` inside the Global drill-in and the legacy URLs are rewritten by `legacySoundTarget`. The requirement is kept open because whether the route should survive is exactly the contested question, not because the route is missing. Its inventory model, rows, audition, and exact-entry inspection are delivered and are not in dispute.
- [ ] **REQ-portrait-journey-consolidation-gated**: Portraits get a single understandable journey before their code is consolidated. Locker's installed portrait management and Foundry's catalog, crop, and build work may remain separate implementations behind a shared hero shell; a full merge is an option to evaluate, not an assumption. Decision-gated: compare the flows and prototype one shared shell before moving data or deleting a route. **Competing variant with REQ-portrait-shelf-cards-ownership and REQ-portrait-randomization-home, both of which are delivered**, which means the "build into `HeroCardPicker` now" side has already run and the journey question is now about what to do next, including whether the deliberate two-control randomization split (`cardShuffleIncluded` in Locker Cards, `foundryShuffleIncluded` in Foundry `My changes`) stays.
- [ ] **REQ-portrait-alias-sweep**: The one remaining path to a root cause on issue #4 ("Abrams Portraits resolves to no families"), written while the defect is not reproducing. The three-way test holds two facts side by side per hero: what `resolvePortraitHero` and `portraitCodenamesForHero` return, and which codenames the loaded catalog actually contains. Verdicts: in-catalog and unresolved is an alias miss; not-in-catalog and resolved means the empty state is honest; resolved with zero families means `portraitFamilyKey` is wrong; neither means the hero is absent from this build. Leg A (alias-table self-consistency) is safe to run alongside other work; Legs B and C need a committed working tree because the dev-driver drives the working tree.
- [ ] **REQ-ui-consequence-and-vocabulary**: Lanes 9 and 10 of the consistency pass, the two still open. Undo for reversible bulk actions using the state the store already holds and the toast stack that already exists; every disabled control states its blocker (extended past Locker and Foundry to Profiles apply, Conflicts resolve, and the Foundry forge and install path); pending work preserves the prior answer instead of blanking it; provenance is one phrase and one target (`/?focusMod=<id>`) everywhere. Then one term each for enabled/disabled, installed/staged/forged, and active/selected/applied, one empty-state shape (what is missing, why, next action), and one error shape distinguishing "not indexed", "loading", and "failed" rather than collapsing all three into "nothing found". Fix the vocabulary at the catalog before touching call sites.

### Companion browser

- [ ] **REQ-browser-tool-catalog**: The in-app browser's destinations become a maintained catalog rather than the nine-entry `SHORTCUTS` array hardcoded at the top of `src/pages/Browser.tsx`. Pimp My Hideout (`https://xkitkatcat.github.io/pimpmyhideout/`) is in it. Every existing entry is loaded once and either kept, corrected, or removed with the result recorded, because a bookmark list rots silently and nothing in the app notices: `deadlocked.wiki` in particular needs checking against `deadlock.wiki`, which is the domain search results return. Each entry declares what kind of destination it is (mod host, reference, tool that produces a file, community feed) so the UI can group them and so a handoff keys off the kind rather than a URL match. The existing `nsfw` flag and its tie to `browseNsfwContentMode` are part of the entry shape, not a special case bolted on. Whether crosshair generators belong at all is open, because Grimoire ships its own Crosshair Designer and a second answer to the same question is a UX cost, not a feature.
- [ ] **REQ-browser-produced-file-handoff**: A file a community tool builds inside the in-app browser reaches Grimoire instead of the system browser's Downloads folder. Today `guest.session.on('will-download')` in `electron/main/index.ts` calls `event.preventDefault()` and hands the URL to `shell.openExternal`, so the VPK that Pimp My Hideout's `Build VPK` button produces leaves the app and the user re-finds it by hand. Two constraints bound the fix. First, the webview hardening in `will-attach-webview` does not weaken: the guest keeps no preload, no Node integration, `sandbox` and `contextIsolation` on, its own `persist:grimoire-browser` partition, and an http(s)-only `src`. Second, the user is told what will be written and where before it is written, matching the pre-write disclosure the Foundry tray already gives, and a file that is not a VPK Grimoire can identify via `checkVpkFile` is refused with a stated reason rather than accepted and dealt with later. The genuinely unsolved part is that this tool builds its VPK client-side, so there is no URL to hand off and the bytes exist only inside an unprivileged guest.
- [ ] **REQ-browser-navigation-gaps**: The controls a user assumes a browser has and this one does not. `src/pages/Browser.tsx` has back, forward, reload/stop, home, an address bar, and open-externally, and nothing else: no find-in-page, no zoom, no history beyond the guest's own stack, and a `HOME_URL` hardcoded to `SHORTCUTS[0]` rather than chosen. Deliberately bounded, and the existing file comment states the boundary to hold: no tabs, no extensions, not a general-purpose browser. This requirement exists so those gaps are a recorded decision rather than an oversight, and it is the first thing to cut if the phase runs long.

---

## v2 Requirements

Acknowledged, tracked, not in the current roadmap.

### 3D preview

- **REQ-3d-preview-retarget-and-effects**: Rotation-only bind-pose animation retarget, ambient FX, and authentic ability casts. Unblocked but not started; no bone-map or retarget code exists. Start with a bone-map JSON for one pilot hero. Ambient FX is honestly a curated ~13-hero / ~32-effect feature, not an auto-discovered 2,147-effect one: the two real gates are child-system walking (`m_Children` is unresolved and the marquee effects are parent shells) and control-point feeds (most ambient effects `PositionLock` to non-CP0 points nothing drives on a static model). Exactly two effects render correctly standalone today. In-game APPLY via `.vnmclip_c` re-encode stays deferred; preview only.

### Authoring surface

- **REQ-chat-wheel-base-command-catalog**: Expose the base-game Chat Wheel option catalogue so users can browse the voice commands the game provides and choose which to unlock, via `override_bindable` and `override_ping_wheel_bindable`. Unknown YAML keys and command IDs must be retained byte-for-byte in a visible "Other commands in this file" group. Deferred behind REQ-experimental-gate-and-doc-drift and REQ-renderer-test-harness: Chat Wheel is still experimental with an untested VPK round trip, and adding surface area before hardening the existing one inverts the fork's own thin-slice rule.
- **REQ-agent-ui-lab**: An opt-in, allow-listed, loopback-only agent UI inspection surface inside the real Electron app, as a strictly narrower replacement for `scripts/dev-driver.mjs`. Deferred on the source's own open question: if the only consumer is ever a developer running the repo locally, dev-driver is cheaper and this is not worth building. Confirm that framing before the timeboxed Phase 0 spike, which must first prove that `sendInputEvent` delivers a trusted click and keystroke with the window unfocused and that the window can reach narrow widths with media queries firing.

### Merge composition

- **REQ-vpk-composition-review-and-recipes (milestones 3 to 5)**: Optional versioned merge recipe stored beside `MergedModInfo`; include/exclude/winner path policy compiled into a deterministic split and repack plan built to temp, validated, provenance-embedded, then atomically replaced; editable merged contents, content presets, rebuild diffs, and source-update review. Strictly ordered 4b then 4c then 4d. Assessed 2026-07-28 as the least important item on the board: pure groundwork for 4c and 4d with no standalone user benefit, and nothing breaks without it.

### Performance config

- **REQ-performance-convar-profiles-and-recovery**: Phase B intent profiles with an exact ConVar diff preview and named local profiles; Phase C timestamped snapshots with selectable rollback, a reviewed compatibility manifest checked on launch, an update-review state that preserves values but prevents writes for unverified keys, and a human-readable activity log; Phase D carefully expanded settings, each requiring live-build validation. Also the id-keyed multi-preset applier over the curated upstream presets. Deferred on unanswered review questions the source leaves open and on the fork boundary: upstream owns preset data and the applier's data model.

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Foundry models, VFX, and broad thumbnail browsing (slice G) | Blocked on a trustworthy path catalog. The Phase 2 dependency is satisfied; that is not a reason to start |
| Social phase 2 (comments, search, follows, collections, Discord OAuth) | Moderation cost postponed deliberately. Re-decide before starting; do not drift into it |
| Admin analytics dashboard | Listed in the social Phase 1.5 doc, deliberately outside that wave's scope, and nothing depends on it |
| Generic ingestion of arbitrary GameBanana `gameinfo.gi` configs | Recorded research shows it cannot be made safe or low-maintenance: no reliable baseline, every config carries a full FileSystem/SearchPaths block, machine-specific `video.txt`, boolean-encoding chaos, and configs that disagree and contain author bugs |
| `video.txt` auto-apply | Machine-specific; guided merge only |
| A general raw-ConVar editor as the default experience | If expert editing is ever added it goes behind a warning, in its own marked managed block, preserving user configuration verbatim, with diff and rollback |
| Locker overflow renderer polish (W11) | Marked optional in its own spec; only if a user-visible problem appears |
| A universal preference framework | `uiPrefs` is a typed wrapper over the keys that already exist, not a new abstraction to grow into |
| A general design-token or component-library refactor | The consistency pass makes existing surfaces agree with each other; it does not introduce a new system for them to agree with |
| Changing sound inventory resolution, ownership, conflict, or load-order semantics | `buildSoundInventory` and `SoundEntryRow` are load-bearing and stay as they are |
| Cross-manager interop claims for the portable profile format | `CLAUDE.md` forbids claiming compatibility with other mod managers, whatever the schema permits |
| Hosting a Deadworks game server | Joining is fully cross-platform; hosting requires Windows and is not this app's surface |
| `codex/chat-wheel-tab` as recovery material | Compared with `main` it removes Chat Wheel and many other fork features. It is an old reductive experiment, not a feature branch to merge |
| Engine-side catalog gaps (base-inherited sound events, ability display names, non-power-of-two crop) | Real, but they live in the sibling `vpkmerge` repo (`catalog.rs`, `portrait.rs`, a fuzzy icon-to-vdata join), not in this one. Track them there |

---

## Contested Variants

Three scopes carry competing acceptance criteria from two documents at equal precedence. **They are preserved, not merged, and no phase assumes an outcome.** Each routes to `/gsd-discuss-phase` on the phase named below.

| # | Question | Variants | Decided in |
|---|----------|----------|------------|
| 1 | Where does installed global sound inventory live? | REQ-sound-locker-surface (a dedicated `/locker/sounds` route, built then folded back) vs REQ-global-inventory-coherence (no new surface until the flows are compared and one shared shell is prototyped) | Phase 5 |
| 2 | Is the portrait and Cards journey defined before or after its code consolidates? | REQ-portrait-shelf-cards-ownership + REQ-portrait-randomization-home (build into `HeroCardPicker` now, both delivered) vs REQ-portrait-journey-consolidation-gated (define the journey first, a full merge is an option to evaluate) | Phase 5 |
| 3 | What is the Locker hero page's target state? | REQ-locker-foundry-shared-hero-frame (extract today's chrome verbatim into a shared frame, delivered) vs REQ-locker-model-as-stage (make the 3D model the page, which rebuilds that chrome) | Phase 4 |

Variant 3's declared sequencing hazard has partly resolved itself: `HeroDetailFrame` shipped, so it no longer blocks parity lanes 2 to 5. The disagreement about the end state is untouched, and Foundry currently inherits chrome that one of the two variants wants to move away from.

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| REQ-ingame-verification-sweep | Phase 1 | Pending |
| REQ-renderer-test-harness | Phase 1 | Pending |
| REQ-rigged-preview-release-gate | Phase 1 | Pending |
| REQ-performance-convar-safer-experimentation | Phase 1 | Pending |
| REQ-packaged-fork-engine | Phase 2 | Pending |
| REQ-fork-support-destination | Phase 2 | Pending |
| REQ-upstream-merge-aug-2026 | Phase 2 | Pending |
| REQ-social-service-disposition | Phase 2 | Pending |
| REQ-experimental-gate-and-doc-drift | Phase 2 | Pending |
| REQ-foundry-forge-edit-kinds | Phase 3 | Pending |
| REQ-foundry-sound-shuffle-surfacing | Phase 3 | Pending |
| REQ-foundry-pool-audition-fidelity | Phase 3 | Pending |
| REQ-locker-foundry-parity-lanes | Phase 4 | Pending |
| REQ-locker-model-as-stage | Phase 4 | Pending |
| REQ-global-inventory-coherence | Phase 5 | Pending |
| REQ-sound-locker-surface | Phase 5 | Pending |
| REQ-portrait-journey-consolidation-gated | Phase 5 | Pending |
| REQ-portrait-alias-sweep | Phase 5 | Pending |
| REQ-ui-consequence-and-vocabulary | Phase 5 | Pending |
| REQ-browser-tool-catalog | Phase 6 | Pending |
| REQ-browser-produced-file-handoff | Phase 6 | Pending |
| REQ-browser-navigation-gaps | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 22 total
- Mapped to phases: 22
- Unmapped: 0 ✓
- Delivered (not phased): 27 entries
- Deferred to v2: 5

---

## Provenance

Requirement IDs matching `.planning/intel/requirements.md` were synthesized from 13 PRD-classified docs. The following IDs were derived directly from the nine documents the ingest held out of `.planning/intel/` because of three cross-reference cycles, and have no intel entry: REQ-ingame-verification-sweep, REQ-renderer-test-harness, REQ-rigged-preview-release-gate, REQ-packaged-fork-engine, REQ-fork-support-destination, REQ-social-service-disposition, REQ-experimental-gate-and-doc-drift, REQ-foundry-forge-edit-kinds, REQ-foundry-sound-shuffle-surfacing, REQ-foundry-pool-audition-fidelity, REQ-ui-consequence-and-vocabulary.

Held-out sources read directly: `docs/feature-status.md`, `docs/audit-2026-07-28-verdicts.md`, `docs/remaining-work-phases.md`, `docs/work-order.md`, `docs/foundry-handoff.md`, `docs/foundry-tab-design.md`, `docs/locker-consistency-pass.md`, `docs/ui-thoughtfulness-and-adjustability-plan.md`, `docs/rigged-preview-spike.md`.

Delivery status was re-verified against the working tree at v1.26.20 on 2026-08-05, not carried forward from any doc's status line. Several docs are stale in the code's favour: `docs/feature-status.md` gap 1d (updater pruning) and gap 2f (impostor surfacing and the `dmmMigration` hole) are both closed, `audioConversion.test.ts` exists, and `HeroDetailFrame`, `portraitInventory`, and `poseFailureStore` all shipped after their docs were written.

---
*Requirements defined: 2026-08-05*
*Last updated: 2026-08-05 after doc ingest and tree verification*
