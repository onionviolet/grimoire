# Synthesis

Entry point for downstream consumers (`gsd-roadmapper`). Mode: `new`.
Produced from `.planning/intel/classifications/` (50 per-doc JSON files) plus the
source documents themselves.

**STATUS: BLOCKED.** 3 cross-reference cycles hold 9 docs out of synthesis, and 3
competing-variant warnings need user resolution before routing. See
`.planning/INGEST-CONFLICTS.md`.

---

## Doc counts

| Type | Classified | Synthesized | Held out (cycle) |
| --- | ---: | ---: | ---: |
| ADR | 10 | 10 | 0 |
| SPEC | 14 | 14 | 0 |
| PRD | 20 | 13 | 7 |
| DOC | 6 | 4 | 2 |
| **Total** | **50** | **41** | **9** |

All 50 classifications carry an explicit manifest type (`manifest_override: true`).
48 are high confidence, 2 medium (`docs/third-party-notices.md`,
`docs/work-order.md`). No UNKNOWN, no low confidence.

Precedence integers were manifest-supplied and honored over tier defaults,
including the two deliberate bumps (`docs/feature-status.md` PRD at 1,
`docs/audit-2026-07-28-verdicts.md` DOC at 2). Both bumped docs fall inside
cycles and are held out.

## Held out of synthesis (9 docs, cycle-blocked)

- `docs/feature-status.md`, `docs/rigged-preview-spike.md`, `docs/remaining-work-phases.md`, `docs/foundry-handoff.md`, `docs/foundry-tab-design.md` (one 5-node SCC)
- `docs/work-order.md`, `docs/audit-2026-07-28-verdicts.md` (2-node cycle)
- `docs/locker-consistency-pass.md`, `docs/ui-thoughtfulness-and-adjustability-plan.md` (2-node cycle)

Nothing from these docs was extracted. Each cycle has a suggested single-edge cut
in the conflicts report.

## Decisions locked (2 sources, 18 decision entries)

- `docs/social-architecture-decisions.md` — 17 Accepted ADRs (ADR-001 through ADR-017), preserved individually
- `docs/locker-global-mods.md` — the `citadel/grimoire` priority root, its naming split, reserved-slot model, and invariants

The other 8 ADRs carry `status: proposed` because no source declares a literal
`Accepted` status, even where the source's own status line reads "shipped":
`fork-divergence-policy`, `fork-maintenance`, `performance-config-integration`,
`ability-vfx-recolor`, `ui-conventions`, `upstream-boundary-map`,
`release-maintenance`, `third-party-notices`. Each entry preserves the source's
own status wording inside the decision text.

File: `.planning/intel/decisions.md`

## Requirements extracted (28, from 13 PRDs)

REQ-3d-preview-shared-spine, REQ-3d-preview-material-parity,
REQ-3d-preview-npr-and-cloth, REQ-3d-preview-retarget-and-effects,
REQ-agent-ui-lab, REQ-chat-wheel-base-command-catalog,
REQ-foundry-vpk-identity-gate, REQ-foundry-scoped-source-blocking,
REQ-foundry-grouped-pool-view, REQ-foundry-portrait-editor-and-sound-surfacing,
REQ-global-inventory-coherence, REQ-global-sound-taxonomy,
REQ-portrait-journey-consolidation-gated, REQ-locker-model-as-stage,
REQ-locker-honest-failure-states, REQ-locker-foundry-shared-hero-frame,
REQ-locker-foundry-parity-lanes, REQ-upstream-merge-aug-2026,
REQ-performance-convar-safer-experimentation,
REQ-performance-convar-profiles-and-recovery, REQ-portrait-alias-sweep,
REQ-portrait-inventory-model, REQ-portrait-shelf-cards-ownership,
REQ-portrait-randomization-home, REQ-sound-inventory-model,
REQ-sound-locker-surface, REQ-vpk-composition-analysis,
REQ-vpk-composition-review-and-recipes

Five of these are competing variants across three contested scopes and are
preserved separately, never merged. They are cross-noted in the file.

File: `.planning/intel/requirements.md`

## Constraints (24, from 14 SPECs)

Type breakdown: 6 schema, 11 protocol, 2 api-contract, 5 nfr.

Highest-leverage constraints downstream planning must not violate:
- the vpk-modinfo canonical identity model (original pre-first-imprint sha256, never recomputed)
- Grimoire owns and rewrites the entire `gameinfo.gi` SearchPaths block, so any mount point must be a conditional line inside the canonical block
- multi-folder overflow keying is asymmetric (bare filename for base + `.disabled`, `addons{N}/<file>` for overflow) specifically to avoid a migration
- Grimoire Social `/v1/` is frozen and additive-only
- the portable profile format is references-only and foreign profiles are untrusted input

File: `.planning/intel/constraints.md`

## Context topics (4, from 4 DOCs)

GameBanana API surface for Deadlock; GameBanana category taxonomy;
deadlock-api.com stats reference; particle FX feasibility for the Locker 3D
preview.

File: `.planning/intel/context.md`

## Conflicts

- 3 blockers (all cross-reference cycles)
- 3 competing variants (global sound inventory home; portrait/Cards UX journey; Locker hero page target state)
- 7 auto-resolved / informational

Full detail: `.planning/INGEST-CONFLICTS.md`

## Per-type intel files

- `.planning/intel/decisions.md`
- `.planning/intel/requirements.md`
- `.planning/intel/constraints.md`
- `.planning/intel/context.md`
