---
phase: 10-wheel-interaction-and-disclosure
plan: 01
subsystem: chat-wheel
tags: [ui, i18n, a11y, drag-drop, disclosure]

requires:
  - 09-03 (BaseCommandCatalog, TriStateControl, chipStyles, the byte-preserving applyModel path)
provides:
  - LimitationNote (one inline disclosure per documented ChatLane limitation)
  - Roving-tabindex ring navigation on RadialWheelPreview (arrows wrap, Home/End, Enter/Space select, Alt+Arrow moves)
  - Native HTML5 drag-and-drop for catalogue rows, item rows, and wheel wedges, each with a keyboard alternative
  - chatWheelMenuEdit.ts (pure move/insert/transfer helpers and the private drag payload codec)
  - 5 chatWheel.limits.* and 10 chatWheel.dnd.* i18n keys, regenerated locale manifest
affects: [REQ-cw-limitations-disclosures, REQ-cw-keyboard-nav, REQ-cw-drag-drop]

actuals:
  tokens: 0
  tasks: 3
  commits: 1

one_liner: The wheel page now says what the game will actually do next to each affected control, the ring is a proper roving tab stop, and menus can be built by drag-and-drop without losing the keyboard floor.
---

# Plan 10-01 Summary: Wheel interaction and disclosure

## Delivered

**Criterion 1 - disclosures**

- `src/components/chatwheel/LimitationNote.tsx` (new): a `role="note"`
  paragraph with `data-limitation` and an info glyph, keyed by a closed
  `ChatWheelLimitation` union. Copy lives in one table and states game and
  ChatLane capability (no note uses "will"). `docs/chat-wheel.md` gained a
  "Known limitations" section so the doc is now the source the notes cite;
  the wording was checked against the upstream RedMser/ChatLane README, which
  is why the placeholder-voice note says the line plays when the menu itself
  is selected without picking an entry, rather than on every custom command.
- Placement in `src/pages/ChatWheel.tsx`: `topSlot` and `placeholderVoice`
  head the "Menus and commands" editor (they concern a menu as a whole);
  `archmotherOrder` and `slotSelect` sit directly under the radial preview
  (they concern how the ring behaves in game); `unbindCrash` sits above the
  Save & install row (it concerns the add-on that button creates).

**Criterion 2 - ring navigation**

- `RadialWheelPreview.tsx`: the wedges are one roving tab stop (`tabIndex 0`
  on the last-focused slot, `-1` elsewhere, jumping to whatever slot the form
  selects via the adjust-during-render pattern). ArrowRight/ArrowDown move
  clockwise, ArrowLeft/ArrowUp counter-clockwise, both wrapping; Home/End jump
  to the ends. Arrow keys move focus only and never select, matching the
  Phase 9 TriStateControl rule. Enter/Space still call `onSelectSlot`.

**Criterion 3 - drag-and-drop with keyboard alternatives**

- `src/lib/chatWheelMenuEdit.ts` (new, pure): `moveMenuItem`,
  `insertMenuItem`, `transferMenuItem`, plus `writeChatWheelDrag` /
  `readChatWheelDrag` / `hasChatWheelDrag` under a private MIME type
  (`application/x-grimoire-chat-wheel`) so stray file or text drops are
  ignored. Every result goes through the page's existing `applyModel`, i.e.
  `updateChatWheelYaml`; nothing new touches YAML text.
- Catalogue rows (`BaseCommandCatalog.tsx`): a drag handle on the name and a
  new `Add` column (icon button labelled "Add {{command}} to {{menu}}",
  disabled with a title when there is no menu). Both render only when the
  page passes `onAddToMenu`, so the component's Phase 9 contract is unchanged.
- Item rows (`ChatWheel.tsx`): rows are draggable; the item list is a drop
  zone (drop on a row inserts before it, elsewhere appends). Keyboard twins:
  Move up / Move down icon buttons, Alt+Up / Alt+Down on the command input,
  and a "Move to menu" select that appears only with two or more menus.
- Wheel wedges: draggable (via a spread, since React's SVG typings omit
  `draggable`); dropping a wedge on another reorders, dropping a catalogue
  command on a wedge inserts at that slot, on the surface appends. Alt+Arrow
  on a focused wedge is the keyboard twin of the wedge drag.
- Drag-and-drop does not recreate the game's own slot-binding editor.

**Criterion 4 - i18n and gates**

- 15 new keys, all under `chatWheel.limits.*` and `chatWheel.dnd.*`;
  `src/locales/manifest.json` regenerated. No em-dashes anywhere (the one
  negative assertion uses the `\u2014` escape).

## Files

- New: `src/components/chatwheel/LimitationNote.tsx`, `LimitationNote.test.tsx`,
  `RadialWheelPreview.test.tsx`, `src/lib/chatWheelMenuEdit.ts`,
  `chatWheelMenuEdit.test.ts`
- Changed: `src/components/chatwheel/RadialWheelPreview.tsx`,
  `BaseCommandCatalog.tsx`, `BaseCommandCatalog.test.tsx`,
  `src/pages/ChatWheel.tsx`, `ChatWheel.test.tsx`,
  `src/locales/en/translation.json`, `src/locales/manifest.json`,
  `docs/chat-wheel.md`

## Tests added

- `chatWheelMenuEdit.test.ts` (7): move/insert/transfer semantics, clamping,
  immutability, codec round trip and rejection of foreign or malformed drops.
- `RadialWheelPreview.test.tsx` (8): tab-stop layout and follow, arrow
  traversal with wrap plus Home/End, Enter/Space/append selection, Alt+Arrow
  move (and its absence without `onMoveItem`), wedge and surface drops,
  foreign drop ignored, `draggable` only when a handler is offered.
- `LimitationNote.test.tsx` (5): each disclosure renders with its id, its key
  phrase, no "will", no em-dash.
- `BaseCommandCatalog.test.tsx` (+4): Add column hidden by default, Add button
  calls back and names the menu, disabled with explanation when no menu,
  dragstart writes the command payload.
- `ChatWheel.test.tsx` (+7): all five disclosures present and placed, Move
  up/down, Alt+Arrow, Add to menu, Move to menu, list drop insert, wedge drop
  reorder, all asserted on the resulting YAML.

## Gate results

- `tsc -b` exit 0; `eslint .` exit 0; `check-i18n.mjs` exit 0;
  `check-encoding.mjs` exit 0 (748 files); `gen-locale-manifest.mjs --check`
  exit 0; `vitest run` exit 0 (219 files, 2468 passed, 18 skipped).

## Not done / notes

- No in-app CDP verification was run; drag-and-drop is covered by dispatched
  events with a hand-made `dataTransfer` because jsdom has no `DragEvent`.
  A real pointer drag in the running app remains an engine-tier check.
- Drop highlighting uses `dragleave` with a `relatedTarget` containment check
  rather than an enter/leave counter; a brief flicker between nested targets
  is possible in Chromium and is cosmetic.
- `check-i18n.mjs` continues to list data-table keys (the `LimitationNote`
  copy table and the catalogue's `FILTERS`) as informationally unused; they
  are all rendered.
