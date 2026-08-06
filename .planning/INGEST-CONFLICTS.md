# Doc Ingest Conflicts

Mode: new. Sources: 50 classified docs (10 ADR, 14 SPEC, 20 PRD, 6 DOC).
Precedence: manifest-supplied integers, honored over tier defaults where they
disagree (`docs/feature-status.md` PRD at 1, `docs/audit-2026-07-28-verdicts.md`
DOC at 2).

## Conflict Detection Report

### BLOCKERS (3)

[BLOCKER] Cross-reference cycle: feature-status / rigged-preview-spike / remaining-work-phases / foundry-handoff / foundry-tab-design
  Found: docs/feature-status.md references ./rigged-preview-spike.md; docs/rigged-preview-spike.md references docs/remaining-work-phases.md; docs/remaining-work-phases.md references ./feature-status.md, closing a 3-node cycle
  Found: docs/remaining-work-phases.md references ./foundry-handoff.md; docs/foundry-handoff.md references ./foundry-tab-design.md; docs/foundry-tab-design.md references ./feature-status.md, closing a 5-node strongly connected component with the above
  Expected: an acyclic cross-reference graph, so synthesis can resolve "read first" chains in one direction
  Impact: all 5 docs were held out of `.planning/intel/`. This is the heaviest cost of the three cycles: it removes `docs/feature-status.md` (manifest precedence 1, the delivery contract that foundry-changes-parallel-plan, foundry-tab-design, locker-foundry-parity-plan, global-locker-foundry-ux-plan, and remaining-work-phases all instruct the reader to consult first) and the entire Foundry roadmap chain
  → Break one edge per loop, then re-run ingest. The cheapest cuts: drop the `./feature-status.md` back-reference from docs/remaining-work-phases.md (it is the doc that closes both loops), and drop `./feature-status.md` from docs/foundry-tab-design.md. Alternatively pass `--manifest` with these 5 docs pinned to an explicit precedence order to declare the intended read direction.

[BLOCKER] Cross-reference cycle: work-order / audit-2026-07-28-verdicts
  Found: docs/work-order.md references ./audit-2026-07-28-verdicts.md
  Found: docs/audit-2026-07-28-verdicts.md references ./work-order.md
  Expected: an acyclic cross-reference graph
  Impact: both docs were held out of `.planning/intel/`. This removes `docs/audit-2026-07-28-verdicts.md`, which the manifest bumped to precedence 2 specifically because it is verified ground truth on what is actually implemented (SHIPPED / PARTIAL / MISSING / PREMISE FALSE per wave item at v1.25.171), and `docs/work-order.md`, the ordered execution plan (serial steps 0-5, three waves, gates)
  → Break the loop by removing the `./work-order.md` reference from docs/audit-2026-07-28-verdicts.md; the audit is the measurement and the work order is the plan that consumes it, so the audit should not point back. Then re-run ingest.

[BLOCKER] Cross-reference cycle: locker-consistency-pass / ui-thoughtfulness-and-adjustability-plan
  Found: docs/locker-consistency-pass.md references ui-thoughtfulness-and-adjustability-plan.md
  Found: docs/ui-thoughtfulness-and-adjustability-plan.md references docs/locker-consistency-pass.md
  Expected: an acyclic cross-reference graph
  Impact: both docs were held out of `.planning/intel/`. Three higher-precedence sources point into this pair and now reference material that is absent from the synthesized intel: docs/fork-divergence-policy.md (ADR, precedence 0) names `docs/locker-consistency-pass.md` as the fork-owned consistency floor in Rule 3 and again in Rule 6; docs/design-overhaul-brief.md (SPEC, precedence 1) cites it for the tablist diagnosis; docs/global-locker-foundry-ux-plan.md (PRD) references both
  → Break the loop by removing the `ui-thoughtfulness-and-adjustability-plan.md` reference from docs/locker-consistency-pass.md (the consistency pass is the narrower, later document). Then re-run ingest.

### WARNINGS (3)

[WARNING] Competing acceptance variants for where installed global sound inventory lives
  Found: docs/sound-locker-plan.md (PRD, precedence 2) requires a new dedicated surface: "`src/pages/SoundLocker.tsx`, routed at `/locker/sounds` with `/locker/sounds/hero/:hero` and `/locker/sounds/global` drill-ins", with a hero grid plus a Global shelf, on the reasoning that global sound content (announcer packs, killstreak music, UI packs) "have no home at all"
  Found: docs/global-locker-foundry-ux-plan.md (PRD, precedence 2) requires the opposite direction for the same content: "Global should feel like one inventory. It may use an `All content | Visuals | Sounds` filter", inside the existing Global drill-in, and opens with "Status: do not merge the surfaces yet ... this document is therefore decision-gated: first compare the existing flows, then prototype one shared shell before moving data or deleting a route"
  Impact: one plan adds a route for global sound inventory while the other gates any surface change behind a comparison and a shared-shell prototype. Synthesis cannot pick without losing intent, and building both produces two homes for the same inventory
  → Choose one variant, or split into two requirements with an explicit sequencing decision (run the global-locker-foundry-ux comparison gate first, then decide whether the Sound Locker route survives it). Both variants are preserved in `.planning/intel/requirements.md` as REQ-sound-locker-surface and REQ-global-inventory-coherence.

[WARNING] Competing acceptance variants for the portrait / Cards UX journey
  Found: docs/portrait-shelf-plan.md (PRD, precedence 2) requires building into `HeroCardPicker` now, with an explicit rejection of a separate route ("Why no `/locker/portraits` route"), and in Lane 3 requires surfacing the forged-portrait pools in the Cards section while explicitly keeping the Foundry My changes pool view: "Leave the My changes pool view in place ... this lane adds the per-hero window, it does not move the feature"
  Found: docs/global-locker-foundry-ux-plan.md (PRD, precedence 2) requires the opposite ordering for the same scope: "Portraits need a single understandable journey before their code is consolidated ... A full merge is an option to evaluate, not an assumption", and gates the work behind comparing flows and prototyping one shared shell
  Impact: portrait-shelf-plan deliberately leaves two randomization controls in two surfaces (`cardShuffleIncluded` in Locker Cards, `foundryShuffleIncluded` in Foundry My changes) after acknowledging that split is "a real misplacement", while global-locker-foundry-ux-plan requires a single journey be defined first. Synthesis cannot pick without losing intent
  → Choose one variant, or sequence them explicitly. Preserved in `.planning/intel/requirements.md` as REQ-portrait-shelf-cards-ownership, REQ-portrait-randomization-home, and REQ-portrait-journey-consolidation-gated.

[WARNING] Competing acceptance variants for the Locker hero page target state
  Found: docs/locker-foundry-parity-plan.md (PRD, precedence 2) Lane 1 requires extracting the current chrome as-is into a shared component: "Extract `src/components/common/HeroDetailFrame.tsx` owning exactly the shared chrome ... Take Locker's three-blur version verbatim", with the backdrop image as the frame's identity layer, and marks it a prerequisite: "Lane 1 is a prerequisite for the rest, and lanes 2 through 5 each assume the shell it extracts"
  Found: docs/locker-deep-dive.md (PRD, precedence 2) requires a different end state for the same surface: "The target: open a hero and the model is the page rather than a widget in the corner", i.e. the 3D model panel replaces the backdrop-plus-rail composition the parity plan is about to freeze into a shared component
  Impact: extracting the current backdrop/glass/rail frame into a shared `HeroDetailFrame` and then making the 3D model the page means the extracted frame is rebuilt, and Foundry inherits chrome that Locker is moving away from. Both are precedence 2, so precedence rules cannot resolve it
  → Decide the Locker hero page target state before Lane 1 lands, or scope `HeroDetailFrame` so the backdrop layer is a replaceable slot rather than a fixed image. Preserved in `.planning/intel/requirements.md` as REQ-locker-foundry-shared-hero-frame and REQ-locker-model-as-stage.

### INFO (7)

[INFO] Auto-resolved: LOCKED ADR beats SPEC on the Locker cosmetics VPK slot model
  Note: docs/locker-global-mods.md (ADR, precedence 0, LOCKED) declares the managed Locker VPKs live in `citadel/grimoire` at reserved pak01-pak04, win by SearchPaths precedence, and that "Reorder skips priority-root mods" because "they win by search-path position, not slot number". docs/locker-hero-card-apply.md (SPEC, precedence 1) section 6 and "Lifecycle guarantees" describe the superseded model: "keep the cosmetics VPK pinned to the FRONT of the enabled load order via `pinLockerVpksToFront`" at a low pakNN in `addons/`. LOCKED ADR wins; only the ADR's model is carried into `.planning/intel/constraints.md`. The SPEC itself already records the resolution in its "As built: deviations" section (deviation 1), so this is a documentation lag, not a live disagreement.

[INFO] Auto-resolved: ADR beats SPEC on the shipped vpkmerge pin
  Note: docs/ability-vfx-recolor.md (ADR, precedence 0) states "The bundled engine is the tagged, pinned `vpkmerge v0.19.0` release (`scripts/fetch-vpkmerge.mjs`), not a local dev build", and docs/release-maintenance.md (ADR, precedence 0) records "the pinned fork build currently reports `vpkmerge 0.19.0 (798f3a7)`". docs/hero-pose-locker.md (SPEC, precedence 1) still instructs "Bump `VPKMERGE_VERSION` + the three sha256s to the v0.6.1 release to ship them", and docs/vpk-metadata-embed-integration.md (SPEC, precedence 1) records "Phase 4 (ship): deferred ... Dev uses the sibling `../vpkmerge/target` build". ADR wins: v0.19.0 is the shipped pin, and the SPEC bump instructions are historical. Note that docs/fork-maintenance.md (ADR, precedence 0) qualifies this: "The stock `v0.19.0` download remains a fallback only until the fork publishes a versioned, checksum-pinned release."

[INFO] Auto-resolved: ADR beats PRD on where the Agent UI Lab toggle lands
  Note: docs/agent-ui-lab-plan.md (PRD, precedence 2) specifies "Add **Allow local agent UI inspection** under Developer Mode / Experimental Features in Settings (`src/pages/Settings.tsx`)". docs/fork-divergence-policy.md (ADR, precedence 0) Rule 3 names `src/pages/Settings.tsx` and `src/components/settings/**` as an area "upstream owns, and we should stop editing except through new modules ... Upstream just restructured this whole tree; fighting it is pure cost", and Rule 2 states "a new file is cheap to carry, an edit to a shared file is not". docs/upstream-boundary-map.md (ADR, precedence 0) corroborates with `src/pages/Settings.tsx` at +106 / -1840 and "Absorbing it will be a project of its own, not a merge". ADR wins: the toggle should be implemented as a fork-only module that the Settings tree calls, not as an edit to `Settings.tsx`. The requirement itself is unchanged and is carried in `.planning/intel/requirements.md` as REQ-agent-ui-lab.

[INFO] Auto-resolved: ADR beats SPEC on accent color and Settings grouping
  Note: docs/design-overhaul-brief.md (SPEC, precedence 1) pins `accent` to the literal `#f97316` in its theme token table and recommends grouping Settings into "Game Path | Preferences | Maintenance | Cache". docs/ui-conventions.md (ADR, precedence 0) states "The accent foreground flips by luminance at runtime; literal whites can't" and "**No raw hex** in `className`/`style`. Use a token utility", and docs/upstream-boundary-map.md (ADR, precedence 0) lists `src/components/settings/AccentColorPicker.tsx` and eight `src/components/settings/sections/*` files as already-existing fork-only surfaces. ADR wins: the accent is a runtime-variable token, not a fixed hex, and the Settings section structure already exists upstream-restructured. The brief's shell rule (top-level route / drill-in / section body, and the `role="tab"` contract) does not conflict with anything and is carried in full into `.planning/intel/constraints.md`.

[INFO] LOCKED-vs-LOCKED check passed
  Note: two ADRs carry `locked: true` in this ingest set: docs/locker-global-mods.md (scope: `citadel/grimoire` priority root, `priorityMod`/`globalType`, `modLoadOrder`, shuffle planner, reserved Locker VPKs) and docs/social-architecture-decisions.md (scope: Grimoire Social identity, voting, Cloudflare backend, API versioning, storage, moderation, deletion). Their scopes are disjoint and no decision statement contradicts another. No LOCKED-vs-LOCKED blocker.

[INFO] Manifest precedence bumps honored, but both bumped docs fall inside cycles
  Note: the manifest bumped `docs/feature-status.md` to precedence 1 (PRD acting as the delivery contract) and `docs/audit-2026-07-28-verdicts.md` to precedence 2 (DOC acting as verified ground truth). Both integers were honored over their tier defaults during precedence evaluation, but both docs sit inside detected cycles and were therefore held out of `.planning/intel/`. The downstream effect is that the synthesized intel has no delivery contract and no implementation ground truth until the cycle blockers are resolved and ingest is re-run.

[INFO] No UNKNOWN or low-confidence classifications
  Note: all 50 classifications carry an explicit type with `manifest_override: true`. 48 are `confidence: high`; 2 are `confidence: medium` (docs/third-party-notices.md as ADR, docs/work-order.md as PRD). No doc was classified UNKNOWN and none carries `confidence: low`, so no re-tagging blocker applies. Several classifier notes record that heuristics alone would have read a doc differently (e.g. docs/feature-status.md and docs/merge-plan-upstream-2026-08.md read as DOC-shaped, docs/DEADLOCK_STATS_API.md reads as SPEC-shaped); in every case the manifest type was treated as authoritative, as instructed.
