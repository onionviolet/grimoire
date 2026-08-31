# Roadmap: Grimoire

## Overview

The Chat Wheel editor already ships behind the experimental gate with a
custom-menu form, a live radial SVG preview, and a byte-preserving YAML round
trip against the bundled ChatLane converter. What it does not have is the rest
of ChatLane: a way to see and edit the base game's own voice command catalogue,
honest disclosure of the game limitations that actually bite a saved wheel, and
the interactions the original GUI offered. This milestone closes that gap and
ends by shipping the fork's v1.27.5 release. The journey is: capture and own the
command catalogue and give both override maps a form surface, then make the
wheel page honest and interactive, then add the safety warning and the
game-asset dressing spike, and finally release.

Two things shape the sequence. First, the catalogue is the largest slice and is
deliberately self-contained: it is versioned data pinned to the bundled
ChatLane release, never guessed from display labels and never fetched at
runtime, and the audit's untested `chat-wheel:read` and `chat-wheel:starter`
paths are the same service, so the test gap closes with it rather than as its
own phase. Second, the interaction and disclosure work all lands on the same
page and preview, so it stays one phase even though its criteria are separate.
The safety and dressing items are the smallest phase and are left last so the
page surfaces they touch are settled before they are extended. SEED-001 stays
dormant, and the deferred in-game verification rows from v1.27 stay tracked, not
re-scoped.

**Milestone:** v1.27.5, "Chat Wheel parity". Delivery slices stay independently
releasable: a slice is complete only when its data contract, UI, error and
rollback behaviour, and automated checks land together. A visible control is
not a substitute for the byte-for-byte preservation or the test coverage behind
it.

## Phases

**Phase Numbering:** continues from v1.27 (1-6) and v1.27.1 (7-8). v1.27.5 runs
Phase 9 onward. Decimal phases (9.1, 10.1) are urgent insertions marked INSERTED
and appear between their surrounding integers in numeric order.

- [ ] **Phase 9: The Base Command Catalogue** - Capture the base-game voice commands as typed, provenance-pinned data, give `override_bindable` and `override_ping_wheel_bindable` a searchable, editable form surface that preserves unknown entries byte-for-byte, and close the `chat-wheel:read`/`starter` test gap
- [ ] **Phase 10: Wheel Interaction And Disclosure** - Disclose the game's documented limitations near the controls they affect, finish arrow-key ring navigation on the radial preview, and add drag-and-drop menu building with keyboard alternatives
- [ ] **Phase 11: Safety And Dressing** - Warn before removing a Chat Wheel add-on that must be unbound first, and prove the game-asset dressing spike with the pure-SVG wheel kept as the permanent fallback
- [ ] **Phase 12: Release Engineering** - Ship v1.27.5: package.json version, CHANGELOG entry, tag `v1.27.5`, and a GitHub Release with notes from the changelog

## Phase Details

### Phase 9: The Base Command Catalogue

**Goal**: The base game's voice command catalogue becomes owned, versioned data with a browsable, editable form surface for both override maps, and the audit's untested read/starter paths close beside the existing round-trip test
**Depends on**: Nothing (first phase of the milestone)
**Requirements**: REQ-cw-command-catalogue, REQ-cw-override-editing, REQ-cw-test-gap
**Success Criteria** (what must be TRUE):

  1. The catalogue in `src/lib/chatWheelCommands.ts` is typed and readonly, and every base command a user can search carries a stable command ID, a user-facing label, a category, and its default availability; the file names the upstream ChatLane commit the catalogue was vendored from, notes explicitly that the bundled fork binary's exact build point is unverified (the fork repo is not publicly readable), and gives a short update procedure
  2. A user can search and filter the catalogue, see each command's game-default status, and toggle its availability for the stock Chat Wheel and the Ping wheel from form controls without touching YAML
  3. Unknown YAML override entries stay visible and editable in an "Other commands in this file" group, and unknown root keys and unknown command IDs round-trip byte-for-byte through save and reopen, covered end to end by a populated-override fixture in the real-binary round-trip suite (byte preservation is scoped to LF input with a plain unquoted name:, since the model normalizes CRLF and requotes name: by design)
  4. `chat-wheel:read` and `chat-wheel:starter` carry main-process test coverage beside the existing round-trip test; typecheck, lint, and `i18n:check` pass, and the full test suite introduces no new failures beyond the pre-existing baseline recorded in docs/upstream-absorption-1.28.md (9 failing files / 26 failing tests, inherited from the v1.28 absorption; the gate binaries are run directly, not via pnpm run, because the local pnpm major differs from CI's)

**Plans**: TBD

**Notes**: The catalogue is versioned data tied to the pinned ChatLane source or release used to build the bundled CLI, not a scrape of game files or a remote fetch. A small YAML fixture with known and unknown entries keeps parser compatibility independent of the whole catalogue. The override controls live on the Chat Wheel page as a separate collapsible section beneath "Menus and commands", and Advanced YAML stays the escape hatch: manual edits flow back into the controls through the existing `parseChatWheelYaml` path. The IPC handlers under test are the two-delegation lines in `electron/main/ipc/chatWheel.ts`; the round-trip test they join already exists.

### Phase 10: Wheel Interaction And Disclosure

**Goal**: The wheel page and preview are honest about what the game will actually do and match the interactions ChatLane's GUI had, without losing the keyboard floor
**Depends on**: Phase 9
**Requirements**: REQ-cw-limitations-disclosures, REQ-cw-keyboard-nav, REQ-cw-drag-drop
**Success Criteria** (what must be TRUE):

  1. Each of the five documented limitations that affect a saved wheel (custom menu item order reversed on the Archmother team, top-slot menus opening in the wrong direction, some items unselectable depending on the bound slot, the gameinfo-reset crash risk, the placeholder voice line) is disclosed with concise, honest copy near the control it affects
  2. Arrow keys move focus around the radial wheel ring, and Enter/Space still activate the focused slot
  3. Commands can be dragged from the catalogue or list into a menu and menu items reordered on the wheel by drag-and-drop, matching ChatLane's GUI, and every drag-only interaction keeps a keyboard-accessible alternative
  4. Every new visible string is an i18n key and the repository gate stays green

**Plans**: TBD

**Notes**: All three requirements touch the same `ChatWheel.tsx` page and the `RadialWheelPreview` component, so they share one phase even though the disclosure copy, the ring traversal, and the drag-and-drop are separate deliverables. The disclosures state game and ChatLane capability, not a guarantee of an in-match outcome, and only cover the limitations that actually affect a saved wheel. Drag-and-drop does not recreate the game's own slot-binding editor; the game still owns where enabled commands are assigned.

### Phase 11: Safety And Dressing

**Goal**: Removing a Chat Wheel add-on can no longer crash the game silently, and the preview can wear the game's own art when the user's paks provide it, with the pure-SVG wheel as the permanent fallback
**Depends on**: Phase 10
**Requirements**: REQ-cw-unbind-warning, REQ-cw-game-asset-dressing
**Success Criteria** (what must be TRUE):

  1. Removing a Chat Wheel add-on, from either the Chat Wheel page or the Installed page, warns that custom menus must be unbound in the game's Chat Wheel settings first, or the game can crash on opening the chat wheel or settings, and requires confirmation before the removal proceeds
  2. The dressing spike lands: with a game path configured, the preview is dressed with the extracted chat wheel panorama or backplate art and the stock ChatLane icon set; without a game path, without the Foundry flag, or on any decode failure, the pure-SVG wheel renders unchanged
  3. Dressing reuses the existing Foundry decode services: no duplicate decode code was added
  4. The repository gate stays green

**Plans**: TBD

**Notes**: The dressing half is explicitly a spike that must end with a written verdict, because the extraction cost is unknown until the paks are opened; the pure-SVG wheel is permanent, not provisional, so a failed spike still ships with the fallback intact. The unbind warning is the user-visible safety item and may not be gated on the spike's outcome.

### Phase 12: Release Engineering

**Goal**: The fork ships v1.27.5 as a GitHub Release on `onionviolet/grimoire`, produced by the release workflow and verified end to end
**Depends on**: Phase 11
**Requirements**: REQ-release-v1.27.5
**Success Criteria** (what must be TRUE):

  1. `package.json` version is 1.27.5 and `scripts/verify-release-version.mjs` passes against the tag
  2. A CHANGELOG entry records the fork's v1.27.5 release (Chat Wheel parity), free of bare upstream PR-number references
  3. Tag `v1.27.5` is created and pushed to `origin` (`onionviolet/grimoire` only); `release.yml` builds the installer, checksums, and attestations
  4. The GitHub Release exists with notes from the changelog and the release URL is reported; per release maintenance policy the published release is never deleted

**Plans**: TBD

**Notes**: The version stays below upstream (1.27.5, not 1.28) so a fork patch can never overtake the upstream version line. Windows artifacts are produced with `GRIMOIRE_FORK_BUILD` and `GRIMOIRE_SOCIAL_BASE_URL` set, and the packaged smoke record does not gate the release (decided 2026-07-28).

## Progress

**Execution Order:**
Phases execute in numeric order: 9 → 10 → 11 → 12. Each phase depends on the one before it: the interaction phase builds menus from the catalogue, the safety phase extends the page and preview the interaction phase just settled, and the release ships after the work is done.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 9. The Base Command Catalogue | 0/0 | Planned |  |
| 10. Wheel Interaction And Disclosure | 0/0 | Planned |  |
| 11. Safety And Dressing | 0/0 | Planned |  |
| 12. Release Engineering | 0/0 | Planned |  |
