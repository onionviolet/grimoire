# Roadmap: Grimoire

## Overview

Grimoire is not short of features. Four waves of work landed through 2026-07 with a green repository gate and effectively zero in-game validation, so the app's largest risk is that nobody knows which of it actually works when Deadlock is running. This milestone runs that debt down first, then turns the result into a supported fork release, then closes the three real functional gaps that remain, and only then takes on the two UX questions that need a decision before they need code. The journey is: prove it, ship it, complete the Foundry's build contract, close the Locker and Foundry parity gap, and give global inventory one home and portraits one journey.

Two things shape the sequence more than feature value. First, doc status headers in this repo have drifted in both directions and work has been started three times on things that already shipped, so every phase below was checked against the working tree at v1.26.20 rather than against a doc's status line. Second, three product decisions are genuinely open and are carried as competing requirement variants; the phases that depend on them say so and name both sides rather than assuming an outcome.

**Milestone:** v1.27, "verified, supported, coherent". Delivery slices stay independently releasable: a slice is complete only when its data contract, UI, error and rollback behaviour, and automated checks land together. A visible control is not a substitute for the corresponding exact-path inspection or preflight.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Verified Against The Game** - Run the verification debt to zero: prove Foundry, merge, rigged preview, and the performance card against a running build, and make the untested renderer lanes testable (completed 2026-08-06)
- [x] **Phase 2: A Supported Fork Release** - Pin a fork engine, package and smoke it, own the support destination, consolidate the branches, and decide which social service a shipped installer points at (completed 2026-08-07)
- [ ] **Phase 3: Foundry Completes Its Build Contract** - Recolor and model edits can enter a combined build, sound shuffle is reachable from Foundry, and a pool auditions every clip
- [ ] **Phase 4: Locker And Foundry As One Object** - Foundry gets preview, Locker gets pre-write disclosure, portraits get variant awareness, and the hero grid shows what the user has made
- [ ] **Phase 5: One Inventory, One Journey** - Global reads as one inventory, portraits get a decided journey, the Abrams alias defect gets a root cause, and the consistency floor is finished

## Phase Details

### Phase 1: Verified Against The Game

**Goal**: Every path that has only ever been proven by a unit test is proven against the running app, driven end to end over CDP, and the lanes that shipped without any rendering check get one
**Depends on**: Nothing (first phase)
**Requirements**: REQ-ingame-verification-sweep, REQ-renderer-test-harness, REQ-rigged-preview-release-gate, REQ-performance-convar-safer-experimentation
**Success Criteria** (what must be TRUE):

  1. A VPK forged from one staged sound edit and one staged texture edit holds both entry paths with bytes matching their staged sources; cancelling the native save dialog instead leaves the mod library and the staged edits exactly as they were. **Amended 2026-08-06 (D-26), after verification:** both halves remain `blocked` in the record and the project accepts that for this phase rather than claiming the criterion met. The texture half needs the fork's locally-built vpkmerge engine (the bundled release binary refuses texture replacement without the YCoCg icon fix); the dialog half needs a main-process hook, because `dialog.showSaveDialog` cannot be cancelled from a CDP-driven script and faking it was rejected as dishonest evidence. The sound half and the surrounding forge-install paths are settled. These two stay `blocked`, not `deferred`, so the record keeps saying someone owes them
  2. A merged VPK built from a reviewed source order carries, at the contested entry, the bytes of the mod the review named as winner
  3. An installed VPK's audition clip is byte-identical to the entry it claims to play, across a downloaded third-party mod, a forged mod, a disabled mod, and a multi-clip pool, in all three scopes (hero, voice, global)
  4. Seven (`gigawatt_prisoner`) renders on the rigged preview with a frame rate measured by the driver on record, naming the machine it came from, and the ship, gate, or per-hero recommendation is written down and applied to the release flag
  5. The pool cards, alternatives gallery, portrait editor, seeded sound editor, and Chat Wheel VPK round trip each have a check that actually renders or exercises them
  6. `node scripts/check-verification-record.mjs --strict` exits 0 with no game session: 23 app-tier rows settled by `pnpm verify:in-app`, and 18 engine-tier rows (the 16 ConVar readings plus the two portrait-variant rows) carrying a `deferred` verdict with a per-row reason

**Plans**: 8/8 plans executed

Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Render harness tracer: pin jsdom behind a package-legitimacy gate, then drive the pool-cards and audition-preview lanes end to end under jsdom
- [x] 01-04-PLAN.md — Chat Wheel starter to VPK to YAML round trip against the real bundled converter, plus its rejection paths
- [x] 01-05-PLAN.md — Thread `engineDefault` beside `gameDefault` end to end and let the value-state badge report what the game will do
- [x] 01-06-PLAN.md — Scaffold the in-game verification record (41 rows, verdicts blank) and the guard that makes its completion rule executable

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — Render the alternatives gallery and the sound trim/gain badge lanes at interaction depth
- [x] 01-03-PLAN.md — Render the seeded SoundImportEditor and the portrait editor through stubbed canvas and Web Audio
- [x] 01-08-PLAN.md — Tier the verification record, build the CDP runner that settles its 23 app-tier rows, and defer the 18 engine-tier rows with reasons
- [x] 01-07-PLAN.md — Measure Seven on the rigged preview over CDP, record the recommendation, and apply it to `RELEASE_RENDER_FLAGS.rigged`

**Waves**: 1 = {01-01, 01-04, 01-05, 01-06}; 2 = {01-02, 01-03, 01-08}; 3 = {01-07}

**Notes**: This is the phase the docs themselves rank first: "four waves have landed with a green repository gate and zero in-game validation. That is the real risk on this board, and no amount of further code reduces it." If any check here fails, that failure outranks everything below it. **Amended 2026-08-06:** the claim that the sweep and the fps reading are human-gated held for the sweep's engine half only. `scripts/dev-driver.mjs` reaches the live renderer over CDP and the renderer exposes 266 `electronAPI` methods, so 23 of the 41 rows are settled by a script and the fps reading is a rAF sampler rather than a person watching DevTools. What stays genuinely human-gated is 18 rows: the 16 ConVar readings, which only a running developer console prints, and the two portrait-variant rows, which ask what the game's HUD and minimap actually draw. Those are deferred with reasons rather than blocking. The gap this accepts is stated rather than hidden: an app-tier pass proves Grimoire wrote the intended bytes to the intended path, not that the engine loads them. The renderer test work is the enabling half: Vitest runs in a node environment with no DOM today, so deciding how these components get rendered at all is part of the phase, not an afterthought.

### Phase 2: A Supported Fork Release

**Goal**: This fork can be handed to a user as a supported build, with a pinned engine, a support channel it owns, one clean branch, and a decided answer about the social service
**Depends on**: Phase 1
**Requirements**: REQ-packaged-fork-engine, REQ-fork-support-destination, REQ-upstream-merge-aug-2026, REQ-social-service-disposition, REQ-experimental-gate-and-doc-drift
**Success Criteria** (what must be TRUE):

  1. A packaged Windows build reports a checksum-pinned `onionviolet/vpkmerge` version in Settings, and replacing both a normal icon and a DXT5-YCoCg icon through it produces correct colours in game
  2. No fork-owned surface sends a user to the upstream project's support channel, while attribution and the Ko-fi label still say plainly that they belong to upstream
  3. `git branch` shows no branch holding unmerged work, the fully merged branches are gone, and the temporary merge plan document has been retired
  4. A shipped installer points at a social service someone has decided on, and no surface advertises a check that will never run against it
  5. An experimental surface cannot be reached with its setting off, and no shipped document claims a capability the project forbids claiming

**Plans**: 6/6 plans executed

Plans:
**Wave 1**

- [x] 02-01-PLAN.md: Tracer: move the update modal's support link to the fork's GitHub Issues through catalog, guard, and gate, then expand to the Settings support section and record the D-03 exclusions

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 02-02-PLAN.md: Reconcile the fetch script and engine policy with D-02, guard the release workflow's pinned engine SHA, and put the packaged in-game colour check on the verification record
- [x] 02-03-PLAN.md: Gate the Chat Wheel page on its own setting with a render test for all three states, and drop the profile spec's cross-tool compatibility claims

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 02-04-PLAN.md: Merge structural-refactor-7 after confirming its worktree is inactive, resolve the assetClaims design collision by human decision, and prove the tree is green

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 02-05-PLAN.md: Remove the worktrees, delete the merged branches with the lowercase flag behind a one-way-door checkpoint, and retire the temporary merge plan document
- [x] 02-06-PLAN.md: Record ADR-018 for the dormant social service, prove the client already degrades correctly, and settle the terms-gate drift

**Waves**: 1 = {02-01}; 2 = {02-02, 02-03}; 3 = {02-04}; 4 = {02-05, 02-06}

**Notes**: The packaged smoke record does not gate a release (decided 2026-07-28), but the YCoCg engine fix does gate correctness: 197 of 12,561 pak textures are DXT5-YCoCg and they are mixed inside the item-icon category, so an unpinned engine garbles or not depending on which icon the user happens to drop on. The social item is a release decision, not a merge decision: whichever way it goes, migration 0005 must be applied **before** the Worker deploys, because the profile routes select its columns. Note that `pnpm typecheck` resolves the sibling `grimoire-social` from disk and stays green while CI fails, so verify by reverting the sibling file and running `pnpm exec tsc -b --force`.

### Phase 3: Foundry Completes Its Build Contract

**Goal**: The Foundry's combined build accepts every kind of edit the Foundry can author, and the two authoring gaps that make a pool feel dishonest are closed
**Depends on**: Phase 2
**Requirements**: REQ-foundry-forge-edit-kinds, REQ-foundry-sound-shuffle-surfacing, REQ-foundry-pool-audition-fidelity
**Success Criteria** (what must be TRUE):

  1. A recolor staged in Foundry appears in the build tray's reviewed write set and forges into the same named VPK as a sound edit and a texture edit, rather than being refused
  2. A user can add or remove a hero sound from its launch shuffle pool without leaving Foundry, and can reach the Locker's view of that same pool from there
  3. Auditioning a randomizer pool plays every clip in the pool, so what the user hears before forging is what the pool actually contains

**Plans**: 3/3 plans executed

Plans:
**Wave 1**

- [x] 03-01-PLAN.md - Recolor tracer: stage a recolor in Foundry and forge it into the combined VPK, with the built array alignment fixed and locked
- [x] 03-02-PLAN.md - Sound shuffle reachable from Foundry with a Locker link, plus the pool-audition traceability correction

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 03-03-PLAN.md - Recolor rows in My changes, the workshop Appearance mount, both effect surfaces captioned, human verification

**UI hint**: yes

**Notes**: Deliberately bounded. Widening `FoundryForgeEdit` also means fixing the `built` array alignment in `foundryForge.ts`, which only pushes for sound and texture today and is currently kept safe by the type alone. The invariants do not move: exact normalized paths stay the ownership key, Installed and the Locker stay the only authority for enabled state, and a failed or unreadable inspection still blocks the ambiguous action.

### Phase 4: Locker And Foundry As One Object

**Goal**: Locker and Foundry stop being two products at two quality levels: Foundry gains the Locker's preview, the Locker gains Foundry's pre-write disclosure, and each hero surface shows what the user has already made
**Depends on**: Phase 3
**Requirements**: REQ-locker-foundry-parity-lanes, REQ-locker-model-as-stage
**Success Criteria** (what must be TRUE):

  1. A staged visual edit is visible on the 3D model before the user forges it
  2. A Locker action that will overwrite something says what it will overwrite before it runs
  3. Foundry can source an image without requiring a file drop
  4. A hero card in the Foundry grid carries the same state a Locker hero card does: favorites, and a count of what the user has already made for that hero

**Plans**: 2/2 plans executed

**Wave 1**

- [x] 04-01-PLAN.md - The composable replaceable stage: model as the Locker's plate, Foundry on the same opt-in slot, the tray-preview stale pill, human verification

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 04-02-PLAN.md - Locker Effects-tab pre-write disclosure with a contested-write gate, and the hero-grid loading-versus-zero change-count badge

**UI hint**: yes

**Open decision (do not assume an outcome)**: Contested variant 3, the Locker hero page's target state. **REQ-locker-foundry-shared-hero-frame** (delivered: `HeroDetailFrame` is extracted and both `LockerHero` and `HeroWorkshop` render it) versus **REQ-locker-model-as-stage** (make the 3D model the page, which rebuilds that chrome). Both sources are equal precedence, so precedence cannot resolve it. The prerequisite hazard has discharged itself because Lane 1 shipped, so lanes 2 to 5 are no longer blocked, but Foundry now inherits chrome that one variant wants to move away from. Route to `/gsd-discuss-phase` before planning. One documented middle path exists and is not a decision: scope the frame so the backdrop is a replaceable slot rather than a fixed image.

**Notes**: The governing invariant for every lane, stated by the source: exact normalized VPK entry paths are the ownership key, labels and hero names and mod metadata are never a substitute, and Installed and the Locker remain the only authority for enabled state. Lane 2's preview runs over ad-hoc VPK pose sources, which is a new source shape for the existing viewer, not a new viewer.

**Amended 2026-08-08 (scope correction, verified twice against the working tree):** commit `f614bb7`, already an ancestor of `HEAD`, shipped parity lanes 2 to 5, not lane 1 alone. Foundry's debounced tray preview (`useTrayPreview.ts`, `previewVpkRegistry.ts`), the Locker's sound pre-write disclosure (`soundPickConsequence.ts`), the three-source portrait intake (`PortraitEditor.tsx`) and the Foundry grid's shared favorites plus change count (`FoundryHeroGrid.tsx`) are all delivered, so success criteria 1, 3 and most of 4 are already met. What genuinely remains is: D-01/D-02/D-03's composable replaceable stage (`heroStage.ts` types a `'model'` plate case that nothing produces, and the Locker model still opens in a floating panel that defaults to closed); success criterion 4's loading-versus-zero gap on the grid change-count badge; a `stale` state on the tray-preview pills; and success criterion 2 for the Locker Effects tab, which the parity commit declined on the stated ground that `heroColors` and `trippyEffects` discover the particle entries they patch at bake time, so there is no pre-write path to disclose without a dry bake. That last one is a product decision, not a UI one. This is the doc-drift pattern the overview already names; the roadmap was stale, the tree is the record.

### Phase 5: One Inventory, One Journey

**Goal**: Installed global content has exactly one home, portraits have a decided journey rather than two shipped halves, the Abrams portrait defect has a root cause, and the app reads as one product
**Depends on**: Phase 4
**Requirements**: REQ-global-inventory-coherence, REQ-sound-locker-surface, REQ-portrait-journey-consolidation-gated, REQ-portrait-alias-sweep, REQ-ui-consequence-and-vocabulary
**Success Criteria** (what must be TRUE):

  1. Opening Global never strands the user in an empty category while installed global content sits hidden behind another tab, and the mod counts its sections report agree with each other
  2. Portrait management has one stated journey, and where two controls do the same thing that is a recorded decision rather than an accident
  3. The Locker knows a portrait has variants
  4. Abrams and every other hero whose codename mismatches resolve to the same portrait family whether reached from the Locker or from Foundry, and an empty portrait view says which of "not indexed", "loading", or "failed" is true
  5. Any bulk action can be undone without rebuilding the selection by hand, and no disabled control leaves its blocker to be guessed
  6. The same state is never given two names on two pages, and every empty state names what is missing, why, and the next action

**Plans**: 2/6 plans executed

Plans:
**Wave 1**

- [x] 05-01-PLAN.md - Tracer: `All content` selectable end to end through route, merged projection, tablist and pane, empty categories hidden, plus the whole phase's catalog change in one place

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 05-02-PLAN.md - Randomization scope captions, an honest unresolved-codename disclosure, the Locker's failed portrait state under render coverage, and Leg A across the whole roster and both alias tables
- [ ] 05-03-PLAN.md - Snapshot-and-undo for every reversible bulk action, supersession, one-message partial failure, and a stated blocker on every control it disables
- [ ] 05-04-PLAN.md - Derived descriptions for paks with no useful name, and the recorded answer to the contested global sound inventory variant

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 05-05-PLAN.md - Legs B and C of the alias sweep driven over CDP, with a per-hero verdict recorded either way

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 05-06-PLAN.md - The disabled-blocker contract extended to Profiles apply, Conflicts resolve and the Foundry forge and install path, a conflict recheck that keeps its answer, and provenance consolidated to one phrase and one target

**Waves**: 1 = {05-01}; 2 = {05-02, 05-03, 05-04}; 3 = {05-05}; 4 = {05-06}

Plan 05-06 gets a wave of its own for two reasons, both structural rather than stylistic. It
touches `HeroCardPicker.tsx` and `MyChanges.tsx`, which are in plan 05-02's `files_modified`,
so it cannot share wave 2. Plan 05-05 drives the working tree over CDP and needs a tree nobody
else is editing, so it cannot share wave 3 either. It adds no i18n key of its own: plan 05-01
owns the entire phase catalog change in wave 1 and carries 05-06's seven keys, which is why
05-06 depends on 05-01.

**UI hint**: yes

**Open decisions (do not assume an outcome)**: Two, and this phase should not start until both are discussed.

- Contested variant 1, where installed global sound inventory lives: **REQ-sound-locker-surface** (a dedicated `/locker/sounds` route with hero and global drill-ins) versus **REQ-global-inventory-coherence** (no new surface until the flows are compared and one shared shell is prototyped). The record here is not neutral and the discussion needs to know it: the route was built and then folded back into the Locker shell as `GlobalSoundShelf`, with legacy URLs rewritten. That is history, not a verdict, and the second source explicitly says "do not merge the surfaces yet".
- Contested variant 2, the portrait and Cards journey: **REQ-portrait-shelf-cards-ownership** plus **REQ-portrait-randomization-home** (build into `HeroCardPicker` now, both delivered) versus **REQ-portrait-journey-consolidation-gated** (define the journey first; a full merge is an option to evaluate, not an assumption). The "build now" side has already run, including the deliberate two-control randomization split its own author called a real misplacement, so the live question is what to do next.

**Notes**: Fix the vocabulary in `src/locales/en/translation.json` before touching more components, because copy drift is cheaper to correct at the catalog than at 30 call sites. Legs B and C of the alias sweep drive the working tree over CDP, so they need a committed or stashed tree and a dev slot nobody else is attached to.

**Amended 2026-08-08 (scope correction, verified twice against the working tree):** the shared Global shell, `HeroCardPicker` as the canonical per-hero portrait home, and the shuffle mechanism behind both randomization views are already delivered, so the phase is narrower than the decision list suggests. What genuinely remains: the `All content` tri-state selector, which does not exist (`lockerMode.ts` types only `'looks' | 'sounds'`); hiding empty rail categories, where the code currently renders them unconditionally on purpose; two missing portrait empty states, `failed` and `filtered to zero`, since `not indexed` and the Locker's own none-state already ship; an honest indicator for unresolved codenames; a bulk-undo toast wired onto the existing `ToastStack`; derived descriptions for paks without useful names; and copy-only fixes consolidating six divergent phrasings into `Active source` plus the singular `Portrait family`. Both open decisions resolve by keeping every useful capability and both randomization views while refusing a second inventory home, which is what the discussion recorded.

### Phase 6: Community Tools Land Inside Grimoire

**Goal**: A community web tool that builds a mod inside the in-app browser hands its output to Grimoire instead of the system Downloads folder, and the destination list becomes a checked catalog rather than a hardcoded array that rots
**Depends on**: Nothing (independent of the Phase 2 to 5 chain; can be pulled forward)
**Requirements**: REQ-browser-tool-catalog, REQ-browser-produced-file-handoff, REQ-browser-navigation-gaps
**Success Criteria** (what must be TRUE):

  1. Pimp My Hideout is reachable from the browser's destination list, and every other entry in that list has been loaded once and either kept, corrected, or removed, with the result recorded
  2. Clicking `Build VPK` on Pimp My Hideout inside Grimoire's browser produces a file Grimoire can act on without the user leaving the app or opening a file manager
  3. Before that file is written anywhere, the user is told what it is and where it will go, and a file that is not a VPK Grimoire can identify is refused with a stated reason
  4. The webview is no less hardened after the download path changes than before: the guest still has no preload, no Node, its own partition, and an http(s)-only `src`
  5. A destination declares what kind of thing it is, so a handoff keys off that kind rather than a hardcoded URL match

**Plans**: 7/7 plans executed

Plans:
**Wave 1**

- [x] 06-01-PLAN.md — Tracer: an end-to-end tool download reaches the mod library (capture, identity gate, disclosure, install)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 06-02-PLAN.md — Refuse a non-VPK visibly, and hold exactly one pending download at a time
- [x] 06-03-PLAN.md — Pin the guest webview hardening and permission floor with tests
- [x] 06-04-PLAN.md — Probe every destination once and record keep, correct, or remove

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 06-05-PLAN.md — Group destinations by kind, and record the browser's bounded control set

**Wave 4** *(gap closure, blocked on Wave 3 completion)*

- [x] 06-06-PLAN.md — Make the tool download disclosure survive navigation (CR-01) and sweep the temp root at startup (WR-05)

**Wave 5** *(gap closure, blocked on Wave 4 completion)*

- [x] 06-07-PLAN.md — Make an accepted tool download actually install (CR-01) and surface an accept-time failure instead of swallowing it (WR-01)

**UI hint**: yes

**Open decision (do not assume an outcome)**: Whether a browser-built VPK enters through the existing install path (treated as a third-party mod, like a GameBanana download) or through the Foundry's reviewed write set (treated as content the user authored). The two give the user a different undo story and a different ownership record, and the invariant that Installed and the Locker are the only authority for enabled state has to survive either choice. Route to `/gsd-discuss-phase 6` before planning.

**Notes**: The gap is one handler. `guest.session.on('will-download')` in `electron/main/index.ts` calls `event.preventDefault()` and hands the URL to `shell.openExternal`. That is correct today, because an embedded browser with no download UI should not write to disk unattended, and it is exactly what has to change for a tool that builds a mod. `getGameBananaImportHandoff` in `src/lib/browserImportHandoff.ts` is the pattern to follow: an item-page handoff that still requires an explicit user Install, deliberately not a download handler. The hard part is that Pimp My Hideout builds its VPK client-side, so there is no URL to hand off and the artifact exists only inside the guest page. How the file crosses from an unprivileged sandboxed guest into main without widening the guest's privileges is the open technical question, and it is not answered yet. Similar tools already exist for crosshairs, but Grimoire ships its own Crosshair Designer, so whether those belong in the catalog at all is a scope question for discuss-phase rather than an assumption.

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6. Phase 6 declares no dependency on the 2 to 5 chain and can be pulled forward once Phase 1 is planned.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Verified Against The Game | 8/8 | Complete    | 2026-08-06 |
| 2. A Supported Fork Release | 6/6 | Complete    | 2026-08-07 |
| 3. Foundry Completes Its Build Contract | 3/3 | In Progress|  |
| 4. Locker And Foundry As One Object | 2/2 | In Progress|  |
| 5. One Inventory, One Journey | 2/6 | In Progress|  |
| 6. Community Tools Land Inside Grimoire | 7/7 | Complete    | 2026-08-08 |
