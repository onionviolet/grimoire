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

- [ ] **Phase 1: Verified Against The Game** - Run the verification debt to zero: prove Foundry, merge, rigged preview, and the performance card against a running build, and make the untested renderer lanes testable
- [ ] **Phase 2: A Supported Fork Release** - Pin a fork engine, package and smoke it, own the support destination, consolidate the branches, and decide which social service a shipped installer points at
- [ ] **Phase 3: Foundry Completes Its Build Contract** - Recolor and model edits can enter a combined build, sound shuffle is reachable from Foundry, and a pool auditions every clip
- [ ] **Phase 4: Locker And Foundry As One Object** - Foundry gets preview, Locker gets pre-write disclosure, portraits get variant awareness, and the hero grid shows what the user has made
- [ ] **Phase 5: One Inventory, One Journey** - Global reads as one inventory, portraits get a decided journey, the Abrams alias defect gets a root cause, and the consistency floor is finished

## Phase Details

### Phase 1: Verified Against The Game
**Goal**: Every path that has only ever been proven by a unit test is proven against a running Deadlock build, and the lanes that shipped without any rendering check get one
**Depends on**: Nothing (first phase)
**Requirements**: REQ-ingame-verification-sweep, REQ-renderer-test-harness, REQ-rigged-preview-release-gate, REQ-performance-convar-safer-experimentation
**Success Criteria** (what must be TRUE):
  1. A VPK forged from one staged sound edit and one staged texture edit mounts in Deadlock, and the user hears the sound and sees the texture; cancelling the native save dialog instead leaves the mod library and the staged edits exactly as they were
  2. A merged VPK built from a reviewed source order mounts, and the mod the review named as winner is the one the engine loads
  3. Auditioning an installed VPK's clip from the sources panel matches what the engine plays, verified across a downloaded third-party mod, a forged mod, a disabled mod, and a multi-clip pool
  4. Seven (`gigawatt_prisoner`) renders on the rigged preview with a measured frame rate on record, and the ship, gate, or per-hero recommendation is written down and applied to the release flag
  5. Every ConVar in the performance card shows a game default read off a running build, and the pool cards, alternatives gallery, portrait editor, seeded sound editor, and Chat Wheel VPK round trip each have a check that actually renders or exercises them
**Plans**: TBD

**Notes**: This is the phase the docs themselves rank first: "four waves have landed with a green repository gate and zero in-game validation. That is the real risk on this board, and no amount of further code reduces it." If any check here fails, that failure outranks everything below it. Two items are human-gated and cannot be automated: the in-game sweep and the fps reading. The renderer test work is the enabling half: Vitest runs in a node environment with no DOM today, so deciding how these components get rendered at all is part of the phase, not an afterthought.

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
**Plans**: TBD

**Notes**: The packaged smoke record does not gate a release (decided 2026-07-28), but the YCoCg engine fix does gate correctness: 197 of 12,561 pak textures are DXT5-YCoCg and they are mixed inside the item-icon category, so an unpinned engine garbles or not depending on which icon the user happens to drop on. The social item is a release decision, not a merge decision: whichever way it goes, migration 0005 must be applied **before** the Worker deploys, because the profile routes select its columns. Note that `pnpm typecheck` resolves the sibling `grimoire-social` from disk and stays green while CI fails, so verify by reverting the sibling file and running `pnpm exec tsc -b --force`.

### Phase 3: Foundry Completes Its Build Contract
**Goal**: The Foundry's combined build accepts every kind of edit the Foundry can author, and the two authoring gaps that make a pool feel dishonest are closed
**Depends on**: Phase 2
**Requirements**: REQ-foundry-forge-edit-kinds, REQ-foundry-sound-shuffle-surfacing, REQ-foundry-pool-audition-fidelity
**Success Criteria** (what must be TRUE):
  1. A recolor staged in Foundry appears in the build tray's reviewed write set and forges into the same named VPK as a sound edit and a texture edit, rather than being refused
  2. A user can add or remove a hero sound from its launch shuffle pool without leaving Foundry, and can reach the Locker's view of that same pool from there
  3. Auditioning a randomizer pool plays every clip in the pool, so what the user hears before forging is what the pool actually contains
**Plans**: TBD
**UI hint**: yes

**Notes**: Deliberately bounded. Widening `FoundryForgeEdit` also means fixing the `built` array alignment in `foundryForge.ts`, which only pushes for sound and texture today and is currently kept safe by the type alone. The invariants do not move: exact normalized paths stay the ownership key, Installed and the Locker stay the only authority for enabled state, and a failed or unreadable inspection still blocks the ambiguous action.

### Phase 4: Locker And Foundry As One Object
**Goal**: Locker and Foundry stop being two products at two quality levels: Foundry gains the Locker's preview, the Locker gains Foundry's pre-write disclosure, and each hero surface shows what the user has already made
**Depends on**: Phase 3
**Requirements**: REQ-locker-foundry-parity-lanes, REQ-locker-model-as-stage
**Success Criteria** (what must be TRUE):
  1. A staged visual edit is visible on the 3D model before the user forges it
  2. A Locker action that will overwrite something says what it will overwrite before it runs
  3. The Locker knows a portrait has variants, and Foundry can source an image without requiring a file drop
  4. A hero card in the Foundry grid carries the same state a Locker hero card does: favorites, and a count of what the user has already made for that hero
**Plans**: TBD
**UI hint**: yes

**Open decision (do not assume an outcome)**: Contested variant 3, the Locker hero page's target state. **REQ-locker-foundry-shared-hero-frame** (delivered: `HeroDetailFrame` is extracted and both `LockerHero` and `HeroWorkshop` render it) versus **REQ-locker-model-as-stage** (make the 3D model the page, which rebuilds that chrome). Both sources are equal precedence, so precedence cannot resolve it. The prerequisite hazard has discharged itself because Lane 1 shipped, so lanes 2 to 5 are no longer blocked, but Foundry now inherits chrome that one variant wants to move away from. Route to `/gsd-discuss-phase` before planning. One documented middle path exists and is not a decision: scope the frame so the backdrop is a replaceable slot rather than a fixed image.

**Notes**: The governing invariant for every lane, stated by the source: exact normalized VPK entry paths are the ownership key, labels and hero names and mod metadata are never a substitute, and Installed and the Locker remain the only authority for enabled state. Lane 2's preview runs over ad-hoc VPK pose sources, which is a new source shape for the existing viewer, not a new viewer.

### Phase 5: One Inventory, One Journey
**Goal**: Installed global content has exactly one home, portraits have a decided journey rather than two shipped halves, the Abrams portrait defect has a root cause, and the app reads as one product
**Depends on**: Phase 4
**Requirements**: REQ-global-inventory-coherence, REQ-sound-locker-surface, REQ-portrait-journey-consolidation-gated, REQ-portrait-alias-sweep, REQ-ui-consequence-and-vocabulary
**Success Criteria** (what must be TRUE):
  1. Opening Global never strands the user in an empty category while installed global content sits hidden behind another tab, and the mod counts its sections report agree with each other
  2. Portrait management has one stated journey, and where two controls do the same thing that is a recorded decision rather than an accident
  3. Abrams and every other hero whose codename mismatches resolve to the same portrait family whether reached from the Locker or from Foundry, and an empty portrait view says which of "not indexed", "loading", or "failed" is true
  4. Any bulk action can be undone without rebuilding the selection by hand, and no disabled control leaves its blocker to be guessed
  5. The same state is never given two names on two pages, and every empty state names what is missing, why, and the next action
**Plans**: TBD
**UI hint**: yes

**Open decisions (do not assume an outcome)**: Two, and this phase should not start until both are discussed.
- Contested variant 1, where installed global sound inventory lives: **REQ-sound-locker-surface** (a dedicated `/locker/sounds` route with hero and global drill-ins) versus **REQ-global-inventory-coherence** (no new surface until the flows are compared and one shared shell is prototyped). The record here is not neutral and the discussion needs to know it: the route was built and then folded back into the Locker shell as `GlobalSoundShelf`, with legacy URLs rewritten. That is history, not a verdict, and the second source explicitly says "do not merge the surfaces yet".
- Contested variant 2, the portrait and Cards journey: **REQ-portrait-shelf-cards-ownership** plus **REQ-portrait-randomization-home** (build into `HeroCardPicker` now, both delivered) versus **REQ-portrait-journey-consolidation-gated** (define the journey first; a full merge is an option to evaluate, not an assumption). The "build now" side has already run, including the deliberate two-control randomization split its own author called a real misplacement, so the live question is what to do next.

**Notes**: Fix the vocabulary in `src/locales/en/translation.json` before touching more components, because copy drift is cheaper to correct at the catalog than at 30 call sites. Legs B and C of the alias sweep drive the working tree over CDP, so they need a committed or stashed tree and a dev slot nobody else is attached to.

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Verified Against The Game | 0/TBD | Not started | - |
| 2. A Supported Fork Release | 0/TBD | Not started | - |
| 3. Foundry Completes Its Build Contract | 0/TBD | Not started | - |
| 4. Locker And Foundry As One Object | 0/TBD | Not started | - |
| 5. One Inventory, One Journey | 0/TBD | Not started | - |
