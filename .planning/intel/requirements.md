# Requirements (PRD intel)

Synthesized from PRD-classified docs. `docs/feature-status.md` carries a manifest
precedence bump to 1 (delivery contract); it is NOT represented here because it
falls inside a detected cross-reference cycle and was held out of synthesis. See
`.planning/INGEST-CONFLICTS.md`.

Where two PRDs give non-identical acceptance for the same scope, both variants
are preserved under separate IDs and flagged as competing variants in the
conflicts report. They are not merged.

---

## REQ-3d-preview-shared-spine
- source: docs/3d-preview-fidelity-plan.md
- description: Stop baking away the model rig and stop discarding Source 2 material extras. Add a non-pose ("rigged") export variant that omits `--pose`/`--require-pose` so `to_glb_textured` emits the existing skinned and animated glb, wired to a parallel cache (sibling key `model-rigged.glb` with a separate version) so rigged and static glbs coexist under the LRU and the `grimoire-hero:` protocol. On the renderer side, detect a rigged glb, load it as `THREE.SkinnedMesh`, drive an idle/menu clip with `THREE.AnimationMixer`, and stop force-casting materials to `MeshStandardMaterial` so `userData.morphic` survives for the parity shader.
- acceptance: A hero plays its OWN idle clip on the turntable and materials keep their morphic extras. Graceful degradation: no skeleton or no clip falls back to static/2D without crashing. Status re-verified 2026-07-28: built (`heroPoseModels.ts` exports both the static `--pose` bake and a rigged export keeping skeleton, skin, and one ranked animated clip).
- scope: Locker 3D hero preview, glb exporter, rigged export, HeroPoseViewer

## REQ-3d-preview-material-parity
- source: docs/3d-preview-fidelity-plan.md
- description: Reach Source 2 material and lighting parity in the Locker preview, staying on Three.js + @react-three/fiber via custom GLSL injection rather than switching to Babylon or a native embed. Bake 1-2 IBL probes via `cubemap.rs`, ship the `.hdr` faces, set `scene.environment` via a shared PMREM singleton, apply an ACES/Hable tonemap at ~0.8 exposure, enable `vertexColors` where present, and let GLTFLoader auto-upgrade the KHR sheen/glass/unlit/emissive extensions.
- acceptance: Closes the bulk of the perceptual gap between preview and in-game. Depends on the shared spine. Status re-verified 2026-07-28: built (`src/lib/deadlockMaterial.ts`, `src/lib/source2Preview/`, with tests).
- scope: Source 2 material parity, IBL cubemap, tonemapping, Three.js renderer

## REQ-3d-preview-npr-and-cloth
- source: docs/3d-preview-fidelity-plan.md
- description: Add NPR cel/rim/tint via `three-custom-shader-material` chunk injection gated on `userData.morphic` (preserving PBR, IBL, sheen, and the skinning chunk so materials stay SkinnedMesh-safe), and renderer-side verlet cloth/jiggle simulation on `$cloth_m0p*` chains.
- acceptance: Status re-verified 2026-07-28: both built (`src/lib/source2NprMaterial.ts` tested; `src/lib/useClothSim.ts` plus `clothMath.test.ts`, `feModel.test.ts`, and solver-stability harness tests). Known ceilings: cel constants are engine-global and hand-tuned against screenshots; Valve's cloth stiffness/damping (DSTF) is undecoded and hand-tuned.
- scope: NPR cel/rim/tint, cloth/jiggle simulation

## REQ-3d-preview-retarget-and-effects
- source: docs/3d-preview-fidelity-plan.md
- description: Phases 5-7: animation retargeting (rotation-only bind-pose retarget), ambient FX, and authentic ability casts in the Locker preview.
- acceptance: Not started as of 2026-07-28. No bone-map, retarget, or pre-baked-clip code exists. No longer blocked on the rigged spine. Known ceilings: in-game APPLY (`.vnmclip_c` re-encode) is hard and deferred; model-spawning particles are pre-bake-only.
- scope: animation retargeting, ambient FX, ability casts

## REQ-agent-ui-lab
- source: docs/agent-ui-lab-plan.md
- description: Build an opt-in Agent UI Lab inside the real Electron application so a local AI agent can inspect and operate Grimoire's actual rendered UI, for UI quality assurance (responsive layouts, keyboard focus, empty/loading states, normal app-owned workflows). It is a strictly narrower replacement for `scripts/dev-driver.mjs`, not additive capability: allow-listed structured commands instead of arbitrary renderer eval, a revocable runtime user toggle instead of a launch-time env var, and a loopback-only control plane. It must not expose the Electron preload API, provide arbitrary code execution, direct IPC access, filesystem access, or unattended destructive operations.
- acceptance: Phase 0 derisking spike (timeboxed to a day) must first confirm (1) `webContents.sendInputEvent` delivers a real click and keystroke at viewport coordinates with the window unfocused, trusted enough for React handlers and native focus movement; (2) the `BrowserWindow` can genuinely reach target narrow widths with `minWidth` temporarily relaxed and CSS media queries firing; (3) a usable accessible name can be derived for Grimoire's icon-only controls without a heavy a11y library. If (1) or (2) fails, the core promise does not hold and the design must change before phase 1. The user-facing toggle ("Allow local agent UI inspection") requires Developer Mode, shows active/inactive state with an expiry/inactivity countdown and a Disconnect control, provides a copyable local connection command only while active, keeps port/token/session details in memory and never persists them, and auto-disconnects on toggle-off, quit, token expiry, or inactivity. Persistent setting is `experimentalAgentUiLab?: boolean`. Non-goals: a general-purpose browser-automation framework, testing main-process behavior, cross-machine control, or replacing Vitest.
- scope: Agent UI Lab, Electron renderer UI, dev-driver.mjs, user-facing toggle, input synthesis, viewport resizing, accessible-name extraction
- open question (unresolved in source): whether dev-driver survives alongside the Lab or the Lab replaces it. The doc states that if the only consumer is ever a developer running the repo locally, dev-driver is cheaper and this plan is not worth building, and that the framing must be confirmed before starting.

## REQ-chat-wheel-base-command-catalog
- source: docs/chat-wheel-option-catalog-plan.md
- description: Expose the base-game Chat Wheel option catalogue so users can browse the voice commands the game provides, see which are normally available, and explicitly choose which to unlock for the stock and ping wheels, via the two YAML fields `override_bindable` and `override_ping_wheel_bindable`. The existing custom-menu editor stays intact. This is a catalogue and override editor, not a replacement for the game's own Chat Wheel settings; the game remains where users assign enabled commands to wheel slots. Slices: capture and own the command catalogue as versioned data tied to the bundled ChatLane release (`src/lib/chatWheelCommands.ts`, typed readonly, stable command IDs that are not the command text); parse and write both override maps safely; build a browsable `BaseCommandCatalog.tsx` panel with search, category filters, per-row "Chat Wheel / bind" and "Ping wheel" controls, and a legend for inherited/enabled/disabled; integrate as a separate collapsible section without disrupting custom menus.
- acceptance: A user can search every catalogued base command, understand whether it is normally available, change either override without touching YAML, and reopen a saved VPK with all known and unknown overrides preserved. Custom menus, the radial preview, and Advanced YAML retain their current behavior. Unknown YAML keys and unknown command IDs are retained byte-for-byte and shown in a visible "Other commands in this file" group. Gates: `pnpm i18n:check`, focused Chat Wheel tests, `pnpm typecheck`, `pnpm lint`, `pnpm test`, plus a manual in-game confirmation that an unlocked command appears in Deadlock's Chat Wheel settings and survives reopening the generated VPK.
- scope: Chat Wheel editor, base command catalogue, override_bindable, override_ping_wheel_bindable, ChatWheelModel, Advanced YAML, BaseCommandCatalog panel, ChatLane CLI

## REQ-foundry-vpk-identity-gate
- source: docs/foundry-changes-parallel-plan.md
- description: Lane A. Stop installing files that are not VPKs. Every install path currently checks only the filename extension (`lower.endsWith('.vpk')`) while the app already validates the magic on merge output (`VPK_MAGIC = 0x55aa1234`). Add a single shared validator (magic + version) in `services/vpk.ts` and call it from every path that adopts a file as an installed mod: custom import, archive extraction results, one-click install, drag-drop, and the `resolveVpkIdentity` adoption path, rejecting with the detected type by name. When extraction yields an archive containing exactly one VPK, install that VPK rather than the archive. Add a startup reconcile that flags already-installed impostors and offers extract-and-repair, without auto-deleting.
- acceptance: No non-VPK can be installed; existing ones are surfaced. Tests: a ZIP and a 7z renamed to `_dir.vpk` are both rejected; a real v1 and a real v2 VPK are both accepted; an archive wrapping one VPK installs the inner file; the reconcile reports an impostor without removing it. Grounded in a 2026-07-29 live drive of a 131-mod library where six installed "mods" were 7-Zip or ZIP archives renamed to `*_dir.vpk` and had never worked.
- scope: Foundry, VPK identity validation, install/import paths, impostor reconcile

## REQ-foundry-scoped-source-blocking
- source: docs/foundry-changes-parallel-plan.md
- description: Lane B. Block the ambiguous action, not the whole panel. `AssetSourcesPanel` currently derives one `blocked` flag from `unreadableMods.length > 0`, and `inspectFoundryAssetSources` adds a mod to `unreadableMods` before any path matching, so an unreadable VPK unrelated to the inspected asset disables every action app-wide. Split the gate by what each action depends on: allow enabling/disabling a listed source (its identity is known), keep "create a replacement" gated (the resulting winner is what is ambiguous). Make the warning actionable by naming the unreadable mods and offering a way to reach them in Installed.
- acceptance: A readable source stays actionable while an unrelated mod is unreadable; the replacement path stays blocked; the warning lists every unreadable mod. Do not guess whether an unreadable VPK could matter; state the uncertainty precisely.
- scope: Foundry, AssetSourcesPanel, source gating

## REQ-foundry-grouped-pool-view
- source: docs/foundry-changes-parallel-plan.md
- description: Lane C. Add a pool-first mode to `MyChanges` (a view toggle beside the sort control) rendering one card per contended-path pool from the existing `groupFoundryShufflePools(mods)`: the shared paths, each member as an alternative, the current runtime winner marked, and a pool-level shuffle opt-in that toggles every member at once. Keep the flat list as the default. Reuse the existing winner resolution rather than recomputing it.
- acceptance: A pool reads as one unit with its members and winner. Pool cards match `groupFoundryShufflePools` exactly; the pool-level opt-in adds every member; a single-member pool renders in a reduced form with a stated reason. Lane D (alternatives gallery with thumbnails per pool member) waits for this lane's pool component to exist.
- scope: Foundry, MyChanges pool view, alternatives gallery

## REQ-foundry-portrait-editor-and-sound-surfacing
- source: docs/foundry-changes-parallel-plan.md
- description: Lane E: a portrait editor owning crop/fit/variant authoring before staging, without touching the staging contract in `visualEdits.ts`. Lane F: surface sound tooling at row level in the sound browser, without touching `SoundImportEditor` internals.
- acceptance: Lane E is done when what you see is what the card shows. Lane F is done when trim/gain/loop are visible without opening Swap. Lanes A, B, C, E, F run concurrently; D waits for C.
- scope: Foundry, portrait editor, sound browser

## REQ-global-inventory-coherence
- source: docs/global-locker-foundry-ux-plan.md
- description: Make Global feel like one inventory. It may use an `All content | Visuals | Sounds` filter, but it must not strand someone in an empty sound category while hiding the global content that is already installed. The current layout is technically one Global drill-in with `Visuals | Sounds` tabs, but it still reads as two disconnected areas because the Sounds tab starts on an empty category and hides both the global inventory and the reason a category exists.
- acceptance: This document is decision-gated and explicitly states "do not merge the surfaces yet": first compare the existing flows, then prototype one shared shell before moving data or deleting a route. Open layout defects re-confirmed live after the classification fix: empty categories still render (`Announcer 0`, `Ambience 0`); the Visuals rail still shows sound categories and the header reports `20 mods` on Visuals against `15 mods` on Sounds for one inventory; `Pak92`/`Pak93` are unusable as list entries.
- scope: Global inventory, Locker, Foundry, Visuals/Sounds tabs, globalType buckets

## REQ-global-sound-taxonomy
- source: docs/global-locker-foundry-ux-plan.md
- description: `Shared` and `Shared melee` must not be user-facing categories. "Shared" means only that the classifier saw `shared`, `generic`, or `common` in a name and could not say what the sound is; that is an implementation fallback, not a content type. Every player melee/punch event belongs in **Melee**. Truly unclassified files need an explicit review state, not a vague `Other` bucket. Classification must be driven by what mods write (the VPK entry list) rather than what they were called.
- acceptance: FIXED in Pass B (`a87eb6e`, "classify global sounds on what mods write, not what they were called"). Closed defects 1, 2, and 3 (the Announcer dumping ground, the `Shared`/`Shared melee` leak, and the empty `NPC` category). Verified live against the same 15 installed mods: `Announcer 0 · Music 4 · Interface 1 · Ambience 0 · NPC 2 · Items 6 · Melee 2 · Needs classification 0`. `Shared`, `Shared melee`, and `Other` no longer exist as categories. No database migration was needed because classification is computed at render time.
- scope: sound categorisation, globalType buckets, Locker Global sounds

## REQ-portrait-journey-consolidation-gated
- source: docs/global-locker-foundry-ux-plan.md
- description: Portraits need a single understandable journey before their code is consolidated. Locker's installed portrait management and Foundry's game catalog/crop/build work may remain separate implementations behind a shared hero shell. A full merge is an option to evaluate, not an assumption.
- acceptance: Decision-gated. Compare the existing flows and prototype one shared shell before moving data or deleting a route.
- scope: portraits, Locker, Foundry, mod naming
- note: competing variant with REQ-portrait-shelf-cards-ownership and REQ-portrait-randomization-home (see conflicts report).

## REQ-locker-model-as-stage
- source: docs/locker-deep-dive.md
- description: Umbrella design direction (tracked as #15). A skin is three things: a body, a set of ability VFX, and a set of sounds, and the Locker shows a thumbnail of only the first. The target is that opening a hero makes the model the page rather than a widget in the corner, and that the user can make it do things: play an ability, see the particles that ship with that skin, hear the sound that skin replaces, and find out immediately when something is broken. Everything needed is already in the tree and mostly switched off: `ParticleEffect.tsx` renders particle layers but is gated behind `USE_EFFECT_PREVIEW = false`; the viewer's `AnimationMixer` plays exactly one clip; the backend can already enumerate a model's clips through `vpkmerge model clips --json`.
- acceptance: Reconciliation pass 2026-07-30: #13 (model panel dock modes and memory) landed via `853ba98`, shipping persisted open state, eight-way resize, and float / dock-left / dock-right, with per-surface storage keys and the three missing i18n keys. Still true and re-verified: `USE_EFFECT_PREVIEW` is `false`, `RELEASE_RENDER_FLAGS.rigged` is `false`, and `HeroPoseInfo` is still `{hasModel, mtimeMs, key}` with nowhere to put a failure reason.
- scope: Locker, 3D model panel, HeroPoseViewer, ability VFX preview, skin cards, hero backdrops
- note: competing variant with REQ-locker-foundry-shared-hero-frame (see conflicts report).

## REQ-locker-honest-failure-states
- source: docs/locker-deep-dive.md
- description: Warn when a skin model is not working in the Locker. Axis 4 of the deep dive: a badge on the skin card, keyed by `metaKey`, persisted so the mark survives navigation, self-healing on a later successful export, and written by `HeroPoseViewer` narrowing a stack failure to a single VPK (the narrowing being the non-obvious part).
- acceptance: In flight and uncommitted as of 2026-07-30: `src/stores/poseFailureStore.ts` is new and untracked, built the way the body argues for; `HeroPoseViewer.tsx` carries +107 lines against `main`. Tracked as #16.
- scope: Locker, pose failure states, skin cards

## REQ-locker-foundry-shared-hero-frame
- source: docs/locker-foundry-parity-plan.md
- description: Lane 1 (prerequisite for lanes 2-5). `src/pages/LockerHero.tsx` and `src/components/foundry/HeroWorkshop.tsx` render the same chrome around different sections and have drifted so that Foundry's version is visibly lower quality. Extract `src/components/common/HeroDetailFrame.tsx` owning exactly the shared chrome: the full-bleed right-anchored backdrop with Locker's four-step fallback chain (render, wiki, caller-supplied icon, text); Locker's three-blur masked frosted-glass stack verbatim, including the comment explaining why stacked blurs feather rather than cliff; the left rail with back button, hero name art with its text fallback, and a `<nav>` of caller-supplied section rows; the bottom depth gradient and the entrance animations. The frame must stay ignorant of both domains and must not import from `stores/appStore`, `types/mod`, or `types/foundry`. Port `LockerHero.tsx` first, then `HeroWorkshop.tsx`.
- acceptance: Both pages render the same frame and the drift is gone, without touching any section's contents or behaviour.
- scope: Locker, Foundry, HeroWorkshop, LockerHero, shared hero frame
- note: competing variant with REQ-locker-model-as-stage (see conflicts report).

## REQ-locker-foundry-parity-lanes
- source: docs/locker-foundry-parity-plan.md
- description: Sequential lanes 2-5 closing the quality gap, on the thesis that Locker and Foundry are one object at two moments (Locker manages what you have, Foundry makes more of it) and that each surface learned only half of the same lesson: Locker learned preview but applies every action immediately with no write set, collision report, or review; Foundry learned review (exact normalized write sets, ranked collisions, `foundryInspectAssetSources`) but the user authors everything blind. Lane 2 gives Foundry the Locker's 3D preview over ad-hoc VPK pose sources. Lane 3 gives Locker Foundry's pre-write disclosure. Lane 4 covers Foundry image sourcing without a file drop. Lane 5 gives `FoundryHeroGrid` the Locker grid's state (favorites, per-hero change counts).
- acceptance: Lane 2 done when a staged visual edit is visible on the 3D model before forging. Lane 3 done when a Locker action that overwrites says so first. Lane 4 done when Foundry can source an image without a file drop. Lane 5 done when a hero card shows what you have already made for them. Governing invariant for every lane: exact normalized VPK entry paths are the ownership key; labels, hero names, and mod metadata are never a substitute, and Installed/Locker remains the only authority for enabled state.
- scope: Locker, Foundry, HeroPoseViewer, FoundryHeroGrid, tray preview, VPK entry path ownership

## REQ-upstream-merge-aug-2026
- source: docs/merge-plan-upstream-2026-08.md
- description: Temporary ops plan (status: not started; delete once Phase C is done and pushed). Get the 10 new `upstream/main` commits into `main`, fold the one branch that still holds unmerged work (`structural-refactor-7`, 5 ahead / 18 behind) into `main`, fast-forward `dev-slot-seeding` (7 ahead, 0 behind) and then delete it, and delete the eleven branches that are already fully merged (ahead 0, so deleting discards nothing). Written to be executed with no prior context beyond `CLAUDE.md`: every command is literal and every non-mechanical judgment call is marked with a **STOP** marker.
- acceptance: State measured 2026-08-05 and to be re-verified with `git fetch --all --prune` before starting: last upstream commit already held `9d29dd8`, current `upstream/main` `14a6eb6`, 10 new upstream commits (74 files, +10477 / -3731), our `main` `8193f67` identical to `origin/main`, fork lead 225 commits / 390 files, fork version `1.26.20` against upstream `1.26.0`. Upstream PR numbers are deliberately stripped from the recorded subjects; the "refs:check" gate governs any commit message written.
- scope: upstream merge, branch consolidation, main branch, structural-refactor-7, dev-slot-seeding, refs:check gate

## REQ-performance-convar-safer-experimentation
- source: docs/performance-convars-followup-plan.md
- description: Phase A of the bounded HUD/minimap ConVar controls in the Performance settings card. Add a per-control "Reset to game default" action that removes Grimoire's override instead of choosing an app-defined value; show an explicit value-state badge (game default, managed preset, user override, or unsupported/out-of-range); warn before replacing an existing value outside the supported UI range and never silently clamp it; add a compact "changes pending" / applied-values summary so slider adjustments are auditable.
- acceptance: Status proposed; review and prioritize before implementation. Guardrails that bound every phase: expose only confirmed client-side, non-cheat, non-dev-only settings; exclude server, gameplay, networking, debugging, and competitive-integrity controls unless independently confirmed; keep all numeric inputs bounded and show the game default when no app override exists; patch only the managed ConVars block and retain user entries, surfacing a diff before broad changes; re-validate supported keys against a current Deadlock build after major game updates and disable obsolete controls rather than writing unknown keys. Suggested order: Phase A first, then the Phase B profile diff preview.
- scope: Performance settings card, HUD/minimap ConVars, gameinfo.gi

## REQ-performance-convar-profiles-and-recovery
- source: docs/performance-convars-followup-plan.md
- description: Phase B (profiles and visibility): a small set of reviewed intent profiles such as Competitive clarity, Maximum FPS, and Streaming-friendly; preview the exact ConVar diff before a profile applies, including values that will be removed to restore defaults; let users save a named local profile containing only supported controls; detect known hand-edited ConVars and classify them as managed, recognized but unmanaged, or unknown, never importing unknown values automatically. Phase C (recovery and compatibility): timestamped snapshots before each multi-value apply with a selectable rollback target; verify managed keys against the latest reviewed compatibility manifest on game launch or card open; an update-review state that preserves current values but prevents writes for keys unverified after a Deadlock update; a human-readable activity log. Phase D (carefully expanded settings) requires live-build validation and UX review per candidate control.
- acceptance: Open review questions the source explicitly leaves unanswered: which intent profiles are genuinely distinct and safe enough to support; whether saved local profiles ship before, after, or instead of built-in profiles; what snapshot retention limit avoids clutter; whether compatibility validation is manual per release or sourced from a signed/reviewed manifest; which visual-quality controls justify their support and testing cost. Avoid a general raw-ConVar editor as the default experience; if expert editing is ever added, put it behind a warning, isolate it in its own marked managed block, preserve all user configuration verbatim, and offer diff/rollback.
- scope: intent profiles, snapshots and rollback, compatibility manifest

## REQ-portrait-alias-sweep
- source: docs/portrait-alias-sweep-plan.md
- description: Plan of record for the one remaining path to a root cause on issue #4 ("Abrams Portraits resolves to no families"), written while the defect is not reproducing. Items 1 and 3 (root cause, regression test) are blocked on a reproduction that has not come back; the sweep is the only remaining work that could produce one, because it checks every hero with a codename mismatch instead of the single reported hero. The three-way test holds two facts side by side per hero: what `resolvePortraitHero`/`portraitCodenamesForHero` return, and which codenames the loaded catalog actually contains. Verdicts: in-catalog + unresolved = alias miss (the #4 hypothesis); not-in-catalog + resolved = not indexed (the empty state is honest); resolved but zero families = family key derivation is wrong, look at `portraitFamilyKey`; neither = hero absent from this build.
- acceptance: Leg A (alias table self-consistency, pure unit test extending `heroPortraitIdentity.test.ts`) is safe to run alongside other work in a worktree off a known commit; it cannot find an alias miss but catches collisions and typos. Leg B (catalog cross-check through the Foundry IPC `CatalogDiagnostics` already uses) is the leg that can find the root cause. Leg C (dev-driver verification across at least three heroes including Abrams, preferring `text`/`html` assertions over screenshots). Concurrency constraint recorded 2026-07-30: Legs B and C must wait for the working tree to be committed or stashed, because the dev-driver drives the working tree and there were uncommitted changes on this exact surface, and because a single dev server was already attached on ports 5173/9222.
- scope: portrait alias table, heroPortraitIdentity.ts, indexed portrait catalog, Foundry IPC / CatalogDiagnostics, dev-driver

## REQ-portrait-inventory-model
- source: docs/portrait-shelf-plan.md
- description: Lane 1. New `src/lib/portraitInventory.ts`, the visual sibling of `src/lib/soundInventory.ts`, folding `Mod[]` into per-hero portrait entries from signals already on `Mod`: `textureReplacement` (a one-entry forged portrait/icon replacement), recorded `foundryBuild` entries (a multi-part forged build's exact write set), and `lockerCosmetics` card selections. Entry shape mirrors `SoundInventoryEntry`: `key`, `modId`, `metaKey`, `name`, `enabled`, `priority`, `hero`, `variants`, `paths` (exact `.vtex_c` entries), `provenance`, `managed`.
- acceptance: Two rules carried over verbatim because they are what made the sound model honest: an entry whose paths are unrecorded reports `paths: []` rather than a guess, and `overlappingClaims` counts only enabled entries with recorded paths so it can only under-report, with `foundryInspectAssetSources` staying the authority. Tests in `portraitInventory.test.ts` with the same coverage shape as `soundInventory.test.ts` (multi-signal fold, alias collapse, disabled claimant ignored, no-overlap-from-unknowns).
- scope: Locker Cards section, portraitInventory.ts, hero portrait art

## REQ-portrait-shelf-cards-ownership
- source: docs/portrait-shelf-plan.md
- description: Lane 2 (depends on lane 1), all inside `HeroCardPicker`. Group the `HeroPortrait[]` tiles by `modFileName` and badge each group with its provenance and enabled state, joined from the inventory by metaKey. Per group, an expander that answers ownership the way `SoundEntryRow` does: feed `foundryInspectAssetSources` the family's exact entries from `getCustomCardSlots` and show the winner per variant with a jump to the winning mod. Add a section-level note when two enabled mods claim the same card entry. Deliberately no `/locker/portraits` route: portrait art is always hero-scoped and the Locker already has a per-hero Cards section, so a separate route would be the Cards section plus an extra click.
- acceptance: No new IPC; every call in this lane is one an existing surface already makes. Keep the existing coverage-gap warning exactly as it is, because it answers a different question (did you fill the family) and must not be merged with the ownership readout (does someone else own it). Verification: drill into a hero with more than one installed portrait mod, open Cards, and check with `text`/`html` that the winner readout names the same mod the Conflicts page does for the same entry. Gates: `pnpm exec vitest run`, `pnpm lint`, `pnpm i18n:check`.
- scope: Locker Cards section, HeroCardPicker, foundryInspectAssetSources
- note: competing variant with REQ-portrait-journey-consolidation-gated (see conflicts report).

## REQ-portrait-randomization-home
- source: docs/portrait-shelf-plan.md
- description: Lane 3 (depends on lane 2). Today a user randomizing portraits has two unrelated controls in two surfaces: `cardShuffleIncluded` in the Locker's Cards section and `foundryShuffleIncluded` in Foundry's My changes pool view. Surface the forged-portrait pools in the Cards section next to the card shuffle toggle by reusing `groupFoundryShufflePools` + `foundryShuffleKey` filtered to this hero's portrait entries, keeping the store field, the key function, and the launch-time roll exactly as they are. Leave the My changes pool view in place as the cross-hero view of the same data. Lane 4 (independent): verify empirically where the `minimap` and `small` variants appear in game and give each an honest `VARIANT_LABEL` with the raw token in a tooltip, saying so if a variant does not render anywhere the user can see.
- acceptance: Reuse, not a second mechanism. Do not invent the speculated "shuffle group" field: the pool partition over contended paths already groups exactly the right things and a second grouping concept would have to be kept in sync forever. No ownership inference from variant tokens: a token orders the strip and labels a chip, the entry path decides who owns what. Does not touch `prepareVisualStagedEdit` or the forge path.
- scope: Locker Cards section, foundry shuffle pools, VARIANT_LABEL variant labels
- note: competing variant with REQ-portrait-journey-consolidation-gated (see conflicts report).

## REQ-sound-inventory-model
- source: docs/sound-locker-plan.md
- description: `src/lib/soundInventory.ts` folds `Mod[]` into a sound inventory with one entry per **(mod, hero)** pair rather than per mod, because a sound mod can carry files for several heroes and must appear on every hero page it touches; a mod with no hero produces exactly one global entry. Each entry carries `modId`/`metaKey`/`name`/`enabled`/`priority`, `hero`, `scope`, `categories` (ability, voice, weapon, music, announcer, ui, other), `slots`, `events`, `paths`, `fileCount`, and `provenance` (locker, forged, downloaded, imported, third-party).
- acceptance: Untagged third-party sound VPKs are not dropped: they become global entries with category `other` and provenance `third-party`, because "I do not know what this writes" is a thing the surface must be able to say. A mod that is neither a sound mod nor sound-adjacent produces no entry at all. The Locker-managed sound VPK is included on purpose, one entry per hero it covers, flagged `managed`, because it is the mod that actually wins in game and hiding it would make the ownership readout a lie. Tested in `soundInventory.test.ts`.
- scope: sound inventory model, src/lib/soundInventory.ts

## REQ-sound-locker-surface
- source: docs/sound-locker-plan.md
- description: A Locker-style home for installed sound mods: `src/pages/SoundLocker.tsx` routed at `/locker/sounds` with `/locker/sounds/hero/:hero` and `/locker/sounds/global` drill-ins plus a `?hero=` query. Heroes are keyed by name, not GameBanana category id. A grid of one card per hero with sound-mod and enabled counts plus a Global card; hero pages using `HeroDetailFrame` with `Abilities`, `Voice`, `Weapon`, `Other` sections; rows with name, provenance chip, slot chips, enable/disable, and an expander resolving the exact write set and reporting the runtime winner per path via `foundryInspectAssetSources`; audition through `useClipPlayer` extended with an optional `sourceModId` so the player resolves the clip inside that mod's VPK; a section-level conflict note phrased from the winner readout rather than from labels. Plus cross-links to Foundry (`?section=`, a new `?tool=` query) and label quality helpers in `src/lib/soundLabels.ts` (`collapseTakes`, `preferredSoundLabel`).
- acceptance: The Sound Locker is the inventory surface and `HeroSoundPicker` stays the selection surface; the Sound Locker links into the picker rather than reimplementing it, and the picker is untouched. No sidecar service: every number comes from data already on `Mod` or an IPC call an existing surface already makes. No ownership inference from labels: where a write set is unknown the row says so. `collapseTakes` is deliberately not applied to the Foundry browse lists, because a browse row is a swap target and collapsing three swappable events into one row would make two of them unreachable. Governing invariant: exact normalized VPK entry paths are the ownership key, and Installed/Locker remains the only authority for enabled state.
- scope: Sound Locker, HeroSoundPicker, global sound mods, VPK entry paths, Locker hero page, Foundry sound-conflict inspector
- note: competing variant with REQ-global-inventory-coherence (see conflicts report).

## REQ-vpk-composition-analysis
- source: docs/vpk-composition-roadmap.md
- description: Milestone 1 (complete). Add an additive `analyze-merge` IPC endpoint reporting source order, parsed entry counts, total input size, collision paths, and which source wins under the same priority ordering the current merge uses. It must distinguish unreadable VPKs from an empty VPK and omit inert imprint metadata from collision totals. No existing merge invocation changes in this milestone.
- acceptance: The `analyze-merge` endpoint and its focused service tests exist; renderer review integration is the next user-visible step. Safety invariant: analysis is read-only, never reserving slots, writing metadata, changing `gameinfo.gi`, or moving a source. Unit tests cover path normalization, category grouping, priority winner selection, metadata exclusion, duplicate source detection, unreadable VPK reporting, and stable result ordering; service tests cover that analysis performs no writes.
- scope: VPK merge, analyze-merge IPC endpoint

## REQ-vpk-composition-review-and-recipes
- source: docs/vpk-composition-roadmap.md
- description: Milestones 2-5. Show analysis before confirmation with grouped collisions and the effective winner, letting users change source ordering in the new composition workflow while the legacy merge path retains its Deadlock-priority order (milestone 2). Introduce an optional versioned merge recipe storing source identities, order, and policy, persisted alongside existing `MergedModInfo` (milestone 3). Support include, exclude, and winner rules over normalized VPK paths/prefixes, compiled into a deterministic `vpkmerge` split/repack plan, built to a temp file, validated, provenance-embedded, then atomically replaced (milestone 4). Add editable merged contents, content presets, rebuild diffs, and source-update review, with recipe export/import extending portable profiles only through optional fields (milestone 5).
- acceptance: The roadmap is deliberately additive: existing `merge-mods`, `unmerge-mod`, `extract-merge-source`, and `add-merge-sources` IPC calls, existing merge metadata, and existing embedded `vpk-modinfo` records remain valid; old app versions ignore every new optional field and new versions treat absent fields as the current default (all source entries, priority-derived winner, non-strict merge). Safety invariants: a failed build never replaces a live merged VPK or disables a source; existing recipe-less merges remain editable, unmergeable, extractable, and rebuildable using their recorded source order; any new recipe is optional and versioned, and unknown recipe versions are displayed as unsupported rather than interpreted loosely; a client must feature-detect a newer API. Future rebuild tests must prove transaction rollback and legacy merge reconstruction.
- scope: merge recipe schema, prefix/path policy, composition UX, portable profiles, MergedModInfo, vpk-modinfo
