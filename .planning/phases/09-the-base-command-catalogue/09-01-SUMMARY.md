---
phase: 09-the-base-command-catalogue
plan: 01
subsystem: chat-wheel
tags: [catalogue, yaml, byte-preservation, chatlane]

requires: []
provides:
  - src/lib/chatWheelCommands.ts (53-entry vendored catalogue, provenance-pinned to ChatLane 9a71e22)
  - findChatWheelCommand / CHAT_WHEEL_COMMAND_COUNTS
  - ChatWheelModel.overrideBindable / .overridePingWheelBindable
  - In-place override-map editing in updateChatWheelYaml
  - OverrideState / overrideStateFor / applyOverride (pure UI seam for plan 09-03)
affects: [REQ-cw-command-catalogue, REQ-cw-override-editing]

actuals:
  tokens: 0
  tasks: 2
  commits: 0

one_liner: The command catalogue is owned, typed, pinned data, and the form model reads and writes both override maps without touching a byte it does not own.
---

# Plan 09-01 Summary: The catalogue and the byte-preserving override maps

## Delivered

**Task 1 - `src/lib/chatWheelCommands.ts` + test (new)**

- 53 entries in VC_LIST order (20 default, 12 hidden, the 7-entry broken block,
  13 late default entries, `Pregame Pings` last), generated mechanically from
  the verbatim block in 09-RESEARCH section 2.1 rather than retyped, so no
  field value can drift from the source.
- Header comment pins commit `9a71e229f30e7a899699aa5f24d1fbe88da8ce00`
  (master, 2026-01-24), states that the id IS the YAML override-map key, that
  `label` is provenance-only, that the bundled ChatLane.exe's build commit is
  unverified, and gives the three-line update procedure.
- `findChatWheelCommand` is an exact match: no trim, no case folding (the
  chatWheelIcons normalization is deliberately NOT copied, it would break
  round-trip). `CHAT_WHEEL_COMMAND_COUNTS` is derived at module load.
- 8 tests, quantified over the array rather than sampled: the 53/33/12/8
  counts, the three `isMenu` ids, every hidden entry unbindable and ping-wheel
  bindable, `Missing` as the bindable odd one out against the other 7 broken
  entries, straight ASCII apostrophes, id uniqueness, exact-match lookup.

**Task 2 - `src/lib/chatWheelModel.ts` + test (extended)**

- `ChatWheelModel` gains the two optional maps; absent stays absent, `{}` stays
  `{}`, populated keeps insertion order.
- `parseOverrideMap` shares the menu parser's stop rule; comment lines that
  look like entries (`  # note: true`) are excluded by an explicit guard.
- **Prerequisite fix:** the `custom_menus` end-scan now stops one past the last
  INDENTED NON-BLANK line (`blockEnd`). Column-0 trailing comments and the
  file-final newline used to be swallowed by the splice; indented comments stay
  inside the owned range so `customMenusBlock`'s own `# Add a command below`
  placeholder is not duplicated on every update.
- `applyOverrideBlock` edits in place: a changed entry keeps its original key
  text and only its boolean token is rewritten; unparsed lines are never
  rewritten and never deleted; adds land immediately after the last parsed
  entry line; an emptied block collapses to `root: {}` unless preserved lines
  remain; `undefined` deletes the block; a defined map with no block appends
  one at the end.
- New keys serialize through `overrideKey`, whose regex allows parentheses,
  apostrophes and `/` (so `quote()` cannot corrupt post-game command keys) and
  quotes YAML 1.1 reserved scalars, so a new `Yes` / `No` entry is written
  `"Yes": true`.
- 16 tests, including `expect(updated).toBe(yaml)` identity on a fixture with a
  parenthesized unquoted key, a double-quoted key, an apostrophe key, an
  unknown id, an unparseable `Weird Key: TRUE` line, an unknown root option,
  comments and a trailing comment; a single-toggle line-array diff proving
  exactly one line changed; absent-in/absent-out; the starter shape surviving a
  menu edit with one line added. The file imports nothing from
  `chatWheelCommands` (REQ-cw-command-catalogue).

## Gate Results

- `vitest run src/lib/chatWheelCommands.test.ts src/lib/chatWheelModel.test.ts` - pass (24 tests)
- `tsc -b` - pass
- `eslint .` - pass
- `node scripts/check-encoding.mjs` - clean (734 files)
- Full `vitest run`: 3 failed files / 26 failed tests, all pre-existing
  (browserDownloadCapture, heroStageMode, uiPrefs) and at or below the
  documented 9-file / 26-test baseline. No new failures.

## Notes / Carried Debt

- `overrideKey` is module-private: the plan's exported-symbol list does not
  include it, and it is covered through the `"Yes"` / `"No"` serialization test.
- Comments and blank lines INSIDE the `custom_menus` block are still destroyed
  by that block's wholesale regeneration. Pre-existing, out of scope, and the
  identity claims are scoped to text outside that block.
- `JSON.stringify` escapes `"` and `\` on write while `unquote` strips only the
  outer quote pair, so a user key containing either would not round-trip. No
  catalogue id contains either character.
