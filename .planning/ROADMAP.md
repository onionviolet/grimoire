# Roadmap: Grimoire

## Milestones

- ✅ **v1.27 "verified, supported, coherent"** - Phases 1-6 (shipped 2026-08-10)
- 🚧 **v1.27.1 "absorb, review, ship"** - Phases 7-8 (in progress)

## Phases

**Phase Numbering:** continues from v1.27 (7, 8). Decimal phases (7.1, 8.1) are urgent insertions marked INSERTED.

- [x] **Phase 7: UI Review Of Shipped Frontend** - Run the retroactive six-pillar visual audit on the four shipped frontend phases (03-06), produce the first UI-REVIEW files ever created for them, and fix code-fixable findings before release (completed 2026-08-10)
- [ ] **Phase 8: Release Engineering** - Ship v1.27.1: CHANGELOG entry, tag `v1.27.1` matching `package.json`, push to `origin`, and confirm the GitHub Release (installer, checksums, attestations) with notes from the changelog

## Phase Details

### Phase 7: UI Review Of Shipped Frontend

**Goal**: The four shipped frontend phases (03 Foundry build contract, 04 Locker/Foundry parity, 05 one-inventory-one-journey, 06 community tools) each receive a graded six-pillar visual audit against their UI-SPECs, and every code-fixable finding is fixed and covered before the release tag.
**Depends on**: Nothing (retroactive on shipped phases)
**Requirements**: REQ-ui-review-shipped-frontend
**Success Criteria** (what must be TRUE):

  1. A `{phase}-UI-REVIEW.md` exists for each of phases 03-06 with the six pillar scores (1-4) and an explicit list of findings
  2. Every code-fixable finding (visual, accessibility, layout, contrast, responsiveness, state feedback) is fixed and the repository gate is green (typecheck, lint, full test suite, i18n, encoding)
  3. Findings that are not code-fixable (e.g. requiring live in-game validation) are recorded with an owner and a resume command, consistent with the project's accepted deferred-verification position

### Phase 8: Release Engineering

**Goal**: The fork ships v1.27.1 as a GitHub Release on `onionviolet/grimoire`, produced by the release workflow and verified end to end.
**Depends on**: Phase 7
**Requirements**: REQ-release-v1.27.1
**Success Criteria** (what must be TRUE):

  1. `package.json` version is 1.27.1 and `scripts/verify-release-version.mjs` passes against the tag
  2. A CHANGELOG entry records the fork's v1.27.1 release (upstream v1.27 absorbed + fork divergence), free of bare upstream PR-number references
  3. Tag `v1.27.1` is created and pushed to `origin` (`onionviolet/grimoire` only); `release.yml` builds the installer, checksums, and attestations
  4. The GitHub Release exists with release notes from the changelog, and the release URL is reported
