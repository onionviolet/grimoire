---
phase: 06-community-tools-land-inside-grimoire
plan: "05"
subsystem: browser
tags: [browser, catalog, i18n, docs, ui]
dependency-graph:
  requires:
    - 06-02
    - 06-04
  provides:
    - browser-destination-kind-grouping
    - browser-scope-boundary-record
  affects:
    - src/pages/Browser.tsx
    - src/lib/browserCatalog.ts
tech-stack:
  added: []
  patterns:
    - "Pure grouping/visibility functions in browserCatalog.ts (visibleDestinations, groupDestinationsByKind), unit tested independent of React rendering"
    - "Eager label-lookup constants that throw at import time (resolveHomeDestinationUrl) rather than a fallback-to-wrong-value on an orphaned reference"
key-files:
  created:
    - docs/browser-scope-boundary.md
  modified:
    - src/lib/browserCatalog.ts
    - src/lib/browserCatalog.test.ts
    - src/pages/Browser.tsx
    - src/locales/en/translation.json
    - src/locales/manifest.json
decisions:
  - "Kind-group headers are a local h3 (text-xs font-semibold uppercase tracking-wider), not the shared SectionHeader primitive, because SectionHeader is locked to text-sm/font-medium (weight 500) and 06-UI-SPEC.md declares this phase's label role at 12px/weight 600 -- reusing it would introduce a third font weight the design contract does not allow. Documented inline as the ui-conventions.md deviation exception."
  - "HOME_DESTINATION_URL's resolution logic was extracted into resolveHomeDestinationUrl(catalog, label) so the orphaned-Home throw path is unit testable against a synthetic catalog; behavior for the real catalog is unchanged (still a label lookup, still throws at import time when GameBanana is absent)."
  - "docs/browser-scope-boundary.md records the download manager's absence explicitly rather than folding it into a generic 'no extra controls' line, per REQ-browser-navigation-gaps' intent that the gap read as a decision, not an oversight."
metrics:
  duration: "~35min"
  completed: 2026-08-07
actuals:
  tokens: 5633
  tasks: 2
  commits: 2
status: complete
---

# Phase 06 Plan 05: Group browser destinations by kind and record the control-set boundary Summary

Catalog destinations now render as four kind-grouped rows (Mod hosts, Tools, Reference, Community) instead of one flat shortcut row, and the browser's deliberately small control set is written down in `docs/browser-scope-boundary.md` as a decision with reasons rather than an unrecorded gap.

## What Was Built

**Task 1 — Group the destinations by kind** (`c379193`)

- `visibleDestinations(entries, nsfwMode)` in `src/lib/browserCatalog.ts`: reproduces the existing nsfw-hide predicate as a pure, exported function.
- `groupDestinationsByKind(entries)`: walks `KIND_ORDER` and buckets entries by kind, in input order within each bucket, omitting any kind with zero entries entirely (no group object, no placeholder, no empty-state message).
- `src/lib/browserCatalog.test.ts` gained tests for all seven behaviors in the plan's `<behavior>` block, plus one covering the real catalog end-to-end through both functions together.
- `src/pages/Browser.tsx`: replaced the single `visibleShortcuts` memo and its one `flex flex-wrap gap-1.5` row with a `groups` memo and four rendered groups, each `flex flex-col gap-2` inside an outer `flex flex-col gap-4` list. Each group's shortcut row keeps the exact prior markup and class string unchanged (`flex flex-wrap gap-1.5`, unchanged button classes), so overflow still resolves by wrapping. The `Tools` group header is the only one rendered `text-accent`; the other three stay `text-text-secondary`. The page's outer container gap changed from `gap-3` to `gap-6` per 06-UI-SPEC.md's Spacing Scale.
- Added `browser.catalog.groups.{modHost,tool,reference,communityFeed}` to `src/locales/en/translation.json`, rendered through `Tx` with English fallbacks matching the UI-SPEC's Copywriting Contract, and regenerated `src/locales/manifest.json` via `pnpm i18n:manifest`.
- **900x700 viewport backstop check** (dev-driver, slot 3): all ten shortcut buttons render at a uniform `offsetHeight` of 26px with the sidebar collapsed at the app's minimum supported width — no label forced a button onto two lines. Screenshot confirmed visually: four grouped rows, Tools in accent orange, no clipping or horizontal scroll.

**Task 2 — Record the browser's bounded control set as a decision** (`3b9f8a7`)

- Created `docs/browser-scope-boundary.md`: a table of the 7 controls that exist (back, forward, reload/stop, home, address bar, open externally, destination catalog) each with a one-line purpose; a table of the 6 controls that deliberately do not exist (tabs, find in page, zoom, extension surface, history panel beyond the guest's own stack, download manager) each with a non-empty reason; a Home section naming GameBanana as the specific destination and explaining the label-lookup anchoring; and a review-cadence section pairing this document with `docs/browser-destinations.md`.
- `HOME_DESTINATION_URL` already resolved by label lookup (not array index) coming into this plan. Extracted the lookup into `resolveHomeDestinationUrl(catalog, label)` so the "throws when the named entry is absent" behavior is unit testable against a synthetic catalog rather than only assertable by removing GameBanana from the real one. Real-catalog behavior is unchanged: still throws at import time if `GameBanana` is missing.
- `src/pages/Browser.tsx`'s file header comment now points at `docs/browser-scope-boundary.md` instead of restating "no tabs, no downloads, no extensions" inline.
- No tab, zoom, find-in-page, extension, history-panel, or download-manager control was added anywhere in this task; the toolbar still renders exactly its original six controls.

## Deviations from Plan

None — plan executed exactly as written. `HOME_DESTINATION_URL` was already a label lookup (not an index) coming into this plan, likely from an earlier plan in the phase; Task 2's instruction to "confirm... and if it still uses an index, change it" resolved as "already correct," so the only code change there was the test-driven extraction into `resolveHomeDestinationUrl`.

## Verification

- `pnpm exec vitest run src/lib/browserCatalog.test.ts`: 25/25 tests pass (up from the pre-plan baseline, covering grouping, visibility, and the home-lookup throw path).
- `pnpm typecheck`, `pnpm lint`, `pnpm i18n:check`, `pnpm encoding:check`: all exit 0.
- `pnpm exec vitest run` (full suite): 160 files / 1806 tests passed, 1 file / 11 tests skipped (pre-existing skips, unrelated to this plan).
- Dev-driver viewport check at 900x700 with sidebar collapsed (slot 3): no label wraps a shortcut button onto two lines; screenshot captured and reviewed.
- `grep -n "visibleShortcuts" src/pages/Browser.tsx` returns no matches — the old memo was replaced, not left beside the new one.

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: docs/browser-scope-boundary.md
- FOUND: src/lib/browserCatalog.ts (visibleDestinations, groupDestinationsByKind, resolveHomeDestinationUrl)
- FOUND: src/pages/Browser.tsx (grouped rows, GROUP_LABEL_KEYS, updated header comment)
- FOUND commit c379193 in git log
- FOUND commit 3b9f8a7 in git log
