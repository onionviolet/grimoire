---
phase: 4
slug: locker-and-foundry-as-one-object
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-08
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `04-RESEARCH.md` section "Validation Architecture". The planner fills the
> per-task rows; the Wave 0 list below is the researcher's verified gap set.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (`package.json` script `test` = `vitest run`) |
| **Config file** | `vitest.config.ts`, node environment by default. A per-file `// @vitest-environment jsdom` pragma opts a single test into DOM rendering |
| **Quick run command** | `pnpm exec vitest run <path-to-test-file>` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | Not measured this session. Driver: 163 `*.test.ts(x)` files in the tree, so the full suite is not a sub-second run. Use the scoped command for per-task feedback |

Render-capable precedent already exists for structurally identical components:
`src/components/foundry/AssetSourcesPanel.test.tsx` and
`src/components/foundry/PortraitEditor.test.tsx` both use the per-file jsdom pragma
established by Phase 1's `REQ-renderer-test-harness`. New render tests follow that
pattern rather than introducing a second harness.

---

## Sampling Rate

- **After every task commit:** `pnpm exec vitest run <changed-test-files>`
- **After every plan wave:** `pnpm test`, plus `pnpm typecheck` and `pnpm lint`, which
  `docs/ui-conventions.md` requires after any UI change
- **Before `/gsd-verify-work`:** full suite green, typecheck green, lint green
- **Max feedback latency:** bounded by the scoped run, not the full suite

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | TBD | — | N/A | TBD | TBD | TBD | ⬜ pending |

*Filled by the planner from PLAN.md task IDs. Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Requirement to Test Map (from research)

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| REQ-locker-model-as-stage | `resolveHeroPlate` / `heroPlateComposition` produce the `'model'` branch when the caller requests it | unit | `pnpm exec vitest run src/lib/heroStage.test.ts` | Exists, extend it |
| REQ-locker-model-as-stage | `HeroDetailFrame` renders the caller-supplied plate override and stays free of Locker and Foundry imports | render (jsdom) | `pnpm exec vitest run src/components/common/HeroDetailFrame.test.tsx` | Wave 0 gap |
| REQ-locker-foundry-parity-lanes | `useTrayPreview` exposes the stale window, `building` true while `previewId` is not null | unit | `pnpm exec vitest run src/components/foundry/useTrayPreview.test.ts` | Wave 0 gap |
| REQ-locker-foundry-parity-lanes | `FoundryHeroGrid` renders the loading dot when `!modsLoaded` and the numeral when `changeCount > 0`, never both | render (jsdom) | `pnpm exec vitest run src/components/foundry/FoundryHeroGrid.test.tsx` | Wave 0 gap |
| REQ-locker-foundry-parity-lanes | The chosen Effects dry-run option produces the correct write set for a known hero and parameter combination | unit (node env, main process) | `pnpm exec vitest run electron/main/services/heroColors.test.ts` | Wave 0 gap |

---

## Wave 0 Requirements

- [ ] `src/components/common/HeroDetailFrame.test.tsx` — new. Covers plate-slot override rendering and the frame's continued domain ignorance (no Locker or Foundry imports)
- [ ] `src/components/foundry/useTrayPreview.test.ts` — new. Covers the stale-window derivation
- [ ] `src/components/foundry/FoundryHeroGrid.test.tsx` — new. Covers loading versus zero versus numeral badge states
- [ ] `electron/main/services/heroColors.test.ts` — new. Covers the chosen dry-run write-set function
- [ ] `src/lib/heroStage.test.ts` — existing. Extend for the `'model'` branch. Verify current coverage before assuming a gap

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The model actually renders as the stage backdrop at an acceptable frame rate on the target machine | REQ-locker-model-as-stage | A jsdom render test proves the plate branch is selected, not that Three.js draws it. Frame timing needs a real renderer | Drive the working tree over CDP per CLAUDE.md's "Driving a Running Dev Build". Requires `GRIMOIRE_DEV_NO_BACKGROUNDING=1`, because a covered window produces zero frames while `shot` still returns a correct-looking screenshot |
| The veil blur over a live canvas is acceptable on a low-end GPU | REQ-locker-model-as-stage | Human measurement on hardware this session does not have. `docs/locker-deep-dive.md` records the reading as inconclusive on capable hardware | Run `tools/veil-blur-bench.js` on the low-end target and compare against the fallback ladder that doc already defines |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency acceptable on the scoped command
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
