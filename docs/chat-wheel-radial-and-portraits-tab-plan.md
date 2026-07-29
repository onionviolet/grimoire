# Plan: authentic radial chat wheel preview + a Portraits tab in Foundry

Status: **both lanes landed 2026-07-29** (same day as authoring); see the
worklog notes inline and the Pass 2 section at the end for what comes next.
Two independent lanes; they share no code.

## Lane A: Chat wheel maker, the real circular wheel from the game

### Where we are

The Chat Wheel page ([src/pages/ChatWheel.tsx](../src/pages/ChatWheel.tsx))
fakes the wheel with a 3x3 CSS grid: 8 rectangular buttons placed around a
center cell (`gridSlots = [1, 2, 5, 8, 7, 6, 3, 0]`, lines 327-336). It works
as a slot picker but looks nothing like the in-game Source 2 radial menu the
YAML actually drives, so users cannot judge label fit, slot order, or which
wedge a command lands on.

### Target

A preview that mirrors Deadlock's circular chat wheel: a donut of 8 wedge
sectors starting at the top and going clockwise, labels drawn inside each
wedge, a center hub with the menu name/icon, hover and selection highlighting
the wedge. Where the game files are available, dress it with the game's own
wheel art and the real ChatLane icon set; degrade to a clean pure-SVG wheel
when they are not.

### Steps

1. **Geometry core (pure, tested).** New `src/lib/chatWheelGeometry.ts`:
   wedge path math (SVG arc path for sector i of n, inner/outer radius),
   slot index -> angle mapping (slot 0 at 12 o'clock, clockwise, matching the
   in-game order ChatLane targets), label anchor position per wedge, and a
   "does this label fit" measure hook point. Vitest coverage beside it
   (`chatWheelGeometry.test.ts`), same style as
   [chatWheelModel.test.ts](../src/lib/chatWheelModel.test.ts).
   Verify the in-game slot order empirically before hardcoding it: build a
   wheel with numbered commands via the existing Save & install flow and
   screenshot it in game; record the finding as a comment in the geometry
   module.

2. **RadialWheelPreview component.** New
   `src/components/chatwheel/RadialWheelPreview.tsx` rendering the SVG donut:
   - 8 clickable wedges (`<path role="button">`), keyboard focusable, wired to
     the existing `selectPreviewSlot` / `focusedItem` state so the
     click-a-slot-to-edit flow is unchanged.
   - Empty slots render a muted wedge with a `+`.
   - Center hub: menu name, and the menu icon once step 4 lands.
   - Hover state mirrors the in-game highlight (wedge fill + label brighten).
   - Replaces the grid block in `ChatWheel.tsx`; no state model changes.

3. **Slot-count honesty.** The in-game wheel shows a fixed 8 slots; the YAML
   accepts any number of items. The preview should render `min(items, 8)` and
   show an inline warning when a menu holds more than 8 commands ("the game
   shows only the first 8"), instead of silently dropping them. Confirm the
   actual ChatLane/game cap in the RedMser/ChatLane docs first; if the cap is
   different, follow reality.

4. **Icon picker instead of free text.** The `icon:` field is a bare text
   input today. Enumerate the icon names ChatLane accepts (from the ChatLane
   repo/docs plus the bundled converter's resources) into a typed list, turn
   the input into a datalist/dropdown with a live thumbnail, and show the
   chosen icon in the wheel hub. Unknown values stay allowed (Advanced YAML
   remains the source of truth).

5. **Optional game-asset dressing (spike first).** The Foundry texture
   pipeline can already decode any `.vtex_c` from the user's pak to PNG
   (`foundryFullImage`, thumbnail cache). Spike: search the catalog for the
   chat wheel's panorama art (`vpkmerge catalog texture --search wheel` and
   browsing `panorama/images/hud/`). If the wheel backplate/line art and the
   stock icon set are extractable, add a main-process helper (reuse the
   existing foundry services; do not duplicate decode code) that serves them
   to the Chat Wheel page, gated on a configured game path. The SVG wheel is
   the permanent fallback: no game path, no Foundry flag, or decode failure
   all land there. Keep this step last; the pure SVG wheel alone is already
   the bulk of the win.

6. **i18n + polish.** New strings go in
   `src/locales/en/translation.json` under `chatWheel.*`; run
   `pnpm i18n:check`. Verify with the dev driver:
   `node scripts/dev-driver.mjs route chatwheel` then `text`/`shot` the
   preview, plus an in-game check of a saved wheel against the preview.

Out of scope for this lane: drag-to-reorder commands on the wheel and editing
`override_bindable`/ping wheel from the form. Both are natural follow-ups once
the radial surface exists.

## Lane B: Foundry (Door Stuck), a first-class Portraits tab

### Where we are

The portrait tooling is already strong
([PortraitEditor.tsx](../src/components/foundry/PortraitEditor.tsx):
aspect-locked crop, whole portrait family staging with variant coverage) but
it is buried: the only way in is the Library grid in catalog mode
([LibraryBrowse.tsx:183](../src/components/foundry/LibraryBrowse.tsx)), after
filtering to hero images and recognizing which card is a portrait base. The
hero workshop's "Icons & Textures" section mixes portraits in with ability
icons and everything else.

### Target

A dedicated Portraits surface in both Foundry modes: a `portraits` sub-tool in
the catalog rail and a `portraits` section in the hero workshop rail. It shows
one card per portrait family per hero (base thumbnail, variant-count badge,
coverage-gap flag), and clicking a card opens the existing `PortraitEditor`
directly.

### Steps

1. **Family grouping helper (pure, tested).** Extend
   [portraitFamily.ts](../src/components/foundry/portraitFamily.ts) with a
   `groupPortraitFamilies(catalog)` that folds hero-image entries into
   `{ hero, base, variants[] }` records, reusing the existing discovery logic
   rather than re-deriving it. Tests beside the existing
   `portraitFamily.test.ts`.

2. **PortraitBrowse component.** New
   `src/components/foundry/PortraitBrowse.tsx`: loads the hero-image category
   (same IPC as LibraryBrowse), renders the family cards with the shared
   thumbnail plumbing, hero filter + search, and opens `PortraitEditor`
   pre-seeded with the family. Staging hands `VisualStagedEdit[]` to the same
   `onStage` build-tray callback; nothing new on the main side.

3. **Wire the catalog rail.** Add
   `{ id: 'portraits', icon: UserSquare, labelKey: 'foundry.subtools.portraits' }`
   to `SUBTOOLS` in [Foundry.tsx](../src/pages/Foundry.tsx) and render
   `PortraitBrowse` for it. Point `subtoolForChangeFilter('hero-image')` at
   `'portraits'` so "make a new one" from My changes lands on the new tab.

4. **Wire the hero workshop.** Add a `portraits` entry to `SectionId` and the
   `sections` array in
   [HeroWorkshop.tsx](../src/components/foundry/HeroWorkshop.tsx), rendering
   `PortraitBrowse` scoped to the open hero. Keep "Icons & Textures" for
   ability/item icons and everything else; portraits simply stop being its
   job.

5. **i18n + naming.** Only translation keys are added; the surface inherits
   whatever the catalog calls Foundry ("Door Stuck" today, per
   `sidebar.foundry` / `settings.experimental.foundry`). Run
   `pnpm i18n:check` and `pnpm i18n:manifest` if catalogs change.

6. **Verify.** Dev driver: `route foundry`, click into the Portraits tab and
   a hero workshop, confirm a staged family shows in the build tray, then
   forge-install and check My changes lists it.

### Open questions (decide during implementation, none block the start)

- Should the Locker's hero-card picker link to the new tab the way it links
  to the workshop today (`/foundry?hero=`)? Cheap to add via a
  `?section=portraits` query once the section exists.
- Whether the family card should offer the Locker-style "source an image
  without a file drop" intake now or wait for the parity lane already tracked
  in [locker-foundry-parity-plan.md](./locker-foundry-parity-plan.md) (lane 4
  covers exactly that). Recommendation: wait; do not fork that work here.

### Worklog (what actually landed, 2026-07-29)

Both lanes shipped as planned, with two findings that changed details:

- **ChatLane wheels hold up to 12 entries and fill the whole circle** (not a
  fixed 8), so the preview renders one equal wedge per command
  (`src/lib/chatWheelGeometry.ts`, `RadialWheelPreview.tsx`). The valid icon
  names come from ChatLane's own `icon_db.gd` (11 names) and the SVGs are
  vendored under `src/assets/chatlane-icons/` (MIT; noted in
  third-party-notices).
- **`portraitFamilyKey` never matched real pak filenames.** Live entries look
  like `astro_card_gloat_psd.vtex_c` (source-format token, sometimes a
  trailing content hash), so every portrait was silently a family of one,
  including in the existing editor preflight. The key now strips the
  hash/format tail and knows the live state vocabulary (card / card_gloat /
  card_critical / mm / sm / vertical). This widened the preflight family on
  purpose: it is the set the editor was always documented to cover.

## Pass 2: catalog identity, exploration, and the installed-mod side

Captured from review feedback on the landed lanes. These are planned, not
started. Ordered roughly by leverage.

### 1. Human names and personal tags for visual assets (sound-annotation parity)

Sounds already have `SoundAnnotation` (personal name / note / tags per event,
searchable). Portraits and textures deserve the same:

- Generalize the annotation store keying (`soundAnnotations.ts`) to accept
  catalog entry paths, or add a parallel `visualAnnotations` file with the
  same shape; surface an edit affordance on family cards and in the lightbox.
- Ship better *default* labels first: the variant chips now say Hero card /
  Critical / Gloat, but `mm` and `sm` still show raw tokens because their HUD
  role is unverified. Verify in game where `mm`/`sm`/`vertical` actually
  render (minimap? scoreboard? top bar?) and give them honest labels plus a
  tooltip carrying the raw token.

### 2. Text improvement pass for sounds

The sound browse labels are event names turned to prose, which is honest but
uneven ("ability special cast 03"). Plan:

- A curated overrides layer (shipping with the app, separate from personal
  annotations) for the highest-traffic events: ults, footsteps, weapon fire.
- Better prose transforms: expand known abbreviations, group takes ("01/02/03"
  becomes one row with a take count) so search results stop triplicating.
- Sorting by usefulness: category weights (ability > weapon > movement) and
  take-collapsing before alphabetical order.

### 3. Usefulness sorting and per-hero identity

- Family cards already sort state families before single-file art; extend the
  same idea inside the card (chips ordered card, critical, gloat, vertical,
  sm, mm) and across tools (assets a mod actually overrides sort first, see
  item 5).
- The hero workshop's Portraits section is the "individual character profile"
  surface; deepen it with the hero's backgrounds and gun art grouped under
  headings instead of mixed cards, and cross-link: Locker hero page gains a
  "Portraits in Foundry" jump (`/foundry?hero=X&section=portraits`), and the
  Foundry family card links back to the Locker card picker when a custom card
  is already installed.

### 4. Randomized portraits (ride the launch shuffle)

Sounds get randomizer pools natively; textures cannot, the game reads one
file. But Grimoire already shuffles Locker skins at launch (see
`launch.toast.shufflePartial`), so portrait randomization is the same trick:
mark several forged portrait mods as one shuffle group and let the launch
flow pick one per session. Needs: a shuffle-group field on managed visual
mods, and Locker/Foundry UI to bundle staged portrait families into a group.

### 5. The installed-mod side (like Global sounds, but for what you have)

Today the catalog browses the *base game*; the only mod awareness is the
staging preflight. Make installed content a first-class browse axis:

- A "Modded" filter/badge in PortraitBrowse and LibraryBrowse: which families
  does an installed VPK currently write, and which mod wins each variant
  (the `foundryInspectAssetSources` data, batched across the visible grid).
- Per-family source panel mirroring the sound-conflict inspector: every
  contender, enabled state, priority, and the winning layer, with jump-to-mod.
- The reverse view under My changes: pick an installed mod and see the
  catalog entries it overrides, rendered as the same family cards.

### 6. Rebalancing modding vs exploration (datamining is a real use)

The catalog is already a decent datamining surface (76K voice lines, 12.5K
textures, offline, version-true). Lean into exploration without diluting the
forge:

- Keep Foundry's default framing as "change things", but add an explicit
  read-only Explore posture: an Inspect mode toggle (or a per-card "inspect"
  action) that opens full-size decode, entry path, dimensions, and source pak
  without any stage affordance in reach.
- Exploration features that cost little: copy entry path, export decoded PNG
  or clip, "what changed this patch" (the catalog cache already fingerprints
  the build; diff two fingerprints into an added/removed/changed list, which
  is genuinely valuable to dataminers after every update).
- Consider surfacing unreleased-hero art (the roster already knows
  `inDevelopment`) behind the same experimental gate as the tab itself.
- The line to hold: exploration never installs, never stages, and never needs
  a warning dialog. If a surface can only look, it should not be able to
  touch, which is also what makes it safe to hand to the curious.
