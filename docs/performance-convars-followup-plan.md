# Performance ConVar follow-up plan

Status: proposed — review and prioritize before implementation.

This records possible follow-up work for the bounded HUD/minimap ConVar
controls in the Performance settings card. It is deliberately a product and
safety plan, not a commitment to expose every Source 2 console variable.

## Goals

- Make safe client-side presentation and readability tuning easier to discover.
- Make each change understandable, reversible, and resilient to game updates.
- Preserve hand-edited `gameinfo.gi` values and never take ownership of
  unrelated user configuration.

## Guardrails

- Expose only confirmed client-side, non-cheat, non-dev-only settings.
- Exclude server, gameplay, networking, debugging, and competitive-integrity
  controls unless their safety and normal-player usefulness are independently
  confirmed.
- Keep all numeric inputs bounded and show the game default when no app override
  exists.
- Patch only the managed ConVars block; retain user entries and surface a diff
  before broad changes.
- Re-validate supported keys against a current Deadlock build after major game
  updates, and disable obsolete controls rather than writing unknown keys.

## Proposed phases

### Phase A — safer experimentation

1. Add a per-control **Reset to game default** action that removes Grimoire's
   override instead of choosing an app-defined value.
2. Show an explicit value-state badge: game default, managed preset, user
   override, or unsupported/out-of-range value.
3. Warn before replacing an existing value that lies outside the supported UI
   range; never silently clamp it.
4. Add a compact "changes pending" / applied-values summary to make slider
   adjustments auditable.

### Phase B — profiles and visibility

1. Define a small set of reviewed intent profiles, e.g. Competitive clarity,
   Maximum FPS, and Streaming-friendly.
2. Preview the exact ConVar diff before a profile applies, including values that
   will be removed to restore defaults.
3. Let users save a named local profile containing only supported controls.
4. Detect known hand-edited ConVars and classify them as managed, recognized but
   unmanaged, or unknown. Do not import unknown values automatically.

### Phase C — recovery and compatibility

1. Keep timestamped snapshots before each multi-value apply, with a selectable
   rollback target. Retain the existing original-file backup separately.
2. On game launch or settings-card open, verify the managed keys against the
   latest reviewed compatibility manifest.
3. Add an update-review state: preserve current values, but prevent writes for
   keys whose status is unverified after a Deadlock update.
4. Record a human-readable activity log (apply, reset, restore, conflict) for
   support and debugging.

### Phase D — carefully expanded settings

Candidate categories require live-build validation and UX review before adding
individual controls:

- Presentation: blur, bloom, SSAO, shadows, decals, ragdolls, and particles.
- Readability: damage text, hit-marker timing, ally/enemy visual indicators,
  objective visibility, and minimap labels/icons.
- Responsiveness: FPS caps and UI-frame-rate caps, only with explanations of
  power, thermals, display refresh rate, and capture/streaming tradeoffs.

Avoid a general raw-ConVar editor as the default experience. If expert editing
is ever added, put it behind a warning, isolate it in its own marked managed
block, preserve all user configuration verbatim, and offer diff/rollback.

## Review questions

1. Which intent profiles are genuinely distinct and safe enough to support?
2. Should saved local profiles ship before, after, or instead of built-in
   profiles?
3. What snapshot retention limit avoids clutter while remaining useful?
4. Should compatibility validation be purely manual per release, or sourced
   from a signed/reviewed manifest?
5. Which visual-quality controls provide enough user benefit to justify their
   support and testing cost?

## Suggested order

Implement Phase A first, then the profile diff preview from Phase B. Snapshot
history and compatibility validation can follow once the product needs broader
or more frequently updated ConVar coverage.

## Related implementation

- `electron/main/services/performanceConfig.ts`
- `electron/main/services/performanceConfigData.ts`
- `src/components/performance/PerformanceConfigCard.tsx`
- `docs/performance-config-integration.md`
