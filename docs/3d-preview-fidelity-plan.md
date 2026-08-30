# 3D preview fidelity: feasibility + phased plan

> **Status:** Research and plan, 2026-06-16. Partially delivered. Not maintained; read it for rationale, not for current state.

Goal: make the Locker's 3D hero previews look close to in-game. Four axes the user
named: cloth bones, lighting/materials (Source 2 shader parity), previewing effects
(ambient passive FX + authentic ability casts), and applying custom animations
(taunts/dances) to any hero skeleton.

Status (re-verified 2026-07-28): **Phases 1-4 have landed.** Pilots: Paige
(`bookworm`), Dynamo (`astro`), Seven (`gigawatt`). This doc is the build map;
the premise section below is preserved for its reasoning, not as a description
of current behaviour.

- **Phase 1 (shared spine): built.** `services/heroPoseModels.ts` exports two
  sibling glbs: the legacy static `--pose` bake (`:169`) and a rigged export
  that deliberately omits `--pose` to keep the skeleton, skin, and one ranked
  animated clip (`:171`, `:882`, `:972`). The claim below that "Grimoire always
  passes `--pose`" is obsolete.
- **Phase 2 (material/lighting parity): built.** `src/lib/deadlockMaterial.ts`,
  `src/lib/source2Preview/`, with tests.
- **Phase 3 (NPR cel/rim/tint): built.** `src/lib/source2NprMaterial.ts`, tested.
- **Phase 4 (cloth/jiggle): built.** `src/lib/useClothSim.ts` plus
  `clothMath.test.ts`, `feModel.test.ts`, and solver-stability harness tests.
- **Phases 5-7 (retarget, ambient FX, ability casts): not started.** No
  bone-map, retarget, or pre-baked-clip code exists. They are no longer blocked
  on the rigged spine.

## The reframe (read this first)

Two premises we started with were both wrong, in our favor:

1. **The glb exporter already emits a full skinned, animated, KHR-rich glTF.**
   `morphic/src/model/glb.rs` (`to_glb_textured`) builds the bone-node hierarchy,
   a `json::Skin` with joints + inverseBindMatrices, `JOINTS_0`/`WEIGHTS_0`, one
   glTF animation per decoded clip, and injects `KHR_materials_emissive_strength`,
   `_sheen`, `_transmission`, `_ior`, `_unlit`. The static, rigless preview is purely
   a product of the `--pose --require-pose` bake in `morphic/src/model/pose.rs`
   (`bake_with` zeroes skeleton + animations and strips joints/weights). Grimoire
   always passes `--pose`, so it deterministically throws the rig away.

2. **The viewer already receives the Source 2 material data and discards it.**
   Every exported material carries `material.extras.morphic = { shader, ints, floats,
   vectors, textures }` (shader name + all param tables + NPR mask texture indices),
   surfaced by GLTFLoader as `material.userData.morphic`. `HeroPoseViewer.tsx` casts
   everything to `MeshStandardMaterial` under `ambientLight(0.8)` + 2 directionals,
   no IBL, no tonemap, and never reads `userData.morphic`.

Consequence: the single highest-leverage move is to **stop baking away the rig and
stop discarding extras**. That one change (the "shared spine") simultaneously unblocks
cloth (needs the skeleton + `$cloth` bones), animation retarget (needs joints/weights/
clips), and material/NPR parity (needs extras + KHR + IBL), and gives the VFX work a
bone/attachment anchor.

## Renderer decision: stay Three.js + @react-three/fiber

Reach Source 2 parity via custom GLSL injection, not Babylon and not a native embed.

- The data path is already Three-shaped: standard glTF 2.0, KHR extensions GLTFLoader
  auto-upgrades to `MeshPhysicalMaterial` (its sheen lobe is the Charlie NDF, an exact
  match to Source 2's `pbr.vfx` cloth lobe, not an approximation), and `userData.morphic`
  as the bridge for a parity shader. Switching renderers discards this for zero gain.
- NPR is a chunk-injection problem and Three wins it: `three-custom-shader-material`
  (CSM) injects cel/rim/tint into the lighting chunk while preserving PBR, IBL, sheen,
  and the skinning chunk (the rigged spine means materials must be SkinnedMesh-safe).
  Babylon's custom ShaderMaterial overrides PBRMaterial wholesale and loses
  metallic/roughness/IBL, making NPR there harder.
- IBL is already baked: `vpkmerge-core/src/cubemap.rs` (`export_cubemap_hdr`) decodes
  the game's BC6H skybox probe to six Radiance `.hdr` faces in three.js cube order,
  feeding `PMREMGenerator` directly.
- A native Source 2 renderer (VRF) is the only path to pixel-exact parity (engine-global
  cel constants, real outline/LUT post), but is wildly disproportionate to a Locker
  preview. Keep it as a someday option AND as the offline tool to pre-bake ability clips
  that cannot be simulated live.

## What's reachable vs what hits a ceiling

| Axis | New morphic decode? | Approach | Ceiling |
|---|---|---|---|
| Skinned/animated playback | No (path exists, bypassed by `--pose`) | Drop `--pose`, SkinnedMesh + AnimationMixer | WIP heroes may lack embedded clips (NM-only) |
| Materials + IBL + KHR | No (data already in glb) | PMREM env + filmic tonemap + MeshPhysicalMaterial | HDR data maps dropped by `decode_slot` |
| NPR cel/rim/tint | No | CSM chunk injection gated on `userData.morphic` | Cel constants are engine-global, hand-tuned vs screenshots |
| Cloth/jiggle | No for v1 (bones named in skeleton); DSTF for real params is greenfield | Renderer-side verlet on `$cloth_m0p*` chains | Valve's stiffness/damping (DSTF) undecoded; hand-tuned |
| Animation retarget | No (skeletons + clips decoded) | Rotation-only bind-pose retarget (upf-gti/retargeting-threejs) | In-game APPLY (.vnmclip_c re-encode) is hard, deferred |
| Ambient FX | Yes: read-only `.vpcf` descriptor extractor (KV3 substrate exists) | three.quarks live emitter, flipbook fallback | Detection auto vs curated depends on model-bound vs game-spawned |
| Ability casts | Yes: `.vpcf` dump + child resolution (`m_Children` not resolved today) | Hybrid: pre-baked clip baseline + live sim for sprite-class | Model-spawning particles (Paige `C_OP_RenderModels`) are pre-bake-only; VRF can't render them either |

## Shared spine (the one prerequisite)

**Rigged export mode + extras-aware loader.** Ships as one deliverable, two halves:

- **Export side (Rust/Grimoire):** add a non-pose ("rigged") export variant. Omitting
  `--pose`/`--require-pose` runs `anim.apply()` instead of the pose bake, so
  `to_glb_textured` emits the existing skinned + animated glb. Cleanest: a new
  `--rigged`/`--skinned` flag in `vpkmerge-cli/src/main.rs` (keeps the `--require-pose`
  2D-fallback semantics available), or have `heroPoseModels.ts` build a no-pose command.
  Wire a **parallel cache** (sibling key e.g. `model-rigged.glb` + separate version) so
  rigged and static glbs coexist under the 2 GB LRU and `grimoire-hero:` protocol
  (`POSE_CACHE_VERSION` is currently `'4'`). This is a fresh-write of a read-only glTF
  document, so it is NOT bound by morphic's never-re-encode-meshopt/KV3 rule.
- **Renderer side:** in `HeroPoseViewer.tsx`, detect a rigged glb, load it as
  `THREE.SkinnedMesh`, drive an idle/menu clip with `THREE.AnimationMixer` (keep the
  turntable + OrbitControls), and stop force-casting materials to `MeshStandardMaterial`
  so `userData.morphic` survives for the parity shader.

Graceful degradation: no skeleton or no clip falls back to static/2D (no crash).

## Sequenced roadmap

**Phase 0: De-risk spikes (throwaway, ~days, parallel).** Settle the load-bearing
unknowns before committing to the spine. See "Spikes" below. Gates everything.

**Phase 1: Shared spine.** Rigged export + skinned/animated playback + extras-aware
loader. A hero plays its OWN idle clip on the turntable; materials keep their morphic
extras. Depends on Phase 0(a). Foundational for all threads.

**Phase 2: Material + lighting parity.** Renderer-only + one asset bake. Bake 1-2 probes
via `cubemap.rs`, ship the `.hdr` faces, `scene.environment` via PMREM (shared
singleton), ACES/Hable tonemap at ~0.8 exposure, `vertexColors=true` where present, let
GLTFLoader auto-upgrade KHR sheen/glass/unlit/emissive. Closes the bulk of the
perceptual gap. Depends on Phase 1.

**Phase 3: NPR cel/rim/tint shader.** A `Source2NprMaterial` via CSM gated on
`shader=='pbr.vfx' && F_USE_NPR_LIGHTING`: half-Lambert quantized bands (hand-tuned),
rim modulated by `g_tTintMaskRimLightMask` G, self-illum by `g_flSelfIllumScale1`,
ability tint through tint-mask R wired live to the existing recolor/Prism selection.
This is the differentiating live-recolor-preview feature. Depends on Phases 1-2.

**Phase 4: Cloth/jiggle on Dynamo.** A `useClothSim` hook identifying `$cloth` chains by
name, running Wiggle (or a ~150-line verlet) AFTER `mixer.update` each frame, seeding
inertia from parent motion + turntable spin, delta-clamped and damped, with 2-3
hand-placed colliders to stop robe-through-body. Hand-tuned (DSTF undecoded). Depends on
Phase 1 + Phase 0(b).

**Phase 5: Custom-animation retarget.** A canonical-humanoid bone-map JSON (Deadlock side
~90% identity, seeded from vpkmerge alias lists) + a bundled dance clip, retargeted via
upf-gti/retargeting-threejs (SkeletonUtils fallback) with shared bind-pose alignment,
rotation-only transfer, hip translation scaled by height ratio. Per-hero coverage
diagnostic. Depends on Phase 1 + Phase 0(c).

**Phase 6: Ambient passive FX (Seven).** 6a: captured alpha sprite-sheet flipbooked via
the EXISTING TrippyPaint CanvasTexture pattern (no new Rust, fastest visible win). 6b: a
read-only `vpkmerge particle inspect --json` walking the KV3 tree morphic already reads,
rendered live via three.quarks, pinned per-hero ambient set, flipbook fallback. Depends
on Phase 1 (anchoring) + Phase 2 (additive/tonemap) + Phase 0(d).

**Phase 7: Authentic ability casts (hybrid).** Track A: offline pre-baked recolor-aware
looping WebM/sprite-strip per ability (universal baseline; the ONLY authentic path for
Paige's `C_OP_RenderModels` ult), played as a billboard. Track B: a thin three.js CPU
sim driven by a child-resolved `.vpcf` dump for sprite-class ults (Seven), auto-falling
back to Track A when a system contains a model renderer or unsupported operators. A "Play
ability" controller drives both. Depends on Phases 1, 6, and Phase 0(d).

**Phase 8 (stretch): real-data fidelity.** Independent optional items: a morphic DSTF
decoder for real cloth params (greenfield, no VRF reference); in-game APPLY of retargeted
taunts via `.vnmclip_c` re-encode (genuinely hard); exported attachment-point transforms
for precise emitter anchoring; outlines (inverted-hull/edge pass) + exact Hable post.

## Cross-cutting risks

- **The rigged/no-pose path has NEVER run in production** (always `--pose`). Latent
  issues: clip selection, NPR shell handling under animation, larger glb straining the
  2 GB LRU and `grimoire-hero:` serving, longer export. The whole roadmap rests on it
  being clean. Phase 0(a) must verify on a SHIPPED hero first.
- **Engine-global constants are not in the data.** NPR cel-band sharpness, specular
  steps, rim strength/falloff/wrap, outline colors, and the exact Hable+bloom+LUT chain
  are set by render code, carried by ZERO shipped materials (605-material survey). So
  cel/rim/tonemap parity is hand-tuned approximation. In-game-LIKE is high-confidence;
  pixel-exact is not.
- **NPR outline/glow shells are dropped on all export paths** (`is_dropped` in glb.rs);
  the rigged preview inherits the same flattened-halo limit. Un-stripping reintroduces
  the white-halo problem unless re-materialed with reversed cull.
- **Cloth DSTF params and morph targets/flex are not decoded** (nor by VRF's exporter).
  Cloth is hand-tuned verlet; capes/hair stay rigid under retargeted dances; faces won't
  flex. Permanent gap short of greenfield decoders.
- **Particles have no runtime in the stack** and morphic does not resolve child systems
  (`m_Children`). Model-spawning particles (`C_OP_RenderModels`, Paige's ult) are
  unrenderable in every open-source Source 2 stack including VRF: pre-baked clips only.
- **Recolor x N-features cache explosion.** Rigged glbs + per-(hero, ability, hue, sat,
  brightness, style) clips + ambient descriptors multiply the already-2 GB-capped cache.
  Each artifact needs its own cap/LRU, likely coarser recolor granularity or runtime tint
  of a neutral-baked clip.
- **Low-end performance:** PMREM env + EffectComposer + custom shaders + SkinnedMesh +
  verlet + CPU particles, possibly across multiple viewer instances, is far heavier than
  today. Env maps and composer must be shared singletons; particles need a budget cap.
- **WIP/NM heroes (incl. Paige)** may ship no embedded ANIM clips (static NM only;
  animated NM `m_compressedPoseData` out of scope). Rigged export sources their skeleton
  from `nm.rs`; verify each WIP pilot exports a usable skinned skeleton before committing.

## Recommended spikes (Phase 0)

1. **RIG ROUND-TRIP (highest priority, gates everything):** export one shipped hero
   WITHOUT `--pose`, load as SkinnedMesh + AnimationMixer in a throwaway scene, confirm
   it renders upright and deforms when an idle clip plays. Measure export time + glb size.
2. **IBL + TONEMAP DROP-IN:** bake one probe via `cubemap.rs`, wire PMREM
   `scene.environment` + ACES tonemap + `vertexColors=true` into the CURRENT static viewer
   (no rig needed). A few hours that visually proves how much closes with zero Rust and
   zero shader work, validating the renderer call early.
3. **DYNAMO SKELETON DUMP:** dump `astro`'s bone names, confirm the cloth-chain prefix
   (`$cloth_m0p*` vs hood/robe naming) before any solver work.
4. **FULL-ROSTER BONE DIFF:** dump `sorted_bone_names()` for every hero, diff against a
   canonical humanoid set. Sizes the retarget alias table, surfaces non-humanoid outliers.
5. **RETARGET SANITY:** feed one Mixamo dance + two hero skeletons through
   upf-gti/retargeting-threejs (and SkeletonUtils for comparison) with bind-pose
   alignment; eyeball recognizable vs twisted.
6. **VPCF CLASS-SPLIT DECODE:** decode Paige's `bookworm_ultimate_model.vpcf` and Seven's
   storm-cloud `.vpcf`; enumerate renderer classes. Confirm Paige hits `C_OP_RenderModels`
   (pre-bake-only) and Seven is sprite/trail/light (live-feasible); check `m_Children`.
7. **FLIPBOOK VFX PROOF:** capture a short alpha sprite-sheet of Seven's crackle, play it
   through the existing TrippyPaint CanvasTexture pattern as an additive billboard. Proves
   the ambient payoff and transport before any extractor investment.

## Key files (source-verified anchors)

morphic / vpkmerge (sibling repo `C:\Users\USER\vpkmerge`):
- `morphic/src/model/glb.rs` - the glTF writer; already emits skin + anim + KHR + extras.
- `morphic/src/model/pose.rs` - the `--pose` baker that strips the rig (`bake_with`).
- `vpkmerge-core/src/model.rs` - export orchestration, pose-source priority, `--require-pose`.
- `morphic/src/model/animation.rs` - ANIM/AGRP/ASEQ clip decoder (VRF port).
- `morphic/src/model/skeleton.rs` - skeleton/bind-pose decode.
- `morphic/src/model/nm.rs` - WIP-hero static NM pose decode.
- `morphic/src/material/mod.rs` - vmat param parser + PbrSlots.
- `vpkmerge-core/src/cubemap.rs` - BC6H skybox probe to 6 `.hdr` faces (IBL bake).
- `vpkmerge-core/src/hero_recolor.rs` - proof of `.vpcf` KV3 tree walk (recolor only).
- `vpkmerge-cli/src/main.rs` - CLI surface; `--pose`/`--require-pose` parsing.

grimoire:
- `electron/main/services/heroPoseModels.ts` - builds the export cmd (always `--pose`),
  pose cache + `grimoire-hero:` protocol.
- `src/components/locker/HeroPoseViewer.tsx` - the renderer; flattens to
  MeshStandardMaterial, fixed lights, ignores `userData.morphic`.
- `docs/ability-vfx-recolor.md` - the morphic patch-in-place philosophy.

## Phase 0 spike results (executed 2026-06-16)

Five of the seven spikes were run against the live build (vpkmerge release binary +
real Deadlock pak01). Artifacts in `C:\Users\USER\vpkmerge\.scratch\spikes`.

- **Spike 1 (rig round-trip) PASS (the gate is green).** Exporting `astro` (Dynamo)
  via `model export` WITHOUT `--pose` yields a glb with `skins=1`, 96 joints,
  `JOINTS_0+WEIGHTS_0` present, and **260 animation clips** (`primary_stand_idle`,
  `item_stand_idle`, ...). The static `--pose` glb is 0/0/0 by contrast. The no-pose
  path works on a shipped hero with no code change.
  - **Caveat / action:** all 260 clips make the rigged glb **60.9 MB vs 17.7 MB**
    static (~3.4x). Use `--clip <name>` to export a curated idle set, or the 2 GB pose
    cache caps at ~30 heroes. The rigged export MUST filter clips.
- **Spike 3 (Dynamo cloth bones): the `$cloth_m0p*` assumption was wrong for shipped
  heroes.** Dynamo's cloth is `scarf_0`..`scarf_9` (10-bone chain) + `flaps_0_L/R` +
  `hat_0`, all semantic names. His skeleton is clean humanoid (`pelvis`, `spine_0..3`,
  `clavicle_L`, `arm_upper_L`, full finger hierarchy, plus `leg_*_IKTARGET` for
  foot-lock).
- **Spike 4 (roster bone diff): retarget is de-risked; cloth detection needs a union
  rule.** Across astro/bookworm/gigawatt/viscous/bebop/haze/warden/lash, ALL 8 hit
  **100% of the 23-bone canonical humanoid core**, including non-humanoid Viscous (85
  bones) and robot Bebop (258). So a canonical retarget map is ~identity roster-wide.
  Cloth naming is heterogeneous: semantic chains (scarf/hair/sleeve_cloth/waist_cloth/
  forearm_tie/hair_a_b/rope) on most, Valve `$cloth_m#p#` sim bones ONLY on Bebop (69)
  and Warden (152), several heroes have BOTH, Viscous has none. **Cloth detector = union
  of `$cloth_` prefix + semantic keyword set, grouped by numbered suffix + `_end` tips.**
- **Spike 6 (vpcf class split) CONFIRMED + sharpened.** Paige
  `bookworm_ultimate_model.vpcf` = `C_OP_RenderModels`, no children (model-spawning,
  pre-bake-only). Seven `gigawatt_storm_cloud_cast.vpcf` = no own renderer, 13+
  sprite/beam/bolt/glow/light children (proves morphic MUST resolve `m_Children` for a
  live sim). Seven `gigawatt_lightning_ball.vpcf` = `C_OP_RenderStandardLight` + a
  `_model` child, so a live sim needs **per-child renderer routing** (sprite/light live;
  model children fall back to pre-bake). The hybrid plan holds, with child-resolution +
  per-child class routing as the firm requirement.
- **Spike 2 (IBL bake) PASS (asset half).** `cubemap` baked
  `materials/skybox/sky_dl_dusk_ibl_exr_3dabb6cd.vtex_c` to six 128x128 `.hdr` faces
  (~64 KB each, 384 KB total), clean decode (mean luminance ~0.43). The renderer
  drop-in into `HeroPoseViewer` (PMREM + tonemap) is the remaining half, needs a visual
  verify under `pnpm dev`.

Implemented, pending manual visual validation:
- **Spike 2 (renderer half) IMPLEMENTED** on branch `feat/3d-preview-fidelity`. In
  `HeroPoseViewer.tsx`: a one-time PMREM `Environment` from the baked dusk probe
  (faces shipped in `public/ibl/`), `ACESFilmicToneMapping` at exposure 0.9, the bare
  `ambientLight` dropped to 0.12 with a warm key + cool fill, and `vertexColors=true`
  where a mesh carries a COLOR attribute. Renderer-only, applies to the CURRENT static
  glb. Needs `pnpm install` then `pnpm dev` to eyeball; exposure / light intensities
  are the tunable knobs.

Not yet run (need a running GUI or manual capture, not a headless data check):
- **Spike 5 (retarget sanity):** feed a Mixamo clip + two hero rigs through
  upf-gti/retargeting-threejs, eyeball recognizable vs twisted. (Bone mapping confirmed
  viable by Spike 4; this validates pose quality.)
- **Spike 7 (flipbook VFX):** needs a captured alpha sprite-sheet of Seven's crackle
  (manual game/VRF capture), then the existing TrippyPaint pattern.

Net: the gate (Spike 1) is green, two findings tighten the plan (clip-filtering for
cache, union cloth-detection rule), retargeting is de-risked roster-wide, and the
ability-VFX hybrid is confirmed. No blockers surfaced.

## Materials-parity workflow results (2026-06-16)

A 5-agent workflow audited the `pbr.vfx` -> glTF -> three pipeline. It found the
real cause of the "still matte" look and a set of export fixes, all verified
against real decoded assets.

**Root cause of matte (verified by decoding textures):** `metal_rough_png` read
roughness from the normal texture's ALPHA channel, but alpha is a constant ~0.999
on every Deadlock `g_tNormalRoughness` texture; the real roughness is the BLUE
channel (varies 0.0-0.82). So every textured material exported fully-rough/matte.

**Applied + verified (`morphic/src/model/glb.rs`, rebuilt; `POSE_CACHE_VERSION`
bumped 4 -> 5):**
1. Roughness from blue (`px[2]`) not alpha. The single highest-impact fix.
2. Normal-Z reconstructed from X,Y (blue was being mis-used as normal Z).
3. Stop dropping 4x4 BC4 constant metalness textures (the `>4` filter is right for
   normal placeholders, wrong for metalness).
4. Constant metalness from `TextureMetalness1` (the vector param Deadlock sets).
   Verified: `shiv_glasses` now `metallicFactor=1` (was 0).
5. Constant roughness from `TextureRoughness1`. Verified: `mcginnis_greenglass`
   now `0.188` (glossy; was stuck at 1.0 matte).
6. `g_vColorTint1` -> `baseColorFactor`. Verified: `mcginnis_greengoo` now
   `[0.161, 0.247, 0.286]` (dark teal; was `[1,1,1,1]`).
Skipped step 7 (synthetic metalness-only MR texture) as optional. Fixes flow
through GLTFLoader with no renderer change. Cloth heroes correctly stay matte
(their constants are `[0,0,0,0]` / high roughness).

**Probe decision (measured):** keep `sky_overcast_01` (mean luminance 0.93,
neutral cast 0.98/1.04/0.98, the best neutral-daylight probe in pak01). Stay on
ACES tonemapping at exposure 0.8; defer the exact Hable pass until after NPR cel
shading lands (so exposure is tuned once against the final look).

**Next (deferred, needs deps + visual iteration):** the DRAFT NPR cel/rim/tint
shader (`three-custom-shader-material` over MeshPhysicalMaterial, gated on
`userData.morphic`), the biggest remaining leap to the in-game cel-shaded look.
Full draft (a new `src/lib/source2NprMaterial.ts` + HeroPoseViewer edits) is in
the workflow output; apply as a verified pass once deps are installed.

## Roster sweep verdict + round-2 (2026-06-16)

A 10-agent roster-wide sweep regression-checked the material fix and ran round-2 gap
analysis. Results:

**Core fix is SAFE roster-wide.** Three independent audits agree: every
`g_tNormalRoughness`-slotted texture in the game has alpha-constant + roughness-in-blue
(230+ GOOD, ZERO alpha-packing inversions). Verified end-to-end (e.g. vampirebat
`roughnessFactor == B/255` exactly; unicorn_prism B=45 -> 0.18 glossy the old alpha-read
would have made fully matte).

**Auto-applied by the workflow agents (build clean, all 99 morphic tests pass; kept):**
- Sheen now reads `TextureSheenColor1 * g_vSheenColorTint1` and binds the `g_tSheen`
  texture (RGB->sheenColor, alpha->sheenRoughness). The old code emitted WHITE sheen on
  ~22/26 cloth materials. NEEDS A VISUAL CHECK.
- Glass honors authored `g_flIOR` instead of a hardcoded 1.5.
- `tests.rs` metal-rough fixture updated to the blue=roughness packing.

**The one real refinement (deferred, NOT a quick patch): mis-routed pure-normal
materials.** A class of heroes (abrams, operative, ghost, punkgoat, viscous_head,
engineer_alt_head) bind a PURE NORMAL map to the normal slot, where blue is normal-Z,
not roughness; the fix reads normal-Z as roughness (mid-rough ~0.65-0.89: wrong, but not
visually catastrophic). The discriminator is content-based and proven:
`mcginnis_body_normal` B min=0 (roughness; a normal-Z can't be 0) vs
`abrams_upper_body_normal` B 98-255 reaching 255 (normal-Z). Name/slot do NOT
distinguish them (both `_normal_png`), so the drafted slot-name patch is WRONG. The
correct fix tests, per texel, whether blue matches the normal-Z reconstructed from R,G.
A heuristic; implement + verify carefully, do not rush into the hot export path.

**Other deferred round-2 items:**
- Wire the resolved-but-unused `g_tRoughness` slot (recovers ghost's authored roughness,
  bound to `g_tSheen` alpha and currently dropped).
- BC6H/Rgba16F tonemap in `decode_slot` (purely defensive: 0 hero materials bind HDR).
- Toon outline pass (renderer-side: read `userData.morphic.ints.F_SOLID_COLOR_OUTLINE` +
  `vectors.g_vSolidOutlineTint`, EffectComposer edge pass; 151/605 materials; needs a
  visual check; per-material tint needs an id->tint shader, not three's single-color
  OutlinePass).

Workflow agents left throwaway examples in `vpkmerge/morphic/examples/` (mat_audit.rs,
param_census.rs, sheen_verify.rs).

## Hard-limit absences in morphic (route around these)

- Cloth/jiggle/softbody SIM params (DSTF block): not decoded (nor by VRF).
- Morph targets / flex: not decoded; `gltf_import.rs` explicitly skips them.
- Physics/collision (PHYS block): flagged in `inspect()`, not decoded.
- General `.vpcf` emitter/operator graph: read only as opaque KV3 for color patching;
  no child-system (`m_Children`) resolution.
- Animated NM clips (`m_compressedPoseData`): static single-frame only.
- HDR/Rgba16F texture slots: `decode_slot` returns None (falls back to factor).
