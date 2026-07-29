# Rigged hero preview: measurement spike

Status: spike report, not a feature. Date: 2026-07-28.

Scope owner files: `electron/main/services/heroPoseModels.ts`,
`src/components/locker/HeroPoseViewer.tsx`, `src/lib/loadGltfPreview.ts`.

Pilots: **Holliday** (`astro`), **Paige** (`bookworm`), **Seven**
(`gigawatt_prisoner`).

## 0. Scope correction (the original premise was stale)

The wave spec said "Grimoire always passes `--pose` to the model export, which
discards the skeleton and clips. Run the no-pose path." That is **not** the state
of the code and no such work was needed. Verified before starting:

- `heroPoseModels.ts` already ships a rigged sibling export that deliberately
  omits `--pose`: `RIGGED_MODEL_FILENAME = 'model-rigged.glb'`,
  `runRiggedHeroExportForSources`, `riggedClipScore` / `chooseRiggedClip`,
  `RIGGED_CACHE_VERSION` at pipeline v7.
- IPC `get-rigged-hero-pose` / `export-rigged-hero-pose` exists and is wired
  through preload.
- `HeroPoseViewer.tsx` already has the two-attempt loader: rigged first, static
  posed preview as fallback.
- `docs/remaining-work-phases.md` Phase 7a already records this as BUILT.

So this spike measured the existing path end to end instead of building one.

## 1. What was measured vs estimated vs unverifiable

| Claim | Basis |
| --- | --- |
| Rigged export succeeds per pilot | **Measured.** Real `vpkmerge` runs against the installed pak. |
| GLB byte sizes and size delta | **Measured.** Real files on disk. |
| Export wall-clock | **Measured.** Single cold run each, `date +%s%N` around the process. |
| Skeleton / skin / clip / joint / triangle / material-extras counts | **Measured.** GLB JSON chunk parsed directly. |
| NPR layer tracks the deforming mesh | **Derived from source**, and it is a *structural* guarantee, not a guess. See section 5. |
| Frames per second under animation | **NOT MEASURED. Cannot be, headlessly.** Section 6 gives an arithmetic estimate with its inputs shown, plus a human procedure. |
| Whether the outline visually swims | **Unverifiable headlessly.** Section 5 argues it structurally cannot; section 8 says how a human confirms. |

Environment: Deadlock installed at `D:\Steam\steamapps\common\Deadlock`, bundled
`resources/vpkmerge/vpkmerge-windows-x86_64.exe`. All exports were vanilla (no
skin stack), which is the `poseKey(hero, [], '')` cache path.

## 2. Per-pilot results

All three pilots **succeed on the rigged path**. Nothing fell back.

| Hero | Codename | Selector | Clips (animated) | Clip chosen | Rigged export |
| --- | --- | --- | --- | --- | --- |
| Holliday | `astro` | `--hero astro` | 260 (249) | `primary_stand_idle`, 81f, 2.67s, looping | PASS |
| Paige | `bookworm` | `--hero bookworm` | 4 (3) | `out_of_combat_stand_idle`, 41f, 1.33s, looping | PASS |
| Seven | `gigawatt_prisoner` | `--hero gigawatt_prisoner` | 230 (222) | `primary_stand_idle`, 79f, 3.25s, looping | PASS |

`chooseRiggedClip` picked a looping standing idle for every pilot, over strong
distractors: Holliday's 249 animated clips include rope-climb and lasso-cast
loops; Seven's include `grenade_idle` and `primary_crouch_idle`; Paige's `ui_pose`
is exactly as long as her idle but does not loop. The ranking is now pinned by
`electron/main/services/heroPoseRiggedClip.test.ts` using clip rows captured
verbatim from the shipped pak.

Note on Seven: `--hero gigawatt` fails outright (`no body model ... found`), which
is exactly why `MODEL_CODENAME_OVERRIDES` maps Seven to `gigawatt_prisoner`. The
override is load-bearing and correct.

### Structural comparison (measured from the GLB JSON chunk)

| | astro static | astro rigged | bookworm static | bookworm rigged | gigawatt static | gigawatt rigged |
| --- | --- | --- | --- | --- | --- | --- |
| triangles | 73,659 | 73,659 | 85,932 | 85,932 | 215,305 | 215,305 |
| vertices | 95,764 | 95,764 | 196,851 | 196,851 | 230,111 | 230,111 |
| nodes | 2 | 99 | 2 | 167 | 4 | 236 |
| skins (joints) | 0 | 1 (96) | 0 | 1 (164) | 0 | 1 (231) |
| animations | 0 | 1 | 0 | 1 | 0 | 1 |
| anim channels | 0 | 288 | 0 | 492 | 0 | 654 |
| skinned primitives | 0 of 3 | 3 of 3 | 0 of 9 | 9 of 9 | 0 of 7 | 7 of 7 |
| materials (with extras) | 3 (3) | 3 (3) | 8 (8) | 8 (8) | 4 (4) | 4 (4) |
| morph targets | 0 | 0 | 0 | 0 | 0 | 0 |

Two things worth calling out. **Geometry is bit-identical in count** between the
two paths: the rigged export is the same mesh plus a rig, not a different LOD.
And **every** primitive in the rigged export carries `JOINTS_0`, so no piece of
the model is left behind in bind pose while the rest animates. That was the most
likely visible failure mode and it does not occur on any pilot.

No pilot carries morph targets, so blend-shape cost is zero here.

## 3. GLB size delta (measured)

| Hero | Static | Rigged | Delta | Delta % |
| --- | --- | --- | --- | --- |
| Holliday | 16.96 MB | 18.57 MB | +1.61 MB | +9.5% |
| Paige | 33.83 MB | 35.31 MB | +1.48 MB | +4.4% |
| Seven | 15.06 MB | 18.09 MB | +3.03 MB | +20.2% |
| **total** | **65.85 MB** | **71.97 MB** | **+6.13 MB** | **+9.3%** |

The delta is fully accounted for by three buffers, measured from accessor counts:

| Hero | skin attrs (`JOINTS_0`+`WEIGHTS_0`) | animation samplers | inverse bind matrices | sum |
| --- | --- | --- | --- | --- |
| Holliday | 1.23 MB | 0.39 MB | 6.0 KB | 1.63 MB |
| Paige | 1.08 MB | 0.33 MB | 10.3 KB | 1.42 MB |
| Seven | 2.18 MB | 0.85 MB | 14.4 KB | 3.04 MB |

Those sums match the observed file deltas to within rounding, which means there
is no hidden bloat: the rigged GLB is the static GLB plus rig data. Absolute file
size in both paths is dominated by embedded textures (20 to 47 images per hero),
which are byte-identical across the two paths.

Cache impact: the rigged GLB is a **sibling** of the static one in the same entry
dir, not a replacement. Enabling the rigged path for a hero therefore costs the
sum of both, not the delta, because the static file is still exported as the
fallback. Against `POSE_CACHE_MAX_BYTES` (2 GB) that roughly halves how many hero
and skin combinations fit before the LRU sweep starts evicting. The sweep handles
it correctly, but users would regenerate more often.

## 4. Export wall-clock (measured, single cold run each)

| Hero | Static | Rigged |
| --- | --- | --- |
| Holliday | 575 ms | 498 ms |
| Paige | 998 ms | 959 ms |
| Seven | 593 ms | 579 ms |

The rigged export is consistently **slightly faster**, which makes sense: it skips
the pose-baking pass. Export cost is a non-issue. Note the rigged path also runs
one extra `model clips --json` call first for clip selection, which is not in
these numbers; it completed in well under a second for every pilot.

## 5. NPR shell behaviour under animation

**Finding: the NPR layer cannot detach or swim, by construction. There is no
inverted-hull shell in the GLB at all.**

Three separate pieces of evidence.

**a. There is no shell geometry to swim.** The exporter drops Deadlock's
inverted-hull `*_outline` and additive `*_glow` shells (both collapse to an opaque
white halo as plain glTF), and it does so on the rigged path too. Scanning all six
GLBs for meshes or materials named `outline|glow|jitter|halo|rim` returns **zero
shell meshes** in either path for all three pilots. The one hull-like mesh present,
Seven's `shirt_backfaces` (2,174 tris), is a real body part and it **is skinned**
in the rigged export, so it deforms with the body.

**b. The NPR look is a fragment-stage effect on skinned normals.** The outline,
cel ramp, and rim are not geometry. They are computed in `NPR_PATCH_MAP`'s
`#include <opaque_fragment>` patch from `vNormal` and `vViewPosition`. `vNormal`
is produced by three.js's `<defaultnormal_vertex>`, which consumes `objectNormal`
*after* `<skinnormal_vertex>` has skinned it. So the rim reads the deformed normal
automatically, every frame, with no extra work.

**c. The vertex stage deliberately does not interfere with skinning.** This is an
authored invariant, already documented at `source2NprMaterial.ts:974`:

> The vertex shader does NOT write csm_Position / csm_Normal. Writing csm_Position
> re-routes `<begin_vertex>` (transformed = csm_Position) and would reorder relative
> to `<skinning_vertex>` / `<morphtarget_vertex>`, risking the rigged spine. Keep this
> to varying passthrough only.

`NPR_VERTEX` is UV passthrough only, confirmed by reading it. The one vertex-stage
write the NPR path does make, the jitter displacement and
`vNprSourcePosition = transformed`, is injected at `#include
<displacementmap_vertex>`, which in three.js's vertex main runs **after**
`<skinning_vertex>`. So `transformed` there is already the skinned position, and
both the jitter offset and the position-driven highlight are applied in skinned
space rather than bind space. That is the correct ordering and it is the one that
would have caused visible swimming if it were wrong.

Supporting checks on the rest of the viewer:

- Material extras survive the rigged export **byte-identically**. All 15 material
  instances across the three pilots compare equal between static and rigged:
  same `shader`, `schema_version`, `blend_mode`, `texture_slots` count, and
  `ints.F_USE_NPR_LIGHTING`. 13 of 15 are NPR-flagged; Paige's `bookworm_lens` is
  the additive-blend self-illum case and it survives as additive. So the morphic
  material extras are preserved under animation.
- `NprMaterials` explicitly tests `mesh.isMesh || skinned.isSkinnedMesh`, so it
  wraps skinned materials.
- `compileSource2DrawState` and `TrippyPaint` test only `isMesh`, which is still
  correct: three.js `SkinnedMesh` extends `Mesh` and has `isMesh === true`.
- `disposeScene` already calls `skeleton.dispose()`, so the rigged path does not
  leak bone textures.
- `RiggedModel` computes its normalization AABB once from a forced bind pose, so
  the model does not breathe or drift in frame as the clip plays. That is the
  right call and it is already implemented.

The residual visual risk is therefore **not** shell swim. It is whether the
`CustomShaderMaterial` wrapper correctly inherits the `USE_SKINNING` define from
its cloned `MeshPhysicalMaterial` base. It should, because CSM subclasses the base
material type and three derives skinning defines from the object rather than the
material. If it did not, the failure would be unmistakable and total (the mesh
renders in bind pose while the skeleton animates), not a subtle swim. This is the
single most important thing for a human to confirm. See section 8.

## 6. Frame budget

**Not measured. No GPU, no window, headless.** What follows is arithmetic from
measured counts, labelled as an estimate.

The most important structural point: **fragment cost is unchanged**. Triangle
count, material count, texture count, and the bloom postprocess are identical
between the two paths. The rigged path adds only per-frame CPU animation work and
GPU vertex-stage skinning. For a preview that is already fragment-bound (a heavy
NPR `CustomShaderMaterial` plus `UnrealBloomPass` on a full-viewport canvas at
`dpr` up to 2), the added cost lands where there is the most headroom.

Estimated per-frame additional cost:

| Hero | anim channels | joints | verts | Mixer interp (est) | Skeleton update + bone texture (est) | Bone texture upload/frame |
| --- | --- | --- | --- | --- | --- | --- |
| Holliday | 288 | 96 | 95,764 | 0.09 to 0.29 ms | 0.05 to 0.10 ms | 6.1 KB |
| Paige | 492 | 164 | 196,851 | 0.15 to 0.49 ms | 0.08 to 0.16 ms | 10.5 KB |
| Seven | 654 | 231 | 230,111 | 0.20 to 0.65 ms | 0.12 to 0.23 ms | 14.8 KB |

Basis: three.js interpolates one sampler per channel per frame in JS at roughly
0.3 to 1.0 us per channel; `Skeleton.update()` composes one matrix per joint and
writes `joints * 16` floats into the bone texture. GPU vertex skinning is four
bone-matrix texel fetches and four `mat4` blends per vertex, which at 230k
vertices is well under a millisecond on any GPU that can already shade 215k
NPR-shaded triangles with bloom.

Estimated total CPU add: **roughly 0.15 to 0.9 ms per frame**, worst case Seven.
At a 16.7 ms budget (60 fps) that is about 1 to 5% of frame time. Additional VRAM
for skin attributes is 1.1 to 2.2 MB per hero, measured in section 3.

**Estimated conclusion: the rigged path should not move fps meaningfully, and
Seven is the worst case on every axis** (most triangles at 215k, most joints at
231, most channels at 654, largest size delta at +20%). If a human measures only
one hero, measure Seven.

Caveat that the arithmetic cannot cover: `Skeleton.update()` and the mixer run on
the main thread, so on a machine already CPU-bound by the React and Electron
overhead the sub-millisecond estimate could matter more than the percentage
suggests. That is exactly the kind of thing only a real measurement settles.

## 7. Fallback verification

**The static posed preview is not merely the fallback today. It is the only path
that runs in any shipped build.** Verified by reading the gate, not assumed:

```
// src/components/locker/heroPoseRenderFeatures.ts
const USE_RIGGED_PREVIEW: boolean = false;
...
riggedPreviewEnabled: USE_RIGGED_PREVIEW || clothPreviewEnabled,
```

- In production, `HeroPoseViewer` uses `RELEASE_RENDER_FLAGS`, where
  `cloth: USE_CLOTH` and `USE_CLOTH = false`. So `riggedPreviewEnabled` is
  `false || false` = **false**. Attempt 1 is skipped entirely and the loader goes
  straight to the static `--pose` export.
- In dev, `devFlags.cloth` defaults to `previewFlag('grimoire.preview.cloth',
  USE_CLOTH)` = false, so it is off there too unless a developer ticks the Leva
  "Cloth" checkbox.

**This is a coupling problem worth fixing before any ship decision.** Rigged
preview has no independent switch. The only way to turn it on is to enable
`cloth`, which simultaneously starts the WIP cloth verlet sim (`useClothSim`) and
fires a `getHeroClothModel` IPC per hero. So today you cannot audition rigged
animation on its own, and any evaluation of "does rigged look right" is
contaminated by cloth. Recommended shape: give `riggedPreviewEnabled` its own
flag and make cloth depend on rigged rather than the reverse. That change is in
`heroPoseRenderFeatures.ts`, which this spike does not own, so it is written up
here rather than made.

The fallback *logic* itself, read line by line in `HeroPoseViewer.tsx`, is sound.
All four failure modes degrade to the static preview:

1. `getRiggedHeroPose` / `exportRiggedHeroPose` throws: inner `catch` falls
   through to attempt 2.
2. Export returns `hasModel: false` (the clipless case, where
   `runRiggedHeroExportForSources` returns early rather than throwing): the
   `if (rig.hasModel)` block is skipped and control falls through to attempt 2.
3. Rigged GLB loads but carries no animated clip: `pickIdleClip` returns null,
   the scene is disposed, and a throw is caught by the same inner `catch`.
4. Static export then also fails: `setFailed(true)` renders
   `HeroPoseFailureState` with `locker.pose.cannotPose`, which is the 2D-portrait
   path.

No leak in any branch: `loaded` is only assigned after the success checks, and
the rejected rigged scene is explicitly disposed before the throw.

What could **not** be verified headlessly: that fallback path 1 or 3 actually
executes at runtime on a real hero. No pilot triggers it, because all three
succeed. To exercise it deliberately, see section 8.

### Related stale-comment correction (fixed in this spike)

`heroPoseModels.ts` claimed `--require-pose` exists because "a clipless WIP hero
(Apollo, Billy, Celeste, Mina, Paige, Rem)" fails there and falls back to 2D. That
list is stale. Re-checked against the installed pak on 2026-07-28:

| Hero | Codename | Clips (animated) | Static `--pose --require-pose` |
| --- | --- | --- | --- |
| Apollo | `fencer` | 6 (4) | PASS |
| Billy | `punkgoat` | 5 (4) | PASS |
| Celeste | `unicorn` | 7 (5) | PASS |
| Mina | `vampirebat` | 5 (2) | PASS |
| Paige | `bookworm` | 4 (3) | PASS |
| Rem | `familiar` | 2 (0) | n/a, pinned to `familiar_wip`: 7 (5) |

Every hero the comment named now ships pose clips and exports cleanly. Only plain
`familiar` is still clipless, and Rem is already pinned away from it by
`MODEL_ENTRY_OVERRIDES`. The comment has been corrected to describe
`--require-pose` as a safety net for future WIP additions rather than a live
filter. The guard itself is still correct and was not changed.

## 8. What a human must check, and how

Everything below needs the app running with a GPU. None of it can be done
headlessly. Run `pnpm dev`, open the Locker, pick a hero's page.

**Enable the rigged path.** There is no dedicated switch today (section 7). In
dev, open the Leva "Preview" panel, expand "Debug", tick **Cloth**. That is
currently the only way to set `riggedPreviewEnabled`. Be aware this also starts
the cloth sim, so attribute any cloth-specific artifacts accordingly. Better:
temporarily set `USE_RIGGED_PREVIEW = true` in `heroPoseRenderFeatures.ts` so you
are testing rigged alone.

**Check 1: does it animate at all, and is the whole model animating?**
Expected: the hero plays a looping idle. Holliday plays `primary_stand_idle`,
Paige `out_of_combat_stand_idle`, Seven `primary_stand_idle`.
- PASS: the entire model moves together, including Seven's gun and headgear and
  Paige's head, all of which are separate meshes.
- FAIL: the model stands in bind pose while nothing moves. That is the
  `USE_SKINNING`-not-inherited failure from section 5 and it is the single most
  likely real defect.
- FAIL: part of the model animates and part stays frozen. Measurement says every
  primitive is skinned, so this would indicate a viewer bug, not an export bug.

**Check 2: does the NPR outline or rim swim or detach?**
Orbit the model while the idle plays, and watch the silhouette edge and the rim
highlight along the shoulders and head.
- PASS: the rim stays locked to the silhouette as limbs move. Analysis says this
  is structurally guaranteed.
- FAIL: the rim lags, floats off the surface, or the outline stays in a
  bind-pose-shaped ghost. If this happens, the cause is not the export. Check
  whether `NPR_VERTEX` gained a `csm_Position` write, which would break the chunk
  ordering documented at `source2NprMaterial.ts:974`.

**Check 3: frame budget (the number this spike could not produce).**
Use Seven, the worst case on every measured axis. Open DevTools, Performance
panel, or add a stats overlay.
1. Record 10 seconds with the static preview (rigged off).
2. Record 10 seconds with the rigged preview on the same hero, same window size.
3. Compare median frame time, not average, and note the dpr the canvas settled on.
- PASS: rigged frame time is within about 1 ms of static, matching the estimate
  in section 6. Ship-viable.
- INVESTIGATE: 1 to 3 ms worse. Probably the mixer on the main thread. Still
  likely acceptable for a preview.
- FAIL: more than 3 ms worse, or a drop below 30 fps on mid-range hardware. That
  would contradict the estimate and means something other than skinning is going
  on, most likely a material recompile per frame.

Also watch for a **one-time hitch** when the rigged model first appears: 231 bone
nodes plus shader compile. A stutter on load is expected and acceptable; a
recurring stutter every loop is not.

**Check 4: does the fallback actually trigger?**
No pilot fails naturally, so force it:
1. Export a hero's rigged model normally so the cache dir exists.
2. Corrupt or truncate `model-rigged.glb` in
   `%APPDATA%/grimoire/hero-poses/<key>/`, leaving `.rigged-cache-version` intact
   so the cache still reports `hasModel: true`.
3. Reopen the hero.
- PASS: the viewer shows the static posed preview with no error toast and no
  blank canvas. Path 1 of section 7.
- FAIL: blank canvas, or the "cannot pose" message, or a console error that
  escapes to the user.

Repeat with a hero whose rigged export legitimately produces no clip if one can
be found. As of this spike, none of the roster is in that state.

**Check 5: skin stack.** Every export in this spike was vanilla. Enable a skin
mod on a pilot, confirm the rigged path still picks up the skin's mesh and
textures, and confirm the content-addressed `poseKey` fingerprint gives the skin
its own cache dir rather than serving the vanilla model.

## 9. Recommendation

**Ship it gated, behind its own dev-only flag for now. Do not enable it by
default in this wave.**

Evidence for shipping eventually:

- The export path is correct and complete. Three for three pilots, including one
  hero (Paige) with only four clips total and one (Seven) needing a codename
  override. Clip ranking picks a looping standing idle every time.
- Geometry, material count, and material extras are preserved exactly. The NPR
  and self-illum and additive-blend metadata all survive byte-identically.
- The NPR layer tracks the deformation by construction, and the chunk ordering
  that makes that true is already an authored, documented invariant.
- Size cost is modest and fully explained: +9.3% across the pilots, all of it rig
  data, textures unchanged.
- Export is not slower. It is marginally faster.
- The fallback logic is sound across all four failure modes.

Evidence for not defaulting it on yet:

- **No fps measurement exists.** The estimate says the cost is 1 to 5% of frame
  budget, but that is arithmetic, not a benchmark. Defaulting a 3D preview on
  without a real frame-time number on real hardware is not a call this spike can
  make. Check 3 in section 8 is the blocker.
- **The rigged flag is welded to cloth.** `riggedPreviewEnabled =
  USE_RIGGED_PREVIEW || clothPreviewEnabled` means enabling rigged today also
  starts the WIP cloth sim. Shipping in that shape would ship cloth. This must be
  decoupled first, and it is a one-line change in a file this spike does not own.
- **Cache pressure roughly doubles per hero**, because the rigged GLB is a
  sibling of the static one and the static one must stay as the fallback. Against
  a 2 GB cap that means more frequent LRU eviction and more regeneration for users
  who browse a lot of heroes and skins.
- **Three pilots is not the roster.** All three passed, which is a good signal but
  not coverage. Before defaulting on, run the clip-selection check across every
  hero, which is cheap: it is one `model clips --json` call each and needs no
  export.

Concrete next steps, in order:

1. Decouple `riggedPreviewEnabled` from `clothPreviewEnabled` in
   `heroPoseRenderFeatures.ts` and give rigged its own flag.
2. A human runs section 8 checks 1, 2, and 3 on Seven. Check 3 is the gate.
3. If frame time is within about 1 ms, sweep `model clips --json` across the full
   roster and record which heroes yield no animated clip.
4. Only then consider defaulting it on, and consider whether the static GLB can
   be skipped once a hero's rigged export is known good, to recover the cache
   cost.

Explicitly out of scope and not started, per the wave brief: cloth and retarget.

## 10. Reproducing the measurements

```bash
PAK="D:/Steam/steamapps/common/Deadlock/game/citadel/pak01_dir.vpk"
VM="./resources/vpkmerge/vpkmerge-windows-x86_64.exe"

# clip discovery (what chooseRiggedClip ranks)
"$VM" model clips --vpk "$PAK" --hero astro --base "$PAK" --json

# static posed export (the fallback path)
"$VM" model export --vpk "$PAK" --hero astro --base "$PAK" \
  --pose --require-pose --out astro-static.glb

# rigged export (no --pose, exactly one --clip)
"$VM" model export --vpk "$PAK" --hero astro --base "$PAK" \
  --clip primary_stand_idle --out astro-rigged.glb
```

Substitute `bookworm` / `out_of_combat_stand_idle` and `gigawatt_prisoner` /
`primary_stand_idle` for the other two pilots. Structural counts in sections 2
and 3 come from parsing the GLB JSON chunk directly.
