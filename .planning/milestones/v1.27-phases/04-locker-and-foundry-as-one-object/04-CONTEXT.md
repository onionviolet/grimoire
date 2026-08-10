# Phase 4: Locker And Foundry As One Object - Context

**Gathered:** 2026-08-08
**Status:** Ready for planning after Phase 3 execution

<domain>
## Phase Boundary

Phase 4 closes the quality gap between Locker and Foundry without merging their routes or ownership models. Foundry gains a live preview of staged visual work, Locker gains pre-write consequence disclosure, Foundry can source portrait images without a file drop, and the Foundry hero grid gains favorites and authored-change counts.

Phase 3 execution is a planning and implementation dependency, not a discussion dependency. Research and planning must re-check the post-Phase-3 tree before fixing file-level tasks.

The Locker portrait-family work formerly bundled into parity lane 4 is not in this phase. It belongs to Phase 5 because it lives in `HeroCardPicker.tsx`, `HeroPortraitFamilies.tsx`, and `portraitInventory.ts` and is governed by the open portrait-journey decision.

</domain>

<decisions>
## Implementation Decisions

### Shared frame and model as stage

- **D-01:** Preserve both contested variants through one composable page structure. `HeroDetailFrame` remains the shared outer chrome, but its visual stage is a replaceable slot rather than a fixed backdrop image. This keeps the delivered shared-frame work and allows the 3D model to become the Locker page's stage without rebuilding the rail, navigation, gradients, or fallbacks.
- **D-02:** In Locker, the model is the primary stage when it can load. The existing image chain remains a graceful fallback and a user-selectable low-cost view. In Foundry, the same stage slot hosts a lazy, opt-in preview of the tray because preview builds have real latency and lifecycle cost. This implements both product directions while leaving the user in control.
- **D-03:** Stage controls belong in the frame's top-right slot and use one shared presentation contract. Domain behavior stays outside the frame. The frame must not import Locker or Foundry stores or domain types.

### Foundry tray preview

- **D-04 [informational]:** Already delivered by commit `f614bb7`, verified against the working tree three times. Retained as the standing contract the shipped code must keep honouring, not as work for this phase. Preview the complete reviewed tray result stacked above the hero's currently enabled skins. Do not preview only the most recent edit. The result must answer what the user will see after forging against their current installed state.
- **D-05:** A preview build is temporary in the strong sense: it uses an explicit path-based pose source, never installs, never changes load order, never writes to the addons folder, and is cleaned up when replaced, closed, navigated away from, or when the owning window exits.
- **D-06:** Build only while the preview is open. Debounce tray changes, cancel or supersede stale builds, retain the last valid preview while the replacement is building, and label stale, loading, failed, and current states distinctly. A failed preview does not invalidate the reviewed forge request.

### Locker pre-write disclosure

- **D-07:** Show consequences inline beside the action before writing. Use a modal only when the action has a destructive overwrite that cannot be made unambiguous inline. Routine non-conflicting actions keep their current speed.
- **D-08:** Disclosure names exact normalized VPK paths, current owners, the effective winner, and the proposed result. Unreadable inspection blocks only the ambiguous action and does not mutate installed state.
- **D-09:** Locker stays immediate-apply. This phase makes writes informed; it does not move Locker actions into the Foundry tray.

### Foundry image sourcing

- **D-10 [informational]:** Already delivered by commit `f614bb7`, verified against the working tree three times. Retained as the standing contract the shipped code must keep honouring, not as work for this phase. `PortraitEditor` offers three sources through one intake surface: file drop or picker, images found in the selected mod, and recently used images. The crop frame remains locked to the selected template's native aspect ratio.
- **D-11 [informational]:** Already delivered by commit `f614bb7`, verified against the working tree three times. Retained as the standing contract the shipped code must keep honouring, not as work for this phase. Recent-image entries are references to existing user-selected sources or safe app-owned derivatives, not a new opaque image library. Missing sources remain visible with a clear recovery action instead of silently disappearing.
- **D-12 [informational]:** Already delivered by commit `f614bb7`, verified against the working tree three times. Retained as the standing contract the shipped code must keep honouring, not as work for this phase. Image intake may be shared, but `PortraitEditor` and Locker image components remain separate authoring surfaces. Staging continues through `prepareVisualStagedEdit` unchanged.

### Foundry hero grid state

- **D-13 [informational]:** Already delivered by commit `f614bb7`, verified against the working tree three times. Retained as the standing contract the shipped code must keep honouring, not as work for this phase. Favorites are one shared hero preference across Locker and Foundry. Do not introduce a Foundry-only favorite store.
- **D-14:** The authored-change badge counts the same per-hero entries used by `MyChanges`. The badge opens that hero's workshop and should distinguish zero from unavailable or still-loading data.
- **D-15 [informational]:** Already delivered by commit `f614bb7`, verified against the working tree three times. Retained as the standing contract the shipped code must keep honouring, not as work for this phase. The grid follows the same image fallback behavior as the detail frame and removes hardcoded visible English while this file is already being changed.

### the agent's Discretion

- Exact debounce duration and whether stale preview state uses a badge, overlay, or compact status row.
- Exact visual arrangement of the three image sources, provided all remain reachable without obscuring the crop preview.
- Whether shared stage behavior is expressed as a hook, small controller component, or typed slot contract. Prefer the smallest boundary that prevents page-specific imports in `HeroDetailFrame`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and conflicts

- `.planning/ROADMAP.md` section "Phase 4: Locker And Foundry As One Object" - goal, dependency, success criteria, and the contested target-state record.
- `.planning/REQUIREMENTS.md` sections "Locker and Foundry parity" and "Inventory and journey coherence" - active requirement wording and the Phase 5 boundary.
- `.planning/INGEST-CONFLICTS.md` warning "Competing acceptance variants for the Locker hero page target state" - equal-precedence conflict and replaceable-stage middle path.
- `docs/locker-foundry-parity-plan.md` - sequential lane contract, ownership invariant, preview lifecycle, disclosure, sourcing, and grid-state intent. Its Locker portrait-family portion of lane 4 is superseded by the Phase 4/5 roadmap split.
- `docs/locker-deep-dive.md` - model-as-stage target and interactive model intent.

### Prior work and standing constraints

- `.planning/phases/03-foundry-completes-its-build-contract/03-CONTEXT.md` - staged edit and forge decisions that Phase 4 must consume after Phase 3 executes.
- `docs/ui-conventions.md` - shared UI, token, focus, and i18n rules.
- `docs/upstream-boundary-map.md` - change-cost guidance for shared and fork-only files.
- `docs/fork-divergence-policy.md` - additive, fork-selective implementation policy.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `src/components/common/HeroDetailFrame.tsx`: delivered shared chrome and the stable outer boundary for a replaceable stage.
- `src/components/locker/HeroPoseViewer.tsx` and the existing floating model panel: current 3D rendering, loading, and lazy-mount patterns.
- `electron/main/services/foundryForge.ts`: temporary VPK build primitive returning a path and cleanup callback.
- `src/components/foundry/buildTray.ts`: reviewed exact write set and collision analysis.
- `src/components/foundry/AssetSourcesPanel.tsx`: exact-path ownership disclosure.
- `src/components/locker/LockerModImagePicker.tsx` and `LockerImageCropper`: in-app image sourcing and cropping patterns.
- `src/components/foundry/MyChanges.tsx`: existing hero-scoped authored-change data.

### Established Patterns

- Exact normalized VPK entry paths are the ownership key. Installed and Locker remain the only enabled-state authority.
- Renderer components request file and VPK work through the preload boundary; main owns temporary files and cleanup.
- Three.js stays lazy so users who never open a preview do not pay its bundle cost.
- Shared presentation components remain domain-ignorant and accept slots or data props.

### Integration Points

- `src/components/foundry/HeroWorkshop.tsx` owns both the stage mount and Foundry image-sourcing lane, so those changes stay together in Phase 4.
- Pose source types and main-side resolution need an additive explicit-path variant for temporary preview VPKs.
- Locker sound and effects apply controls need pure pre-write analysis without changing their write mechanism.
- `src/components/foundry/FoundryHeroGrid.tsx` consumes shared favorites and hero-scoped change counts.

</code_context>

<specifics>
## Specific Ideas

- The shared frame and model-as-stage variants should not be treated as mutually destructive. A replaceable stage makes the model the page while preserving shared chrome and an image fallback.
- Prefer implementing compatible, reversible options when doing so does not duplicate ownership or create two sources of truth. User-facing presentation choices are acceptable; duplicated inventory or state mechanisms are not.

</specifics>

<deferred>
## Deferred Ideas

- Locker portrait-family awareness is explicitly moved to Phase 5 and must not be pulled back into Phase 4 even though the older parity plan groups it with Foundry image sourcing.
- Ability playback, particle playback, and sound audition directly on the 3D model are part of the broader model-as-stage vision but are not required by Phase 4's success criteria. Keep extension points compatible; do not add those capabilities here.

</deferred>

---

*Phase: 4-Locker And Foundry As One Object*
*Context gathered: 2026-08-08*
