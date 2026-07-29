# UI thoughtfulness and adjustability pass

An implementation brief for the next chat. This is a quality pass, not a new
feature area: make existing controls clearer before interaction and give users
small, reversible ways to tune visual choices where a sensible adjustment exists.

## Goal

Every interactive surface should answer three questions without a user needing
to experiment blindly:

1. What can I do here?
2. What will change if I do it?
3. Can I tune it or get back to the default?

Start with Locker and Foundry, then apply the resulting patterns to the rest of
the app. Preserve the existing rule that Locker manages installed state and
Foundry authors new content.

## Scope and ordering

Treat this as a focused pass across existing, high-frequency decision surfaces;
do not turn it into a global search or preferences rewrite.

1. Locker and Foundry establish the shared interaction patterns.
2. Conflicts is the first follow-on page: users arrive there with a concrete
   problem and often need to locate one mod, pair, or game path among a long
   result set.
3. Apply the same search and state patterns selectively to Installed, Browse,
   Profiles, and Stats. Each already has search or filtering, so the work is
   about making those controls clearer and more reliable rather than adding
   speculative search to every route.

## Lane 0: define search as an inspection tool

Search should help people answer "where is the thing affecting this?", not
merely narrow a list. For every search surface, define its searchable fields,
its active scope, result count, empty result state, and clear/reset behavior.
Keep filtering client-side only when the loaded collection is bounded; preserve
the server/local-catalog query path for Browse and other large inventories.

### Conflicts page: add conflict search

Add one debounced, client-side search field above the active conflict list. It
must match, case-insensitively, across:

- both mod names, filenames, and visible variant labels;
- shared game paths for file conflicts, including a pasted path fragment;
- conflict type and plain-language labels (for example `file`, `priority`,
  `same slot`, and `load order`).

Keep the active conflict scan independent of the query: a search must never
cause another VPK scan, alter what is detected, or hide a conflict from the
sidebar count. Show `Showing X of Y active conflicts` when narrowed and retain
the user's query across Refresh and view-mode switches for the current visit.
Provide a labelled clear control, Escape-to-clear when the field is focused,
and a no-match state that offers to clear the search. Do not include ignored
sections in the default result set: give each ignored panel its own lightweight
filter only if its size makes restoration difficult, or add an explicit
"Include ignored" scope toggle with a clear count and reset.

When a search result shows because of a path rather than a mod name, visually
surface the matching path in the card/file list. This prevents the frustrating
case where a card matches but the user cannot tell why. Preserve normal list
and grid accessibility: focus order, result announcements, and all actions
must remain available after filtering.

Acceptance: a user can paste a partial `game/...` path or a remembered mod
name and identify the relevant active pair without scrolling or triggering a
new conflict detection pass.

### Search improvements worth applying elsewhere

- **Installed / Locker:** keep name search, but make active filters and sort
  visible as removable chips or a concise result summary. Search aliases,
  filename, source filename, and variant label where that metadata exists;
  make it clear whether disabled items are included.
- **Browse:** preserve the remote-versus-local catalog routing and expose it
  as a small status line near results (for example, cached catalog versus
  online). Keep a query on retry, explain zero results versus a loading/error
  state, and make hero/category/NSFW filters legible in the query scope.
- **Foundry:** consolidate the repeated "search this asset/change" affordance
  around a consistent input, clear button, match reason, and no-match next
  action. A pasted game path should be treated as a first-class lookup where
  the underlying inventory supports it; do not silently broaden authoring
  write sets.
- **Profiles:** add search only if the profile list can reasonably exceed one
  viewport. Search name and description, preserve the selected profile when
  it falls outside the query, and explain that it is hidden rather than
  deselected.
- **Stats / builds:** retain the existing API-backed query controls; improve
  field labels, pending-state copy, and a compact summary of active filters
  instead of duplicating a second client-side search.

Acceptance: every retained or new search exposes its scope and has a useful
zero-results state; no page gets an extra search field unless it reduces a
real discovery cost.

## Lane 0.5: make portrait coverage and ownership legible

The same hero is represented by multiple game namespaces. Do not use a roster,
sound, or panorama codename interchangeably without a tested resolver. Abrams
is the reference case: roster, current panorama, and legacy panorama names can
all differ; Doorman / The Doorman and renamed heroes need the same treatment.

Create one shared, tested hero-identity resolver for portrait catalog filtering
and Locker source discovery. It should resolve a display hero to all relevant
panorama codenames, including known legacy aliases, and should be the sole
place a new alias is added. The Foundry Portraits view must use this resolver
when it is scoped to a hero rather than comparing the roster codename directly
to the texture catalog's `hero` field.

Add a small coverage result to the Portraits surface:

- **Families available:** show the number of discovered families and their
  exact target variants.
- **No base-game family found:** state that this hero has no indexed editable
  portrait family in this game build; offer the global catalog / report path,
  not a misleading search-only message.
- **Catalog mapping mismatch or load failure:** preserve the diagnostic detail
  and offer Retry. Never collapse this into "No portraits match."

Do not move portrait authoring wholesale into Locker. The product boundary
should stay crisp:

- **Locker manages what exists:** installed portrait sources, the currently
  active result, load order/provenance, and Apply / Revert. Rename the hero
  `Cards` section to **Cards & portraits** where practical, because it already
  owns the base-slot and installed-source view.
- **Foundry creates what does not exist:** upload, crop, family coverage,
  preflight, staging, and the build tray. It should never imply an edit is
  installed before the user forges or installs the build.

Mirror the *hero navigation shell*, not every control. Both pages can retain
the same hero context, portrait art, and familiar rail, but label their intent
explicitly: Locker's rail begins with "Manage installed"; Foundry's begins
with "Create a new mod" and its Build tray. Add contextual, section-specific
handoffs rather than one generic route: Locker's Cards & portraits section
gets **Create portrait in Foundry**, deep-linked to
`/foundry?hero=<hero>&section=portraits`; Foundry's My changes and completed
build affordances link back to the corresponding Locker hero.

Acceptance: Abrams, Doorman / The Doorman, and one renamed legacy-codename hero
each return the same applicable portrait family whether reached from Locker or
Foundry; an empty portrait view explains which of "not indexed", "loading",
or "failed" is true.

### Keep Locker Global focused

Add global controls only for assets and decisions that are genuinely not tied
to one hero. Good candidates are a categorized inventory for HUD/interface
art, item icons, world props, Soul Containers / Spirit Urns, and uncategorized
installed mods that need tagging. For each, show enabled state, owner/source,
load-order consequence where relevant, and a route to its detail surface.

Avoid making Global a duplicate Foundry catalog. Its useful additions are
management and diagnosis: a compact "needs attention" group (unclassified,
outdated, conflicting, or disabled-after-update assets), global randomization
membership, and a clear path to the authoring tool when no installed source
exists.

Global sound content deserves a first-class Locker destination, but not a
generic card inside the visual Global tab. Keep it in the Sound Locker's
**Global sounds** shelf: UI, music, ambience, NPC/item sounds, shared melee
and other non-hero events need audition, exact source/provenance, enabled
state, and conflict/winner context that visual-prop cards do not. Foundry's
Global sounds tool remains the authoring side (choose an event and stage a new
swap); the Sound Locker is where the resulting installed swap is heard,
enabled, disabled, traced, or removed. The visual Global tab may show a small
summary/link when installed global sounds need attention, rather than owning a
second sound editor.

## Lane 0.75: converge the Sound Locker into Locker

> **Done.** The route work landed first and left the shell work unfinished: the
> Global drill-in's Sounds tab returned a different page component, so selecting
> it unmounted the shell and Visuals became unreachable. Lane 1 of
> `docs/locker-consistency-pass.md` finished it, and that doc's Lanes 2 to 4
> cover the rule, the route resolver, and the visual sweep that followed.

Keep the Sound Locker's inventory model and rich rows; change its information
architecture. It should be a Locker mode, not a sibling destination that makes
the user traverse a second hero grid.

### Target navigation

**Superseded 2026-07-29.** This lane originally specified a top-level
`Looks | Sounds` mode switch over two hero grids. That was implemented and then
reversed: the hero page already had a Sounds section, so the mode switch only
ever led to a *richer* version of a tab that already existed. Two hero grids for
one hero's content was the distance the lane set out to remove. The shipped
design is one grid, one hero page:

- The Locker landing has **one** hero grid and no mode switch. Hero cards stay
  poster art: the whole card opens that hero, and a small hover/focus Sounds
  chip (music glyph + count) deep-links to the hero's Sounds tab. An always-on
  action strip was tried and buried the hero name logo on every card.
- The hero page rail is **Skins / Sounds / Cards & portraits / Effects**. The
  Sounds tab renders `HeroSoundShelf`: category chips, then the installed sound
  rows (audition, provenance, enable/disable, conflict context) as the primary
  content, with the per-ability picker below as a clearly labelled
  "Current selections" panel.
- The Global Locker drill-in keeps `Visuals | Sounds` sections. Global Sounds
  carries announcer, music, interface, NPC/item, shared melee/punch, and
  unclassified non-hero content; it keeps the Foundry handoff for creating a
  new swap, and has a visible **Back to Locker** control.
- `?mode=` now selects only the Global drill-in's section. Legacy
  `/locker/sounds`, `/locker/sounds/hero/:hero`, and `/locker/sounds/global`
  URLs are rewritten to the canonical routes by `legacySoundTarget`.

This is a navigation consolidation, not a data rewrite: retain
`buildSoundInventory`, `SoundEntryRow`, source audition, and exact-entry
inspection. Map legacy `/locker/sounds`, `/locker/sounds/hero/:hero`, and
`/locker/sounds/global` URLs to the appropriate Locker mode so existing links
and Foundry handoffs continue to work.

### Refine the shared hero frame without rolling it back

`HeroDetailFrame` should remain the common layout primitive, but receive an
explicit surface variant (or equivalent scoped styling) rather than presenting
Locker and Foundry as the same product moment.

- **Locker variant:** lead with a small installed-state summary (enabled
  sources, active choice, and conflicts/load order where relevant), use calmer
  management chrome, and make the content column feel like a collection.
- **Foundry variant:** lead with draft/staged-edit count and "Create a new mod",
  retain the build-tray affordance, and use the accent state to signal an
  unfinished authoring workflow.
- Keep shared mechanics—hero identity, back navigation, responsive rail,
  keyboard section navigation, image fallback, and accessibility—but keep
  domain-specific rail actions out of the generic frame.

Acceptance: navigating from one hero's Looks to Sounds, then to Global Sounds,
never makes the user choose a second hero grid or lose their obvious path back
to Locker; Foundry is recognizable as an authoring workflow before any tab is
selected.

## Lane 1: inventory the weak states

> **Superseded by `docs/locker-consistency-pass.md`.** That doc has its own
> lane numbering and it wins where the two overlap. This lane's disabled-control
> and empty-state requirements are carried by its Lane 9 ("Disabled controls
> state their blocker") and Lane 10 ("One empty-state shape"), widened past
> Locker and Foundry to Profiles, Conflicts, and the Foundry forge path. Read
> this section as background, not as work to schedule.

Audit Locker and Foundry for controls in these states:

- Empty but actionable.
- Disabled, including the reason it is disabled.
- Loading or resolving ownership.
- Hoverable previews or source art.
- Destructive or non-obvious changes.

For each, record the current copy, trigger, and missing feedback in a short
checklist. Prefer one representative of a repeated component over touching each
call site independently.

Acceptance: no interactive control in the audited surfaces relies only on color
to communicate availability or consequence.

## Lane 2: establish the interaction patterns

> **Superseded by `docs/locker-consistency-pass.md`.** Note that both docs have
> a "Lane 2" and they are different; that one wins. This lane's patterns are
> split across its Lane 8 (keyboard and assistive-tech floor: `useEscapeKey`,
> tablist wiring, one live-region convention), Lane 9 (undo, blockers, pending
> work), and Lane 10 (copy and state vocabulary). Read this section as
> background, not as work to schedule.

Make the following patterns consistent in shared components before applying
them to individual surfaces:

- Resting art can be subdued, but hover and keyboard focus reveal the full
  preview when that helps a choice. The custom-card slots are the reference.
- Disabled controls explain their exact blocker in a tooltip or nearby line.
- On-demand inspections show that they are work in progress and preserve the
  prior answer until a replacement answer arrives when practical.
- Empty states lead to the next valid action rather than merely reporting that
  nothing exists.
- Reversible actions have an obvious Reset, Revert, or Remove control adjacent
  to the adjustment they undo.

Acceptance: a keyboard-only pass reaches every disclosure and adjustment, and
focus has the same preview clarity as hover.

## Lane 3: add bounded adjustability

> **Superseded by `docs/locker-consistency-pass.md`.** Its Lane 5 carries this:
> one typed `uiPrefs` module over the keys that already exist, a registry that
> names each key once with its default, and a Settings control that can reset
> every remembered layout choice. The "stable default, can be reset" rule below
> is the requirement that lane implements. Read this section as background, not
> as work to schedule.

Do not add controls merely because a property can vary. Add an adjustment only
when it changes a visible outcome, has a stable default, and can be reset.

Priorities:

1. Image and portrait surfaces: crop framing, preview intensity, and compact
   versus spacious tile density where space is constrained.
2. Hero surfaces: section-density and gallery-size preferences, persisted only
   when they are broadly useful rather than one-off local state.
3. Media surfaces: preview volume, playback choice, and any existing visual
   fit controls should state their current value and reset target.

Use the smallest control that fits: a toggle for binary choices, a short preset
list for discrete layouts, and a slider only for a continuous visual result.
Never make renderer state a second source of truth for installed enablement or
Foundry write sets.

Acceptance: every new adjustment has a label, current value, default/reset,
persistence decision, and an accessible name.

## Lane 4: validate and polish

- Test empty, populated, disabled, loading, hover, focus, and reset states at
  desktop and narrow widths.
- Add component tests for pure preference or state-resolution helpers.
- Use `pnpm lint`, `pnpm exec vitest run`, and `pnpm i18n:check`.
- Live-check the affected Locker and Foundry surfaces through the dev build.

## Deliberately out of scope

- New authoring pipelines or new IPC services.
- Changes to load order, ownership resolution, or randomization semantics.
- A universal preference framework. Add local preferences only when repeated
  use shows they merit persistence.
