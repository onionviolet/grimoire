---
phase: 05-one-inventory-one-journey
verified: 2026-08-09T03:59:35Z
status: human_needed
score: 3/6 must-haves verified
behavior_unverified: 3 # Count of PRESENT_BEHAVIOR_UNVERIFIED truths (present + wired, behavior not exercised); each is detailed in behavior_unverified_items below (and in human_verification below)
overrides_applied: 0
behavior_unverified_items:
  - truth: "SC1: Opening Global never strands the user in an empty category while installed global content sits hidden behind another tab, and the mod counts its sections report agree with each other"
    test: "Open /locker/global in the running app with a mix of installed visual and global sound mods; switch between All content, Visuals and Sounds; repeat with a section that filters to zero rows."
    expected: "Bare /locker/global lands on All content; empty rail categories render no row; a narrower section with zero non-empty categories shows the reset state with a Show all content action; the header count beside Global is the same Set-deduplicated count in all three sections."
    why_human: "The route, projection and hide-empty logic are unit-tested, but no render test mounts LockerGlobalView, so the rendered tablist, rail row hiding, reset state, membership caveat placement and header consistency need in-app sign-off."
  - truth: "SC4: Abrams and every other hero whose codename mismatches resolve to the same portrait family whether reached from the Locker or from Foundry, and an empty portrait view says which of 'not indexed', 'loading' or 'failed' is true"
    test: "Confirm the driven-build verdict record (docs/portrait-alias-sweep-plan.md) reflects the measured build, and open the Foundry portrait catalog and Locker Cards & portraits for a hero with no indexed family."
    expected: "Every mismatch hero has a recorded four-way verdict; the Locker family surface distinguishes loading, failed, none and populated (render-tested); the Foundry catalog shows its distinct not-indexed/loading/failed/empty states rather than collapsing them."
    why_human: "Leg A is unit-tested and the Locker four-state surface has a passing render test, but the Legs B/C verdicts were driven over CDP on dev slot 2 and only a human can sign off that the record reflects the loaded build; the Foundry catalog's five states are present but have no render-level test."
  - truth: "SC5: Any bulk action can be undone without rebuilding the selection by hand, and no disabled control leaves its blocker to be guessed"
    test: "In Installed, select several mods, run a bulk enable/disable/retag, press Undo; verify selection is restored in select mode; run a second batch and verify only the newest batch is undoable; trigger a partial failure and verify one toast with counts and Undo; check a disabled Profiles apply, Conflicts resolve and Foundry forge control names its blocker in rendered text."
    expected: "Undo restores data and the same selection; a newer batch supersedes the previous undo offer; a partial failure reports changed/failed counts in one toast keeping Undo; every disabled control has an aria-describedby pointing at a rendered blocker line, never a tooltip alone."
    why_human: "The pure snapshot/diff/restore module is unit-tested and the aria-describedby wiring is present, but no render test mounts Installed, Profiles, Conflicts or FoundryBuildTray, so the end-to-end undo flow, supersession, partial-failure toast and visible blocker lines need functional sign-off in the running app."
human_verification:
  - test: "Open /locker/global in the running app with a mix of installed visual and global sound mods; switch between All content, Visuals and Sounds; also test with a section that filters to zero rows."
    expected: "Bare /locker/global lands on All content; empty categories render no row; the narrower section shows a three-part reset state (what is missing, why, Show all content); the header count is the same unique-mod count in all three sections; All content shows the membership caveat once above the rail."
    why_human: "The pure route/projection logic is unit-tested; the rendered selector, rail highlight, reset state and caveat placement have no render test in this repo."
  - test: "Open the Locker per-hero card shuffle and the Foundry cross-hero pool list and check the scope captions."
    expected: "The per-hero control is captioned 'This hero', every cross-hero pool list is captioned 'All forged portraits', each caption stays on one line in the longest shipped locale, and both controls still read/write one shared pool identity."
    why_human: "Captions are wired at the call sites and the pool-identity diff guard held, but no render test mounts HeroCardPicker or MyChanges, so placement and wrap need visual sign-off."
  - test: "From the Locker portrait family surface, verify the four states: loading, failed (with retry), no assets for this hero, and populated; confirm the failed state names what is missing, why, and offers a working retry."
    expected: "Exactly one state renders at a time; retry re-runs the same load and replaces the failed state on success; 'no assets for this hero' keeps its shipped copy."
    why_human: "The four-state render test passes, but the in-app retry flow against a real catalog read and the visual distinction between failed and not indexed need human confirmation."
  - test: "Open the Foundry portrait catalog with a codename the alias table cannot place (or a hero-pinned view) and inspect the unresolved disclosure."
    expected: "The raw codename renders as its own label with a neutral Unresolved tag (raw name in the title attribute), the hint renders once per group, and a failed catalog read routes to the failed state, never to the unresolved label."
    why_human: "The shared resolver and HeroSelect are unit-tested, but PortraitBrowse has no render-level test, so the one-hint-per-group placement and failure routing need functional sign-off."
  - test: "In the Global drill-in, verify a card whose mod name is only a pak slot (e.g. Pak92)."
    expected: "The card leads with a description derived from the mod's own VPK entries, keeps the raw pak name as a secondary line, shows the raw name while the read is in flight, and labels unreadable or empty paks as unknown content."
    why_human: "The derivation is unit-tested; the rendered card states (loading, secondary identity line, unknown label) have no DOM-level test."
  - test: "In Installed, select several mods, run bulk enable/disable/hero tag/clear tag/global tag, then press Undo; run a second batch before undoing the first; trigger a partial failure if possible."
    expected: "Undo restores both data and the same selection in select mode; only the newest batch is undoable (previous toast dismissed); a partial failure reports changed and failed counts in one warning toast that keeps Undo; bulk delete keeps its confirmation and offers no undo."
    why_human: "The pure undo module is unit-tested and all five handlers capture before their loops, but no render test mounts the Installed action bar, so the end-to-end flow and single-toast supersession need functional sign-off."
  - test: "While a Profiles apply/update, a Conflicts resolve action, or a Foundry forge runs, inspect each disabled control and its blocker line."
    expected: "Every disabled control is described by an accessible description pointing at rendered text naming the reason; the forge button names which of its two blockers is in force (empty selection or forge running) with the corrective action preferred; exactly one blocker reason renders at a time."
    why_human: "aria-describedby wiring and rendered blocker lines are present (grep-verified), but the visible behavior in the running app needs sign-off."
  - test: "In Conflicts, re-run the conflict scan after the first successful load, and also test the very first load."
    expected: "The first load shows the skeleton; a recheck keeps every row on screen with a 'results below are from the previous check' line; a failed recheck falls through to the existing error state with its retry."
    why_human: "The hasLoaded flag and rescanning line are present in code, but the retained-row-with-recheck-label behavior only exists in the running app against real conflict data."
  - test: "On a Conflicts card, click Open in Installed (where the side resolved to a mod record)."
    expected: "The app navigates to /?focusMod=<id> and Installed scrolls to and highlights the named mod; a side whose record is missing from modsMap renders no affordance."
    why_human: "The helper is unit-tested and the focus consumer exists, but the click-through navigation is in-app behavior only a human can sign off."
  - test: "Review docs/portrait-alias-sweep-plan.md Results section against the sweep scratchpad (C:\\Users\\wayba\\AppData\\Local\\Temp\\gsd-05-05-sweep\\)."
    expected: "Per-hero four-way verdicts for all 15 mismatch heroes, Abrams driven end to end on both surfaces, the dual-table lead ruled out as the cause of issue #4 on this build, and the negative result recorded rather than absent."
    why_human: "The record is corroborated by scratchpad JSON/screenshots and the dev-slot-2 log, but only a human can confirm the record reflects a genuinely driven build and accept the negative-result conclusion for issue #4."
---

# Phase 5: One Inventory, One Journey Verification Report

**Phase Goal:** Installed global content has exactly one home, portraits have a decided journey rather than two shipped halves, the Abrams portrait defect has a root cause, and the app reads as one product
**Verified:** 2026-08-09T03:59:35Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth   | Status     | Evidence       |
| --- | ------- | ---------- | -------------- |
| 1   | Opening Global never strands the user in an empty category while installed global content sits hidden behind another tab, and the mod counts its sections report agree with each other | PRESENT_BEHAVIOR_UNVERIFIED | Route logic, merged hide-empty projection and Set-deduplicated header count unit-proven (`lockerMode.test.ts`, `globalInventory.test.ts`, 24 tests); render wiring present in `Locker.tsx` (three-segment tablist, `globalInventoryRailRows`, reset state, membership caveat). No render test mounts `LockerGlobalView`, so rendered behavior is not exercised. |
| 2   | Portrait management has one stated journey, and where two controls do the same thing that is a recorded decision rather than an accident | VERIFIED | Scope captions wired at both call sites (`locker.cards.shuffleScopeThisHero`, `foundry.myChanges.shuffleScopeAllForged`); `ChangePools.tsx` keeps one pool identity; no separate portraits route; the deliberate two-control split is recorded in `.planning/STATE.md` / PROJECT decisions. |
| 3   | The Locker knows a portrait has variants | VERIFIED | `HeroPortraitFamilies.tsx` renders per-variant labels (`portraitVariantDisplay`), a per-variant Replace action (`portrait.family.replaceVariant`) and per-variant source disclosure; the four-state family surface has a passing render test (`HeroPortraitFamilies.test.tsx`). |
| 4   | Abrams and every other hero whose codename mismatches resolve to the same portrait family whether reached from the Locker or from Foundry, and an empty portrait view says which of "not indexed", "loading" or "failed" is true | PRESENT_BEHAVIOR_UNVERIFIED | Leg A whole-roster/dual-table tests pass (71 tests incl. `heroPortraitIdentity.test.ts`); Legs B/C verdict record present and corroborated by scratchpad evidence (405 items / 78 codenames, per-hero JSONs, slot-2 log); Locker four-state render test passes. Foundry catalog states are present but not render-tested; driven verdicts need human sign-off. |
| 5   | Any bulk action can be undone without rebuilding the selection by hand, and no disabled control leaves its blocker to be guessed | PRESENT_BEHAVIOR_UNVERIFIED | Pure `bulkUndo` module unit-proven (9 tests); all five reversible handlers capture and offer Undo with supersession; `aria-describedby` blocker wiring present in Installed, Profiles, Conflicts and FoundryBuildTray. No render test mounts those surfaces, so the end-to-end flow is not exercised. |
| 6   | The same state is never given two names on two pages, and every empty state names what is missing, why, and the next action | VERIFIED | Active source vocabulary consolidated at 14 existing keys with render tests asserting the phrase (`ChangePools.test.tsx`, `AssetSourcesPanel.test.tsx`); empty-state copy (reset state, portrait failed state, unknown-pak label) present with what/why/next-action shape. |

**Score:** 3/6 truths verified (3 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected    | Status | Details |
| -------- | ----------- | ------ | ------- |
| `src/lib/lockerMode.ts` | Three-value LockerMode and route defaulting | VERIFIED | `'all' | 'looks' | 'sounds'`; bare `/locker/global` defaults to `all`; legacy rewrites intact |
| `src/lib/globalInventory.ts` | Merged hide-empty rail projection | VERIFIED | `globalInventoryRailRows`, `firstGlobalRailRowKey`, `GlobalRailRow` exported and tested |
| `src/pages/Locker.tsx` | Three-segment selector, merged rail, reset state | VERIFIED | Wired through `GLOBAL_SECTION_TABS`, `globalInventoryRailRows`, reset state, membership caveat, unnamed-pak card label |
| `src/locales/en/translation.json` | Active source vocabulary and all phase keys | VERIFIED | All 23 spot-checked keys present; `pnpm i18n:check` exit 0; manifest regenerated by 05-01 only |
| `src/components/locker/HeroPortraitFamilies.tsx` | Four-state family surface with retry | VERIFIED | Loading/failed/none/populated branches; `onRetry` wired from `HeroCardPicker` |
| `src/components/locker/HeroPortraitFamilies.test.tsx` | Four-state render coverage | VERIFIED | jsdom render test passes (4 cases, retry fires once) |
| `src/components/foundry/PortraitBrowse.tsx` | Shared resolver + unresolved disclosure | VERIFIED | `buildHeroFilterOptions` + `HeroSelect`; unresolved tags with raw codename in `title` |
| `src/lib/heroPortraitIdentity.test.ts` | Leg A whole-roster and dual-table checks | VERIFIED | 71 tests pass incl. whole-roster collision and cross-table agreement |
| `src/lib/bulkUndo.ts` | Pure snapshot/diff/restore module | VERIFIED | `captureBulkSnapshot`, `bulkUndoPlan`, `bulkChangedCount` exported; 9 tests pass |
| `src/lib/bulkUndo.test.ts` | Coverage for capture/diff/skip/partial cases | VERIFIED | All pass |
| `src/pages/Installed.tsx` | Undo capture, toast, supersession, blocker line | VERIFIED | `offerBulkUndo` helper, 5 handlers, `dismissToast` supersession, `installed-bulk-blocker` + aria-describedby |
| `src/lib/derivedPakName.ts` | Unnamed-pak detection and derivation | VERIFIED | `isUnnamedPakName` (exact PakNN shape), `derivePakDescription` (cap 3 + remainder, unknown fallback); 10 tests pass |
| `src/components/locker/useUnnamedPakEntries.ts` | Memoized per-mod VPK entry reads | VERIFIED | Reuses existing `listUnknownModFiles` IPC; one call per mod; silent per-mod failures |
| `.planning/REQUIREMENTS.md` | Recorded global-sound answer and alias-sweep traceability | VERIFIED | REQ-sound-locker-surface resolved by D-01/D-02 with cited evidence; alias-sweep completion note cites the verdict record |
| `docs/portrait-alias-sweep-plan.md` | Completed sweep verdict record | VERIFIED | Results section with 15-row verdict table and Leg C record (the `contains: Verdicts` artifact check is a case-sensitive false negative; the table and per-hero verdicts are present and corroborated by scratchpad JSON) |
| `src/lib/provenance.ts` | One provenance route builder | VERIFIED | `focusModPath` encodes id, root-relative, no scheme/host; 5 tests pass |
| `src/lib/provenance.test.ts` | Encoding/shape/injection coverage | VERIFIED | All pass |
| `src/pages/Conflicts.tsx` | Fourth provenance surface, resolve blockers, recheck retention | VERIFIED | `focusModPath` navigation, per-site blocker ids + aria-describedby, `hasLoaded` first-load split, rescanning line |
| `src/pages/Profiles.tsx` | Apply/update blocker line + accessible descriptions | VERIFIED | `busyBlockerId` rendered line; 7+ aria-describedby sites |
| `src/components/foundry/FoundryBuildTray.tsx` | Forge/install two named blockers | VERIFIED | `blockedBusy` vs `blockedEmpty`, one at a time, aria-describedby + aria-live |

### Key Link Verification

| From | To  | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `src/pages/Locker.tsx` | `src/lib/globalInventory.ts` | `globalInventoryRailRows` | WIRED | gsd-tools verified |
| `src/pages/Locker.tsx` | `src/lib/lockerMode.ts` | `GLOBAL_SECTION_TABS` | WIRED | gsd-tools verified |
| `src/lib/lockerMode.ts` | `src/pages/Locker.tsx` | `?mode=sounds` legacy rewrite | WIRED | gsd-tools verified |
| `src/components/foundry/PortraitBrowse.tsx` | `src/components/foundry/heroFilterOptions.ts` | `buildHeroFilterOptions` | WIRED | gsd-tools verified |
| `src/components/locker/HeroCardPicker.tsx` | `src/components/locker/HeroPortraitFamilies.tsx` | `onRetry` | WIRED | gsd-tools verified |
| `src/lib/heroPortraitIdentity.test.ts` | `src/lib/lockerUtils.ts` | `canonicalHeroName` cross-check | WIRED | gsd-tools verified |
| `src/pages/Installed.tsx` | `src/lib/bulkUndo.ts` | `bulkUndoPlan` | WIRED | gsd-tools verified |
| `src/pages/Installed.tsx` | `src/stores/toastStore.ts` | `dismissToast` supersession | WIRED | gsd-tools verified |
| `src/pages/Installed.tsx` | `src/lib/api.ts` | restore mutators `toggleMod`/`setModLockerHero`/`setModGlobalType` | WIRED | gsd-tools verified |
| `src/pages/Locker.tsx` | `src/components/locker/useUnnamedPakEntries.ts` | `useUnnamedPakEntries` | WIRED | gsd-tools verified |
| `src/components/locker/useUnnamedPakEntries.ts` | `src/lib/api.ts` | `listUnknownModFiles` | WIRED | gsd-tools verified |
| `src/pages/Locker.tsx` | `src/lib/derivedPakName.ts` | `derivePakDescription` | WIRED | gsd-tools verified |
| `scripts/dev-driver.mjs` | `src/components/foundry/PortraitBrowse.tsx` | dev-driver reads rendered hero filter | WIRED | gsd-tools verified |
| `docs/portrait-alias-sweep-plan.md` | `.planning/REQUIREMENTS.md` | traceability note cites verdict record | WIRED | gsd-tools verified |
| `src/pages/Conflicts.tsx` | `src/lib/provenance.ts` | `focusModPath` | WIRED | gsd-tools verified |
| `src/lib/provenance.ts` | `src/pages/Installed.tsx` | `focusMod` query consumed by focus effect | WIRED | gsd-tools verified; consumer at Installed.tsx:976 |
| `src/pages/Profiles.tsx` | `src/locales/en/translation.json` | `profiles.actions.busyBlocker` | WIRED | gsd-tools verified |
| `src/components/foundry/FoundryBuildTray.tsx` | `src/components/foundry/AssetSourcesPanel.tsx` | `aria-live` explanation pattern | WIRED | gsd-tools verified |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `Locker.tsx` rail rows | `railRows` | `groups` + `soundCounts` from store/inventory read model | Yes | FLOWING |
| `Locker.tsx` header total | `total` | `countGlobalInventoryMods(groups, globalSoundEntries)` Set-dedup | Yes | FLOWING |
| `Locker.tsx` unnamed-pak card | `unnamedPakEntries[mod.id]` | `listUnknownModFiles` IPC per mod | Yes | FLOWING |
| `useUnnamedPakEntries.ts` | `entries` | `window.electronAPI.listUnknownModFiles` | Yes | FLOWING |
| `Conflicts.tsx` provenance button | `focusModPath(mod.id)` | mod record from `modsMap` | Yes | FLOWING |
| `Installed.tsx` focus effect | `focusParams.get('focusMod')` | URL query | Yes | FLOWING |
| `Profiles.tsx` blocker | `busyBlockerId` | rendered i18n line | Yes | FLOWING |
| `FoundryBuildTray.tsx` blocker | `blockedBusy`/`blockedEmpty` | rendered i18n line | Yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Phase-critical unit behaviors (route, projection, family states, Leg A, bulk undo, derived names, provenance, resolver) | `pnpm exec vitest run` (8 targeted files) | 132 passed | PASS |
| Full workspace suite (repo gate) | `pnpm exec vitest run` | 1929 passed, 12 skipped, 0 failed | PASS |
| Catalog integrity | `pnpm i18n:check` | exit 0 (informational unused-key list incl. the 5 deliberately-deferred provenance keys) | PASS |
| Encoding gate | `pnpm encoding:check` | clean (655 files) | PASS |
| Driven sweep evidence | scratchpad cross-check (`legb-catalog.json` = 405 items / 78 distinct / 0 null; `scoped-*.json`, `legc3-*.json`, `dev-slot2.log`) | matches verdict record | PASS |

### Probe Execution

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| None | N/A | No `scripts/*/tests/probe-*.sh` and no probe references in phase 5 plans/summaries | N/A (not a migration/tooling phase) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| REQ-global-inventory-coherence | 05-01, 05-04 | Global reads as one inventory; no stranded empty category; PakNN cards usable | SATISFIED | `lockerMode.ts`, `globalInventory.ts`, `Locker.tsx`, `derivedPakName.ts` + tests; REQUIREMENTS.md amended 2026-08-09 |
| REQ-sound-locker-surface | 05-01, 05-04 | Global drill-in is the canonical home; legacy URLs resolve; no second route | SATISFIED | `GlobalSoundShelf`, `legacySoundTarget`/`resolveLockerRoute`, `lockerMode.test.ts`; recorded as resolved by D-01/D-02 |
| REQ-portrait-journey-consolidation-gated | 05-02 | One stated journey; separate implementations kept; decision recorded | SATISFIED | Scope captions at call sites, no new route, `ChangePools.tsx` untouched, decisions in STATE.md/PROJECT.md |
| REQ-portrait-alias-sweep | 05-02, 05-05 | All three legs; per-hero verdicts; Abrams root-cause outcome | SATISFIED | `heroPortraitIdentity.test.ts` (Leg A), `docs/portrait-alias-sweep-plan.md` verdict record (Legs B/C), scratchpad corroboration |
| REQ-ui-consequence-and-vocabulary | 05-01, 05-02, 05-03, 05-06 | Undo for reversible bulk actions; stated blockers; one provenance phrase/target; one empty-state shape | SATISFIED | `bulkUndo.ts` + tests, aria-describedby wiring, `provenance.ts` + tests, Active source catalog + render tests |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| (none) | - | No TBD/FIXME/XXX/HACK markers, no stub returns, no `console.log`-only implementations in any phase-5 modified file | - | - |

The `placeholder=` hits in translation.json, Installed.tsx, Profiles.tsx, Conflicts.tsx, FoundryBuildTray.tsx, PortraitBrowse.tsx and MyChanges.tsx are legitimate input placeholder attributes, not stubs.

### Human Verification Required

1. **Global tri-state selector and reset state**
   - **Test:** Open `/locker/global` in the running app with a mix of installed visual and global sound mods; switch between All content, Visuals and Sounds; also test a section that filters to zero rows.
   - **Expected:** Bare `/locker/global` lands on All content; empty categories render no row; a fully-filtered narrower section shows the three-part reset state with a Show all content action; the header count is the same unique-mod count in all three sections; All content shows the membership caveat once above the rail.
   - **Why human:** The pure route/projection logic is unit-tested; the rendered selector, rail highlight, reset state and caveat placement have no render test in this repo.

2. **Randomization scope captions**
   - **Test:** Open the Locker per-hero card shuffle and the Foundry cross-hero pool list.
   - **Expected:** The per-hero control is captioned "This hero", every cross-hero pool list "All forged portraits"; each stays on one line in the longest shipped locale; both still read/write one shared pool identity.
   - **Why human:** Captions are wired at the call sites and the pool-identity diff guard held, but no render test mounts HeroCardPicker or MyChanges.

3. **Locker portrait family four states in-app**
   - **Test:** Exercise loading, failed (with retry), no assets for this hero, and populated states against a real catalog read.
   - **Expected:** Exactly one state at a time; retry re-runs the same load and replaces the failed state on success; "no assets for this hero" keeps its shipped copy.
   - **Why human:** The four-state render test passes, but the in-app retry flow and the visual failed-versus-not-indexed distinction need confirmation.

4. **Unresolved-codename disclosure**
   - **Test:** Open the Foundry portrait catalog with a codename the alias table cannot place, and with a failed catalog read.
   - **Expected:** Raw token keeps its own label with a neutral Unresolved tag (raw name in title), hint once per group; a failed read routes to the failed state, never to the unresolved label.
   - **Why human:** The shared resolver and HeroSelect are unit-tested; PortraitBrowse has no render-level test.

5. **Derived pak descriptions**
   - **Test:** View a Global card for a mod named only after its pak slot (e.g. Pak92).
   - **Expected:** Card leads with a description derived from its own VPK entries, keeps the raw pak name as a secondary line, shows the raw name while the read is in flight, and labels unreadable/empty paks as unknown content.
   - **Why human:** Derivation is unit-tested; the rendered card states have no DOM-level test.

6. **Bulk undo end-to-end**
   - **Test:** Select several mods in Installed, run bulk enable/disable/hero tag/clear tag/global tag, press Undo; run a second batch before undoing; trigger a partial failure if possible.
   - **Expected:** Undo restores data and the same selection in select mode; only the newest batch is undoable; a partial failure is one warning toast with counts and Undo; bulk delete keeps its confirmation and offers no undo.
   - **Why human:** The pure module is unit-tested and all five handlers capture before their loops, but no render test mounts the Installed action bar.

7. **Stated blockers on disabled controls**
   - **Test:** While a Profiles apply/update, Conflicts resolve action, or Foundry forge runs, inspect each disabled control.
   - **Expected:** Every disabled control is described by rendered text naming the reason (never tooltip alone); the forge button names which blocker is in force with the corrective action preferred; exactly one blocker reason renders at a time.
   - **Why human:** aria-describedby wiring and rendered lines are present (grep-verified); visible behavior in the running app needs sign-off.

8. **Conflict recheck retention**
   - **Test:** Re-run the conflict scan after a successful first load, and test the very first load.
   - **Expected:** First load shows the skeleton; a recheck keeps every row on screen with a "results below are from the previous check" line; a failed recheck falls through to the existing error state with its retry.
   - **Why human:** The hasLoaded flag and rescanning line are present in code; the retained-row behavior only exists against real conflict data.

9. **Provenance click-through**
   - **Test:** On a Conflicts card, click Open in Installed for a side that resolved to a mod record.
   - **Expected:** Navigates to `/?focusMod=<id>` and Installed scrolls to and highlights the named mod; a side missing from modsMap renders no affordance.
   - **Why human:** The helper is unit-tested and the focus consumer exists; click-through navigation is in-app behavior.

10. **Alias sweep verdict record**
    - **Test:** Review `docs/portrait-alias-sweep-plan.md` Results against the sweep scratchpad (`C:\Users\wayba\AppData\Local\Temp\gsd-05-05-sweep\`).
    - **Expected:** Per-hero four-way verdicts for all 15 mismatch heroes, Abrams driven end to end on both surfaces, the dual-table lead ruled out on this build, negative result recorded for issue #4.
    - **Why human:** Corroborated by scratchpad JSON/screenshots and the slot-2 log, but only a human can accept that the record reflects a genuinely driven build and the negative-result conclusion.

### Gaps Summary

No failed truths, missing artifacts, broken links, or blocking anti-patterns were found. All 21 phase artifacts exist, are substantive, and are wired; all 18 key links verified; the full suite passes (1929/1941). The phase goal is not fully certifiable by automation because this is a UI-heavy phase: three roadmap truths (SC1 Global tri-state rendering, SC4 driven alias-sweep verdicts and Foundry empty states, SC5 bulk-undo flow and blocker rendering) are present and wired but their runtime behavior is not exercised by tests, so they are reported as PRESENT_BEHAVIOR_UNVERIFIED and routed to in-app human verification. Ten human-verification items are listed above; until they are signed off, the phase is not `passed`.

---

_Verified: 2026-08-09T03:59:35Z_
_Verifier: the agent (gsd-verifier)_
