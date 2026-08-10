---
phase: 04-locker-and-foundry-as-one-object
plan: 02
subsystem: ui
tags: [react, electron, foundry, locker, recolor, asset-sources, i18n]

requires:
  - phase: 03-foundry-completes-its-build-contract
    provides: discoverRecolorEntries, the foundry:prepareRecolorStage IPC, the foundryPrepareRecolorStage renderer wrapper, and the foundry:inspectAssetSources ownership inspection
  - phase: 04-locker-and-foundry-as-one-object
    provides: plan 04-01's composable stage and the shared AssetSourcesPanel ownership panel
provides:
  - "lockerManaged flag on FoundryAssetSource, set from the four locker* metadata markers, so Grimoire's own rebuilt artifacts never contest the user against themselves"
  - "Pure recolorApplyConsequence module: exact normalized write set, contesting owners, effective winner, unreadable names, and contested flag derived only from the existing inspection"
  - "Locker Effects-tab pre-write disclosure: inline path list and owners before the managed colors VPK is rebuilt, one-press for routine applies, a request-keyed confirm gate for contested writes, and a read-only block on unreadable VPKs"
  - "Foundry hero grid loading badge: a neutral pulse dot while the mod list is unloaded, distinct from a genuine zero"
affects: [05-one-inventory-one-journey, uat-04]

actuals:
  tokens: 9376    # chars/4 over the realized diff (37506 chars added+deleted)
  tasks: 3        # tasks completed
  commits: 3      # production commits (per-task); final docs commit separate

tech-stack:
  added: []
  patterns:
    - "Pure consequence module over an existing inspection result: paths/owners/winners are never re-derived renderer side, keeping the claims index the single answer for who wins"
    - "Request-keyed confirm gate: a held disclosure is bound to the exact serialized export request it described, and any parameter change clears it and re-arms the gate"
    - "One ownership implementation across surfaces: the Locker disclosure reuses AssetSourcesPanel verbatim, passing only paths"

key-files:
  created:
    - src/components/locker/recolorApplyConsequence.ts
    - src/components/locker/recolorApplyConsequence.test.ts
    - src/components/foundry/FoundryHeroGrid.test.tsx
  modified:
    - electron/main/services/foundryAssetSources.ts
    - electron/main/services/foundryAssetSources.test.ts
    - src/types/foundry.ts
    - src/components/locker/HeroColorPicker.tsx
    - src/components/foundry/FoundryHeroGrid.tsx
    - src/locales/en/translation.json
    - src/locales/manifest.json
    - src/components/foundry/AssetSourcesPanel.test.tsx, ChangePools.test.tsx, poolView.test.ts, portraitFamily.test.ts, recolorStagedEdit.test.ts, sourceGating.test.ts, visualEdits.test.ts, src/lib/inspectedAssetClaims.test.ts (fixture lock-in for the new required field)

key-decisions:
  - "lockerManaged is a separate boolean, never a provenance reclassification: a user-forged mod is also Forged and SHOULD contest, so the two concepts cannot share a classifier"
  - "The disclosure is keyed to the serialized export request: a confirmation granted for one write set can never be replayed after a parameter change (T-04-10)"
  - "An unreadable VPK blocks only that one ambiguous apply and mutates nothing: no bake result is folded in, no mod is enabled, disabled or reordered (D-08)"
  - "The uncontested case is deliberately not a warning: a routine recolor keeps its one-press speed and the disclosure renders inline, never behind a modal (D-07)"

patterns-established:
  - "Consequence-module pattern: a pure function over data the caller already fetched (sibling to soundPickConsequence), with the head comment stating the entries came from parsing a real bake output"
  - "Request-key re-arm pattern: JSON-serialized request as the identity of a held disclosure, with a useEffect clearing stale disclosures on any parameter change"
  - "Badge branch ladder: loading dot / numeral / absent in one conditional, so loading and zero can never render identically"

requirements-completed: [REQ-locker-foundry-parity-lanes]

coverage:
  - id: D1
    description: "Pure recolorApplyConsequence module: paths come verbatim from the inspection, owners are enabled non-lockerManaged winners, contestedPaths is the deduplicated union, unreadable surfaces as names, and the contested flag is owners.length > 0"
    requirement: REQ-locker-foundry-parity-lanes
    verification:
      - kind: unit
        ref: "src/components/locker/recolorApplyConsequence.test.ts#8 cases"
        status: pass
    human_judgment: false
  - id: D2
    description: "lockerManaged classification: true for candidates carrying lockerColors or lockerCosmetics, false for plain third-party VPKs and user-forged foundryBuild mods, with provenance unchanged for every candidate"
    requirement: REQ-locker-foundry-parity-lanes
    verification:
      - kind: unit
        ref: "electron/main/services/foundryAssetSources.test.ts#marks Locker-managed artifacts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Locker Effects-tab pre-write disclosure: apply runs the shared bake-then-inspect discovery, renders the exact path list and owners inline via AssetSourcesPanel, blocks only contested writes behind an 'Apply anyway' gate keyed to the exact serialized request, and refuses with the unreadable mods named when a VPK cannot be inspected"
    requirement: REQ-locker-foundry-parity-lanes
    verification:
      - kind: unit
        ref: "src/components/locker/recolorApplyConsequence.test.ts#contested and unreadable cases"
        status: pass
    human_judgment: true
    rationale: "The pure consequence and gate predicate are unit-proven, but the interactive contract (one press applies uncontested, a slider move re-arms the gate, a corrupted VPK blocks without rebuilding the managed colors VPK) needs a running renderer with real installed mods, which is human-only per 04-VALIDATION.md and the project's deferred real-game verification policy."
  - id: D4
    description: "Foundry hero grid distinguishes an unknown change count from a genuine zero: a neutral pulse dot in the badge position while !modsLoaded, the existing accent numeral when changeCount > 0, and nothing at all for a true zero, with a card never rendering both a dot and a numeral"
    requirement: REQ-locker-foundry-parity-lanes
    verification:
      - kind: unit
        ref: "src/components/foundry/FoundryHeroGrid.test.tsx#4 cases"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-08-09
status: complete
---

# Phase 4 Plan 2: Recolor Write-Set Disclosure and the Foundry Loading Badge Summary

**A Locker ability recolor now names the exact normalized VPK paths it will write and who owns them today before the managed colors VPK is rebuilt, blocking only when another enabled mod would lose paths, and a Foundry hero card no longer renders "no changes" and "not known yet" identically.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-08-09T02:00:30Z
- **Completed:** 2026-08-09T02:12:15Z
- **Tasks:** 3
- **Files modified:** 18

## Accomplishments

- `FoundryAssetSource` gained a `lockerManaged` boolean, set from the four `locker*` metadata markers (`lockerCosmetics`, `lockerSounds`, `lockerColors`, `lockerTrippySkins`) that main already uses for exactly this classification. Grimoire's own auto-rebuilt ability-colours VPK is now honest on every surface that renders it instead of being labelled `Third-party`, and it can never contest the user against themselves on re-apply.
- `src/components/locker/recolorApplyConsequence.ts` computes the disclosed write set, the contesting owners, the contested path union, and the unreadable mods as one pure function over the existing inspection result. No renderer-side copy of the per-hero recipe exists, and who wins stays the claims index's answer.
- `HeroColorPicker`'s Locker branch now runs `foundryPrepareRecolorStage` (the same cache-keyed bake the apply performs) then `foundryInspectAssetSources`, renders the exact paths, owners and effective winner inline through the shared `AssetSourcesPanel`, and keeps one-press speed when nothing else claims the paths. A contested write stops before the write and turns the primary button into "Apply anyway", keyed to the exact serialized request so any parameter change re-arms the gate. An unreadable inspection blocks only that one apply and mutates nothing.
- `FoundryHeroGrid` threads `modsLoaded` into `HeroCard` and renders a small neutral pulse dot in the badge position while the count is unknown, keeping the existing accent numeral for authored changes and the deliberate absence for a genuine zero.
- The Foundry staging branch of `handleApply` and `provenance()` in `foundryAssetSources.ts` are both byte-for-byte untouched, per the plan's prohibitions.

## Task Commits

Each task was committed atomically:

1. **Task 1: Make a recolor's write set and its current owners a pure, testable fact** - `3f0f6f0` (feat)
2. **Task 2: Say what an ability recolor will overwrite, in the Locker, before it writes** - `d299fdc` (feat)
3. **Task 3: Stop the Foundry hero grid from rendering "no changes" and "not known yet" identically** - `b807985` (feat)

**Plan metadata:** final docs commit (separate)

## Files Created/Modified

- `src/components/locker/recolorApplyConsequence.ts` - New pure consequence module: `RecolorContestingOwner`, `RecolorApplyConsequence`, and `recolorApplyConsequence(entries, inspection)`; refuses to disclose an empty write set when entries were requested
- `src/components/locker/recolorApplyConsequence.test.ts` - New node-environment coverage: 8 cases (uncontested, one owner with two wins, disabled excluded, re-apply against a lockerManaged artifact, mixed owner, unreadable names, ordered deduplicated union, empty-write-set refusal)
- `electron/main/services/foundryAssetSources.ts` - Widened `InstalledAssetSourceCandidate['metadata']` with the four `locker*` keys and added the `lockerManaged` field, populated beside `managed`; `provenance()` untouched
- `electron/main/services/foundryAssetSources.test.ts` - New classification case asserting `lockerManaged` truth/falsity and provenance stability
- `src/types/foundry.ts` - Mirrored `lockerManaged` on the renderer `FoundryAssetSource`
- `src/components/locker/HeroColorPicker.tsx` - Disclosure state + request key, bake-then-inspect before the apply, unreadable refusal, request-keyed contested gate with "Apply anyway", re-arm effect, inline disclosure block, and a `checkingOverwrite` busy hint; the `if (onStage)` staging branch untouched
- `src/components/foundry/FoundryHeroGrid.tsx` - `modsLoaded` threaded into `HeroCard`; three-branch badge (loading dot / numeral / absent) with the existing numeral class copied verbatim and the zero-case comment extended
- `src/components/foundry/FoundryHeroGrid.test.tsx` - New jsdom render coverage: 4 cases over the mocked store
- `src/locales/en/translation.json` - 8 new keys (7 logical) under `locker.colors` plus `foundry.heroes.changeCountLoading`
- `src/locales/manifest.json` - Regenerated (3080 keys)
- Nine test fixture files gained `lockerManaged: false` on their `FoundryAssetSource` literals (mechanical consequence of the required field)

## Decisions Made

- `lockerManaged` is a distinct concept from provenance: a user-forged mod is also `Forged` and SHOULD contest a recolor, so the two cannot share a classifier. Documented beside the field in both declarations.
- The disclosure is bound to the exact serialized export request it described; a confirmation granted for one write set cannot be replayed after a slider, mode, gradient or trippy parameter change.
- `recolorApplyConsequence` receives the requested entries and the inspection, returns the inspection's own path list verbatim, and throws rather than disclose an empty write set when entries were requested but the inspection returned none - a disclosure that disagrees with the write is worse than no disclosure.
- The routine uncontested case is deliberately not a warning: the disclosure renders inline and the apply proceeds in the same press.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Refuse an inconsistent empty write set in the consequence module**
- **Found during:** Task 1
- **Issue:** `recolorApplyConsequence` receives the requested entries but derives `paths` from the inspection. If discovery and inspection disagreed (entries requested, no paths returned), the caller would disclose an empty write set for a write that will still happen - exactly the T-04-05 failure the plan guards against.
- **Fix:** Added a guard that throws when `entries.length > 0 && inspection.paths.length === 0`. It cannot fire in the normal flow (the inspection returns every normalized requested path), so routine one-press applies are unaffected.
- **Files modified:** src/components/locker/recolorApplyConsequence.ts
- **Verification:** Dedicated 8th test case in recolorApplyConsequence.test.ts; full suite green
- **Committed in:** 3f0f6f0 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing-critical)
**Impact on plan:** The guard strengthens the disclosure contract without changing any planned behavior; no scope creep.

## Issues Encountered

- The new required `lockerManaged` field on `FoundryAssetSource` forced fixture updates across nine existing test files; each was a one-line `lockerManaged: false` addition with no behavior change.
- The plan's behavioural acceptance items (one-press apply, slider re-arm, corrupted-VPK block, live badge swap) require a running renderer with real installed mods; they are covered structurally and by the pure/render tests, and the interactive half routes to end-of-milestone UAT per the project's deferred real-game verification policy.

## Known Stubs

None. The loading dot is a deliberate, tested UI state, not a placeholder.

## Deferred Verification

- The interactive disclosure contract (contested gate re-arm, unreadable VPK block without rebuilding the managed colors VPK, one-press routine apply) is human-only and routes to end-of-milestone UAT.
- The badge's live swap (pulse replacing numeral once the mod list resolves) is human-only for the visual reading; the four render tests pin the branches.

## Next Phase Readiness

- Phase 4's honesty gaps are closed: the Locker Effects tab and the Foundry grid both answer "what will change / what is known" without hiding uncertainty.
- The `lockerManaged` flag now flows through the shared asset-source shape, so any future surface that renders ownership can label Grimoire's own outputs correctly without a second classifier.
- Ready for phase 5 (one-inventory-one-journey) and the phase's deferred items (Locker hero page target state, portrait journey, global sound inventory home).

---
*Phase: 04-locker-and-foundry-as-one-object*
*Completed: 2026-08-09*

## Self-Check: PASSED

- Created files verified on disk: recolorApplyConsequence.ts, recolorApplyConsequence.test.ts, FoundryHeroGrid.test.tsx, 04-02-SUMMARY.md
- Commits verified in git log: 3f0f6f0 (Task 1), d299fdc (Task 2), b807985 (Task 3)
- All plan-level verifications green: typecheck, lint, full test suite (169 files / 1891 tests passed), i18n:check, encoding:check, manifest idempotent (3080 keys), provenance() untouched, onStage staging branch untouched
