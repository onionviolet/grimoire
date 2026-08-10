# Phase 7: UI Review Of Shipped Frontend - Context

**Gathered:** 2026-08-10
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped; scope pre-approved by the repository owner)

<domain>
## Phase Boundary

Run the retroactive six-pillar visual audit on the four shipped frontend phases
(03 Foundry build contract, 04 Locker/Foundry parity, 05 one-inventory-one-journey,
06 community tools), produce the first `*-UI-REVIEW.md` files ever created for
them, and fix every code-fixable finding before the release tag. Findings that
are not code-fixable (in-app or in-game observations) are recorded with an owner
and a resume command, consistent with the project's accepted deferred-verification
position.

</domain>

<decisions>
## Implementation Decisions

### the agent's Discretion
Audits are code-only (no dev-server screenshots; component render tests in the
suite cover interaction states). UI-SPECs are the baseline contract. Findings are
classified BLOCKER (must fix) / WARNING (fix recommended) / variance (recorded,
may be accepted with rationale). All code fixes must keep the repository gate
green (typecheck, lint, tests, i18n, encoding).

</decisions>

<code_context>
## Existing Code Insights

- UI-SPECs live in `.planning/milestones/v1.27-phases/{03,04,05,06}-*/` next to
  their archived phase documents.
- Audited surfaces: `HeroColorPicker`/`HeroEffectsPanel`, `FoundryBuildTray`,
  `MyChanges`, `changeList`, `SoundBrowse` (03); `HeroDetailFrame`,
  `LockerHero`, `HeroWorkshop`, `useTrayPreview`, `FoundryHeroGrid` (04);
  `Locker`, `GlobalSoundShelf`, `HeroCardPicker`, `HeroPortraitFamilies`,
  `PortraitBrowse`, `Installed` (05); `Browser`,
  `useBrowserToolDownloadHandoff`, `browserCatalog` (06).

</code_context>

<specifics>
## Specific Ideas

- Produce `03-UI-REVIEW.md` through `06-UI-REVIEW.md` with pillar scores (1-4)
  and actionable findings.
- Fix code-fixable findings: Phase 5 copy-contract drift (section label,
  filtered-zero block, catalog-failed state) is the known cluster.

</specifics>

<deferred>
## Deferred Ideas

- In-app observations (longest-locale wrap, live retry flows, in-game checks)
  stay recorded as human verification rows, per the standing decision.

</deferred>
