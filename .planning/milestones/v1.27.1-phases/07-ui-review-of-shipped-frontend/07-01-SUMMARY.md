---
phase: 07-ui-review-of-shipped-frontend
plan: 01
subsystem: ui-review
tags: [ui-review, copywriting, a11y, release-gate]

requires: []
provides:
  - First-ever retroactive six-pillar UI reviews for shipped frontend phases 03-06
  - Phase 5 copy-contract fixes: `locker.global.sectionLabel`, `filteredZeroTitle/Body/Reset`, and the dedicated `foundry.portraits.catalogFailed` state wired into PortraitBrowse
  - A recorded inventory of non-code-fixable findings routed as human verification rows
affects: [REQ-ui-review-shipped-frontend, release engineering readiness]

actuals:
  tokens: 0
  tasks: 7
  commits: 1

one_liner: First UI reviews for the four shipped frontend phases (03-06) plus Phase 5 copy-contract fixes, with the full repository gate green.
---

# Plan 07-01 Summary: Audits and fixes

## Delivered

- **03-UI-REVIEW.md (22/24):** copywriting 3/4 (two documented, accepted label
  variances consistent with the app's existing vocabulary), experience 3/4
  (two contract backstops recorded as human rows); visuals/color/typography/
  spacing 4/4 each.
- **04-UI-REVIEW.md (23/24):** all copy verbatim; experience 3/4 with three
  recorded backstops (each decided per the contract's own assumptions).
- **05-UI-REVIEW.md (22/24):** copywriting 2/4 on four contract deviations;
  all four fixed or accepted: `sectionLabel` -> "Global inventory view",
  `filteredZero*` -> "No results for {{filter}}." / "Nothing in this view
  matches the current filter." / "Clear filter", new
  `foundry.portraits.catalogFailed.title/.description` keys wired into
  `PortraitBrowse`'s failed branch (raw error retained as a secondary line),
  and the unresolved-hint plural wording recorded as an accepted variance
  (more correct for multi-name groups).
- **06-UI-REVIEW.md (24/24):** no code-fixable findings; three backstops
  recorded, two already covered by the phase's seam/held-out tests.

## Gate Results

- `pnpm i18n:manifest` - regenerated (3169 keys)
- `pnpm i18n:check` - pass (all referenced keys exist)
- `pnpm encoding:check` - pass
- `pnpm typecheck` - pass
- eslint (changed files) - pass
- `pnpm test` - 2076 passed, 12 skipped

## Carried Rows (human verification, per standing decision)

- Longest-locale wrap checks for the Phase 3/4/5 new strings
- Phase 3 E1 partial VFX-layer detection; E4 failed pool-write revert in-app
- Phase 4 E1 stage-control loading behavior; E4 partial skin-stack failure;
  E6 load-failure vs loading dot
- Phase 6 downloading-toast-before-write timing; longest catalog label wrap
