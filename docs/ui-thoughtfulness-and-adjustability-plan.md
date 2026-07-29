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

## Lane 1: inventory the weak states

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
