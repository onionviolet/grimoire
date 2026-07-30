# UI quality, consistency, and convenience pass

An implementation brief. This is not a new feature and not a redesign. Part 1
fixes a specific reported defect in the Locker. Part 2 addresses the class of
problem it belongs to: work that has been done correctly two or three times in
different pages and never extracted, so each new surface either re-implements it
or silently goes without.

Companion to `ui-thoughtfulness-and-adjustability-plan.md`. That doc's Lane 0.75
called for folding the Sound Locker into Locker. The route work landed; the
*shell* work did not. Part 1 finishes it.

Every finding below is a code observation with a file reference, not a guess.
Anything proposed without evidence is marked `(unverified)`.

---

# Part 1: the Locker Global sounds defect

## The diagnosis

`/locker/global` renders `GlobalLockerView` (`src/pages/Locker.tsx`): full-bleed
Deadlock background art, a feathered frosted-glass left rail, a `Visuals |
Sounds` tablist, a per-category nav with counts, and a keyed fade on the right
pane.

Its `Sounds` tab calls `navigate('/locker/global?mode=sounds')`
(`src/pages/Locker.tsx:1275`). `Locker` then returns early:

```
if (globalSelected && globalSection === 'sounds') {
  return <SoundLocker />;          // src/pages/Locker.tsx:928-930
}
```

The shell unmounts. Everything the user was looking at is replaced by a plain
padded page. Three separate user-visible symptoms fall out of that one line:

1. **It looks like a different product.** `SoundLocker` is the only
   Locker-family surface that uses `PageHeader`. Every other `PageHeader` user
   is a genuine top-level page (Conflicts, Foundry, Settings, Discover,
   Servers). No background art, no glass rail, no category nav, no fade.
2. **The tab does not go back to where it came from.** There is no tablist on
   the sounds side at all, so `Visuals` is unreachable. The only exit is a
   `Back` button wired to `/locker` (`src/pages/SoundLocker.tsx:118`), which
   lands on the hero grid: one level past the drill-in the user opened.
3. **The tablist misreports itself to assistive tech.** Two `role="tab"`
   buttons where the selected one navigates away, and the app has zero
   `role="tabpanel"` and zero `aria-controls` anywhere (see Lane 8).

Per-hero sounds got this right: `HeroSoundShelf` is a *component* rendered into
the hero page's existing section rail. Global sounds is the same content model
and should be the same shape.

## Lane 1: make Global sounds a real tab panel

Do this first. It is the whole reported complaint and it is self-contained.

- Convert `src/pages/SoundLocker.tsx` into
  `src/components/locker/GlobalSoundShelf.tsx`, mirroring `HeroSoundShelf`: a
  body component, no `PageHeader`, no back button, no page padding of its own.
  Keep `buildSoundInventory`, `categoriesPresent`, `entriesInCategory`,
  `SoundEntryRow`, the annotation fetch, audition, and the toggle path exactly
  as they are. This is a shell change, not a data change.
- Render it inside `GlobalLockerView`'s right pane. The rail, background,
  heading treatment, and count typography stay mounted across the switch, so
  the two sections read as one screen.
- Keep the tablist mounted in both states with real wiring: `aria-selected`
  tracks the active section, each tab gets `aria-controls` pointing at a
  `role="tabpanel"` with `aria-labelledby` back, Left/Right arrows move between
  tabs. Selecting `Sounds` must not remount the shell.
- Decide the rail's job in the Sounds section and record it in a comment. Two
  defensible answers; pick one:
  - **Preferred:** the rail lists the global *sound* categories (Announcer,
    Music, Interface, Ambience, NPC, Items, Shared melee, Shared, Other) with
    counts, exactly as it lists visual types. Same rail, same affordance, and
    it lets the shelf drop its second inline category filter.
  - Or the rail keeps visual types and the shelf keeps its inline filter, in
    which case visual-type rows must be visibly inert while Sounds is active,
    not silently do nothing.
- `Back` in the rail keeps its current meaning (leave the drill-in for the hero
  grid). Do not add a second competing back control. The `Global` heading stays
  put; `Global sounds` becomes the right pane's `h3`, matching how a visual type
  titles that pane today.
- Keep `?mode=sounds` in the URL and keep the legacy `/locker/sounds*` rewrites
  in `src/lib/lockerMode.ts` and `Locker.tsx:432-451` working. The Foundry
  handoff (`/foundry?tool=globalSound`) and the return path from it must both
  land on the Sounds panel, not Visuals.
- `soundLocker.global.*` keys stay valid where the copy is still displayed.
  Delete the keys whose controls disappear (the page description if the pane no
  longer has room, the back label) from `src/locales/en/translation.json`
  rather than leaving them orphaned, then run `pnpm i18n:check` and
  `pnpm i18n:manifest`.

Acceptance: from `/locker/global`, clicking `Sounds` then `Visuals` returns to
the same view with no full-screen change and no reload flash; a keyboard user
moves between the two tabs with arrow keys; nothing about the sound rows,
audition, or enable/disable behavior changed.

## Lane 2: one shell rule, written down

The reason this drifted is that nothing states which chrome belongs to what.
**Foundry already implements the rule.** `src/pages/Foundry.tsx:204` reads
"Hero workshop: full-bleed, no page chrome (mirrors the Locker hero view)" and
returns `HeroWorkshop` bare, while the roster landing and the no-game-path gate
each use `PageHeader` (lines 181, 229). So this lane is not a new convention, it
is writing down the one Foundry follows and Locker's sound panel breaks.

Add a short section to `docs/design-overhaul-brief.md`:

- **Top-level route** (a sidebar destination): `PageHeader` with title,
  description, actions. Conflicts, Browse, Settings, Servers, Discover, and the
  Foundry landings.
- **Drill-in** (reached from a grid or card, keeps a Back control): the shell
  owns identity, art, rail, and Back. Its sections are panels inside that shell
  and never render their own `PageHeader`. Locker Global, Locker hero, Foundry
  hero workshop.
- **Section body**: a component that renders content and nothing else. Named
  `*Shelf` or `*Panel`. `HeroSoundShelf` is the reference.

Then audit against it: grep `PageHeader` and confirm no hit sits inside a
drill-in; grep `role="tab"` and confirm every tablist has real panels. Treat
each of the 23 tab-ish roles (10 in `Locker.tsx`, 6 in `Browse.tsx`, 4 in
`common/ui.tsx`, and one each in `PlayerSelect`, `HeroSelect`, `SoundBrowse`) as
either a real tablist (wire it) or not a tablist at all (plain buttons, drop the
role). Leaving the half-state is what produced symptom 3.

Acceptance: a new section can be added to a drill-in by writing a body
component, with no decision left about headers or back navigation.

## Lane 3: tab and back-navigation invariants

The `Sounds` tab landing somewhere its own tab could not return from is a
navigation bug, not a styling one. Three invariants, applied across Locker,
Foundry, and Conflicts:

1. **A tab switch never changes the shell.** If selecting a section unmounts the
   rail or the background, it is a route, not a tab, and it must not be
   presented as a tab.
2. **A route that presents itself as a section of X can return to X.** The
   control that got the user there is visible and selected where they land.
3. **Section state is addressable and survives a round trip.** Reaching a hero
   drill-in from a section and pressing Back returns to that section, not the
   default. `Locker.tsx` already reads `?section=` for hero sounds and
   `HeroWorkshop` takes `initialSection` from the query
   (`src/pages/Foundry.tsx:212`); the same must hold for the Global panels and
   every Foundry handoff that claims to deep-link a section.

Add unit coverage for the pure part: a resolver mapping
`(pathname, search) -> { drillIn, section }` alongside the existing
`src/lib/lockerMode.test.ts`, covering `/locker/global`,
`/locker/global?mode=sounds`, the three legacy `/locker/sounds*` shapes, and
`/locker/hero/:id?section=sounds`. Route-shape regressions are cheap to catch
here and expensive to catch by hand.

## Lane 4: the visual consistency sweep

Only after Lanes 1 to 3. These are the differences visible when the two Global
panels sit side by side. Fix them by making the sound panel adopt the shell's
existing choices, not by inventing new ones:

- Heading level, weight, and the `drop-shadow` used on text over background art.
- The count pill beside a heading (`locker.page.modCount`) versus the shelf's
  own count rendering.
- Row versus card density, and whether a zero-entry sound category is listed
  with a `0` or omitted. The visual rail lists empty types deliberately
  (`Locker.tsx:1620-1622`); the shelf currently filters to present-only. Match
  the rail.
- Empty state: the visual pane's empty types offer a next action. The sound
  panel's empty state must offer `Make one in Foundry`, not merely report that
  nothing exists.
- Button styling for the Foundry handoff: same treatment as the visual pane's
  import affordance.
- Scroll container: `scrollbar-glass` on the pane, and the pane keyed so the
  fade runs on section switch as it does on type switch.

Acceptance: screenshots of the Visuals and Sounds panels differ only in their
content region.

---

# Part 2: the same class of problem, app-wide

Each lane below is one capability that already exists correctly somewhere, was
never extracted, and is therefore inconsistent or missing elsewhere. They are
independent of Part 1 and of each other, so they can be taken in any order.
Ordered here by user-visible payoff per unit of risk.

## Lane 5: one preference store (highest convenience payoff)

**Finding.** View preferences are written straight to `localStorage` from five
places with four different conventions:

- Inline string literals: `'lockerViewMode'`, `'lockerHideEmpty'`
  (`Locker.tsx:228,235,348,352`), `'installedLayout'`, `'installedViewMode'`,
  `'installedSortMode'`, `'installedSourceSel'`, `'installedDisabledSort'`,
  `'installedFixUnknownHidden'` (`Installed.tsx:881-1041`).
- Module constants: `BROWSE_SIDEBAR_WIDTH_KEY`,
  `BROWSE_CARD_SIZE_MULTIPLIER_KEY`, `BROWSE_CARD_DESIGN_STORAGE_KEY`,
  `BROWSE_DETAILS_VIEW_STORAGE_KEY` (`Browse.tsx`),
  `CONFLICTS_VIEW_MODE_KEY` (`Conflicts.tsx:185,536`),
  `INSTALLED_CARD_SIZE_MULTIPLIER_KEY` (`Installed.tsx:763`).
- Store-owned, with a legacy-key fallback path: `LAYOUT_KEY`, `SORT_KEY`,
  `SOUND_VOLUME_KEY`, and five shuffle keys (`appStore.ts:130-1030`).
- Three different boolean encodings: `'true'`/`'false'`
  (`lockerHideEmpty`, `SHUFFLE_ON_LAUNCH_KEY`), `'1'`/`'0'`
  (`installedFixUnknownHidden:922`), and sentinel-string comparison
  (`=== 'list'`, `=== 'classic'`, `=== 'sidebar'`).

Every reader also re-implements the same defensive `try`/`catch` around storage
being unavailable. `Locker.tsx:270-272` documents a real bug this shape caused
(a StrictMode save closure capturing `[]` and clobbering the stored value).

**Convenience cost.** Card size tuned on Browse does not carry to Installed
even though it is the same control on the same kind of grid. There is no
inventory of what is remembered, no way to see it, and no way to reset a layout
you have painted yourself into except hunting down the original control.

**Fix.**

- One small typed module, `src/lib/uiPrefs.ts`: `read(key)` / `write(key, v)` /
  `reset(key)`, the storage `try`/`catch` written once, a typed codec per key
  (boolean, enum, clamped number), and a single exported registry of every key
  with its default. Add `uiPrefs.test.ts` for the codecs, clamping, and
  legacy-key fallback: it is pure, so it is cheap to cover.
- Migrate the existing keys through it, keeping back-compat reads for both
  boolean encodings so nobody's saved layout resets on upgrade.
- Decide per key whether it is genuinely per-page or should be shared. Card
  size and grid-versus-list are strong candidates for shared; sort order and
  source selection are legitimately per-page.
- Add **Reset view preferences** to Settings, driven off the registry so it
  cannot fall out of date.

Acceptance: no page reads `localStorage` directly; the registry is the only
place a key is named; Settings can reset every remembered layout choice.

## Lane 6: one confirmation dialog

**Finding.** Destructive and consequential confirmations use native
`window.confirm` in twelve places: `Crosshair.tsx:192` (delete preset),
`Crosshair.tsx:209` (clear active), `ChatWheel.tsx:97` (discard unsaved),
`PortraitEditor.tsx:289`, `SoundBrowse.tsx:1108`, `MySoundChanges.tsx:149`,
`MyChanges.tsx:383` (delete mod) and `:521`, `TextureBrowse.tsx:67`,
`LibraryBrowse.tsx:69`, plus the two injected seams in `visualEdits.ts:64` and
`portraitFamily.ts:322`.

In Electron a native `confirm` blocks the renderer, ignores the app's visual
language entirely, cannot render the affected mod names as a scannable list
(several sites currently join them into one comma string), has no "don't ask
again", and gives a destructive action the same styling as a benign one. The app
already owns a `common/Modal` with focus handling and Escape, used by 27 files.

**Fix.** One promise-returning `useConfirm()` built on `common/Modal`: title,
body, an optional list of affected items, a labelled danger action, and Escape
or Cancel resolving `false`. Migrate all twelve. The two injected `context.confirm`
seams (`visualEdits`, `portraitFamily`) already have the right shape, so they
migrate by passing the new async confirm through; note that those call sites
become async, which is the only non-mechanical part of this lane. New copy needs
keys in `src/locales/en/translation.json`; the existing `t()` calls carry over.

Acceptance: no `window.confirm` in `src/`; every destructive confirmation names
what it will affect and styles the destructive choice distinctly.

## Lane 7: one search input, one scroll restore

Two extractions of the same kind, and the components to extract already exist.

**Search.** There are roughly 30 hand-rolled text and search inputs across 32
files. `src/components/foundry/FoundrySearchInput.tsx` is new and already the
right shape, but only Foundry uses it, and the new matchers
(`assetSearch.ts`, `conflictSearch.ts`) are each wired to one page. Promote it
to `src/components/common/SearchInput.tsx` with the contract Lane 0 of the
companion plan already specifies: visible scope, result count, labelled clear
control, Escape-to-clear, a match reason when the hit is not on the visible
name, and a zero-result state offering a next action. Adopt it on Conflicts,
Installed, Locker, and Profiles. Do not add a search field to a page that does
not have a real discovery cost.

**Scroll restore.** Implemented three times, independently, in the three pages
that have long grids plus a drill-in: `Browse.tsx` (the most elaborate, with a
virtualized-grid variant), `Installed.tsx:1409-1444`, `Locker.tsx:289,718-738`.
It is absent from every other page: Conflicts, Profiles, Foundry, Stats,
Crosshair, and Autoexec all report zero `scrollTop` handling. So opening a
conflict pair from deep in a long list and coming back dumps the user at the
top, which is exactly the frustration the three implemented pages exist to
prevent. Extract `useScrollRestore(key)` from the simpler two (Installed and
Locker are near-duplicates), apply it to Conflicts and Foundry first, and leave
Browse's virtualized variant alone unless it reduces to the same hook cleanly.

Acceptance: returning from any drill-in restores the list position that led
into it; every search field states its scope and its result count.

## Lane 8: keyboard and assistive-tech floor

**Finding.** Escape handling is written 24 times across 16 files. `common/Modal`
has one, and fifteen other files roll their own (`AnchoredPopover`,
`HeroSelect` twice, `PlayerSelect`, `PriorityEditor`, `VariantPickerModal`,
`ModDetailsModal`, `ManageModListsModal`, `BrowseFileQuickPicker`,
`FoundrySearchInput`, plus five pages). Ten files use `createPortal` while 27
import `common/Modal`, so some overlays sit outside the shared dismissal and
focus path. Separately, the app has 23 tab-ish ARIA roles and **zero**
`role="tabpanel"` and zero `aria-controls`, and its 28 live regions are spread
across 15 files with no shared convention for announcing a filtered result
count.

**Fix.**

- `useEscapeKey(handler)` and `useDismissable()` extracted from `common/Modal`;
  every overlay, popover, and picker uses one of them. Then verify the actual
  user-facing invariant: everything dismissible is Escape-dismissible, and
  focus returns to the control that opened it.
- Complete the tablist wiring from Lane 2 across all 23 sites: real
  `tabpanel`/`aria-controls`/`aria-labelledby`, arrow-key movement, and roving
  `tabIndex`. Where a control set is not really tabs, remove the role.
- One convention for result-count announcements (`role="status"` with a
  debounced "Showing X of Y") so filtered lists behave the same everywhere.

Acceptance: a keyboard-only pass reaches every disclosure, adjustment, and
dismissal in Locker, Foundry, Installed, Browse, and Conflicts; no control
communicates availability by color alone.

## Lane 9: consequence and reversibility

This lane is about convenience in the strict sense: reducing what the user has
to hold in their head or redo.

- **Undo for reversible bulk actions.** Toggling, reordering, and bulk
  enable/disable are cheap to reverse but currently require redoing the
  selection by hand. Where the store already knows the prior state, a toast
  with **Undo** is the smallest control that helps; the toast stack
  (`common/ToastStack`, used by 22 files) is already there.
- **Disabled controls state their blocker.** Lane 1 of the companion plan
  requires this for Locker and Foundry; extend the same rule to Profiles apply,
  Conflicts resolve, and the Foundry forge/install path, where the blocker is
  usually a missing game path or an empty staged set.
- **Pending work preserves the prior answer.** On-demand inspections (conflict
  scan, catalog sync, portrait coverage) should show that they are working
  without blanking the answer the user is currently reading.
- **Provenance is one phrase, everywhere.** "Which mod is responsible for this"
  is answered in Locker rows, Conflicts cards, Installed, and the sound shelves,
  and the wording and route differ between them. Pick one phrasing and one
  target (`/?focusMod=<id>`, which `SoundLocker.tsx:79` already uses) and apply
  it to all four.

Acceptance: no bulk action requires manual reconstruction to reverse; no
disabled control leaves the blocker to be guessed.

## Lane 10: cross-page copy and state vocabulary

Lower priority, but it is what makes the app read as one product. Fix the
vocabulary in `src/locales/en/translation.json` before touching more components,
because copy drift is cheaper to fix at the catalog than at 30 call sites:

- One term each for enabled/disabled, installed/staged/forged, and
  active/selected/applied. Locker says "active", Foundry says "staged", and the
  same underlying state is sometimes both.
- One empty-state shape: what is missing, why, and the next action. `EmptyState`
  already exists and takes all three; the inconsistency is that some callers
  omit the action.
- One error shape: what failed, whether it retried, and a Retry control.
  Distinguish "not indexed", "loading", and "failed" rather than collapsing all
  three into "nothing found" (the companion plan's Lane 0.5 requires this for
  portraits; it generalizes).
- Sentence case, no em-dashes (project convention), and counts in `tabular-nums`
  wherever they can change.

Acceptance: `pnpm i18n:check` passes with no orphaned keys, and the same state
is never given two names on two pages.

---

# How to work on and test this

Guessing at pixels is the reason this is hard. Drive the running app and ask it
questions instead. `scripts/dev-driver.mjs` (documented in `CLAUDE.md`) talks to
the renderer over CDP.

Start the dev build with the port open:

```bash
GRIMOIRE_DEV_CDP_PORT=9222 pnpm dev
```

Then drive it. The value is that a check can be a *question about the DOM*,
which says why something is wrong, where a screenshot only says that it looks
wrong:

```bash
node scripts/dev-driver.mjs route locker/global
```

```bash
node scripts/dev-driver.mjs click "button:has-text(Sounds)"
```

```bash
node scripts/dev-driver.mjs eval "document.querySelectorAll('[role=tab]').length"
```

The single sharpest regression check for Lane 1: capture an identifying node
from the shell (the rail heading, or the background `img`) before clicking
`Sounds`, and confirm it is still present after. If it vanished, the shell
unmounted and the tab is still a route.

Use `shot out.png` for the Lane 4 comparison, since that lane genuinely is about
appearance. Prefer `text` and `html` everywhere else.

Note that this drives the **working tree**, not the installed Grimoire, and that
`localhost:5173` in a plain browser is not a substitute (`window.electronAPI` is
absent there, so anything touching IPC fails).

## Per-lane checks

Lane 1 to 4, at desktop and at a narrow width where the rail collapses:

- Global Visuals to Sounds to Visuals, mouse and keyboard.
- Global Sounds with zero installed global sounds, and with several.
- Hero drill-in Sounds tab, to confirm no regression.
- Each legacy URL: `/locker/sounds`, `/locker/sounds/global`,
  `/locker/sounds/hero/Abrams`.
- Foundry global-sound handoff, out and back.

Lanes 5 to 10 are mostly verifiable without the UI, which is the point of
extracting them:

- Lane 5: unit-test the codecs and legacy fallbacks; then confirm by hand that
  an upgrade preserves an existing saved layout.
- Lane 6: grep for `window.confirm` returning nothing in `src/`.
- Lane 7: unit-test the matchers; check scroll restore by driving a drill-in
  round trip and reading `scrollTop`.
- Lane 8: grep `role="tab"` against `aria-controls` counts; then one
  keyboard-only pass per page.
- Lane 10: `pnpm i18n:check`.

Gates for every lane: `pnpm lint`, `pnpm exec vitest run`, `pnpm i18n:check`,
and `pnpm i18n:manifest` if any catalog key moved.

# Suggested sequencing

1. **Lane 1** alone fixes the reported bug and is shippable by itself.
2. **Lanes 2 and 3** stop it recurring, and are mostly documentation plus a
   test.
3. **Lanes 5, 6, 7** are the extractions with the best convenience-to-risk
   ratio, and each is independently shippable.
4. **Lanes 4, 8, 9, 10** are polish and floor-raising; they benefit from the
   extractions above landing first.

# Out of scope

- Changing sound inventory resolution, ownership, conflict, or load-order
  semantics. `buildSoundInventory` and `SoundEntryRow` are load-bearing and stay
  as they are.
- New authoring surfaces, new IPC, or moving anything between Locker and
  Foundry.
- A general design-token or component-library refactor. This pass makes existing
  surfaces agree with each other and extracts what already works; it does not
  introduce a new system for them to agree with.
- A universal preference framework. Lane 5 is a typed wrapper over the keys that
  already exist, not a new abstraction to grow into.

---

# Status

Lanes 1 to 7 are done. Each landed as its own commit with `pnpm lint`,
`pnpm exec vitest run`, `pnpm i18n:check`, and the locale manifest green, and
each was verified by driving the running app rather than by reading code. The
test count went from 1109 to 1140.

| Lane | State | Notes |
| --- | --- | --- |
| 1. Global sounds as a real tab panel | Done | The reported defect. `SoundLocker` is now `GlobalSoundShelf` inside `LockerGlobalView`'s right pane; the rail lists global sound categories with counts and the shelf dropped its inline filter. Verified: the same background DOM node survives Visuals to Sounds and back, tabs stay at 2, images stay at 82 (was 0 and 4) |
| 2. One shell rule, written down | Done | In `design-overhaul-brief.md`, with an audit table of all five tablists |
| 3. Tab and back-navigation invariants | Done | `resolveLockerRoute` plus 8 new tests |
| 4. Visual consistency sweep | Done | Compared by computed style, not by eye |
| 5. One preference store | Done | `src/lib/uiPrefs.ts`, 19 tests, Settings reset |
| 6. One confirmation dialog | Done | `useConfirm`; no `window.confirm` left in `src/` |
| 7. One search input, one scroll restore | Done | `common/SearchInput`, `useScrollRestore` |
| 8. Keyboard and assistive-tech floor | Partly | Lane 2 wired the three real tablists and demoted the one that was not; the `SegmentedControl` tablist and all the Escape and live-region work remain |
| 9. Consequence and reversibility | Open | |
| 10. Cross-page copy and state vocabulary | Open | |

Found and fixed while working, none of it in the original brief:

- Both sound shelves stored the annotations IPC result (a `{ key, annotation }`
  list) straight into a `Record`, so no personal label ever resolved. Now one
  `useSoundAnnotations` hook, keyed correctly.
- Only `?section=sounds` opened a hero section. `cards` and `effects` were
  parsed and discarded, so a link naming them silently opened Skins.
- `/locker/sounds?hero=<name>`, which Foundry's My changes panel links, read as
  the bare legacy landing and dropped the hero. Fixing that exposed a race
  where the generic `?hero=` handler replaced the `?section=sounds` the legacy
  rewrite had just added.
- An empty sound category in the rail was a dead control: it bounced back to
  the first populated one instead of opening its own empty state.
- Conflicts' search field, added in the previous session, was entirely
  hardcoded English.
- `scripts/dev-driver.mjs` opened a socket per command, so a device-metrics
  override died before the next command could observe it and no narrow-layout
  check was possible. Added `at <w>x<h> <expr>`, which does both on one socket.

Two gotchas worth keeping, both from an unfocused Electron window:

- `:focus` and `:focus-visible` never match, so probing focus styling by
  `eval` gives false negatives. Assert on generated CSS or on behaviour.
- rAF is throttled, so assigning `scrollTop` fires no scroll event and a
  scroll-restore check looks broken when it is not. Dispatch the event
  explicitly.
