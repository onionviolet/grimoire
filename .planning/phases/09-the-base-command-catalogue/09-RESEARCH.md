# Phase 9 Research: The Base Command Catalogue

**Researched:** 2026-08-11
**Status:** Ready for planning

---

## 1. Domain Understanding

Phase 9 owns the base-game voice command catalogue as versioned data and gives
the two ChatLane override maps (`override_bindable`,
`override_ping_wheel_bindable`) a searchable, editable form surface that
preserves unknown YAML byte-for-byte. It also closes the audit-flagged
`chat-wheel:read` / `chat-wheel:starter` main-process test gap.

The wire format is the ChatLane YAML. Override map keys ARE the command display
strings (for example `Good Game (Post Game) - All Chat: true` in
`CLI/example.yml`), so there is no separate command ID in the format. The
catalogue keys on the display string (D-01), stores ChatLane's `vc-item-*` label
keys for provenance only (D-02), and groups commands into ChatLane's three
categories: `default`, `hidden`, `broken` (D-03).

---

## 2. Verified Facts

### 2.1 The authoritative catalogue (VC_LIST), quoted verbatim

Source: `voice_commands_db.gd`, `const VC_LIST = [...]` array.
[VERIFIED: https://raw.githubusercontent.com/RedMser/ChatLane/master/GUI/autoload/voice_commands_db.gd]
Fetched from `master`, which currently points at commit
`9a71e229f30e7a899699aa5f24d1fbe88da8ce00` (2026-01-24).
[VERIFIED: https://api.github.com/repos/RedMser/ChatLane/commits/master]

There are **53 entries, not ~49**. Exact per-category count, verbatim from the
file:

- **`default` (33):** the first 20 block entries (Can Heal through You're
  Welcome), then a second block of 13 appended AFTER the broken block (Going to
  Shop through Flank).
- **`hidden` (12):** Defend Blue through Push Yellow.
- **`broken` (8):** Good Game (Post Game) - All Chat through Well Played (Post
  Game) - All Chat, plus Missing, Pinged Enemy Player, Pinged Teammate, and a
  second `broken` entry `Pregame Pings` appended at the very end.

The 13 `default` entries appended after `broken` plus `Pregame Pings` at the end
signal a later game-command batch; `CLI/example.yml`'s own "List of voice
commands" comment still lists only 38 ids and omits all of them (for example
`Going to Shop` and `Flank`).
[VERIFIED: https://raw.githubusercontent.com/RedMser/ChatLane/master/CLI/example.yml]

The file content to vendor (every field quoted verbatim from the source):

```
{ "id": "Can Heal", "category": "default", "label": "vc-item-can_heal", "isMenu": false, "bindable": true, "pingWheelBindable": true },
{ "id": "Defend Lane", "category": "default", "label": "vc-item-defend_lane", "isMenu": true, "bindable": true, "pingWheelBindable": false },
{ "id": "Going In", "category": "default", "label": "vc-item-going_in", "isMenu": false, "bindable": true, "pingWheelBindable": true },
{ "id": "Good Job", "category": "default", "label": "vc-item-good_job", "isMenu": false, "bindable": true, "pingWheelBindable": true },
{ "id": "Headed to Lane", "category": "default", "label": "vc-item-headed_to_lane", "isMenu": true, "bindable": true, "pingWheelBindable": false },
{ "id": "Headed To Shop/Base", "category": "default", "label": "vc-item-headed_to_shop_base", "isMenu": false, "bindable": true, "pingWheelBindable": true },
{ "id": "Help With Idol", "category": "default", "label": "vc-item-help_with_idol", "isMenu": false, "bindable": true, "pingWheelBindable": true },
{ "id": "Help", "category": "default", "label": "vc-item-help", "isMenu": false, "bindable": true, "pingWheelBindable": true },
{ "id": "Leave Area", "category": "default", "label": "vc-item-leave_area", "isMenu": false, "bindable": true, "pingWheelBindable": true },
{ "id": "Need Heal", "category": "default", "label": "vc-item-need_heal", "isMenu": false, "bindable": true, "pingWheelBindable": true },
{ "id": "No", "category": "default", "label": "vc-item-no", "isMenu": false, "bindable": true, "pingWheelBindable": true },
{ "id": "On My Way", "category": "default", "label": "vc-item-on_my_way", "isMenu": false, "bindable": true, "pingWheelBindable": true },
{ "id": "Push Lane", "category": "default", "label": "vc-item-push_lane", "isMenu": true, "bindable": true, "pingWheelBindable": false },
{ "id": "Retreat", "category": "default", "label": "vc-item-retreat", "isMenu": false, "bindable": true, "pingWheelBindable": true },
{ "id": "Sorry", "category": "default", "label": "vc-item-sorry", "isMenu": false, "bindable": true, "pingWheelBindable": true },
{ "id": "Stay Together", "category": "default", "label": "vc-item-stay_together", "isMenu": false, "bindable": true, "pingWheelBindable": true },
{ "id": "Thanks", "category": "default", "label": "vc-item-thanks", "isMenu": false, "bindable": true, "pingWheelBindable": true },
{ "id": "Need Plan", "category": "default", "label": "vc-item-need_plan", "isMenu": false, "bindable": true, "pingWheelBindable": true },
{ "id": "Yes", "category": "default", "label": "vc-item-yes", "isMenu": false, "bindable": true, "pingWheelBindable": true },
{ "id": "You're Welcome", "category": "default", "label": "vc-item-youre_welcome", "isMenu": false, "bindable": true, "pingWheelBindable": true },

{ "id": "Defend Blue", "category": "hidden", "label": "vc-item-defend_blue", "isMenu": false, "bindable": false, "pingWheelBindable": true },
{ "id": "Defend Green", "category": "hidden", "label": "vc-item-defend_green", "isMenu": false, "bindable": false, "pingWheelBindable": true },
{ "id": "Defend Purple", "category": "hidden", "label": "vc-item-defend_purple", "isMenu": false, "bindable": false, "pingWheelBindable": true },
{ "id": "Defend Yellow", "category": "hidden", "label": "vc-item-defend_yellow", "isMenu": false, "bindable": false, "pingWheelBindable": true },
{ "id": "Headed to Blue Subnav", "category": "hidden", "label": "vc-item-headed_to_blue", "isMenu": false, "bindable": false, "pingWheelBindable": true },
{ "id": "Heading to Green Subnav", "category": "hidden", "label": "vc-item-heading_to_green", "isMenu": false, "bindable": false, "pingWheelBindable": true },
{ "id": "Headed to Purple Subnav", "category": "hidden", "label": "vc-item-headed_to_purple", "isMenu": false, "bindable": false, "pingWheelBindable": true },
{ "id": "Heading to Yellow Subnav", "category": "hidden", "label": "vc-item-heading_to_yellow", "isMenu": false, "bindable": false, "pingWheelBindable": true },
{ "id": "Push Blue", "category": "hidden", "label": "vc-item-push_blue", "isMenu": false, "bindable": false, "pingWheelBindable": true },
{ "id": "Push Green", "category": "hidden", "label": "vc-item-push_green", "isMenu": false, "bindable": false, "pingWheelBindable": true },
{ "id": "Push Purple", "category": "hidden", "label": "vc-item-push_purple", "isMenu": false, "bindable": false, "pingWheelBindable": true },
{ "id": "Push Yellow", "category": "hidden", "label": "vc-item-push_yellow", "isMenu": false, "bindable": false, "pingWheelBindable": true },

{ "id": "Good Game (Post Game) - All Chat", "category": "broken", "label": "vc-item-good_game_post_game_all_chat", "isMenu": false, "bindable": false, "pingWheelBindable": false },
{ "id": "Good Job (Post Game) - All Chat", "category": "broken", "label": "vc-item-good_job_post_game_all_chat", "isMenu": false, "bindable": false, "pingWheelBindable": false },
{ "id": "Thanks (Post Game) - All Chat", "category": "broken", "label": "vc-item-thanks_post_game_all_chat", "isMenu": false, "bindable": false, "pingWheelBindable": false },
{ "id": "Well Played (Post Game) - All Chat", "category": "broken", "label": "vc-item-well_played_post_game_all_chat", "isMenu": false, "bindable": false, "pingWheelBindable": false },
{ "id": "Missing", "category": "broken", "label": "vc-item-missing", "isMenu": false, "bindable": true, "pingWheelBindable": true },
{ "id": "Pinged Enemy Player", "category": "broken", "label": "vc-item-pinged_enemy_player", "isMenu": false, "bindable": false, "pingWheelBindable": false },
{ "id": "Pinged Teammate", "category": "broken", "label": "vc-item-pinged_teammate", "isMenu": false, "bindable": false, "pingWheelBindable": false },

{ "id": "Going to Shop", "category": "default", "label": "vc-item-going_to_shop", "isMenu": false, "bindable": true, "pingWheelBindable": true },
{ "id": "Request Follow", "category": "default", "label": "vc-item-request_follow", "isMenu": false, "bindable": true, "pingWheelBindable": true },
{ "id": "Going to Gank", "category": "default", "label": "vc-item-going_to_gank", "isMenu": false, "bindable": true, "pingWheelBindable": true },
{ "id": "Rejuv Drop", "category": "default", "label": "vc-item-rejuv_drop", "isMenu": false, "bindable": true, "pingWheelBindable": true },
{ "id": "Need Cover", "category": "default", "label": "vc-item-need_cover", "isMenu": false, "bindable": true, "pingWheelBindable": true },
{ "id": "Nevermind", "category": "default", "label": "vc-item-nevermind", "isMenu": false, "bindable": true, "pingWheelBindable": true },
{ "id": "No Teamfight", "category": "default", "label": "vc-item-no_teamfight", "isMenu": false, "bindable": true, "pingWheelBindable": true },
{ "id": "Press The Advantage", "category": "default", "label": "vc-item-press_the_advantage", "isMenu": false, "bindable": true, "pingWheelBindable": true },
{ "id": "Lets Hide Here", "category": "default", "label": "vc-item-lets_hide_here", "isMenu": false, "bindable": true, "pingWheelBindable": true },
{ "id": "Its Dangerous", "category": "default", "label": "vc-item-its_dangerous", "isMenu": false, "bindable": true, "pingWheelBindable": true },
{ "id": "I'll Clear Troopers", "category": "default", "label": "vc-item-ill_clear_troopers", "isMenu": false, "bindable": true, "pingWheelBindable": true },
{ "id": "Meet Here", "category": "default", "label": "vc-item-meet_here", "isMenu": false, "bindable": true, "pingWheelBindable": true },
{ "id": "Flank", "category": "default", "label": "vc-item-flank", "isMenu": false, "bindable": true, "pingWheelBindable": true },
{ "id": "Pregame Pings", "category": "broken", "label": "vc-item-pregame_pings", "isMenu": false, "bindable": false, "pingWheelBindable": false },
```

Notes for vendoring:

- Only 3 entries have `isMenu: true`: `Defend Lane`, `Headed to Lane`,
  `Push Lane` (the submenu-opening commands). All other `isMenu` are `false`.
  [VERIFIED: voice_commands_db.gd URL above]
- Every `hidden` entry has `bindable: false, pingWheelBindable: true`: hidden
  commands are the ones ChatLane exists to unlock on the stock Chat Wheel, and
  they are already ping-wheel available by default.
  [VERIFIED: voice_commands_db.gd URL above]
- `Missing` is `broken` yet `bindable: true, pingWheelBindable: true`; it is
  the odd entry out and should keep its exact values.
  [VERIFIED: voice_commands_db.gd URL above]
- Categories are exactly `default`, `hidden`, `broken`, surfaced by
  `grouped_by_categories()` and per-category help text keys
  `vc-category-<cat>-help`.
  [VERIFIED: voice_commands_db.gd URL above]
- Apostrophes are literal in the ids (`You're Welcome`, `I'll Clear Troopers`).
  `config.gd` runs a migration replacing escaped `You\'re Welcome` / `I\'ll
  Clear Troopers` with the straight apostrophe form, so the canonical display
  string is the straight-apostrophe one.
  [VERIFIED: https://raw.githubusercontent.com/RedMser/ChatLane/master/GUI/autoload/config.gd]

### 2.2 Wire format and loader validation

- `CLI/example.yml` shows both maps keyed on unquoted display strings with
  boolean values:
  [VERIFIED: https://raw.githubusercontent.com/RedMser/ChatLane/master/CLI/example.yml]
  ```
  override_bindable:
    Good Game (Post Game) - All Chat: true
    Well Played (Post Game) - All Chat: true
  override_ping_wheel_bindable:
    Well Played (Post Game) - All Chat: true
  ```
- `config.gd` loader rules:
  - `override_bindable` must be a dictionary, all keys strings, all values
    bools, or the map is rejected with validation errors.
  - `override_ping_wheel_bindable` defaults to `{}` when absent
    (`var temp = data.get("override_ping_wheel_bindable", {})`, commented
    "backwards compat!"). Same string-key/bool-value validation.
  - The ping wheel map was added later than the bindable map, which is why
    absence and empty map must both be representable.
  [VERIFIED: https://raw.githubusercontent.com/RedMser/ChatLane/master/GUI/autoload/config.gd]

### 2.3 The current form model (`src/lib/chatWheelModel.ts`)

[VERIFIED: src/lib/chatWheelModel.ts]

- `interface ChatWheelMenu { name: string; icon: string; items: string[] }`
  (lines 1-5); `interface ChatWheelModel { name: string; menus: ChatWheelMenu[] }`
  (lines 7-10).
- `parseChatWheelYaml(yaml: string): ChatWheelModel` (lines 20-53). Normalizes
  CRLF to LF, regex-finds `name:` and the `custom_menus:` block, parses
  `  - name:`, `    icon:`, `    items:`, `      - item` lines, and stops at
  the first non-indented non-comment line. Unknown root text is simply never
  touched.
- `updateChatWheelYaml(yaml: string, model: ChatWheelModel): string` (lines
  68-84). Rewrites the `name:` line and splices the whole `custom_menus:` block
  (start line through the first dedent) with `customMenusBlock()`. Unknown
  root options, comments, and other root fields BEFORE the custom_menus block
  survive because only owned blocks are replaced. CORRECTION (2026-08-31): the
  block end-scan at line 82 treats column-0 comments and the trailing empty
  line as part of the block, so trailing comments and the file-final newline
  are swallowed by the splice today; plan 09-01 Task 2 fixes this scan as a
  prerequisite of its identity round-trip truth.
- Helpers: `unquote(value)` trims and strips a single matching quote pair;
  `quote(value)` returns the raw value when it matches
  `/^[A-Za-z0-9 _.-]+$/`, else `JSON.stringify(value)` (lines 12-13).

Extension point for the override maps: the same find-start /
extend-until-dedent / splice pattern used for `custom_menus` (lines 74-83)
applies to `override_bindable:` and `override_ping_wheel_bindable:`. The model
would gain two optional maps. CRITICAL design note: `quote()` does NOT include
`(` or `)` in its safe class, so rewriting a key like
`Good Game (Post Game) - All Chat` would emit `"Good Game (Post Game) - All
Chat": true` (double-quoted). That is valid YAML and parses fine, but it
changes bytes vs the unquoted form in `example.yml`. To honor D-05 (preserve
untouched entries and ordering byte-for-byte), the update should preserve
original per-entry lines and only serialize newly added or changed entries.
[VERIFIED: src/lib/chatWheelModel.ts:12-13, 74-84; https://raw.githubusercontent.com/RedMser/ChatLane/master/CLI/example.yml]
[ASSUMED: preserving original per-entry lines is the recommended in-place strategy]

### 2.4 Test infrastructure

- Vitest, node environment by default; jsdom is per-file via
  `// @vitest-environment jsdom`. Includes `src/**/*.test.ts(x)`,
  `electron/**/*.test.ts`, and `scripts/**/*.test.ts`. [VERIFIED: vitest.config.ts:7-15]
- `electron/main/services/chatWheel.test.ts`: `vi.mock('electron', ...)` +
  `vi.mock('child_process', ...)` stubbing `spawn` to write the output file and
  emit `close(0)`. Only `validateChatWheelYaml` is exercised today; the audit
  explicitly flags `chat-wheel:read` and `chat-wheel:starter` as untested.
  [VERIFIED: electron/main/services/chatWheel.test.ts:1-51;
  docs/audit-2026-07-28-verdicts.md:338]
- `electron/main/services/chatWheel.roundtrip.test.ts`: `vi.hoisted` harness
  for `app.getAppPath`, eager `chatLaneBinaryPath()` skip guard with
  `describe.skipIf(!binaryAvailable)`, real-binary round trip of the starter,
  temp-dir leak assertions via `chatWheelTempDirsCreatedSince`.
  [VERIFIED: electron/main/services/chatWheel.roundtrip.test.ts:16-126]
- Renderer page test `src/pages/ChatWheel.test.tsx`: jsdom, mocks
  `../lib/api` and `../stores/appStore` via `vi.hoisted`, renders with
  `createRoot` + `act`, settles effects with a double `flush()`.
  [VERIFIED: src/pages/ChatWheel.test.tsx:1-116]
- The IPC handlers `chat-wheel:read` and `chat-wheel:starter` are thin
  one-liners over `readChatWheelVpk` / `readChatWheelStarter`
  (electron/main/ipc/chatWheel.ts:21-23). Service-level tests in
  `chatWheel.test.ts` (always-run, stubbed) match the existing pattern and
  close the audit gap without ipcMain mocking.
  [VERIFIED: electron/main/ipc/chatWheel.ts:21-23]
  [ASSUMED: service-level coverage is sufficient; no IPC-handler test exists in the repo today]

### 2.5 Shared UI primitives

[VERIFIED: src/components/common/]

- `SearchInput` (`SearchInput.tsx`): value/onChange/placeholder/scope/
  clearLabel/optional label+summary; labelled clear button, Escape clears,
  live `ResultSummary` region ("Showing X of Y"). The established search
  surface contract.
- `SegmentedControl` + `useSegmentedTabs` (`ui.tsx:496-574`,
  `useSegmentedTabs.ts`): role=tablist with roving arrow-key focus and
  aria-selected. NOTE: the file itself warns that `role="tab"` promises a
  panel and a non-panel filter should use plain buttons with `aria-pressed`
  instead (Browse's view options are the cited example). Category filter chips
  should therefore be either SegmentedControl + tabpanel body, or plain
  `aria-pressed` buttons.
- `Toggle` (`ui.tsx:306-331`): two-state switch (role=switch, sr-only
  checkbox + visual knob). Not three-state on its own.
- `CheckboxMark` (`ui.tsx:135-161`): visual check/indeterminate/unchecked
  span driven by peer focus; `indeterminate` is the only existing
  three-state visual in the codebase.
- `Badge` / `Tag` (`ui.tsx:55-125`): status chips (success/warning/error/
  info/neutral; accent/warning/danger/success/info/neutral) for "game
  default" status rows.
- `forms.tsx`: `Input`, `Textarea`, `Select`, `FormField` (label + hint/error
  wired with `useId`, `aria-invalid`, `aria-describedby`). The canonical
  control surface.
- Collapsible section precedent: ChatWheel.tsx uses a native
  `<details>/<summary>` for Advanced YAML (lines 381-387); open-state is NOT
  persisted today (D-06 asks for session retention).
- There is no three-state tri-state input primitive. The catalogue row
  controls (inherit/on/off) will be new UI; a 3-option SegmentedControl per
  row, or three `aria-pressed` buttons, or a custom indeterminate checkbox are
  the building blocks. `CheckboxMark` already draws the indeterminate glyph.
  [ASSUMED: a 3-option segmented control per row is the simplest accessible choice]

### 2.6 i18n gates and the `chatWheel.*` namespace

- `chatWheel.*` namespace exists at `src/locales/en/translation.json:3857-3900`
  with keys up to `chatWheel.disabled.description`.
  [VERIFIED: src/locales/en/translation.json:3857-3900]
- `pnpm i18n:check` runs `scripts/check-i18n.mjs`: scans every `.ts/.tsx` in
  `src/` for `t('key')` and `<Tx k="key">` and fails if the en catalog lacks
  the key. [VERIFIED: scripts/check-i18n.mjs:1-54]
- `pnpm i18n:manifest` runs `scripts/gen-locale-manifest.mjs` (regenerate the
  committed `src/locales/manifest.json`; `--check` mode in CI).
  [VERIFIED: scripts/gen-locale-manifest.mjs:1-60; package.json:35,39]
- Catalogue display strings are DATA, not UI copy (D-02), so they must be
  rendered as raw strings, never through `t()`. Only the surrounding UI copy
  (titles, legend, empty state, category chips, "Other commands in this file"
  group) needs `chatWheel.*` keys. This also keeps `check-i18n.mjs` happy: raw
  strings are not `t('...')` calls and are invisible to the gate.
  [VERIFIED: scripts/check-i18n.mjs:36-37]

### 2.7 starter.yml and provenance

- `resources/chatlane/starter.yml` already ships both maps empty:
  `override_bindable: {}` (line 5) and `override_ping_wheel_bindable: {}`
  (line 6), between `name:` and `custom_menus:`. D-07 says keep them empty and
  show inherited defaults in the UI. [VERIFIED: resources/chatlane/starter.yml:5-6]
- The round-trip test's comment claims the starter comes back byte-for-byte
  including CRLF endings, but CORRECTION (2026-08-31): starter.yml is LF-only
  (zero CR bytes), and the suite's actual assertion is trimmed equality
  (`roundTripped.trim()` vs `yaml.trim()`), not byte-for-byte. The comment at
  roundtrip.test.ts:66-71 is the sole source of the CRLF claim and is stale.
  [VERIFIED: electron/main/services/chatWheel.roundtrip.test.ts:66-84; od -c resources/chatlane/starter.yml]
- `resources/chatlane/` contains `ChatLane.exe`, `LICENSE`, `starter.yml`,
  `TinyEXR.Native.dll`, `libSkiaSharp.dll`. The LICENSE is `MIT License,
  Copyright (c) 2024 RedMser`.
  [VERIFIED: resources/chatlane/LICENSE:1-3]
- `docs/chat-wheel.md:4` links `https://github.com/onionviolet/chatlane-grimoire`,
  which returns **404 Not Found**.
  [VERIFIED: web fetch of https://github.com/onionviolet/chatlane-grimoire -> 404]
  `docs/chat-wheel.md:6-8` describes the converter as "a derivative of the
  original RedMser/ChatLane" with MIT LICENSE distributed alongside.
  [VERIFIED: docs/chat-wheel.md:4-8]
- No script or doc pins the exact ChatLane commit/release the bundled
  `ChatLane.exe` was built from (no match for `ChatLane` in `scripts/`).
  [VERIFIED: grep of scripts/ for ChatLane, no matches]
  The current RedMser/ChatLane master head is
  `9a71e229f30e7a899699aa5f24d1fbe88da8ce00` (2026-01-24), which is where the
  quoted VC_LIST lives.
  [VERIFIED: https://api.github.com/repos/RedMser/ChatLane/commits/master]
  Whether the bundled binary matches that exact commit is NOT verifiable from
  the repo alone; this is the provenance risk the planner must pin down.
  [ASSUMED: pin the catalogue provenance comment to RedMser/ChatLane master at
  the commit above, and record the binary-vs-source version as an open
  verification item]

---

## 3. Patterns and Precedents

- **Vendored typed data with provenance comments:** `src/lib/chatWheelIcons.ts`
  exports a `ReadonlyArray<{ name, url }>` with a comment naming
  RedMser/ChatLane and the source paths, plus a lookup helper. The catalogue
  module follows the same shape (typed readonly array + provenance + a
  find-by-id helper). [VERIFIED: src/lib/chatWheelIcons.ts:1-41]
- **Byte-for-byte preservation:** `parseChatWheelYaml` / `updateChatWheelYaml`
  demonstrate the owned-block splice for unknown root text and comments before
  the custom_menus block, and `chatWheelModel.test.ts:11-16` asserts it with
  `toContain` (not full-string equality, which is why the trailing-text
  swallowing noted in 2.3 has never been caught). Plan 09-01 fixes the end-scan
  and upgrades the assertion to whole-string identity.
  [VERIFIED: src/lib/chatWheelModel.ts:67-84; src/lib/chatWheelModel.test.ts:11-16]
- **Unknown-value honesty:** unknown icon names render as "no icon" rather
  than failing (`chatWheelIcons.ts:7-9`, `RadialWheelPreview.tsx:10`). The
  "Other commands in this file" group follows the same philosophy: unknown IDs
  render raw and stay editable. There is NO existing
  "Other commands in this file" group in the codebase; it is new UI.
  [VERIFIED: src/lib/chatWheelIcons.ts:7-9; src/components/chatwheel/RadialWheelPreview.tsx:10]
- **Main-process service test patterns:** stubbed `child_process.spawn`
  (chatWheel.test.ts) for the always-run suite, real binary + skipIf guard
  (roundtrip.test.ts) for the fidelity suite. The new `readChatWheelStarter`
  and `readChatWheelVpk` tests slot into both.
  [VERIFIED: electron/main/services/chatWheel.test.ts; electron/main/services/chatWheel.roundtrip.test.ts]
- **Page test patterns:** mock `../lib/api` + `../stores/appStore` with
  `vi.hoisted`, render through `createRoot` + `act` + double `flush()`.
  [VERIFIED: src/pages/ChatWheel.test.tsx:22-81]

---

## 4. Risks and Pitfalls

1. **Key formatting drift (byte preservation):** rewriting a whole override
   map block with the current `quote()` helper would double-quote keys that
   contain `(`/`)` (every post-game command). Only changed/new entries should
   be serialized; untouched entries must keep their original line text. This
   is the single biggest correctness risk for D-05.
2. **Absent vs empty vs explicit (D-05/D-07):** an absent map key in YAML is
   "no map at all" (must not be created on parse); an empty `{}` map is a
   present block that the model must be able to write back; an explicit entry
   is one key. The three states must survive model round trips. `config.gd`
   treats absent ping-wheel map as `{}`, so writing an empty map when the
   source had none is a behavior change a strict round-trip test will catch.
3. **Binary version vs catalogue version:** the bundled `ChatLane.exe` is not
   pinned to a source commit in the repo, and the fork URL in `docs/chat-wheel.md`
   is dead. The VC_LIST at master head is the best available reference, but the
   plan must verify (or explicitly defer) whether the binary embeds the same
   command set, e.g. by building a VPK with each new command and reading it
   back, or by checking ChatLane release notes for the appended block.
4. **`Pregame Pings` and the second default block:** these 14 entries sit at
   the end of VC_LIST and postdate `example.yml`'s comment list. Vendoring them
   is correct for the catalogue, but beware assuming the bundled binary or the
   user's game build knows them. They are harmless as catalogue rows (the
   loader validates keys as strings, not against a known set).
5. **Apostrophes in ids:** `You're Welcome` and `I'll Clear Troopers` carry
   literal apostrophes. YAML allows unquoted apostrophes, but the current
   `quote()` (JSON.stringify) would double-quote them on write. Tests must
   cover quoting/unquoting of apostrophe ids.
6. **Three-state control does not exist:** `Toggle` is binary; `CheckboxMark`
   supports indeterminate visually only. The plan must define the row control
   semantics (inherit = no YAML entry) and its a11y pattern explicitly.
7. **CRLF vs LF:** the model normalizes CRLF to LF on every
   `parse`/`update`. CORRECTION (2026-08-31): starter.yml is LF-only; the
   round-trip test comment claiming CRLF is stale (the suite compares trimmed
   strings). YAML extracted from a VPK by the converter may still carry CRLF,
   in which case a model round trip normalizes line endings by design; byte
   identity claims are therefore scoped to LF input.
8. **Category chips vs tablist contract:** `SegmentedControl` is a tablist and
   promises a panel. Category filters are a filter, not a tab switch; use
   plain `aria-pressed` buttons unless a panel is actually provided, or the
   design brief's shell rule is violated.
9. **`isMenu` is only for provenance and display:** custom-menu submenu
   commands (`Defend Lane`, `Headed to Lane`, `Push Lane`) are normal
   bindable commands in the catalogue, not a separate surface. Do not build
   navigation off `isMenu`.

---

## 5. Recommended Approach

1. **Vendor the catalogue** as `src/lib/chatWheelCommands.ts` (per
   REQ-cw-command-catalogue), a `ReadonlyArray<ChatWheelCommand>` with fields
   `id` (display string = YAML key), `label` (the `vc-item-*` key, provenance
   only), `category: 'default' | 'hidden' | 'broken'`, `isMenu`, `bindable`,
   `pingWheelBindable`. Include a provenance comment naming
   RedMser/ChatLane master at `9a71e229f30e7a899699aa5f24d1fbe88da8ce00`
   (or the verified pinned commit) plus a 3-line update procedure, mirroring
   `chatWheelIcons.ts`. Add a `findById` helper. Add a small YAML fixture with
   known and unknown entries so parser tests stay independent of the full
   catalogue.
2. **Extend the model** with
   `overrideBindable?: Record<string, boolean>` and
   `overridePingWheelBindable?: Record<string, boolean>` on `ChatWheelModel`.
   Parse each map by locating the `override_bindable:` / 
   `override_ping_wheel_bindable:` line and reading indented `key: bool` lines
   until dedent; leave a missing map `undefined` (distinct from `{}`). Update
   each owned block in place: keep original line text for untouched entries,
   preserve ordering (JS object string-key insertion order preserves it),
   replace the value line of toggled entries, append new entries, delete the
   line of entries removed, and splice the block out entirely only when the
   model map is `undefined`. Extend `quote()` handling if keys need to match
   ChatLane GUI style.
3. **Build `src/components/chatwheel/BaseCommandCatalog.tsx`** (beside
   `RadialWheelPreview.tsx`): `SearchInput` + plain `aria-pressed` category
   chips (all/default/hidden/broken) + compact count, rows with raw display
   string and a game-default status chip (`Badge`/`Tag`), and two controls per
   row ("Chat Wheel / bind" writes `override_bindable`, "Ping wheel" writes
   `override_ping_wheel_bindable`). Each control is a 3-state
   inherit/on/off control; state derives from the YAML map when the key is
   present, else the catalogue default (D-04). Render a visible "Other
   commands in this file" group for YAML keys absent from the catalogue, with
   editable booleans. `CheckboxMark`'s indeterminate glyph covers the inherit
   visual; wire accessible labels and focus.
4. **Integrate into `src/pages/ChatWheel.tsx`** as a collapsible
   `<details>/<summary>` section beneath "Menus and commands" (line 320),
   initially open for new drafts and kept open across edits within a session
   (local component state). Keep Advanced YAML as the escape hatch; every
   YAML change flows through `parseChatWheelYaml` so manual edits update the
   controls (lines 34, 59). The model-to-YAML path stays
   `applyModel` -> `updateChatWheelYaml`.
5. **Close the test gap** in `electron/main/services/chatWheel.test.ts`
   (stubbed, always runs): `readChatWheelStarter` returns the template
   contents and throws when the template is missing; `readChatWheelVpk`
   validates path, extracts to a temp dir, and cleans up (mirroring the
   existing spawn stub that writes the output file). Keep the real-binary
   coverage in the roundtrip suite. Add model tests for absent vs empty vs
   explicit maps, quoted/unquoted keys, apostrophe ids, toggle-without-loss,
   and form-to-YAML-to-form round trips. Add component tests for
   search/filter and three-state display.
6. **i18n:** add `chatWheel.catalog.*` keys for the section title, legend,
   search scope/placeholder, category chip labels, empty state, and the
   "Other commands in this file" group. Raw command display strings are data
   and stay out of `translation.json` (D-02). Run `pnpm i18n:check` and
   `pnpm i18n:manifest` after any catalog change.

---

## 6. Validation Considerations

- `pnpm typecheck`, `pnpm lint`, `pnpm test` are the repository gate; plus
  `pnpm i18n:check` and `pnpm i18n:manifest` (gen-locale-manifest.mjs --check)
  for catalog changes. [VERIFIED: CLAUDE.md conventions; package.json scripts]
- Byte-for-byte checks: round-trip a starter.yml with both maps `{}`, then a
  YAML with known + unknown entries + comments, through
  `parseChatWheelYaml` -> `updateChatWheelYaml` with no edits and assert the
  untouched text (including unknown keys, ordering, comments) is unchanged.
  Toggle one entry and assert only that entry's line changes.
- Three-state matrix test: for each of the 4 combos (catalogue default true/
  false x map present/absent), assert the derived control state.
- Round-trip through the real binary: the roundtrip suite's starter test is
  the anchor; extend it to a fixture with populated override maps if the plan
  adds one.
- Manual verification per the plan: save a wheel enabling one normally hidden
  command in each map, confirm it appears in Deadlock's Chat Wheel settings,
  can be assigned, and survives reopening the VPK in Grimoire.
  [CITED: docs/chat-wheel-option-catalog-plan.md, slice 5]
- Provenance check: pin and record the ChatLane commit the catalogue was
  vendored from, and record whether the bundled binary's command set was
  verified against it (currently unverifiable from the repo alone).
