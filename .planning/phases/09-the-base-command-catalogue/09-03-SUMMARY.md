---
phase: 09-the-base-command-catalogue
plan: 03
subsystem: chat-wheel
tags: [ui, i18n, a11y, override-editing]

requires:
  - 09-01 (chatWheelCommands.ts, overrideStateFor/applyOverride)
provides:
  - TriStateControl (inherit/on/off, roving tabindex, no tab semantics)
  - BaseCommandCatalog (search, category chips, game-default tags, unknown-key group)
  - The Chat Wheel page's Base command catalogue section, wired to the byte-preserving YAML path
  - 36 chatWheel.catalog.* i18n keys and a regenerated locale manifest
affects: [REQ-cw-override-editing]

actuals:
  tokens: 0
  tasks: 2
  commits: 0

one_liner: Both override maps now have a searchable, filterable, keyboard-accessible form surface that is a pure projection of the parsed YAML.
---

# Plan 09-03 Summary: The base command catalogue UI

## Delivered

**Task 1 - the components**

- `src/components/chatwheel/chipStyles.ts` (new, not in the plan's file list):
  `chipClass()` and `rovingArrowKeyDown()` live here rather than in
  `TriStateControl.tsx` because eslint's `react-refresh/only-export-components`
  rejects a component module that also exports helpers. Behaviour is exactly as
  the UI spec describes; only the file boundary moved.
- `src/components/chatwheel/TriStateControl.tsx`: `role="group"` of three
  `aria-pressed` buttons (Minus/Check/X), the pressed one carrying `tabIndex 0`
  and the others `-1`. Arrow keys (all four) move DOM focus between siblings and
  never call `onChange`, deliberately unlike `SegmentedControl`, which selects on
  arrow: activation here writes saved YAML.
- `src/components/chatwheel/BaseCommandCatalog.tsx`: toolbar (`SearchInput` plus
  four single-select `aria-pressed` chips carrying the static totals 53/33/12/8
  from `CHAT_WHEEL_COMMAND_COUNTS`), legend, `sm`+ column header row,
  `role="list"` rows, the conditional broken caveat, and the "Other commands in
  this file" group. Row values come from `overrideStateFor`; every change is
  handed up as `(id, map, state)`. The unknown-key group uses its own two-state
  On/Off pair plus a muted "Not set", never the three-state control, and writes
  an explicit `false` rather than deleting a key. `loading` and `disabled` stay
  separate props so a save does not blank the list.
- Game-default tags: success/neutral for `default`, info + tooltip for `hidden`,
  warning + tooltip for `broken`, plus the neutral ping-default tag on exactly
  the 15 commands where `pingWheelBindable !== bindable`.
- 36 `chatWheel.catalog.*` keys added to `src/locales/en/translation.json` under
  the existing `chatWheel` object; `src/locales/manifest.json` regenerated. No
  raw command id entered the catalog.
- `BaseCommandCatalog.test.tsx`: 13 tests covering row count, search + summary,
  each chip's count, tri-state derivation, the emitted triple, the ping-tag
  divergence set, the broken caveat's appear/disappear, the zero and non-zero
  unknown-key cases, the empty state and its clear action, loading skeletons +
  disabled controls, the keyboard case (tabIndex layout, ArrowRight moves focus,
  `onChange` not called), and the absence of `role="tab"`/`role="tablist"`.

**Task 2 - page integration**

- `src/pages/ChatWheel.tsx`: `catalogOpen` state defaulting to `true`, a
  `<details>` section between the editor/preview grid and the icon `<datalist>`,
  and `onSetOverride` routing through `applyOverride` then `applyModel`, i.e.
  `updateChatWheelYaml`. The `onToggle` handler is idempotent, since React 19
  emits one toggle on mount for a controlled `details`.
- `src/pages/ChatWheel.test.tsx`: the `getChatWheelStarter` mock now returns the
  real starter shape (both override maps as inline `{}`), so the round trip
  exercises the inline-to-block path that actually ships. One new test asserts
  the section renders open, that pressing On for `Can Heal` puts
  `override_bindable:\n  Can Heal: true` in the textarea, and that a manual
  textarea edit to `false` flips that row's Off button to pressed. The three
  pre-existing gate tests are untouched and still pass.
- `docs/chat-wheel.md`: new "Base command catalogue" section describing search,
  filters, the three-state overrides and the unknown-key group, plus the note
  that the fork's repository link is not publicly readable (404) and the
  catalogue is therefore pinned to an upstream RedMser commit. The
  "never edits gameinfo.gi" rule is intact and restated.

## Gate Results

- `vitest run src/components/chatwheel/BaseCommandCatalog.test.tsx src/pages/ChatWheel.test.tsx src/lib/chatWheelModel.test.ts` - pass (3 files, 33 tests)
- `tsc -b` - exit 0
- `eslint src/pages/ChatWheel.tsx src/components/chatwheel` - exit 0
- `node scripts/check-i18n.mjs` - exit 0 (all 2839 referenced keys exist)
- `node scripts/gen-locale-manifest.mjs` then `--check` - exit 0
- `node scripts/check-encoding.mjs` - exit 0 (738 files clean)
- `grep` checks: no `role="tab"` in rendered output (only the test's negative
  assertion and a comment in TriStateControl mention the string), no
  `SegmentedControl`/`useSegmentedTabs`/`<Toggle>` usage, no U+2014 in
  `src/components/chatwheel/` or `docs/chat-wheel.md`, no raw command id in
  `translation.json`.

## Notes / Carried Debt

- `check-i18n.mjs` lists `chatWheel.catalog.filterAll|filterBroken|filterDefault|filterHidden|stateInherit`
  as informationally unused: the filter chips hold their keys in a `FILTERS`
  data table and `stateInherit` sits in the `OPTIONS` table, so the script's
  literal-`t('...')` scan does not see them. They are all really used; the check
  still exits 0.
- `statusNotBindable` is unreachable with the pinned commit's data, by design
  (a future `VC_LIST` change should degrade honestly rather than mislabel).
- No in-app verification was run: this plan has no CDP step, and the full test
  suite was deliberately not run per the scoped-gate instruction.
- The section defaults open on every load rather than only for new drafts, the
  deliberate D-06 simplification the plan calls out; the user's toggle is
  retained for the session.
