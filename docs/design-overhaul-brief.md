# Deadlock Mod Manager - UI Overhaul Brief

**Target Tabs:** Settings, Crosshair Designer, Autoexec Commands

---

## Theme Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `bg-primary` | `#0f0f0f` | App background |
| `bg-secondary` | `#1a1a1a` | Card backgrounds |
| `bg-tertiary` | `#242424` | Inputs/buttons |
| `accent` | `#f97316` | Orange CTA |
| `accent-hover` | `#ea580c` | Hover state |
| `text-primary` | `#ffffff` | Main text |
| `text-secondary` | `#a1a1aa` | Muted text |
| `border` | `#2d2d2d` | Borders |

**Fonts:** Radiance (primary), Reaver (headers), ValvePulp (display)

---

## Settings Tab

**Current Issues:**
- All settings look equally important
- No section grouping
- Status messages are plain text
- Inconsistent button sizes

**Recommendations:**
1. Group into: **Game Path** | **Preferences** | **Maintenance** | **Cache**
2. Make Game Path section most prominent (larger, top position)
3. Use colored badges for status (green ✓, yellow ⚠, red ✗)
4. "Wipe Cache" should have red accent (destructive action)
5. Sync progress: animated progress bar

---

## Crosshair Designer Tab

**Current Issues:**
- Native browser sliders (generic)
- Tiny color picker
- Preview not prominent enough
- All sections look the same

**Recommendations:**
1. Custom sliders with filled track visualization
2. Larger color picker with preset swatches
3. Make preview the focal point (larger, centered)
4. Add subtle glassmorphism to sections
5. Animated checkmark on copy

---

## Autoexec Commands Tab

**Current Issues:**
- No command search/filter
- Categories lack icons
- Descriptions too small
- Plain instructions list

**Recommendations:**
1. Add category icons (⚡ Performance, 🌐 Network, 🎮 HUD)
2. Search bar to filter commands
3. Command cards: hover to show description
4. Toast notifications on save
5. Drag-to-reorder capability (stretch goal)

---

## Profiles Tab

**Current Issues:**
- Profile cards are basic (no visual differentiation)
- No profile preview/comparison
- Mod counts are plain text
- "Active" badge is small

**Recommendations:**
1. Larger visual cards with mod count badges
2. Preview of enabled mods on hover
3. Comparison mode (diff two profiles)
4. More prominent active state (glow effect)
5. Rename profile inline
6. Profile icons/colors for quick identification

---

## Shell rule: which chrome belongs to what

Three kinds of surface, and each owns a fixed amount of chrome. This is not a
new convention. Foundry already follows it: `src/pages/Foundry.tsx:204` reads
"Hero workshop: full-bleed, no page chrome (mirrors the Locker hero view)" and
returns `HeroWorkshop` bare, while the roster landing and the no-game-path gate
each use `PageHeader`. Writing it down is what stops the next surface from
drifting.

**Top-level route.** A sidebar destination. Uses `PageHeader` with a title, a
description, and its actions. Conflicts, Browse, Settings, Servers, Discover,
and the Foundry landings.

**Drill-in.** Reached from a grid or a card, and keeps a Back control. The
shell owns identity, background art, the rail, and Back. Its sections are
panels inside that shell, and a section never renders its own `PageHeader` or
its own Back. Locker Global, Locker hero, Foundry hero workshop.

**Section body.** A component that renders content and nothing else: no header,
no back control, no page padding of its own. Named `*Shelf` or `*Panel`.
`HeroSoundShelf` and `GlobalSoundShelf` are the reference.

Three invariants follow, and they are navigation rules rather than styling
ones:

1. **A tab switch never changes the shell.** If selecting a section unmounts
   the rail or the background, it is a route, not a tab, and it must not be
   presented as one. The check is mechanical: capture a node from the shell,
   switch sections, and confirm the same node is still in the document.
2. **A route that presents itself as a section of X can return to X.** The
   control that got the user there stays visible and shows itself as selected
   where they land.
3. **Section state is addressable and survives a round trip.** Opening a
   drill-in from a section and pressing Back returns to that section, not to
   the default.

The Locker's Global sounds panel broke all three at once, which is what
prompted writing this down: its Sounds tab returned a different page
component, so the shell unmounted, Visuals became unreachable from Sounds, and
the tablist reported two tabs where the unselected one was a link off the
screen. See `docs/locker-consistency-pass.md` for that diagnosis.

A `role="tab"` is a promise about all of the above. Either wire it fully
(`aria-controls` to a real `role="tabpanel"`, `aria-labelledby` back, roving
`tabIndex`, arrow-key movement) or use plain buttons and drop the role. The
half-state, where the role is present and the panel is not, is worse than
either.

### Audit, as of the Locker consistency pass

Every `role="tablist"` in `src/`, classified. Three shapes turn up: a real
tablist, a control set that only looked like one, and a real tablist whose
panel is rendered by the caller.

| Site | Verdict | State |
| --- | --- | --- |
| `Locker.tsx` Global drill-in, Visuals/Sounds | Real tablist | Wired |
| `Locker.tsx` `HeroCard`, Skins/Sounds | Real tablist | Wired |
| `Browse.tsx` section, Mods/Sounds/Wip | Real tablist | Wired |
| `Browse.tsx` `BrowseViewOptionControl` | Not a tablist: picks a layout, a card design, or an NSFW mode, and reveals nothing | Now `role="group"` with `aria-pressed`; arrow keys kept |
| `common/ui.tsx` `SegmentedControl` | Real tablist: both callers (`LockerModImagePicker` surface tabs, `AppearanceArtSection` source-kind tabs) switch a body below it | Wired. Ids come from `useSegmentedTabs`, which the control and the caller's body share, and the `tabs` prop is required so a future caller cannot reintroduce the half-state |

**One panel, not one per tab.** Every one of these surfaces renders a single
body whose contents change, not one of several siblings. So every tab's
`aria-controls` names the *same* id and the panel's `aria-labelledby` follows
the selected tab. Giving each tab its own panel id looks more thorough and is
wrong: only the selected section is ever in the document, so the other tabs
point at nothing. Locker Global and Browse were built that way and read as
wired until the reference was actually resolved.

The mechanical check, which should hold on every route:

```bash
node scripts/dev-driver.mjs eval "[...document.querySelectorAll('[role=tab]')].every(t=>!!document.getElementById(t.getAttribute('aria-controls')||''))"
```

`PageHeader` is used by `Conflicts`, `Discover`, `Foundry`, `Servers`, and
`Settings`, all top-level routes. No drill-in renders one.

---

## General Guidelines

- Use `transition-all duration-200` for hover states
- Section headers: use `font-reaver` for Deadlock game feel
- Icon size: consistent 20-24px from Lucide
- Add subtle micro-animations for polish
- Match existing sidebar/browse tab aesthetic
