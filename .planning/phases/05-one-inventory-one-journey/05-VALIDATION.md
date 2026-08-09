---
phase: 5
slug: one-inventory-one-journey
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-08
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `05-RESEARCH.md` section "Validation Architecture". The planner fills the
> per-task rows.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (`vitest.config.ts`: `environment: 'node'`, includes `src/**/*.test.ts(x)`, `electron/**/*.test.ts`, `scripts/**/*.test.ts`) |
| **Config file** | `vitest.config.ts` (repo root) |
| **Quick run command** | `pnpm exec vitest run src/lib/lockerMode.test.ts src/lib/globalInventory.test.ts src/lib/heroPortraitIdentity.test.ts` |
| **Full suite command** | `pnpm exec vitest run` |
| **Estimated runtime** | Not measured this session. Driver: 163 `*.test.ts(x)` files. Use the scoped command for per-task feedback |

Two repo gates run outside Vitest and are part of this phase's definition of green,
because the phase changes catalog strings: `pnpm i18n:check` and `pnpm encoding:check`,
both of which run in CI and on pre-push. `pnpm i18n:manifest` regenerates the committed
manifest after any catalog change and `gen-locale-manifest.mjs --check` fails if it is stale.

---

## Sampling Rate

- **After every task commit:** the relevant unit test files, plus `pnpm typecheck` and
  `pnpm lint`, which `docs/ui-conventions.md` requires after any UI change
- **After every plan wave:** `pnpm exec vitest run`, `pnpm i18n:check`, `pnpm encoding:check`
- **Before `/gsd-verify-work`:** full suite green, typecheck green, lint green, and Legs B
  and C of the alias sweep recorded with a per-hero verdict from the requirement's own
  four-way verdict table, even if the underlying defect does not reproduce
- **Max feedback latency:** bounded by the scoped command, not the full suite

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01 T1 | 05-01 | 1 | REQ-global-inventory-coherence, REQ-sound-locker-surface | T-05-01, T-05-02 | Section allow-list rejects an arbitrary `?mode=`; new copy interpolates through escaped JSX children | unit | `pnpm exec vitest run src/lib/lockerMode.test.ts src/lib/globalInventory.test.ts` | Exists, extend both | ⬜ pending |
| 05-01 T2 | 05-01 | 1 | REQ-ui-consequence-and-vocabulary | T-05-04 | Value-only catalog edits defeat no gate; staleness stated, not hidden | repo gate | `pnpm i18n:check && node scripts/gen-locale-manifest.mjs --check` | Existing gate scripts | ⬜ pending |
| 05-02 T1 | 05-02 | 2 | REQ-portrait-journey-consolidation-gated | none | N/A, label-only change | unit | `pnpm exec vitest run src/lib/foundryChanges.test.ts src/components/foundry/poolView.test.ts src/components/foundry/ChangePools.test.tsx` | Exists, regression guard | ⬜ pending |
| 05-02 T2 | 05-02 | 2 | REQ-ui-consequence-and-vocabulary | T-05-05, T-05-07 | An unplaceable codename is never given a hero name it does not have | render (jsdom) | `pnpm exec vitest run src/components/locker/HeroPortraitFamilies.test.tsx src/components/foundry/heroFilterOptions.test.ts` | New file, plus existing | ⬜ pending |
| 05-02 T3 | 05-02 | 2 | REQ-portrait-alias-sweep | T-05-08 | Whole-roster collision check is derived, so a later hero cannot escape the fixture | unit | `pnpm exec vitest run src/lib/heroPortraitIdentity.test.ts` | Exists, extend it | ⬜ pending |
| 05-03 T1 | 05-03 | 2 | REQ-ui-consequence-and-vocabulary | T-05-09, T-05-10 | Restore is a live diff, and a missing mod is skipped rather than thrown on | unit | `pnpm exec vitest run src/lib/bulkUndo.test.ts` | New file | ⬜ pending |
| 05-03 T2 | 05-03 | 2 | REQ-ui-consequence-and-vocabulary | T-05-12, T-05-13 | Undo reaches only the three mutators the batch used; delete gains no undo | unit + gates | `pnpm exec vitest run src/lib/bulkUndo.test.ts && pnpm typecheck && pnpm lint` | New file | ⬜ pending |
| 05-03 T3 | 05-03 | 2 | REQ-ui-consequence-and-vocabulary | T-05-11 | A failed restore re-enables its controls instead of stranding the page | full suite + gates | `pnpm exec vitest run && pnpm typecheck && pnpm lint && pnpm i18n:check` | Existing | ⬜ pending |
| 05-04 T1 | 05-04 | 2 | REQ-global-inventory-coherence | T-05-14 | Only a path's leaf name can reach the render | unit | `pnpm exec vitest run src/lib/derivedPakName.test.ts` | New file | ⬜ pending |
| 05-04 T2 | 05-04 | 2 | REQ-global-inventory-coherence | T-05-15, T-05-16 | No new IPC surface; one entry read per mod id, never retried | unit + gates | `pnpm exec vitest run && pnpm typecheck && pnpm lint && pnpm i18n:check` | Existing plus new | ⬜ pending |
| 05-04 T3 | 05-04 | 2 | REQ-sound-locker-surface | T-05-17 | The legacy-URL claim is backed by a passing test at the moment it is written | unit + gate | `pnpm exec vitest run src/lib/lockerMode.test.ts && pnpm encoding:check` | Exists | ⬜ pending |
| 05-05 T1 | 05-05 | 3 | REQ-portrait-alias-sweep | T-05-18, T-05-19, T-05-20 | Never slot 0, never unslotted, never a dirty tree; the live slot is confirmed before any reading is trusted | manual, CDP-driven | `node scripts/dev-driver.mjs eval "window.__GRIMOIRE_DEV_SLOT"` | Not a Vitest-shaped check | ⬜ pending |
| 05-05 T2 | 05-05 | 3 | REQ-portrait-alias-sweep | T-05-21 | Every verdict cell holds a four-way value or the literal blocked with a reason | doc assertion + unit | `node -e "<verdict-row assertion>" && pnpm encoding:check && pnpm exec vitest run src/lib/heroPortraitIdentity.test.ts` | Doc plus existing test | ⬜ pending |

*Filled by the planner from PLAN.md task IDs. Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Requirement to Test Map (from research)

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| REQ-global-inventory-coherence | `LockerMode` widened to include the third state, `resolveLockerRoute` and `lockerModeFromSearch` handle it, legacy URLs still resolve | unit | `pnpm exec vitest run src/lib/lockerMode.test.ts` | Exists, extend it |
| REQ-global-inventory-coherence | Hide-empty rail projection: merged `All content` row list, count greater than zero filter | unit | `pnpm exec vitest run src/lib/globalInventory.test.ts` | Exists, extend it |
| REQ-portrait-alias-sweep | Leg A: cross-check the `heroIdentity.ts` alias table against `lockerUtils.ts`'s `HERO_DISPLAY_ALIASES` for every hero | unit | `pnpm exec vitest run src/lib/heroPortraitIdentity.test.ts` | Exists, extend it with a new fixture |
| REQ-portrait-journey-consolidation-gated | `foundryShuffleIncluded` and `cardShuffleIncluded` remain one shared pool identity after the caption changes. Regression guard, no behavior change expected | unit | `pnpm exec vitest run src/lib/foundryChanges.test.ts src/components/foundry/poolView.test.ts` | Exists. Research flagged this as a Wave 0 unknown; resolved 2026-08-08, `src/lib/foundryChanges.test.ts`, `src/components/foundry/poolView.test.ts` and `src/components/foundry/ChangePools.test.tsx` all reference `groupFoundryShufflePools` or `foundryShuffleKey` |
| REQ-ui-consequence-and-vocabulary | Catalog completeness after the vocabulary value changes and the new keys | repo gate, not Vitest | `pnpm i18n:check && pnpm i18n:manifest` | Existing gate script |
| REQ-ui-consequence-and-vocabulary | Bulk-undo snapshot capture and restore, pure logic | unit | New test file, named by the planner once the bulk-mutation scope is decided | Wave 0 gap |
| REQ-portrait-alias-sweep | Legs B and C, live catalog cross-check | manual, CDP-driven | `node scripts/dev-driver.mjs` per CLAUDE.md's "Driving a Running Dev Build" | Not a Vitest-shaped check |

---

## Wave 0 Requirements

- [x] A new test file for bulk-undo snapshot capture and restore, once the plan decides which
      mutations D-14 and D-15 apply to. Research found **no bulk-mutation UI in `Locker.tsx`
      at all** (zero `bulk` or `selectedIds` matches), so this is not a retrofit onto an
      existing surface. `Installed.tsx`'s `handleBulkEnable` and `handleBulkDisable` are the
      only mature bulk pattern in the app, and they have no undo either.
      **Resolved 2026-08-08 by plan 05-03:** the scope is the five reversible bulk handlers
      already in `src/pages/Installed.tsx` (enable, disable, hero tag, clear tag, global tag);
      bulk delete is excluded as destructive. The file is `src/lib/bulkUndo.test.ts`, covering
      `captureBulkSnapshot`, `bulkUndoPlan` and `bulkChangedCount` as pure logic. Building
      multi-select into the Global shell first was the rejected alternative: it would invent a
      bulk surface purely to have something to undo, and would put a second multi-select
      implementation in the tree
- [x] A render test for the Locker's portrait empty states, added by plan 05-02 as
      `src/components/locker/HeroPortraitFamilies.test.tsx`, following the jsdom docblock
      convention `src/components/foundry/ChangePools.test.tsx` already established
- [x] A unit test for the merged and hide-empty rail projection, added by plan 05-01 as new
      cases in the existing `src/lib/globalInventory.test.ts`
- [x] Confirm the test file covering `groupFoundryShufflePools` and `foundryShuffleKey`.
      Resolved: `src/lib/foundryChanges.test.ts` plus `src/components/foundry/poolView.test.ts`
      and `src/components/foundry/ChangePools.test.tsx`
- [x] No framework install needed. Vitest is configured and the suite is green

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Legs B and C of the alias sweep: whether the centralized resolution is actually consulted at every call site, against the live loaded catalog | REQ-portrait-alias-sweep | A static read cannot see which codenames the loaded catalog actually contains. The requirement's four-way verdict needs both facts side by side per hero | Drive the working tree over CDP per CLAUDE.md. Needs a committed or stashed tree and a dev slot nobody else is attached to, because the driver drives the working tree. Never slot 0 |
| Whether the Abrams defect is reachable through the dual alias-table structure | REQ-portrait-alias-sweep | The defect is not currently reproducing, so this is a hunt for a root cause rather than a repro | Research's most concrete lead: Foundry's `?hero=` route matching at `Foundry.tsx:161-162` uses `HERO_DISPLAY_ALIASES` from `lockerUtils.ts`, a different table from the `heroIdentity.ts` one the other three D-11 call sites consult. Prove or eliminate that path first |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency acceptable on the scoped command
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planner, 2026-08-08. Thirteen tasks across five plans, every one carrying an
`<automated>` verify. The one non-Vitest-shaped pair is plan 05-05's driven legs, which are
CDP-driven by nature and whose automated gate is the slot confirmation plus a doc assertion
that every hero holds a verdict; a run that cannot obtain a slot records blocked rather than
passing, so the gate cannot be satisfied by silence.
