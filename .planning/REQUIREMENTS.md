# Requirements: Grimoire

**Defined:** 2026-08-11
**Core Value:** A Deadlock player can change their game and always know exactly what changed, who owns it, and how to undo it.

## Milestone

**v1.27.5 "Chat Wheel parity"**: bring the embedded Chat Wheel editor to parity
with the original ChatLane tool: the base-game voice command catalogue becomes
browsable and editable (both override maps), the game's documented limitations
are disclosed where they bite, menus can be built and reordered by
drag-and-drop, deleting a chat wheel warns about unbinding, the preview can be
dressed with the game's own art, and the untested VPK read/starter paths close.
SEED-001 stays dormant for a future milestone.

## Delivered

Shipped before this milestone's phases began, confirmed against the working
tree at the milestone start:

| Requirement | Evidence |
|-------------|----------|
| **REQ-cw-editor-base** | The Chat Wheel page (form editor, live radial SVG preview with `chatWheelGeometry.ts`, 11 vendored ChatLane icons via `chatWheelIcons.ts`, Advanced YAML with byte-preserving model round-trip via `chatWheelModel.ts`) ships behind the `experimentalChatWheel` gate. The bundled ChatLane converter builds and reads VPKs (`chatWheel.ts`, `chat-wheel:read`/`starter`/`validate`/`save` IPC), starter YAML round-trips against the real converter (`chatWheel.roundtrip.test.ts`), the 12-slot honesty warning ships, and the icon picker is a datalist with live preview. |

## v1 Requirements

### Base command catalogue

- [x] **REQ-cw-command-catalogue**: A typed, readonly catalogue of base-game
      voice commands (stable command ID, user-facing label, category, default
      availability) is captured and owned in `src/lib/chatWheelCommands.ts`,
      versioned to the upstream ChatLane commit it was vendored from, with a
      provenance comment, a short update procedure, and an explicit note that
      the bundled fork binary's exact build point is unverified (the fork repo
      is not publicly readable). A small YAML fixture with known and unknown
      entries keeps parser compatibility independent of the whole catalogue.
- [x] **REQ-cw-override-editing**: Users can search, filter, and browse the
      catalogue, and toggle each command's availability for the stock Chat
      Wheel (`override_bindable`) and the Ping wheel
      (`override_ping_wheel_bindable`) from form controls, without touching
      YAML. Unknown YAML override entries stay visible and editable in an
      "Other commands in this file" group; unknown root keys and unknown
      command IDs round-trip byte-for-byte.

### Suite integrity

- [ ] **REQ-green-suite**: `vitest run` is green on the toolchain the
      repository declares, that toolchain is declared explicitly (`engines` or
      `.nvmrc`) or the jsdom/native-`localStorage` collision is removed at its
      source, the `browserDownloadCapture` symlink-sweep case passes or is
      quarantined with a reason and a ledger entry, and the stale
      "9 failing files / 26 failing tests" figure is corrected wherever it is
      quoted as a gate. No phase exits against a remembered failure count.

### Wheel interaction and disclosure

- [ ] **REQ-cw-limitations-disclosures**: The game/ChatLane limitations that
      actually affect a saved wheel (custom menu item order reversed on the
      Archmother team, top-slot menus opening in the wrong direction, some
      items unselectable depending on bound slot, the gameinfo-reset crash
      risk, the placeholder voice line) are surfaced near the relevant
      controls with concise, honest copy.
- [ ] **REQ-cw-keyboard-nav**: Arrow-key focus movement around the radial wheel
      ring is completed (the preview currently supports Enter/Space activation
      but not ring traversal).
- [ ] **REQ-cw-drag-drop**: Commands can be reordered on the wheel and menus
      can be built by dragging commands from the catalogue/list into a menu,
      matching the original ChatLane GUI, with keyboard-accessible
      alternatives preserved for every drag-only interaction.

### Safety and dressing

- [ ] **REQ-cw-unbind-warning**: Removing a Chat Wheel add-on (from the Chat
      Wheel page or the Installed page) warns that custom menus must be
      unbound in the game's Chat Wheel settings first, or the game can crash
      on opening the chat wheel/settings.
- [ ] **REQ-cw-game-asset-dressing**: Spike: extract the game's chat wheel
      panorama/backplate art and the stock ChatLane icon set from the user's
      own paks and dress the preview with them when a game path is configured;
      the pure-SVG wheel is the permanent fallback (no game path, no Foundry
      flag, or decode failure all land there). No duplicate decode code: reuse
      the existing foundry services.

### Test gap and release

- [x] **REQ-cw-test-gap**: `chat-wheel:read` and `chat-wheel:starter` gain
      main-process coverage (flagged untested by the 2026-07-28 audit), beside
      the existing round-trip test.
- [ ] **REQ-release-v1.27.5**: The fork ships v1.27.5 as a GitHub Release on
      `onionviolet/grimoire`: `package.json` version 1.27.5, a CHANGELOG entry
      for the fork release, tag `v1.27.5` pushed to `origin` (matching
      `package.json`; `scripts/verify-release-version.mjs` must pass), the
      `release.yml` workflow builds the installer, checksums, and
      attestations, and the GitHub Release is created with notes from the
      changelog.

## Out of Scope

| Feature | Reason |
|---------|--------|
| SEED-001 generic local-install protocol for browser-built VPKs | A v1.28 seed; must stay dormant |
| Recreating the full ChatLane GUI (its game-slot binding editor) | The game remains where users assign enabled commands to wheel slots |
| Runtime scraping of game files or network-delivered command lists | The catalogue is versioned data tied to the bundled ChatLane release |
| Editing the game's active slot bindings from Grimoire | Not the chat-wheel add-on surface |
| Deferred human in-game verification (v1.27 phases 3-5) | Tracked; resume via `$gsd-verify-work 3/4/5` |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| REQ-cw-editor-base | delivered (pre-milestone) | [x] |
| REQ-cw-command-catalogue | 9 | [x] |
| REQ-cw-override-editing | 9 | [x] |
| REQ-green-suite | 9.1 | [ ] |
| REQ-cw-limitations-disclosures | 10 | [ ] |
| REQ-cw-keyboard-nav | 10 | [ ] |
| REQ-cw-drag-drop | 10 | [ ] |
| REQ-cw-unbind-warning | 11 | [ ] |
| REQ-cw-game-asset-dressing | 11 | [ ] |
| REQ-cw-test-gap | 9 | [x] |
| REQ-release-v1.27.5 | 12 | [ ] |
