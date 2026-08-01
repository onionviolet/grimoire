# Locker deep dive: make the model the stage, playable abilities, and honest failure states

Umbrella design document, tracked as #15. #13 (model panel modes) and #14
(backdrop framing) are the two tactical pieces it was written around; this is
the direction they should steer toward so the small fixes do not have to be
undone later. Their scope is unchanged by this document.

Every claim about the code carries a `file:line` verified against the working
tree on 2026-07-30. Sections that go past what was asked are marked
**Extrapolation**.

---

## Status since this was written

*Reconciliation pass, 2026-07-30, against the tree and the sibling plans. The
body below is unedited except where a claim went stale; each of those carries a
`Landed:` or `Resolved:` note inline. Read this section first, because three of
the things the body calls open are not open any more.*

**#13 landed.** `853ba98 feat(locker): give the 3D model panel dock modes and a
memory` shipped persisted open state, eight-way resize, and float / dock-left /
dock-right. The body describes #13 as uncommitted throughout; it is not. Two
follow-on claims died with it:

- The shared-storage-key bug is fixed. Both keys are now per-surface functions:
  `grimoire.${surface}.modelPanel.state` (`FloatingModelPanel.tsx:43`) and
  `grimoire.${surface}.modelPanel.open` (`useModelPanelOpen.ts:14`), with
  `LEGACY_GEOM_KEY` (`:46`) migrating parked panels. Locker and Foundry no
  longer disagree.
- The three missing i18n keys landed (`locker.model.dockLeft`, `.dockRight`,
  `.float`, `translation.json:2321-2323`). The inline-fallback pattern the body
  warns against is no longer present in the panel.

**Axis 4 is in flight, uncommitted.** `src/stores/poseFailureStore.ts` (new,
untracked) is the "badge on the skin card" row of the taxonomy, built the way
the body argues for: keyed by `metaKey`, persisted so the mark survives
navigation, self-healing on a later successful export, and written by
`HeroPoseViewer` narrowing the stack failure to a single VPK. That narrowing is
the part the body calls the non-obvious one. `HeroPoseViewer.tsx` carries +107
lines against `main`. This is #16.

**`prefers-reduced-motion` is being answered.** `src/lib/usePrefersReducedMotion.ts`
(new, untracked) extracts the live media-query hook out of `Browse.tsx`
explicitly because the 3D pose viewer needed the same answer. The body lists
this as an open question; it is being closed.

**The recipe-coverage contradiction resolves at 38.** `COLOR_CODENAME_BY_HERO`
holds exactly 38 entries (`heroColors.ts:56-108`), and `RECIPE_CACHE_VERSION`
is 7, whose own comment reads "full selectable-roster recipe coverage" (`:105`).
The "only `bookworm` and `unicorn` exist" line in `docs/ability-vfx-recolor.md`
is a stale bullet in that document's historical status log, not a competing
claim. Sizing that depends on recipe coverage can use 38.

**Line numbers into `HeroPoseViewer.tsx` have shifted.** The in-flight axis-4
work moved them by a few lines (`USE_EFFECT_PREVIEW` is now `:110`, not `:108`).
Every other file's references still resolve.

**Still true, re-verified:** `USE_EFFECT_PREVIEW` is `false`; `RELEASE_RENDER_FLAGS.rigged`
is `false`; `HeroPoseInfo` is still `{ hasModel, mtimeMs, key }` with nowhere to
put a reason (`types/portrait.ts:79-83`); `getHeroPoseClips`,
`BACKGROUND_CODENAME_BY_HERO` and `getHeroPanoramaBackdrop` return nothing
anywhere in `src` or `electron`.

---

## Premise

The Locker today is a competent list. You pick a hero, you get a grid of skins,
you toggle one on, and a 3D model is available as a side panel if you know to
open it (`LockerHero.tsx:335`, the `3D` pill). The four sections are Skins,
Sounds, Cards & portraits, Effects (`LockerHero.tsx:177`).

A skin, though, is three things: a body, a set of ability VFX, and a set of
sounds. The Locker shows you a thumbnail of the first one. Everything needed to
show the other two is already in the tree and mostly switched off:
`ParticleEffect.tsx` renders particle layers but is gated behind
`USE_EFFECT_PREVIEW = false` (`HeroPoseViewer.tsx:108`); the viewer holds an
`AnimationMixer` (`HeroPoseViewer.tsx:379`) that plays exactly one clip; the
backend can already enumerate a model's clips through
`vpkmerge model clips --json` (`heroPoseModels.ts:438`).

The target: open a hero and the model is the page rather than a widget in the
corner, and you can make it do things. Play an ability, see the particles that
ship with that skin, hear the sound that skin replaces, and find out
immediately when something is broken.

---

## The user's framing

Each direction below came from a specific request. Quoted verbatim, in the
order they were made.

> "it was the 'Skins: per-hero, with a live 3D pose preview'"

> "persist the toggle, but have it remember that it was on so it persists, but improve the preview dragger or add differentr styles of embedding into page in the future? Like from docked right stage to toggle and more?"

> "it feels like it could be more adjustable or more coherent with the rest of the work?"

> "consider improvements to the plan, logical stuff that adds convinience or coolness?"

> "add considerations maybe in seperate issue for Opacity adjustments for menus and more? since in a smaller scale the characters dont appear at all, so either a slider for that or have it scale with monitor size for a consistent intended look or somethjing idk"

> "more options and possbilities as well, from the backround replaced by the 3d model, showcasing animations on certain models(which would show extra particles and stuff?), like a proper locker deep dive? It can also show the effects of each ability and more, like play the relevant ability with the relevant cahracter model?"

> "We can even warn if a certain skin model isnt working in the locker too..."

> "do be inspired or use their work if necissary if its better"

"A proper locker deep dive" and "convinience or coolness" are the brief. The
rest of this document is the answer, and the sections below name which quote
each one is answering.

---

## Where the pixels go

*Answers: "the backround replaced by the 3d model", "it feels like it could be
more adjustable or more coherent", and the "characters dont appear at all"
report that became #14.*

This is the spine. Everything else is a feature; this is the surface those
features have to live on, and it is currently governed by three unrelated sets
of numbers.

### What is claiming the space today

| Layer | Sizing | Where |
| --- | --- | --- |
| Hero render backdrop | height-scaled, right-anchored: `h-full w-auto max-w-none` | `HeroDetailFrame.tsx:117` |
| Per-skin backdrop image (#208) | cover-fitted, centered: `h-full w-full object-cover` | `HeroDetailFrame.tsx:116` |
| Frosted veil | fixed pixels: `lg:w-[1040px] xl:w-[1160px]` | `HeroDetailFrame.tsx:146` |
| Veil feather stops | percentages of that fixed width (42/94, 32/78, 26/60) | `HeroDetailFrame.tsx:153`, `:162`, `:171` |
| Rail | `lg:w-[300px] xl:w-[340px]` | `HeroDetailFrame.tsx:186` |
| Content pane | `lg:w-[480px] xl:w-[540px]` (capped mode) | `HeroDetailFrame.tsx:254` |
| Model panel | free-floating `360x460` default, or a docked stage of `dockW` | `FloatingModelPanel.tsx:45`, `:247` |

Two facts fall out of that table that are worth stating plainly.

**The backdrop slot already holds two incompatible compositions.** A per-skin
image is `object-cover` and a hero render is right-anchored height-scale
(`HeroDetailFrame.tsx:114-118`). One slot, one prop, two contracts, chosen by
whether `backdropImage` is set. Adding a 3D model as a third occupant without
resolving this is how #14 happens again.

**The calibrated framing table exists and this surface does not use it.**
`HERO_FACE_POSITION` (`lockerUtils.ts:55`) holds hand-calibrated x/y/shiftX for
38 heroes, and `getHeroFacePosition` is consumed by the Locker grid
(`Locker.tsx:2434`, `:2683`), Browse (`Browse.tsx:4177`), Installed
(`Installed.tsx:7130`) and the sidebar (`Sidebar.tsx:275`).
`HeroDetailFrame.tsx` imports only `getHeroNamePath` (`:3`). The one surface
where the hero art is the subject is the one surface flying blind.

### The proposal: one stage box, three consumers

**Extrapolation** (the request said "the backround replaced by the 3d model";
the mechanism below is not the requester's words).

Introduce a single module, `src/lib/heroStage.ts`, that owns the composition
and is read by the 2D backdrop, the veil, and the model stage. Nothing else
computes these numbers.

| Token | Value | Read by |
| --- | --- | --- |
| `veilWidth` | `clamp(680px, 56vw, 1160px)` (#14 option 1) | veil container, `HeroDetailFrame.tsx:146` |
| `clearZoneStart` | `veilWidth * 0.94` (the heaviest layer's transparent stop, `:153`) | model stage left edge, 2D subject anchor |
| `subjectX` | `getHeroFacePosition(hero).x` | 2D `object-position`, 3D camera target |
| `plateKind` | `render` \| `skinImage` \| `model` | the backdrop slot |

`plateKind` is the important one: it replaces "is `backdropImage` set" with a
typed descriptor, so each plate declares its own anchoring instead of the slot
inferring it. The model becomes a third plate rather than a panel drawn on top
of a plate.

**Landed 2026-07-30.** [src/lib/heroStage.ts](../src/lib/heroStage.ts) owns all
four tokens and `HeroDetailFrame` reads it for both the plate and the veil. The
adoption is behaviour-preserving by design and was verified as such against the
running build: the veil resolves to the same 806.58px at 1440 with the same
three blur/mask pairs, and the render plate keeps
`absolute top-0 right-0 h-full w-auto max-w-none`. Three things are worth
knowing about what did and did not change:

- `clearZoneStart` is **derived** from the heaviest layer's `clearStopPct`
  rather than written down as `0.94`, because a token whose whole job is to say
  "the blur has finished here" must not be able to disagree with the mask. It is
  published on the frame root as `--hero-stage-clear-zone-start`, so a
  descendant can respect the clear zone without importing the veil.
  **It got its first consumer the same day** (#10 Part 2, plan doc A2d-part2):
  Foundry's portrait empty state, which the fluid content pane was centring onto
  unblurred hero art. That consumer needed a second derived token,
  `veiledContentWidth`, and building it corrected the arithmetic twice. The
  offset from the stage's left edge to the content is the **wider** rail (340px,
  not 300px: available width is the clear zone *minus* the rail, so assuming a
  narrow rail is the optimistic error) **plus the pane's own 24px padding**.
  Measured against the running veil at 1440, both corrections were worth exactly
  the 40px and 24px they sound like, and the block's right edge then landed on
  the clear stop to the pixel. Two lessons for the next consumer: the cap is a
  `lg:` class, not an inline style, because below `lg` the plate and veil are
  `hidden` and capping would only narrow the content for nothing; and the class
  is a **literal** string, because Tailwind scans source text and never
  generated the utility while the class name was interpolated from the variable
  constant. `max-width` stayed `none` and the failure was silent. A test pins
  the literal to the variable name.
- `subjectX` ships as the single source but has **no runtime consumer yet**, and
  that is deliberate. The `render` plate is height-scaled with no `object-fit`,
  so an `object-position` on it does nothing, and re-anchoring it would reframe
  all 38 heroes at once: a design change, not a refactor. The `skinImage` plate
  stays centred because the table was calibrated against the bundled hero
  renders and that art is mod-authored. Its first real consumer is the model
  camera.
- The Locker grid (`Locker.tsx:1836`) has a **second** frosted veil with the
  same three blur radii and deliberately shorter tapers, because it backs a
  300px sidebar rather than a 300px rail plus a 480px pane. That is a variant,
  not drift. `heroStage.ts` says so in a comment so nobody unifies them by
  pointing the grid at `HERO_STAGE_VEIL`.

Then the three questions the request implies, answered rather than noted:

**Does the model inherit the right-anchored, height-scaled composition?**
Yes, but expressed as camera framing, not CSS. The 2D art is right-anchored
because the subject sits at a roughly fixed distance from the right edge; a 3D
camera can put the subject exactly there, which is strictly better. Concretely,
the canvas fills the plate and the camera targets `subjectX` so the hero lands
in the same place the 2D art was calibrated to. `HERO_FACE_POSITION` gives the
starting value per hero; the model does not need a second calibration table.

**What happens to the veil's blur over a live canvas?** Do not put it there.
This is a real cost and it is not the canvas: today the veil's three stacked
`backdrop-filter` layers (48px, 24px, 10px at `HeroDetailFrame.tsx:151`, `:160`,
`:169`) sample a static `<img>`, so the compositor blurs once and reuses the
result. Sampling a WebGL canvas that repaints every frame invalidates that
every frame, over a region roughly `veilWidth` by viewport height, three times
per frame. The fix is compositional rather than a perf tweak: the masks already
reach full transparency at 94%, 78% and 60% (`:153`, `:162`, `:171`), so if the
model is framed to sit entirely right of `clearZoneStart`, the blur samples
what it samples today on the left, which is the solid `bg-primary`
(`HeroDetailFrame.tsx:109`). If a hero's framing genuinely needs to extend
under the veil, drop to the single 10px layer for that hero rather than
accepting three. Measure before defaulting either way; see Risks.

**Measured 2026-07-30, and the measurement did not answer the question.**
[tools/veil-blur-bench.js](../tools/veil-blur-bench.js) puts a canvas that
dirties its whole surface every frame into the plate position and samples 240
`requestAnimationFrame` deltas per condition, on the real stage (1216x900 CSS at
DPR 1.24, clear zone 758px). Every condition landed between 10.2 and 11.0 ms
mean, roughly 92-97 fps:

| Condition | Mean | p95 |
| --- | --- | --- |
| A. Static `<img>` plate, three layers (today) | 10.28 ms | 14.6 ms |
| B. Repainting canvas spanning the stage, three layers | 10.81 ms | 15.0 ms |
| C. Same canvas, veil hidden | 10.25 ms | 15.2 ms |
| D. Same canvas, one blur layer | 10.95 ms | 15.4 ms |
| E. Canvas framed right of `clearZoneStart`, three layers | 10.98 ms | 14.9 ms |
| F. **Positive control:** canvas spanning the stage, blur radii quadrupled to 192/96/40px | 10.74 ms | 15.0 ms |

**F is the row that matters, and it failed.** Quadrupling the blur radius over a
repainting canvas cost nothing, and hiding the veil entirely (C) cost nothing
either. A harness that cannot see a 4x blur cannot be trusted to have seen a 1x
one, so the flat B/D/E rows are not evidence that blur over a canvas is cheap.
They are evidence that on this machine the frame loop is bounded by vsync at
about 100 Hz and by the main-thread canvas paint, with the compositor's blur
work never on the critical path.

So the risk register's question stands, and its phrasing was already right: this
needs **a low-end GPU**, where the ceiling is low enough for the blur to reach
it. What this run does establish is a method and a null baseline on capable
hardware, plus the harness to re-run in one command. It also lines up with the
Axis 2 gate: both blockers here are readings a human has to take on real
hardware, not code anyone can write.

The compositional fix in the paragraph above is unaffected either way. Framing
the model right of `clearZoneStart` makes the veil sample what it already
samples, so it is correct by construction and costs nothing to adopt while the
measurement is outstanding.

**What is the fallback when a hero has no recipe?** The 2D plate, unchanged and
without an error. This is already the shape upstream chose: `--require-pose`
makes clipless WIP heroes fall back to the 2D portrait instead of rendering a
static T-pose (`heroPoseModels.ts:87`, and `upstream/feat/hero-pose-locker`
`492f276`). "Not posable" is a normal state of the world, not a failure, and
the Honesty surfaces section keeps it out of the error taxonomy on purpose.

One more piece of upstream work belongs here: `f91b9a1` on
`upstream/feat/locker-3d-card-snapshots` adds `BACKGROUND_CODENAME_BY_HERO` and
`getHeroPanoramaBackdrop`, resolving the hero-select `_bg` art rather than the
`_card` portrait, precisely because the card art has a character baked into it.
A 3D model standing in front of a 2D copy of itself is the failure mode that
change exists to prevent. If the model becomes a plate, the plate behind it
should be the panorama `_bg`, not the render. Take that work; do not rewrite it.

### Effect on both surfaces

`HeroDetailFrame` backs the Locker hero page (`LockerHero.tsx:260`) and the
Foundry hero workshop (`HeroWorkshop.tsx:194`), and both mount
`FloatingModelPanel` (`LockerHero.tsx:357`, `HeroWorkshop.tsx:274`) into the
frame's `after` slot (`HeroDetailFrame.tsx:260`). So:

- Any stage-box change lands on Foundry the same day it lands on the Locker.
  Foundry uses `contentWidth="fluid"` (`HeroDetailFrame.tsx:65`) so its content
  pane takes the remaining width; `clearZoneStart` has to be derived from the
  veil, not from the content pane, or the two surfaces diverge again.
- `after` is a sibling of the content pane inside the flex row, which is why a
  docked stage overlays the cards instead of reflowing them. #13 lists that as
  an open decision and it stays #13's call; the stage box just has to work
  either way.
- ~~Worth fixing while in here: `FloatingModelPanel`'s doc comment says mode and
  geometry persist "per surface" but `STORAGE_KEY` is a shared constant.~~
  **Resolved:** `853ba98` made both keys per-surface functions
  (`FloatingModelPanel.tsx:43`, `useModelPanelOpen.ts:14`), so the stage
  proposal does not inherit this. Kept in the record because the stage box must
  stay per-surface too: Locker and Foundry are separate habits.

### The veil control

#14 option 3 proposes a Settings > Appearance slider for veil intensity, and
that is the right home for "or have it scale with monitor size for a consistent
intended look". The stage box is the "scale with monitor size" half
(`56vw` is exactly that); the slider is the taste half. Both, in that order:
the slider is a control on top of a correct composition, not a workaround for
an incorrect one.

---

## What the model can do

*Answers: "showcasing animations on certain models(which would show extra
particles and stuff?)" and "play the relevant ability with the relevant
cahracter model?"*

Animation, VFX and sound are grouped because they share a pipeline (`vpkmerge`
against the user's own VPKs, cached per hero and skin stack) and a failure
mode (per-hero coverage that is uneven and has to be admitted in the UI).

### Animation: two different features wearing one name

The existing issue treated "showcasing animations" as a pipeline gap. Checking
the pin changes the answer. The bundled binary is `v0.19.0`
(`scripts/fetch-vpkmerge.mjs:19`), and the main process already:

- runs `vpkmerge model clips --json` and parses `name`, `frameCount`, `fps`,
  `durationSeconds`, `looping`, `default` (`heroPoseModels.ts:339`, `:372`,
  `:443`);
- ranks those clips and picks one, scoring `idle` and `looping` up and
  `ability`/`attack`/`cast`/`death` down (`heroPoseModels.ts:401-419`,
  `chooseRiggedClip` at `:424`).

So enumeration is solved. What splits are the two things "showcase animations"
could mean:

**Pose cycling.** Bake a static still per clip and let the user flip through
them. `upstream/feat/locker-3d-card-snapshots` `f91b9a1` already built this: a
`getHeroPoseClips` IPC over the same model selector as the export, plus
prev/next chevrons and an `i/n` name pill, with clipless WIP heroes showing
"Default" only. None of `getHeroPoseClips`, `BACKGROUND_CODENAME_BY_HERO` or
`getHeroPanoramaBackdrop` exist in `main` (grep returns nothing). This is the
cheapest real answer to the request and it is already written.

**Live playback.** Play the clip. The viewer is close: `RiggedModel` builds a
mixer and loops one clip (`HeroPoseViewer.tsx:406-422`), normalizing from the
bind pose so the model does not drift (`:384-398`). But the rigged path is
gated off in release (`RELEASE_RENDER_FLAGS.rigged: false`,
`HeroPoseViewer.tsx:116`) with the reason stated at `:951-953`: the idle anim is
WIP and too many heroes fall back to A-pose. `pickIdleClip`
(`HeroPoseViewer.tsx:249`) takes one clip and the loader stores exactly one
(`setClips([clip])`, `:977`), so the viewer-side change is small once the
pipeline ships more than one.

The reason to keep these separate is cost. Each GLB runs 50-95 MB and every
hero-plus-stack combination gets its own entry, which is why the cache has a
byte cap at all after an observed 1.7 GB (`heroPoseModels.ts:456-459`). Pose
cycling multiplies that by the clip count if it bakes per clip. Live playback
does not, because one rigged GLB carries the clip. So:

1. Adopt upstream pose cycling first (it exists, it is honest about clipless
   heroes, and it needs no new pipeline work).
2. Then un-gate the rigged path, following the sequence
   [rigged-preview-spike.md](./rigged-preview-spike.md) already established
   rather than inventing one here (see below).
3. Only then consider exporting several clips into one GLB, and measure the
   size before committing to it.

**Reconciled with the spike.** This document's first draft proposed un-gating
per hero, on the model of `MODEL_ENTRY_OVERRIDES` (`heroPoseModels.ts:92`).
That is not the plan of record and should not become one.
[rigged-preview-spike.md](./rigged-preview-spike.md) section 9 measured the
rigged path across three pilots and recommends shipping it gated, with an
explicit four-step unblock. Its state today:

| Spike step | Status |
| --- | --- |
| 1. Decouple `riggedPreviewEnabled` from `clothPreviewEnabled` | **Done**, 2026-07-28. Rigged has its own switch, and the code comment at `HeroPoseViewer.tsx:117-118` says so |
| 2. A human measures Seven (`gigawatt_prisoner`, the worst case on every axis), section 8 check 3 | **Not done. This is the gate**, and it is the single blocker named in `feature-status.md` item 1c |
| 3. If frame time is within ~1 ms, sweep `model clips --json` across the roster and record which heroes yield no animated clip | Blocked on 2. Cheap: one call per hero, no export |
| 4. Only then consider defaulting on, and whether the static GLB can be dropped once a hero's rigged export is known good | Blocked on 3 |

Two corrections fall out. The gate is **an fps reading on real hardware**, not
the A-pose fallback quality the viewer comment cites; the spike found the
fallback logic sound across all four failure modes. And step 3 is a
**roster-wide sweep**, which is the honest way to learn which heroes are
clipless: a hand-maintained per-hero override list is what the sweep exists to
avoid. The per-hero-gate idea is withdrawn.

Also worth taking from the spike rather than re-deriving: the rigged GLB is a
**sibling** of the static one and the static one has to stay as the fallback, so
cache pressure roughly doubles per hero. That sharpens the cache risk below.

### Ability VFX: staged from the code's own roadmap

`ParticleEffect.tsx`'s header comment (`:1-23`) is already a plan. It states
what it does (a CPU sprite sim driving custom-shader `THREE.Points`, sprite
layers only, rope/model/light skipped) and names its own gaps at `:10-15`:
frame-exact playback via three.quarks or full operator mapping, anchoring to
the hand attachment via control-point injection, and the
`RandomColor`/`ColorInterpolate` tint. Today layers spawn at the model origin
with the descriptor's constant color.

Converted to staged work, with the order argued:

| Stage | Work | Why here |
| --- | --- | --- |
| 1 | Turn it on. `USE_EFFECT_PREVIEW` is `false` (`HeroPoseViewer.tsx:108`) and only curated heroes have a bundle (`:1055-1079`, `info.entry` null for everyone else at `:1062`). | Nothing downstream is verifiable while the feature is dark. |
| 2 | Control-point injection: anchor layers at the attachment instead of the model origin. | Particles in the wrong place during a cast read worse than no particles. Position errors are legible at a glance; rate errors are not. |
| 3 | `RandomColor` / `ColorInterpolate` tint operators. | This is what the Effects tab edits. `HeroEffectsPanel` drives the particle recolor slot (`HeroEffectsPanel.tsx:11-21`), and the recolor works by patching exactly these color scalars (`docs/ability-vfx-recolor.md`, "Recolor by in place scalar patch"). Until the preview honors the tint, the recolor UI is editing a value the preview ignores. |
| 4 | Frame-exact playback (three.quarks / operator mapping). | Largest, and the least visible once 2 and 3 land. The header already calls the current sim "preview-grade, not engine-faithful" (`ParticleEffect.tsx:9`) and that is an acceptable resting state. |

Stage 3 is the one that changes what the app is for: today you pick a hue for a
hero's abilities and cannot see it until you launch the game. Recolor plus a
tint-honoring preview is a live preview of the thing you are editing.

### "Play the relevant ability with the relevant cahracter model"

This is animation and particles fired together, so it sits after both. The
harder half is what "relevant" resolves to.

**It resolves through a table that already exists.** `HERO_ABILITY_SLOTS`
(`heroAbilitySlots.ts:20`) maps each hero's sound codename to four ability
slots (4 = ultimate), each carrying `token` (the internal name), `display` (the
localized name) and `image` (a deadlock-api icon URL). It was generated from
`docs/per-ability-sound-map.json` and validated at 97% file-level accuracy
(`heroAbilitySlots.ts:1-13`). So an ability slot already knows its own name,
its dev token and its icon.

From that token, both halves are reachable:

- **Particles:** `particles/abilities/<codename>/` is the hero's ability
  particle root (`docs/ability-vfx-recolor.md`, "Where ability VFX live"), and
  the files inside are named around the same dev tokens.
- **Animation:** clip names carry the same vocabulary. `riggedClipScore`
  already tokenizes clip names and matches `ability`, `cast`, `attack` on them
  (`heroPoseModels.ts:412`, `clipNameHas` at `:393`). The scorer pushes those
  down because it wants an idle; an ability picker wants the same tokens
  pushed up.

**The genuine difficulty is that these are three different codename
namespaces.** The sound codename keys `HERO_ABILITY_SLOTS`; the model and
particle codename is separate (Paige is `bookworm`, and
`docs/ability-vfx-recolor.md` warns in as many words that this is "NOT the
sound codename"); and upstream's `f91b9a1` adds a third for backgrounds (Paige
card/model `bookworm` versus background `patience`). "Relevant" means joining
three namespaces per hero. That join, not the playback, is the work. It should
be one table with one row per hero and an explicit null where a namespace is
unknown, because a wrong join here silently plays another hero's effect.

**Built 2026-07-30, and the premise above was wrong in one respect: it is four
namespaces, not three.** [src/lib/heroCodenames.ts](../src/lib/heroCodenames.ts)
is the join. What the tree actually says, once the three tables it folds are put
side by side, is that "the model codename" was two different strings wearing one
name:

| Column | Namespace | Owned by |
| --- | --- | --- |
| `panorama` | `panorama/images/heroes/<x>_*`, API `class_name` | `heroPortraitIdentity.ts` (aliases live there too) |
| `sound` | `sounds/abilities/<x>/`, keys `HERO_ABILITY_SLOTS` | `heroSoundCodenames.ts` |
| `particle` | `particles/abilities/<x>/`, and the `recolor-hero` recipe key | **this table** (was `COLOR_CODENAME_BY_HERO` in `heroColors.ts`) |
| `bodyModel` | the `<x>.vmdl_c` basename under `models/heroes*` | **this table** (was `MODEL_CODENAME_OVERRIDES` in `heroPoseModels.ts`) |
| `background` | hero-select `_bg` art | **this table**, null everywhere but Paige until `f91b9a1` lands |

Six heroes diverge, and only six:

| Hero | panorama | sound | particle | bodyModel |
| --- | --- | --- | --- | --- |
| Abrams | `atlas` | `abrams` | `abrams` | `atlas_detective` |
| Grey Talon | `orion` | `orion` | `archer` | `archer` |
| McGinnis | `forge` | `forge` | `mcginnis` | `engineer` |
| Mo & Krill | `krill` | `mokrill` | `digger` | `digger` |
| Pocket | `synth` | `synth` | `pocket` | `synth` |
| Seven | `gigawatt` | `gigawatt` | `gigawatt` | `gigawatt_prisoner` |

Three observations worth keeping:

- **Mo & Krill and Abrams each use three distinct names across four
  namespaces.** Every other hero on the roster agrees with itself, which is
  exactly why a join written from one hero's example passes review.
- **Pocket diverges on `particle` only** (`pocket`, not `synth`), so a rule of
  the form "the particle codename is the model codename" is wrong even for
  heroes whose body model needs no override.
- **The five sound-only rows** (Fathom, Kali, Tokamak, Trapper, Wrecker) have a
  `sound` codename and null everywhere else. Their sound mods must still
  classify, and nothing else about them may be assumed. That is why the columns
  are nullable per column rather than per row, and why `translateHeroCodename`
  returns null instead of echoing its input: an echo is what would send the app
  looking for `particles/abilities/fathom/`.

`heroColors.ts` and `heroPoseModels.ts` now read the join rather than carrying
their own tables, and the change is behaviour-preserving:
`heroCodenames.test.ts` pins the five body-model overrides and the 38 recolor
recipe keys to exactly what those files listed by hand. It also checks the two
columns the join does *not* own against their owning tables in both directions,
so a hero added to `heroSoundCodenames.ts` alone fails CI rather than resolving
to the wrong asset at runtime, and it asserts that no codename in any namespace
is claimed by two heroes.

Everything above is data, so it landed ahead of the stage box exactly as the
sequencing said it could. What it does **not** do is decide anything about
playback: no clip is selected, no particle is fired, and `USE_EFFECT_PREVIEW` is
still `false`.

**Where it belongs in the UI: on the stage.** Argued, not just noted.

The rail's four sections are Skins, Sounds, Cards & portraits, Effects
(`LockerHero.tsx:177-189`). Ability playback does not belong in Effects,
because Effects is an editor for two persistent applied slots
(`HeroEffectsPanel.tsx:11-21`: the ability recolor slot in pak03 and the body
and gun paint in pak04), and playback changes nothing persistent. It does not
belong in a new section either: `docs/design-overhaul-brief.md:110-113` says a
section body renders content and nothing else, and a fifth section whose whole
job is to drive a region owned by the shell inverts that. It also would not be
reachable from Skins, which is exactly where you want to press it, because you
are comparing skins.

So: a four-slot ability rail on the stage, using the icons already in
`HERO_ABILITY_SLOTS`, visible whenever the stage is up and independent of which
section is selected. Effects gets a "preview on the model" affordance that
drives the same stage control rather than owning a second one. This also
satisfies the shell rule's first invariant (`design-overhaul-brief.md:118`):
switching sections must not change the shell, and the stage is shell.

### Sound

*Answers the third leg of the same request.*

The Sounds section already exists and already groups per hero, with categories
`ability`, `voice`, `weapon`, `movement`, `unclassified`
(`HeroSoundShelf.tsx:34`) and a per-ability picker below the installed rows
whose purpose is stated as choosing "the source Grimoire applies for each
ability" (`HeroSoundShelf.tsx:173-181`).

Concretely, how an ability preview triggers the matching sound:

1. The stage's ability button carries a slot (1-4) from `HERO_ABILITY_SLOTS`.
2. Playback asks for the source the Locker would actually apply for that slot,
   which is the same selection `HeroSoundPicker` manages, not the raw file from
   whichever mod happens to be enabled. Previewing something other than what
   would ship is worse than previewing nothing.
3. Resolution of a file to a slot already exists: `resolveAbilitySlot`
   (`abilitySounds.ts:90`) resolves per file via an `aN` path token, a curated
   override, a display-name or token match, then a stem match
   (`abilitySounds.ts:15-27`).

**When a skin replaces some sounds but not others** (the normal case, since the
classifier attributes each file independently and reports per-hero
contributions rather than collapsing to one hero, `abilitySounds.ts:29-33`):
the ability rail should mark per slot whether the audio is modded or vanilla,
and play the base game audio for unmodded slots. If base audio is not
extractable for a slot, play nothing and say so. Playing vanilla audio
unlabelled, next to a modded model, is a quiet lie about what the user
installed. **Extrapolation:** the per-slot modded/vanilla marker and the
base-audio fallback are not in the request.

---

## Honesty surfaces

*Answers: "We can even warn if a certain skin model isnt working in the locker
too..."*

This is the highest value per unit of effort in the document, it is independent
of every 3D feature above, and it is sized accordingly.

### What happens today

One string, for everything. `HeroPoseFailureState` renders
`t('locker.pose.cannotPose')` (`HeroPoseViewer.tsx:1081-1083`), which reads
"This hero can't be posed in 3D yet." (`src/locales/en/translation.json:2198`).
It is reached from a bare `catch` that sets `failed` on any throw
(`HeroPoseViewer.tsx:1021-1026`).

The main process distinguishes more than that and the renderer discards it:

- No game path configured: `get-hero-pose-info` returns `hasModel: false` with
  an empty key (`ipc/portraits.ts:131-133`) and `export-hero-pose` throws
  "No Deadlock path configured" (`:146`).
- No usable clip on a rigged export: returns `hasModel: false` rather than
  throwing (`heroPoseModels.ts:1011-1013`).
- Everything else: rethrows the underlying error, or a generic
  "Failed to export rigged model" (`heroPoseModels.ts:1014-1017`).

And the contract cannot carry the difference anyway: `HeroPoseInfo` is
`{ hasModel, mtimeMs, key }` (`types/portrait.ts:79-83`). There is no field for
why.

### The taxonomy

| Case | What it means | Where it appears | Next action |
| --- | --- | --- | --- |
| No game path | Nothing can resolve | Viewer, one line | Link to Settings |
| Hero not posable | No pose clip for this hero (e.g. Billy's `punkgoat` ships the rig but no pose clip, `heroPoseModels.ts:89-90`) | 2D plate, quiet note. Not an error | None. This is a normal state |
| Hero unsupported for effects | No pinned recolor recipe | Already gated in the Effects section (`HeroEffectsPanel.tsx:33-44`) | None |
| **This skin's model fails** | The mod is likely broken or built for an older game version | **Badge on the skin card**, plus the viewer | Disable the skin, open Conflicts, re-export |
| Our extraction failed | Our problem, often transient | Viewer, with the error text | Retry, plus a copyable diagnostic |

The fourth row is the one worth building. A badge on the card in the grid means
you find out before you launch the game, which is the entire point of a locker.
It also composes with Conflicts, which is the app's other "something is wrong
with your setup" surface.

### What it takes

Two changes, both small and both prerequisites for anything user-visible.

**1. The contract carries a reason.** `HeroPoseInfo` (`types/portrait.ts:79`)
gains a discriminated `reason` for the not-`hasModel` case, and the export path
returns it instead of throwing an untyped `Error`
(`heroPoseModels.ts:1014-1017`). The viewer's catch-all
(`HeroPoseViewer.tsx:1021-1026`) then narrows to genuinely unexpected failures.

**2. Per-skin attribution.** This is the part that is not obvious. The viewer
exports a *merged stack*: every enabled visual VPK for the hero, ordered by
priority (`LockerHero.tsx:149-156`), keyed by the whole stack
(`HeroPoseViewer.tsx:874`). So a failure today is attributable to the stack,
not to a skin, and a card badge needs per-skin truth.

The cheap honest version, **extrapolation**: on a stack failure, retry with the
single-skin fallback that the contract already carries
(`fallbackSkinMetaKey`, built at `LockerHero.tsx:139-144` and threaded through
`exportHeroPose`). If the single skin also fails, badge that skin. If it
succeeds, the stack is at fault rather than any one skin, which is a different
and equally worth-saying message ("these skins do not combine"), and one that
the existing `HeroSkinOverlapPanel` (`LockerHero.tsx:396`) is already the right
home for. A full bisect over the stack is the thorough version and should wait
for evidence that the cheap one is not enough.

Copy for all of this needs real keys in `src/locales/en/translation.json`; per
`CLAUDE.md` that file is the only translatable catalog and `pnpm i18n:check`
gates it. ~~#13 is already blocked on three missing keys.~~ **Resolved:**
`locker.model.dockLeft`, `.float` and `.dockRight` landed with `853ba98`
(`translation.json:2321-2323`). The rule stands for the copy this document
adds: real keys, not inline `t(key, 'fallback')` pairs.

**Status:** in flight as #16, uncommitted. `src/stores/poseFailureStore.ts`
implements the per-skin mark (change 2 above) including the single-skin
narrowing; change 1, the typed `reason` on `HeroPoseInfo`, is not done, so the
taxonomy's other four rows still collapse into one string.

---

## What the user sees, start to finish

*The cohesion check. A plan that cannot be narrated is a pile of features.*

1. You open the Locker and pick Paige. The page is her, full bleed. On a
   1920-wide window and on a 1440-wide one the framing is the same because the
   veil is `56vw`-derived rather than 1040px, and her face is where it was
   calibrated to be rather than behind the frost (this is #14, fixed).
2. The model is already up, because it was up last time (#13's persisted open
   state, `useModelPanelOpen.ts:24`). It is a plate, not a panel: no title bar,
   no drop shadow, standing where the 2D art stood. Behind it is the panorama
   `_bg`, so there is no second Paige in the picture.
3. Left rail: Skins, Sounds, Cards & portraits, Effects, unchanged. The skins
   list is the content pane, unchanged. One card carries a small warning badge:
   that skin's model does not export.
4. Over the stage, low and unobtrusive, four ability icons and a small clip
   pill. The four are from `HERO_ABILITY_SLOTS`. The pill says which pose you
   are looking at, with chevrons.
5. You click ability 2. The model plays the cast, the particles fire at her
   hand rather than at her feet, and the sound plays: the source the Locker
   would actually apply, with a small marker saying slot 2 is modded and slot 3
   is vanilla. It ends and she returns to idle.
6. You switch to Effects and drag the hue slider. The particles on the stage
   change color as you drag, because the preview honors the tint operators. You
   press Apply and it bakes.
7. You click the badged skin card. It says this skin's model failed to export,
   offers Retry, and offers to disable it.
8. You press the stage's close control. It goes away and stays away next visit,
   because that is remembered too.

Nothing in that walkthrough requires a section that does not exist, and nothing
requires the shell to change when a section does.

---

## Upstream work to fold in

*Answers the standing instruction: "do be inspired or use their work if
necissary if its better".*

All three are unmerged branches on `Slush97/grimoire`, and none of these
commits are ancestors of `main` (verified with `git merge-base --is-ancestor`).

| Branch | Commit | What to take |
| --- | --- | --- |
| `feat/locker-3d-card-snapshots` | `f91b9a1` | `getHeroPoseClips` IPC over `vpkmerge model clips --json` plus prev/next pose chevrons (this is the clip picker, already built); `BACKGROUND_CODENAME_BY_HERO` and `getHeroPanoramaBackdrop` (the character-free plate); the preview crop fix |
| `feat/locker-3d-card-snapshots` | `6b3fc52` | `HeroCardBaker`: one reused offscreen `WebGLRenderer` for the whole session, cached IBL probe, canvas sized to the backdrop aspect. Relevant even if card baking is out of scope, because it is the pattern for not leaking a renderer per surface |
| `feat/hero-pose-locker` | `492f276` | `--require-pose` so clipless WIP heroes fall back to 2D instead of a T-pose, plus `POSE_CACHE_VERSION` with a `.cache-version` sidecar. The 2D fallback is the "Hero not posable" row of the taxonomy above |
| `feat/hero-pose-locker` | `c21909f` | Settings card for the local preview cache (size plus one-click clear over hero-poses, soul-models, portrait-cache, locker-card-thumbs). Directly mitigates the cache-growth risk below |
| `fix/hero-framing-regression` | `aac7c7c` | Calibrated per-hero framing restored for hero surfaces (it is the Appearance art path, `AppearanceArtSection.tsx`, not `HeroDetailFrame`). Read before writing #14 option 2, because it is the same `HERO_FACE_POSITION` calibration this document proposes to route into the stage box |

`main` is ~175 ahead / 12 behind `upstream/main` with merge-base `1612680`, and
the 12 upstream commits are already present as re-authored commits, so a plain
merge conflicts on work that is effectively already applied. **Do not propose a
merge.** That reconciliation is deliberately deferred; take these as cherry
picks or re-authored changes, with attribution in the commit message.

---

## Sequencing and dependencies

Order matters here more than usual, because two of these items make the others
either cheap or expensive.

1. **Stage box first** (composition). Not because it is the biggest, but
   because everything else claims space on it. Building an ability rail and a
   clip pill into a 360x460 floating panel (`FloatingModelPanel.tsx:45`) means
   building them twice. This also closes #14 on the way past.
2. **Failure taxonomy in parallel.** It touches `HeroPoseInfo`, the export
   return path and the skin card. It shares no files with the composition work,
   it is the highest value per effort item here, and it does not depend on any
   3D feature landing.
3. **Adopt upstream pose cycling** (`f91b9a1`) once the stage exists. It is
   written, it is honest about clipless heroes, and it answers "showcasing
   animations" without a pipeline change.
4. **Particle anchoring before particle timing** (stage 2 before stage 4
   above). Particles at the wrong origin during a cast look worse than no
   particles.
5. **Tint operators before frame-exact playback** (stage 3 before stage 4). The
   tint is what the Effects tab edits, so it is the stage that turns a preview
   into a live editor.
6. **Live clip playback after all of the above**, and it does not start with
   code. It starts with one person taking one frame-time reading on Seven per
   section 8 of [rigged-preview-spike.md](./rigged-preview-spike.md). That
   measurement gates the whole axis, it is the oldest open item in
   `feature-status.md` (1c), and it needs no work from this document to happen.
   It could be taken today.
7. **Ability playback**, which is the sum of 4, 5 and 6 plus the three-namespace
   join.
8. **Sound last.** It is wiring, and it needs the ability rail from 7 to hang
   off.

The one hard dependency worth naming: 7 cannot start before the codename join
exists, and that join is a data problem, not a rendering problem. It can be
built and tested at any point, including now.

---

## Risks and open questions

**Blur over a moving surface.** The `backdrop-filter` stack blurs a static
image once today. Over a live canvas it is per frame, three layers deep, over
roughly `veilWidth` by viewport height. The stage box is designed so the model
sits outside the blurred region, but that has to be measured on a low-end GPU
before 3D becomes the default presentation rather than assumed from the
geometry. If it does not hold, the fallback ladder is: one blur layer instead of
three, then a static blurred snapshot, then keep the panel.

Attempted on 2026-07-30 with [tools/veil-blur-bench.js](../tools/veil-blur-bench.js)
and **still open**: on this desktop GPU the positive control (4x blur radii)
was free, so the harness could not resolve blur cost at all. Details in Axis 1.
The low-end reading is the remaining gate, alongside Axis 2's fps reading on
Seven. Both are human measurements on real hardware.

**Cache growth.** Each pose GLB is 50-95 MB and every hero-plus-stack
combination is its own entry; the byte cap exists because 1.7 GB was observed
(`heroPoseModels.ts:456-459`). Anything that multiplies entries per clip has to
account for that. Two things sharpen this since the first draft: the rigged GLB
is a sibling of the static one and the static one must stay as the fallback, so
enabling live playback roughly **doubles** per-hero cache cost
([rigged-preview-spike.md](./rigged-preview-spike.md) section 9), and against a
2 GB cap that means more frequent LRU eviction for anyone who browses a lot.
Upstream `c21909f` (clear preview cache) is the mitigation and should land
alongside.

**~~Per-hero coverage is uneven and the docs disagree with themselves.~~
Resolved: 38.** `COLOR_CODENAME_BY_HERO` holds exactly 38 entries
(`heroColors.ts:56-108`) and `RECIPE_CACHE_VERSION` is 7, described in its own
comment as "full selectable-roster recipe coverage" (`:105`). The competing
"only `bookworm` and `unicorn` exist" line was a stale bullet in
`docs/ability-vfx-recolor.md`'s historical status log, now corrected there.
Size against 38. The UI still has to be honest about the gaps, the way
`getHeroColorSupport` already gates the Effects tab
(`HeroEffectsPanel.tsx:33-44`).

**Making 3D the default costs on every hero open.** The three.js chunk is lazy
(`LockerHero.tsx:24`) and today that laziness is hidden by the panel being
closed. A settings escape hatch pairs naturally with #14's veil slider: one
Appearance section that owns how much the hero surfaces cost you.

**Open: does the docked stage reflow the content or overlay it?** #13's
decision, unresolved there. The stage box works either way; noting it so it
does not get decided twice.

**~~Open:~~ `prefers-reduced-motion`.** The turntable started spinning
unconditionally (`spinPaused` is `useState(false)`, `HeroPoseViewer.tsx:871`).
**Being closed:** `src/lib/usePrefersReducedMotion.ts` (uncommitted) extracts
the live media-query hook out of `Browse.tsx` for exactly this. The rule it
establishes is the one this document inherits: CSS animation is already covered
by the stylesheet, but anything driven from JS, a three.js turntable or a
particle sim, has to ask for itself. Ability playback and particle emission must
both respect it when they land, and a user-initiated ability press is a
different case from ambient motion: honor the press, do not autoplay.

**~~Open: the shared panel storage key.~~ Resolved** by `853ba98`. Both keys
are per-surface now. See Status above.

---

## Explicitly out of scope

An umbrella issue without a boundary is a wishlist.

- **In-engine fidelity.** The particle preview is preview-grade by design
  (`ParticleEffect.tsx:9`). Matching the engine exactly is not a goal at any
  stage, including stage 4.
- **Authoring.** Editing, retargeting or creating animations. This is a viewer.
- **A particle engine port.** Stage 4 is operator mapping for the layers that
  already render, not general Source 2 particle support. Rope, model and light
  layers stay skipped (`ParticleEffect.tsx:6-7`).
- **Video, GIF or screenshot export** from the stage. Card baking is upstream
  work with its own scope (`6b3fc52`), not part of this.
- **Camera choreography.** Scripted camera moves, hero-select style intros,
  cinematic framing per ability. The camera targets `subjectX` and otherwise
  the user orbits.
- **Non-hero stages.** Soul containers, weapon models and global mods do not
  get a stage from this work.
- **Fork reconciliation.** Deliberately deferred (see Upstream). This document
  cherry picks; it does not merge.
- **The 2D grid.** Locker grid card layout, thumbnails and card baking are
  their own surfaces. The only thing this work adds to a grid card is the
  broken-skin badge.

---

## Cross references

Issues:

- **#13** owned the panel: persisted open state, dock modes, resize. **Landed**
  as `853ba98`. What survives it is the open question of whether a docked stage
  reflows the content or overlays it, which the stage box works either way.
- **#14** owns the veil-versus-art mismatch. The stage box is the shared set of
  numbers it asks for, and its option 3 (an Appearance slider) is where the
  requested opacity control belongs.
- **#16** is the honesty-surfaces section, spun out. In flight, uncommitted.

Documents. This one is the umbrella; where it disagrees with these on their own
subject, they win, and the disagreement is a bug in this file:

- [rigged-preview-spike.md](./rigged-preview-spike.md) is the authority on live
  clip playback. It has measurements this document does not, and its section 9
  is the sequence of record for un-gating the rigged path.
- [feature-status.md](./feature-status.md) is the authority on what is shipped
  versus dark. Item 1c is the fps-measurement gate; item 5 is the standing
  entry for animated previews and ability VFX.
- [3d-preview-fidelity-plan.md](./3d-preview-fidelity-plan.md) is the authority
  on renderer fidelity, materials parity, and what hits a ceiling in Three.js.
  Its Phase 0 spike results already answer several "can we" questions.
- [ability-vfx-recolor.md](./ability-vfx-recolor.md) is the authority on the
  particle pipeline and the codename namespaces. Read it before touching the
  three-namespace join, which is the real work in ability playback.
- [hero-pose-locker.md](./hero-pose-locker.md) is the authority on the pose
  export itself and on the hero-namespace traps.
- [design-overhaul-brief.md](./design-overhaul-brief.md) supplies the shell rule
  the stage has to satisfy: switching sections must not change the shell.
- [locker-foundry-parity-plan.md](./locker-foundry-parity-plan.md) is why every
  stage change lands on Foundry the same day. Its invariant governs here too.
