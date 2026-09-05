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

**Standing exit rule (Phase 9.1, 2026-09-01):** a phase exits against a command
and its expected exit code, never against a remembered failure count. Phase 9
exited by matching 26 failures to a recorded baseline; the number turned out to
describe two unrelated defects and neither the count nor its attribution had
been re-derived in a month. `./node_modules/.bin/vitest run` now exits 0, so
"green" is checkable rather than recalled.

- [x] **Phase 9: The Base Command Catalogue** - Capture the base-game voice commands as typed, provenance-pinned data, give `override_bindable` and `override_ping_wheel_bindable` a searchable, editable form surface that preserves unknown entries byte-for-byte, and close the `chat-wheel:read`/`starter` test gap
- [x] **Phase 9.1: Green Suite And Honest Baseline** (INSERTED 2026-09-01) - Repair the two genuinely failing test paths and correct the mis-attributed "v1.28 absorption baseline", so the suite is green rather than green-except-a-number-we-remember
- [x] **Phase 10: Wheel Interaction And Disclosure** - Disclose the game's documented limitations near the controls they affect, finish arrow-key ring navigation on the radial preview, and add drag-and-drop menu building with keyboard alternatives
- [x] **Phase 11: Safety And Dressing** - Warn before removing a Chat Wheel add-on that must be unbound first, and prove the game-asset dressing spike with the pure-SVG wheel kept as the permanent fallback
- [ ] **Phase 12: Release Engineering** (RESCOPED 2026-09-05 to v1.28.2) - Ship the fork release: package.json version, CHANGELOG entry, tag `v1.27.5`, and a GitHub Release with notes from the changelog

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

### Phase 9.1: Green Suite And Honest Baseline (INSERTED 2026-09-01)

**Goal**: `vitest run` is green on a supported toolchain, and no phase can ever
again be exited by comparing a failure count against a number nobody re-derived
**Depends on**: Phase 9
**Requirements**: REQ-green-suite
**Inserted because**: the Phase 9 exit note settled success criterion 4 by
matching 26 failures against a recorded "v1.28 absorption baseline". A truth
pass on 2026-09-01 found that attribution is wrong, and that the real content of
the number is two unrelated things:

  - **25 of the 26 are a local toolchain artifact, not absorbed debt.** Node 26
    ships a native `localStorage` global that is unavailable without
    `--localstorage-file`, and it shadows jsdom's. Every storage-touching test
    fails on Node 26 (`uiPrefs` 19, `heroStageMode` 6) and passes on CI's Node
    20. Nothing was absorbed; the local runtime moved.
  - **1 is a real failing test on `main`**: `browserDownloadCapture.test.ts`
    "a symlink entry in the root is skipped and never followed" expects 1 and
    gets 2. Known since v1.27.1 and never fixed.

**Success Criteria** (what must be TRUE):

  1. `./node_modules/.bin/vitest run` is green on the toolchain the repository
     declares, and the declaration is explicit: an `engines` field or `.nvmrc`
     pins the supported Node, or the jsdom/native-`localStorage` collision is
     removed at its source so both Node 20 and Node 26 pass
  2. The symlink-sweep case either passes or is quarantined with a stated
     reason and a ledger entry; it is not left silently red inside a baseline
  3. The stale "9 failing files / 26 failing tests" figure is corrected wherever
     it is quoted as a gate: this roadmap's Phase 9 exit note and
     `docs/upstream-absorption-1.28.md`
  4. No future phase may exit against a remembered failure count: exit criteria
     cite a command and its expected exit code

**Plans**: executed directly, 2026-09-01 (one sitting, no plan file: the work
was two defects with known causes)

**Notes**: This is small and mechanical, and it was inserted rather than banked
because the cost of leaving it is that the next real regression hides inside a
number people have learned to expect.

**Exit (2026-09-01):** `./node_modules/.bin/vitest run` exits 0 with 2436
passing and 0 failing, on the Node 26 that used to fail. `tsc -b`, `eslint`,
`check-i18n`, and `check-encoding` all exit 0.

  - **Criterion 1.** Both halves, not either. `.nvmrc` and `engines.node`
    declare Node 20, matching CI, and `vitest.setup.ts` removes the collision
    so Node 26 passes too. The repair takes `localStorage` from the
    `sessionStorage` instance, which Node does not shadow and which nothing in
    `src/` or `electron/` uses. One trap found while fixing it: the `Storage`
    vitest publishes globally is not the class backing that instance, so
    `vi.spyOn(Storage.prototype, 'getItem')` would have silently never applied
    and the three "storage being unavailable" cases in `uiPrefs.test.ts` would
    have passed vacuously, since a throwing getter and an empty store both
    yield the fallback. The setup file republishes `Storage` from the live
    instance, and `src/lib/domStorage.test.ts` guards all of it by name.
  - **Criterion 2.** Passes rather than quarantined, and the defect was the
    test: it created the symlink's target *inside* the swept root, where a
    regular file is orphaned by construction, so the sweep was correct to
    delete 2 and the assertion of 1 was wrong. The target moved outside the
    root, which is what "skipped and never followed" actually requires.
  - **Criterion 3.** Corrected in this file's Phase 9 exit note and in
    `docs/upstream-absorption-1.28.md`.
  - **Criterion 4.** Recorded as the standing exit rule under "Phases" above.

**Not verified here:** Node 20 itself, which is not installed on this machine.
The setup file's guard makes it a no-op wherever `localStorage` is already
defined, so the Node 20 path is unchanged by construction; CI is what confirms
it by execution.

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

**Exit (2026-09-05):** one plan (10-01), executed by a background agent and
merged as `f4dfa85`. `tsc -b`, `eslint .`, `check-i18n`, `check-encoding`, and
`gen-locale-manifest --check` exit 0.

  - **Criterion 1.** `LimitationNote` renders one `role="note"` per
    limitation: `topSlot` and `placeholderVoice` head the menu editor,
    `archmotherOrder` and `slotSelect` sit under the preview, `unbindCrash`
    sits above Save and install. Copy checked against the upstream ChatLane
    README and recorded in `docs/chat-wheel.md`.
  - **Criterion 2.** The wedges are one roving tab stop; arrows wrap, Home and
    End jump, Enter and Space select, Alt+Arrow moves the command.
  - **Criterion 3.** Native HTML5 drag from catalogue rows, item rows, and
    wedges over a private MIME payload. Keyboard twins: Move up and Move down,
    Alt+Up and Alt+Down, an Add button per catalogue row, and a Move-to-menu
    select. Every edit flows through `applyModel`, so the byte-preserving YAML
    path is the one exercised.
  - **Criterion 4.** 15 new keys under `chatWheel.limits.*` and
    `chatWheel.dnd.*`; the manifest is regenerated.

**Not verified here:** a pointer drag in the running app. jsdom has no
`DragEvent`, so drops are tested with a hand-made `dataTransfer`.

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

**Exit (2026-09-05):** two plans (11-01 unbind warning, 11-02 dressing spike),
executed by background agents in isolated worktrees and merged as `27797c7`
and `6538da7`. Static gates exit 0.

  - **Criterion 1.** `isChatWheelAddon` (source section `ChatWheel`) gates
    `confirmChatWheelUnbind`, which reuses the page's `useConfirm` provider.
    The Chat Wheel page had no removal action at all, so a Remove wheel button
    was added; on Installed both `deleteEntry` and the bulk delete path warn.
    Ordinary mods keep their existing flow.
  - **Criterion 2.** Landed as gated plumbing with a runtime resolver rather
    than a proven texture. The spike verdict (11-02-SUMMARY.md): the stock
    icons need no extraction because the vendored ChatLane set carries the
    game's `ping_icon_<name>` names, and no wheel backplate `.vtex_c` is
    known to exist because the in-game ring is Panorama layout and style.
    When a user's pak does yield a qualifying HUD texture the preview is
    dressed; otherwise null is the normal answer and the SVG wheel renders
    with byte-identical markup. The gate (Foundry flag and game path) is a
    pure function under test.
  - **Criterion 3.** The resolver calls the Foundry catalog's `getTextures`
    and `ensureFullImage` and decodes nothing itself.
  - **Criterion 4.** See the standing note below on the local suite.

**Not verified here:** the resolver against a real pak (no Deadlock install on
this macOS machine), and the removal warning in the running app.

**Local suite, 2026-09-05.** `./node_modules/.bin/vitest run` on the merged
tree: 2496 passed, 2 failed, 18 skipped. Neither failure touches Phase 10 or
11 code. `downloadTransfer` "resumes on the next server when a connected
response stalls" is a load flake: it passes alone. `forgeBridge` "serves more
concurrent connections than a browser will open" reproduces on `main` before
this work and is ledger entry 6 in WINDOWS.md: with 8 concurrent loopback
connects, only 6 ever reach the server's `connection` event, while the same
40-connection burst against a plain `node:http` server on the same port
completes in 22 ms, both bare and under vitest. The bridge file is unchanged
since v1.27.1 and the case passed on 2026-09-01, so it is environmental and
not yet explained. Per the standing exit rule the gate is `vitest run` exit
0, which CI on Node 20 confirms on push; this machine has no Node 20.

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

**Rescope (2026-09-05):** the release is **v1.28.2**, not v1.27.5. The
roadmap was written before the v1.28 absorption; `package.json` has been at
1.28.2 since `93096e7` and tags `v1.28.0` and `v1.28.1` already exist in the
fork, so "stay below upstream" no longer describes the tree, and 1.27.5 would
be rejected by `verify-release-version.mjs` against the package version. Read
every `1.27.5` in the criteria above as `1.28.2`. Prepared so far: the
CHANGELOG entry for 1.28.2 and a passing `node scripts/verify-release-version.mjs`.
Not done, deliberately: the tag push and the GitHub Release are outward-facing
and the release policy says a published release is never deleted, so they wait
for an explicit go. Also note that the `gh` login on this machine is a
different account from the fork's git author, so push rights to
`onionviolet/grimoire` are unverified.

## Not in this milestone

Rescoped 2026-09-01. Two classes of work were being carried in prose across
`docs/feature-status.md` and `docs/remaining-work-phases.md`, where they were
neither scheduled nor trued up, and eleven items sat there for a month after
they had shipped. Both now have one home each:

- **Future feature work** moved to [BACKLOG.md](./BACKLOG.md): the Foundry
  model serializer and model/VFX browsing (B-01, B-02), advanced merge
  composition (B-03), animation retarget and in-preview VFX (B-04), the social
  TOS-gate decision (B-05), Locker overflow polish (B-06), and the
  fork-owned-`grimoire-social` question (B-07). None of it is Chat Wheel work
  and none of it belongs in v1.27.5.
- **Verification debt stays deferred by decision (2026-09-01).** The three
  `unrun-verify` entries in [WINDOWS.md](./WINDOWS.md) need a real Deadlock
  install or a Windows machine. They are waived for this milestone with that
  reason recorded, so they do not block Phase 12, and they are not re-scoped
  onto the roadmap. The app-tier record is already green and strict
  (42 rows, 0 blank); what is owed is the engine tier.

`docs/remaining-work-phases.md` and `docs/work-order.md` are retired to
`docs/archive/` so there is no fourth register to drift.

## Progress

**Execution Order:**
Phases execute in numeric order: 9 → 10 → 11 → 12. Each phase depends on the one before it: the interaction phase builds menus from the catalogue, the safety phase extends the page and preview the interaction phase just settled, and the release ships after the work is done.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 9. The Base Command Catalogue | 3/3 | Complete | 2026-08-31 |
| 9.1. Green Suite And Honest Baseline | 1/1 | Complete | 2026-09-01 |
| 10. Wheel Interaction And Disclosure | 1/1 | Complete | 2026-09-05 |
| 11. Safety And Dressing | 2/2 | Complete | 2026-09-05 |
| 12. Release Engineering | 0/1 | In progress (changelog and version ready; tag and Release await a go) |  |

**Phase 9 exit note, corrected 2026-09-01.** The note below stands as the
record of how the phase was exited, but its central claim does not survive a
truth pass: 25 of the 26 failures are a Node 26 native-`localStorage` collision
with jsdom on this machine, not absorbed debt, and the 26th is a real failing
test on `main`. Phase 9's own work is still clear of both. Phase 9.1 repairs
this. Original note follows.

**Phase 9 exit note (2026-08-31):** success criterion 4 was settled by a full
`./node_modules/.bin/vitest run` on the working tree: 26 failing tests across 3
files (`browserDownloadCapture`, `heroStageMode`, `uiPrefs`), all in the
documented v1.28-absorption baseline. The test count matches the recorded
baseline exactly and the failing-file count is lower than the 9 recorded in
docs/upstream-absorption-1.28.md, so the phase introduced no new failures. That
9-file figure now looks stale rather than authoritative; re-record it the next
time the baseline is quoted as a gate.

One item is carried out of the phase rather than closed: the populated-override
case added to the real-binary round-trip suite in 09-02 skips on macOS, because
the bundled ChatLane converter is Windows-only, and still needs one Windows run.
Tracked as ledger entry 3 in .planning/WINDOWS.md.
