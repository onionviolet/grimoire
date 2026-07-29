# Plan: UI improvement pass on the chat-wheel radial + Portraits work

Status: mostly landed 2026-07-29 (this doc was authored against an
intermediate working-tree state; a parallel session finished the work the
same day). Follows on from
[chat-wheel-radial-and-portraits-tab-plan.md](./chat-wheel-radial-and-portraits-tab-plan.md);
read that first for the original intent.

Outcome per part:

- **Part 1 (radial wheel UI): landed.** `RadialWheelPreview.tsx` is wired into
  `ChatWheel.tsx` (grid deleted), the 12-slot honesty warning ships, and the
  icon picker landed as a datalist-with-live-preview rather than a popover
  grid (arrow-key focus movement around the ring is still open).
- **Part 2: items 2 (workshop card trim), 3 (`?section=` deep link, Foundry
  side), and 5 (chip cap at 4 with a titled "+N") landed.** Item 1
  (coverage-gap flag) was dropped: after the family-key fix the card's family
  IS the discovered set, and the editor already blocks under-covered staging,
  so the card has no second source of truth to flag against. Item 4 (label
  casing) was deliberately kept as-is to match `TextureCard`.
- **Part 3 (verification): run** (vitest, lint, i18n:check, dev-driver route
  checks on both surfaces). The in-game numbered-wheel slot-order check
  remains a manual to-do.

## Where the working tree stands

- **Lane B (Portraits tab) is functionally done.** `PortraitBrowse.tsx` exists
  and is wired into both rails (catalog subtool in `Foundry.tsx`, workshop
  section in `HeroWorkshop.tsx`), `groupPortraitFamilies` is in
  `portraitFamily.ts` with tests, en strings are in place, and
  `subtoolForChangeFilter('hero-image')` lands on the new tab.
- **Lane A (radial wheel) has its pure core only.** `src/lib/chatWheelGeometry.ts`
  (N equal wedges, up to `MAX_WHEEL_SLOTS = 12`, slot 0 at 12 o'clock,
  clockwise) with tests, and `src/lib/chatWheelIcons.ts` with the 11 vendored
  ChatLane SVGs. Nothing imports either yet: `ChatWheel.tsx` still renders the
  3x3 grid (`gridSlots`, ~line 330) and a bare text input for `icon:`
  (~line 303).

## Part 1: land the radial wheel UI (Lane A steps 2-4, updated)

1. **`src/components/chatwheel/RadialWheelPreview.tsx`.** SVG donut built from
   `wheelSlots(items.length, layout)`:
   - One `<path role="button" tabIndex={0}>` per wedge, wired to the existing
     `selectPreviewSlot` / `focusedItem` state; Enter/Space activate, arrow
     keys move focus around the ring. Selected wedge gets the accent
     fill/stroke; hover brightens fill and label, mirroring the in-game
     highlight.
   - Labels at `slot.label`, truncated to fit the wedge (plain
     `<text>` + ellipsis at a char budget derived from wedge span is enough;
     no canvas measuring in v1). Empty items render a muted wedge with `+`.
   - Center hub circle: menu name plus the menu icon via
     `chatWheelIconUrl(menu.icon)` (fallback: no icon, matching ChatLane's
     behavior for unknown names).
   - Since the geometry module divides the circle among however many items
     exist (not a fixed 8), the preview renders `min(items, 12)` wedges and
     re-flows as items are added or removed.
2. **Replace the grid in `ChatWheel.tsx`.** Swap the `gridSlots` block for
   `RadialWheelPreview`; no state-model changes. Delete the grid code rather
   than gating it.
3. **Slot-count honesty at 12.** When a menu holds more than
   `MAX_WHEEL_SLOTS` items, show an inline warning above the wheel ("the game
   shows only the first 12") instead of silently dropping the rest. The
   geometry module already clamps; the UI's job is only to say so.
4. **Icon picker.** Replace the free-text `icon:` input with a popover/grid
   picker fed by `CHAT_WHEEL_ICONS` (thumbnail + name per option), while still
   accepting arbitrary text (Advanced YAML stays the source of truth; the
   module's docblock is explicit that the list drives suggestions, never
   validation). Show the resolved icon next to the field and in the hub.
5. **i18n.** New strings under `chatWheel.*` in
   `src/locales/en/translation.json`; `pnpm i18n:check` + `pnpm i18n:manifest`.

## Part 2: polish the Portraits tab (gaps vs. the original target)

1. **Coverage-gap flag on `FamilyCard`.** The original target promised
   "variant-count badge, coverage-gap flag"; today the card lists variant
   chips but never says a family is incomplete. Derive the expected variant
   set from the same discovery logic the editor/preflight uses (do not invent
   a second list in the card), and render missing variants as dimmed/dashed
   chips with a small warning affordance. Tooltip: "this state keeps the stock
   art unless staged".
2. **Workshop-scoped card trim.** When `hero` is pinned (workshop section),
   the hero-name line on every card is redundant; drop it there. Same for the
   hero dropdown, already handled.
3. **Locker deep link (open question from the original plan, now decided:
   yes).** Support `?section=portraits` on `/foundry?hero=` so the Locker's
   hero card can land directly on the workshop's Portraits section. Cheap:
   `HeroWorkshop` already takes an initial section via its parent.
4. **Card label casing.** `capitalize` on a lowercase filename-derived label
   produces Title Case Per Word artifacts on multiword stems; keep the raw
   label and let `title` carry the full string, or normalize once in
   `portraitFamily.ts` where it is testable, not in the card's class list.
5. **Chip overflow.** Families with many variants wrap chips indefinitely and
   uneven card heights make the grid ragged; cap visible chips at ~4 with a
   "+N" overflow chip.

## Part 3: shared verification

- `pnpm exec vitest run` (geometry + portraitFamily suites), `pnpm lint`,
  `pnpm i18n:check`.
- Dev driver: `GRIMOIRE_DEV_CDP_PORT=9222 pnpm dev`, then
  `route chatwheel`: click wedges, confirm `text` of the editor pane follows
  `focusedItem`; add a 13th item and confirm the warning; pick an icon and
  confirm the hub updates. Then `route foundry`: Portraits tab shows gap
  flags; workshop section omits hero names; stage a family and confirm the
  build tray and My changes list it.
- In-game check (manual): save & install a numbered 12-item wheel and confirm
  slot order matches the preview, per the note in `chatWheelGeometry.ts`.

Out of scope, unchanged from the original plan: drag-to-reorder on the wheel,
`override_bindable`/ping-wheel editing, game-asset dressing (Lane A step 5
spike), and the Locker-style image intake on family cards (tracked in
[locker-foundry-parity-plan.md](./locker-foundry-parity-plan.md) lane 4).
