# Locker and Foundry: parity plan

Why the two hero surfaces have different quality in the same app, and the
sequence that closes it.

**Read first:** [feature-status.md](./feature-status.md) for the delivery
contract, and [foundry-changes-parallel-plan.md](./foundry-changes-parallel-plan.md)
for the lane format this document follows. The invariant that governs every lane
here is the same one: **exact normalized VPK entry paths are the ownership key.
Labels, hero names, and mod metadata are never a substitute. Installed/Locker
remains the only authority for enabled state.**

Unlike that document, these lanes are **sequential**. Lane 1 is a prerequisite
for the rest, and lanes 2 through 5 each assume the shell it extracts.

## The thesis

Locker and Foundry are not two products that might one day relate. They are one
object at two moments: Locker manages what you have, Foundry makes more of it.
The wiring already exists in both directions:

- `HeroWorkshop.tsx` imports `HeroEffectsPanel` and `HeroSoundPicker` directly
  out of `src/components/locker/`.
- `PortraitEditor.tsx` renders `LockerImageCropper`.
- `LockerHero.tsx:419` links to the hero's Foundry workshop, and
  `Foundry.tsx:139` resolves the `?hero=` query that link produces.

The problem is that each surface learned only half of the same lesson.

**Locker learned preview.** It can show you the thing before you commit: the 3D
`HeroPoseViewer` over the live enabled-skin stack, per-skin backdrops and card
images, live trippy parameters pushed into the viewer before anything is
written. But every Locker action applies immediately. Click a sound, it writes a
managed mod. There is no write set, no collision report, no review.

**Foundry learned review.** `buildTray.ts` computes an exact normalized write
set, ranks collisions with a stable tie break, refuses to forge an edit whose
source file moved, and `foundryInspectAssetSources` reports which installed mods
already own a path. And the user authors all of it blind: staging a texture,
portrait, or recolor gives back a thumbnail and nothing else.

Every lane below is one half of that trade.

## Ground truth

Read from the working tree on 2026-07-29.

- `LockerHero.tsx:277-400` and `HeroWorkshop.tsx:129-229` are the same component
  written twice: right-anchored render backdrop, error-fallback chain, masked
  frosted-glass stack, left rail with hero name art and section nav, 280 to
  340px rail widths.
- They have already drifted. Locker stacks three masked blur layers (48px, 24px,
  10px) plus a five-stop gradient; Foundry has one 40px blur plus a four-stop
  gradient. Locker's render fallback is four steps (render, wiki, `hero.iconUrl`,
  give up); Foundry's is three and has no icon step. The Locker version is the
  better one in both cases.
- `HeroPoseViewer` is referenced from exactly one place outside its own module:
  `LockerHero.tsx:511`. Foundry has no live preview of anything.
- `HeroPoseSkinSource` is `{ metaKey, priority }`, and
  `heroPoseModels.ts:608 resolveSources` is the single place a metaKey becomes an
  on-disk path. Anything the viewer can preview must currently be an *installed*
  mod.
- `foundryForge.ts:86 buildFoundryForgeVpk(deadlockPath, request)` already
  returns `{ vpkPath, cleanup }`. The build-to-a-temp-VPK half of a preview
  already exists and is used by the export path.
- `heroPoseModels.ts:628 fingerprintResolved` keys the pose cache on each
  source's `(metaKey, size, mtime)`. A rebuilt temp VPK therefore invalidates the
  cache for free, with no new invalidation rule.
- `FoundryHeroGrid.tsx` has search and nothing else: no favorites, no per-hero
  change count, and a hardcoded English `in development` at line 106 that is
  outside `t()`.
- `MyChanges` already accepts a `heroName` prop (`HeroWorkshop.tsx:264`), so
  per-hero authored-change counts are derivable from data that already exists.

## Lane board

| Lane | Direction | Owns | Must not touch | Done when |
| --- | --- | --- | --- | --- |
| 1 - shared hero frame | both | backdrop, glass, rail, nav chrome | any section's contents or behaviour | both pages render the same frame and the drift is gone |
| 2 - preview the tray | Foundry gets Locker's preview | ad-hoc VPK pose sources, preview lifecycle | the staging contract, installed state | a staged visual edit is visible on the 3D model before forging |
| 3 - review before write | Locker gets Foundry's review | pre-write disclosure on Locker actions | the tray, the forge, ownership rules | a Locker action that overwrites says so first |
| 4 - portrait family + sourcing | both | `HeroCardPicker`, `PortraitEditor` image intake | `visualEdits.ts` staging contract | Locker knows portraits have variants; Foundry can source without a file drop |
| 5 - grid state | Foundry gets Locker's grid | `FoundryHeroGrid` | roster loading in `Foundry.tsx` | a hero card shows what you have already made for them |

Run in order. Lanes 2 through 5 are independent of each other once lane 1 lands,
so they may be parallelised at that point if desired, but each one assumes the
extracted frame.

---

## Lane 1 - one hero frame, not two copies

`src/pages/LockerHero.tsx` and `src/components/foundry/HeroWorkshop.tsx` render
the same chrome around different sections, and the copies have drifted so that
Foundry's version is visibly lower quality than Locker's. Every later lane adds
to that chrome, so extracting it first is what stops the drift from doubling.

1. Extract `src/components/common/HeroDetailFrame.tsx` owning exactly the shared
   chrome and nothing else:
   - The full-bleed backdrop image, right-anchored, `h-full w-auto max-w-none`,
     with the fallback chain. Take **Locker's** four-step chain (render, wiki,
     caller-supplied icon, text), with the icon step optional so Foundry can pass
     `getHeroChipIconPath` (which `FoundryHeroGrid` already uses) or nothing.
   - The masked frosted-glass stack. Take **Locker's** three-blur version
     verbatim, including the comment at `LockerHero.tsx:340` explaining why
     stacked blurs feather rather than cliff. That reasoning is the reason the
     Locker version looks better and it must survive the move.
   - The left rail: back button, hero name art with its `nameFailed` text
     fallback, and a `<nav>` that renders caller-supplied section rows.
   - The bottom depth gradient and the `animate-hero-zoom-in` /
     `animate-slide-in-left` entrances.
2. Keep the frame ignorant of both domains. It takes `heroName`, an optional
   backdrop override, section descriptors (`id`, `label`, `icon`, optional
   `count`, optional `disabled`), the active id, an `onBack`, and slots for
   rail-extra content, top-right controls, and the content pane. It must not
   import from `stores/appStore`, `types/mod`, or `types/foundry`.
3. Port `LockerHero.tsx` to it first, since it is the source of the better
   chrome, then `HeroWorkshop.tsx`. Locker keeps its own rail extras
   (`SkinLoadOrderStrip`) and top-right controls (Locker-image button, 3D
   toggle) through the slots. Foundry keeps its build-tray toggle the same way.
4. Preserve the behaviour that is genuinely per-page and must not be flattened
   into the frame: Locker's `hideHeroName` (issue #208, hides the name art when
   a custom backdrop already shows it), Locker's disabled-section styling, and
   Foundry's `linkedHero` back-navigation that clears the `?hero=` query.
5. Verify with the dev driver rather than by eye:
   ```bash
   GRIMOIRE_DEV_CDP_PORT=9222 pnpm dev
   ```
   ```bash
   node scripts/dev-driver.mjs route foundry
   ```
   Check that both pages report the same rail width and the same number of
   backdrop-filter layers, and screenshot both for the record.

Done when both hero surfaces render from one component, the three-blur stack and
four-step fallback apply to both, and no visual regression appears in either.

---

## Lane 2 - preview what is in the tray

**Depends on lane 1.**

This is the largest quality gap in the app. Foundry stages texture, portrait, and
recolor edits, and the only feedback before forging is a thumbnail. Locker has a
working 3D preview of a whole VPK stack ten files away.

The blocker is that `HeroPoseSkinSource` is `{ metaKey, priority }` and a metaKey
resolves through `heroPoseModels.ts:608 resolveSources` to an *installed* mod.
The tray's write set is not installed and must never become installed just to be
previewed.

1. Widen the pose source to admit a path that no mod owns. Add a discriminated
   variant to `HeroPoseSkinSource` (`src/types/portrait.ts:56` and the main-side
   copy at `heroPoseModels.ts:131`) carrying an explicit VPK path, and teach
   `resolveSources` to pass it through instead of calling `resolveSkinVpk`. Every
   other consumer keeps working because the metaKey variant is unchanged.
2. Check `fingerprintResolved` (`heroPoseModels.ts:628`) handles the new variant.
   It already keys on `(metaKey, size, mtime)`, so a rebuilt temp VPK invalidates
   the pose cache with no new rule. Substitute a stable identifier for `metaKey`
   in the path variant and keep size and mtime. **Do not** add a bespoke
   invalidation path; the point of this step is that the existing one already
   covers it.
3. Add a preview build to the forge service reusing
   `foundryForge.ts:86 buildFoundryForgeVpk`, which already returns
   `{ vpkPath, cleanup }`. Expose it over IPC as an explicitly temporary build:
   it writes only into the build temp, it never touches the addons folder, it
   never calls `loadMods`, and its `cleanup` runs when the preview closes or is
   superseded. A preview that can leave a file in the addons folder is a bug, not
   a feature, and should have a test asserting the addons folder is untouched.
4. Wire it into `HeroWorkshop`: a 3D toggle in the frame's top-right slot (lane 1
   gives you the slot, Locker gives you the button), opening `FloatingModelPanel`
   with `HeroPoseViewer`, sourced from the preview VPK stacked *above* the user's
   currently enabled skins for that hero. Stacking above matters: the preview
   must answer "what will this look like in my game", not "what does this look
   like on a vanilla model".
5. Debounce the rebuild. Every staged edit should not trigger a VPK build.
   Rebuild on tray change with a delay, and show the viewer's existing loading
   state while it runs.
6. Keep the panel lazy exactly as Locker does (`LockerHero.tsx:23`,
   `lazy(() => import(...))`). The three.js chunk must not enter the Foundry
   bundle for users who never open the preview.

Done when staging a texture edit and opening the 3D panel shows that edit on the
model, closing the panel removes the temp build, and the addons folder is
provably unchanged throughout.

---

## Lane 3 - Locker says what it is about to overwrite

**Depends on lane 1.**

`HeroSoundPicker` and `HeroEffectsPanel` write a managed mod on click. In Foundry
those same two components sit next to a tray that would have shown the collision
first. In Locker the user discovers the overlap later, on a different page.

1. Dock `AssetSourcesPanel` into the Locker hero view's Skins section. It already
   takes `paths: string[]` and does its own on-demand VPK-directory scan, and
   `sourceGating.ts` already scopes the unreadable-VPK block to the ambiguous
   action rather than the whole panel (lane B of the earlier plan). Feed it the
   entry paths of the hero's enabled skins.
2. This tells the user *which exact entries* two stacked skins fight over.
   `SkinLoadOrderStrip` already tells them *that* two skins are stacked. Those
   two belong next to each other and currently live on different pages.
3. For the immediate-apply actions, disclose before writing rather than after.
   Reuse `analyzeStagedEdits` from `buildTray.ts` (it is pure, takes
   `{ affectedFiles, precedence }`, and has no Foundry dependency) to compute
   what a Locker sound or effects apply would overwrite, and show it inline.
   Confirmation is a judgement call: prefer showing the consequence next to the
   control over adding a modal to a flow whose speed is the point.
4. Do not move the write itself into the Foundry tray. Locker's immediate-apply
   is a deliberate design choice for managing installed mods; this lane makes it
   informed, not deferred.

Done when a Locker hero page can answer "what else already writes these files"
without navigating to Conflicts, and an apply that will overwrite says so at the
point of action.

---

## Lane 4 - portrait families and image sourcing, both directions

**Depends on lane 1.** Genuinely two-way: each surface has the half the other
is missing.

Foundry's `portraitFamily.ts` knows a portrait is a family (normal, low-HP,
gloat, minimap) and `portraitFamilyCoverageGap` refuses to stage a subset,
because delivering less than the preflight warned about is worse than delivering
nothing. Locker's `HeroCardPicker` sets one surface at a time with no notion that
variants exist.

Locker's `LockerModImagePicker` has a tabbed multi-target flow (3:4 grid
thumbnail, 16:9 card, 16:9 backdrop) and can pull an image out of the mod itself.
`PortraitEditor` borrowed only `LockerImageCropper` and requires a file drop
every single time.

1. Give `HeroCardPicker` family awareness. `portraitFamily.ts` is generic over
   its item type (`PortraitVariant<T>`), so this is a reuse, not a port. Where a
   Locker card surface has variants, list them and warn on partial coverage the
   same way the Foundry editor does.
2. Give `PortraitEditor` the Locker picker's image sourcing: choose from the
   mod's own images and from previously used images, not only a file drop. Keep
   the crop frame locked to the template's native aspect, which is the property
   `PortraitEditor` has and the Locker picker does not.
3. Do not merge the two components. They author different things (game asset
   entries versus Grimoire's own display images) and only the *intake* and the
   *family reasoning* are shared. Extract those two, leave the surfaces separate.
4. Staging must still run through `prepareVisualStagedEdit` unchanged. There is
   one install path and this lane does not add a second.

Done when Locker warns about an incompletely covered portrait family, and the
Foundry portrait editor can be driven without leaving the app for a file picker.

---

## Lane 5 - the Foundry grid should show what you have made

**Depends on lane 1.** Smallest lane, and the fastest to land.

`FoundryHeroGrid` is a search box and a roster. The Locker grid shows counts and
favorites. Foundry already has the data for both and uses neither.

1. Badge each hero card with that hero's authored-change count. `MyChanges`
   already accepts `heroName` (`HeroWorkshop.tsx:264`), so the per-hero scoping
   exists; lift the count out of whatever `MyChanges` uses rather than adding a
   second query path.
2. Add favorites, mirroring the Locker grid's behaviour and persistence so the
   same hero starred in one place reads as starred in the other. If the Locker
   favorite store is Locker-scoped, share it rather than adding a parallel one.
3. Fix the hardcoded `in development` string at `FoundryHeroGrid.tsx:106`: give
   it a real key in `src/locales/en/translation.json` and delete any matching
   `unwired.*` entry in `src/locales/unwired-en.json`. Run `pnpm i18n:check` and
   `pnpm i18n:manifest`, both of which are CI and pre-push gates.
4. While in this file, take the frame's fallback chain if lane 1 exported the
   helper, so the grid and the detail view degrade identically.

Done when opening Foundry shows at a glance which heroes you have already made
things for, and `pnpm i18n:check` passes.

---

## What this deliberately does not do

- **It does not merge the two pages.** They answer different questions. Sharing
  the frame is what makes them feel like one app; sharing the route would make
  both worse.
- **It does not move Locker's writes into the Foundry tray.** Immediate-apply is
  correct for managing installed mods. Lane 3 informs it rather than deferring
  it.
- **It does not let a preview install anything.** Lane 2's temp build is
  temporary in the strong sense: the addons folder is untouched and there is a
  test that says so.
