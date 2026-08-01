# Plan: coherent Global inventory, sound taxonomy, and portrait/source UX

## Status: do not merge the surfaces yet

The screenshots expose a real information-architecture problem, but they do
not by themselves prove that Locker and Foundry should become one component.
This document is therefore decision-gated: first compare the existing flows,
then prototype one shared shell before moving data or deleting a route.

The current direction to test is:

1. **Global should feel like one inventory.** It may use an `All content |
   Visuals | Sounds` filter, but it should not strand someone in an empty sound
   category while hiding the global content that is already installed.
2. **`Shared` and `Shared melee` should not be user-facing categories.**
   "Shared" currently means that the classifier saw `shared`, `generic`, or
   `common` in a name and could not say what the sound is. That is an
   implementation fallback, not a content type. Every player melee/punch event
   belongs in **Melee**. Truly unclassified files need an explicit review state,
   not a vague `Other` bucket.
3. **Portraits need a single understandable journey before their code is
   consolidated.** Locker's installed portrait management and Foundry's game
   catalog/crop/build work may remain separate implementations behind a shared
   hero shell. A full merge is an option to evaluate, not an assumption.

The current layout is technically one Global drill-in with `Visuals | Sounds`
tabs, but the screenshots show why that still reads as two disconnected areas:
the Sounds tab starts on an empty category and hides both the global inventory
and the reason a category exists.

## ~~Known issue: Global sound categorisation~~ FIXED in Pass B (a87eb6e)

**The classification half is resolved 2026-07-30 by `a87eb6e` ("classify global
sounds on what mods write, not what they were called").** The section below is
kept as the diagnosis it was written to be.

Closed: **defects 1, 2, and 3** (the Announcer dumping ground, the `Shared` /
`Shared melee` leak, and the empty `NPC` category).

Still open, because they are layout rather than classification and belong to
Stage 1 in Pass C, both re-confirmed live after the fix:

- **Defect 4.** Empty categories still render: the Sounds rail shows
  `Announcer 0` and `Ambience 0` alongside the populated ones.
- **Defect 5.** The Visuals rail still reads `... HUD 11 · Announcer / SFX 6 ·
  Killstreak Music 1`, and the header still says `20 mods` on Visuals against
  `15 mods` on Sounds for one inventory. Those are `globalType` buckets, a
  different axis from the sound categories this pass fixed, so nothing in
  `a87eb6e` could have moved them.
- **Defect 6.** `Pak92`/`Pak93` are still unusable as list entries. A naming
  problem, not a classification one; Stage 4.

Verified live in the dev build against the same 15 installed mods:

```
Announcer 0 · Music 4 · Interface 1 · Ambience 0 · NPC 2 · Items 6 ·
Melee 2 · Needs classification 0
```

Parry and charged melee under **Melee**, Sinners and the XP-trooper killsound
under **NPC**, and the Refresher/Magic Carpet/Colossus/Trophy Collector mods
under **Items**. `Shared`, `Shared melee`, and `Other` no longer exist as
categories. Every prediction in the audit below landed.

<details>
<summary>Original diagnosis (2026-07-29/30), kept for the record</summary>

Re-confirmed live on 2026-07-30, unchanged from the A0 capture. This is the
largest open user-visible defect in this plan and it is **not** part of Pass A,
because fixing labels before the classifier is agreed just moves rows around.
It is Stage 0 (evidence + rules) and lands in **Pass B**.

The rail today, with 15 global sound mods installed:

```
Announcer 6 · Music 5 · Interface 0 · Ambience 0 · NPC 0 · Items 0 ·
Shared melee 0 · Shared 0 · Other 4
```

What is wrong with it, in order of how badly it misleads:

1. **`Announcer` is a dumping ground.** Its six entries are the JoJo/Colossus
   loop, Magic Carpet Arabian Nights, JBL Speaker Magic Carpet, the Daft Punk
   Refresher, and two unnamed imported paks (`Pak92`, `Pak93`). None of those is
   an announcer. Four are music/killstreak; two are unclassified imports that
   landed here because nothing else claimed them.
2. **`Shared` and `Shared melee` are implementation leaks, not content types.**
   They exist because `classifySoundToken` returns `shared` for any token
   containing `shared|generic|common`, and the charged-melee pool lives in
   `sounds/player/melee/shared/`. Every one of those belongs in a **Melee**
   category, which currently exists in no vocabulary in the app.
3. **`NPC` is empty while `Other` holds the NPC content.** The Sinners/Breed and
   XP-trooper/creep-kill sounds are the four `Other` rows; `globalCategory` maps
   any GameBanana category containing `killsound` straight to `other`.
4. **Six of nine categories are empty and still rendered**, so the rail reads as
   mostly broken even where the classification is right.
5. **Sound categories are also in the Visuals rail** (`Announcer / SFX`,
   `Killstreak Music`), and the same six mods are counted in both, which is why
   the header says `20 mods` on Visuals and `15 mods` on Sounds for one
   inventory (S1, S4).
6. **`Pak92`/`Pak93` are unusable as list entries** whatever category they land
   in (Stage 4).

No database migration is needed for any of it: classification is computed at
render time, so fixing the rules reclassifies every existing install. See
Stage 0 for the rule changes and the fixture, Stage 1 for the one-inventory
rail, and Stage 4 for the unnamed-pak entries.

**The evidence Stage 0 needs already exists, and it is not the metadata.**
`SoundEntryRow` now reads the installed VPK directory (via the same
`list-unknown-mod-files` call the Installed page uses) whenever a mod recorded
no write set, so every one of those six Announcer rows names its entries on
expand:

| Row | Entries |
| --- | --- |
| JoJo Pillar man theme over Colossus loop | `armor.vsndevts_c`, `colossus_cast`, `colossus_lp` |
| Magic Carpet Arabian Nights | `magiccarpet_lp` |
| JBL Speaker Magic Carpet | `magiccarpet_lp` |
| One More Time (Daft Punk) Refresher | `refresher_cast`, `refresher_cast_delay` |
| `Pak92` | `armor.vsndevts_c`, `trophy_collector_proc` |
| `Pak93` | `refresher_cast`, `refresher_cast_delay` |

Every one is an **item** sound: Refresher, Magic Carpet, Colossus, Trophy
Collector, Armor. Not one is an announcer. So the Stage 0 classifier does not
need new plumbing or a re-inspect pass to fix this shelf, it needs to consult
the VPK entry list the row already reads, and the `Items` category that is
currently sitting at 0 is where all six belong.

Two more things fall out of the same read, both cheap and both already visible
in the UI:

- **The unnamed paks stop being unidentifiable.** `Pak92` and `Pak93` can be
  described by what they write, which is most of what Stage 4 wanted from a
  rename.
- **Two real collisions surface that nothing else reported.** `Pak93` writes the
  same `refresher_cast` as the Daft Punk mod and `Pak92` the same
  `armor.vsndevts_c` as the JoJo loop; the winner lookup labels both. A user
  with two enabled mods fighting over one sound previously had no way to see it
  from this surface.

</details>

## Pass A: evidence and a convergence decision (no product rewrite)

This is the next pass. It should produce a short decision record, screenshots,
and only low-risk diagnostic fixes. Do not start the taxonomy or portrait UI
implementation until it is complete.

### A0. Confirmed live in the dev build (2026-07-29)

Driven with `scripts/dev-driver.mjs` against the working tree. These are
observations, not inferences, and they replace several guesses below.

**Locker Global drill-in**

- The Sounds rail is `Announcer 6 · Music 5 · Interface 0 · Ambience 0 ·
  NPC 0 · Items 0 · Shared melee 0 · Shared 0 · Other 4`. Six of nine
  categories are empty and still rendered; `NPC` is empty while `Other`
  holds the four NPC-ish mods. The misclassification is exactly as predicted.
- **`Announcer` is a dumping ground, not just `Other`.** Its six entries are
  "JoJo Pillar man theme over Colossus loop", "Magic Carpet Arabian Nights",
  "JBL Speaker Magic Carpet", "One More Time (Daft Punk) Refresher", and two
  unnamed imported paks (`Pak92`, `Pak93`). Those are music/killstreak
  replacements and unclassified imports. Stage 0 must audit `announcer` with
  the same rigour as `shared`/`other`, and give imported paks with no
  recorded paths a real `Needs classification` home instead of a wrong one.
- **The header count is tab-scoped but reads as global.** It says
  `Global · 20 mods` on Visuals and `Global · 15 mods` on Sounds. The two sets
  also overlap: `Announcer / SFX 6` appears in the Visuals rail *and*
  `Announcer 6` in the Sounds rail, so the same mods are counted twice. This
  is the strongest single argument for the Stage 1 one-inventory model.
- **Sound categories are sitting in the Visuals rail**: `Announcer / SFX` and
  `Killstreak Music` appear alongside Soul Containers, Hideout, HUD, and Icon
  Packs. The Visuals/Sounds boundary is not real today.
- **The default selected category is the first one, empty or not.** Visuals
  opens on `Soul Containers (0 mods)` with an import-only empty state. Fixing
  the default to the first non-empty category is a one-line improvement worth
  landing in Pass A.
- The rail claims `4 categories` on the hero-grid tile while the drill-in
  renders seven Visual categories. One of the two counts is wrong.
- Dead `0:00` scrubbers on every unplayed row: confirmed.

**Foundry hero workshop (Abrams)**

- The Abrams `Icons & Textures` section really does show Holliday, Bebop, and
  Lash content. Four `<select>`s exist: the two `TextureBrowse` ones are
  correctly scoped to Abrams (two options each), and the `LibraryBrowse` hero
  filter has 47 options defaulted to `all`. Confirmed root cause.
- **The naive fix would produce an empty grid.** Abrams' codename is absent
  from the ability-icon hero options entirely, and hero attribution is sparse:
  232 ability icons total, only 4 attributed to `archer`. So scoping must mean
  "this hero's icons *plus* unattributed shared icons", and the real
  improvement is deriving hero attribution from an ability-to-hero mapping
  rather than from the asset path alone.
- **Raw codenames leak into that dropdown**: `archer`, `punkgoat`,
  `genericperson`, `grappler`, `duo`, `nano`, `unicorn` are listed next to
  real hero names, because the label falls back to the codename when the
  roster has no match. This is simultaneously a polish bug and the datamining
  signal from A3: those entries should be resolved where possible and
  otherwise explicitly grouped as unreleased/internal, not silently mixed in.

**Foundry base-game sound catalog**

- Its rail is `Interface · Music · Shop items · Gameplay · NPCs · Ambience ·
  Voice · Other` over 1115 sounds, grouped by path prefix. That is a **second,
  different sound taxonomy** from the Locker's installed-sound categories.
  Stage 0 must reconcile the two vocabularies (or state deliberately why a
  base-game catalog groups differently), otherwise "Melee" will exist in one
  surface and not the other.

**The mojibake does not reproduce in the dev build** because the working tree's
uncommitted changes already fix it. It reproduces in the packaged build, where
1511 corrupted text nodes are visible on the global sound catalog alone. Fully
diagnosed in A0c.

### A0b. Driving the packaged build (already possible, no code change)

The dev driver can inspect the **installed** app too, which matters because the
mojibake reproduces only there. The CDP gate in
[electron/main/index.ts:74](electron/main/index.ts:74) keys off
`process.env.GRIMOIRE_DEV_CDP_PORT` alone, not `is.dev`, so a packaged build
honours it when launched with the variable set. `scripts/dev-driver.mjs` reads
the same variable for its target port. The installed binary is at
`%LOCALAPPDATA%\Programs\grimoire\Grimoire.exe`.

Use a different port from the dev build so both can be open at once:

```bash
GRIMOIRE_DEV_CDP_PORT=9223 "$LOCALAPPDATA/Programs/grimoire/Grimoire.exe"
```

```bash
GRIMOIRE_DEV_CDP_PORT=9223 node scripts/dev-driver.mjs eval "document.body.innerText.includes('Â')"
```

**The two builds cannot run at once.** `app.requestSingleInstanceLock()` at
[electron/main/index.ts:469](electron/main/index.ts:469) makes the second
launch quit immediately, so stop the dev build (and any lingering `electron`
processes) before launching the packaged one, and vice versa. The packaged app
still prints `DevTools listening on ws://127.0.0.1:<port>` before quitting, so
a visible port line is not proof the window stayed open: confirm with
`dev-driver targets`, which reports the asar renderer path when it is really up.

Rules for using it, because this is the user's real installation and not a
sandbox:

- **Read-only by default.** `eval`, `text`, `html`, `route`, and `shot` only.
  Never `click` a control that changes mod state (enable/disable, delete,
  forge, install, Fix Configuration) in the packaged app; that is the user's
  live game setup, and the dev build is the place to test mutations.
- Confirm with the user before any packaged-app interaction that writes
  anything, and prefer reproducing the bug in the dev build first.
- The port evaluates arbitrary code in the renderer. It stays loopback-bound
  (the switch is already set), is set ad hoc on one launch, and is never
  written into a shortcut, a script, or the packaged config.
- Note the two known driver gotchas from prior sessions: `viewport` uses an
  Emulation override that Chromium reverts when the socket closes, so set the
  width and evaluate in one command; and `:focus`/`:focus-visible` never match
  while the Electron window is unfocused, so assert on generated CSS or
  behaviour instead of computed focus styles.
- Add a short "Driving the packaged build" note to `CLAUDE.md` once this is
  used, since the existing note says only that the port is never set in a
  packaged build, which reads as though it cannot be.

This path has already paid for itself: it produced the complete diagnosis in
A0c, which was unreachable from the dev build alone.

### A0c. The mojibake: solved, and it is a committed-source bug

Traced end to end using the packaged-build path from A0b. Earlier drafts of this
plan blamed the build pipeline. That was wrong.

**What the bytes say.** The packaged `app.asar` contains
`c3 82 c2 b7` where a middle dot belongs. That is the UTF-8 encoding of
`Â` + `·`, meaning the original correct `c2 b7` was decoded as Latin-1 and
re-encoded as UTF-8: classic double encoding, baked into the artifact. The
corruption is narrow and specific, not a blanket failure: the asar holds 1610
correctly encoded middle dots against 48 double-encoded ones, and em dashes,
ellipses, smart quotes, and arrows are all clean.

**Where it came from.** Commit `2ea87f0` ("Release v1.25.1724 portrait shelf",
2026-07-29 15:06) added 35 double-encoded occurrences and removed none. `HEAD`
still carries them:

| File | Occurrences in HEAD |
| --- | --- |
| `src/locales/en/translation.json` | 29 |
| `src/components/foundry/SoundBrowse.tsx` | 3 |
| `src/components/locker/HeroCardPicker.tsx` | 2 |
| `src/components/foundry/AssetSourcesPanel.tsx` | 1 |

**Why the dev build looked clean.** Those four files are exactly the four
modified-but-uncommitted files in the working tree, and the uncommitted changes
already reduce all four to zero. So the fix exists, is unshipped, and would be
lost by a `git checkout` of the working tree. This is S9 (no clean rollback
point) causing real harm: a shipped user-visible bug whose fix is sitting
uncommitted.

**Actions, in order:**

1. **Commit the working tree now, before anything else in Pass A.** The fix is
   already written; it just needs to exist in history.
2. Note that 29 of the 35 were in the **translatable catalog**, so translators
   were shown corrupted source strings. `bg`, `fr`, and `ru` catalogs are clean
   today, so nothing propagated, but re-run this check after the next
   `translations/*` merge.
3. **Add a guard so this cannot ship again. This class is recurring, not a
   one-off.** A screenshot from the 21-53 session at 21:57 local the same
   evening shows a button reading `Open VPKâ€¦`: a double-encoded **ellipsis**,
   a different character in a different file. That one is already fixed in
   `HEAD`, so the corruption has struck at least twice with different
   characters and been fixed twice by hand. The guard is therefore not
   optional. Add a repo check (husky `pre-push` and CI, alongside
   `i18n:check`) that fails on double-encoded UTF-8 generally, not just the
   middle dot: the tell is a `c3 82` or `c3 a2 c2 80` byte pair in `src/`.
   It is a two-line grep and worth more than the fix itself, because this
   corruption is invisible in diff review.
4. Consider a single shared separator constant instead of literal `·`
   characters scattered across a dozen files, so one bad write cannot spray
   mojibake across surfaces.
5. Since a release shipped with it, mention the fix in `CHANGELOG.md`.

### A1b. Diff the history and the upstream boundary first

Two cheap git passes make every later decision concrete instead of remembered:

- **Fork-internal archaeology.** Identify the commits that shaped the portrait
  surfaces (`HeroCardPicker`, `PortraitEditor`, `PortraitBrowse`) and diff the
  liked July 29 state against today, so "the older design looked better" turns
  into an exact list of removed styles and interactions to restore or reject.
- **Upstream boundary map.** `git diff upstream/main...main --stat` scoped to
  `src/` and `electron/`, kept as a checked-in list of fork-only files vs
  shared-and-modified files. Every later pass consults this map: prefer
  changing fork-only files, and record when a shared file must move. Refresh
  the map when upstream is merged.

### A2b. Cheap concrete bugs to fix during evidence gathering

These are visible in the current screenshots, independent of any architecture
decision, and safe to land in Pass A:

- **Encoding mojibake: root cause found, fix already written but uncommitted.**
  See A0c. The remaining work is to commit it, ship it, and add the guard.
- **Catalog diagnostics.** When the Foundry catalog looks empty (the
  "portraits disappeared" report), the UI gives no reason. Add a small
  diagnostic line: when the catalog was built, from which game path, how many
  files it indexed, and a rebuild action. This turns future "it disappeared"
  reports into one screenshot.
- **Hero workshop icons are not hero-scoped.** `HeroWorkshop` renders
  `LibraryBrowse` with only `initialCategory="ability-icon"`; `LibraryBrowse`
  defaults its own hero filter to `all`. Inside the Abrams workshop this shows
  Holliday, Bebop, and Lash icons. Accept an initial hero, keep the widen-to-
  All-heroes affordance, and note that `LibraryBrowse` resets `heroFilter` to
  `all` on every category change, so an initial hero must survive that reset.
  Because attribution is sparse (A0), the scoped view must include
  unattributed icons rather than showing an empty grid.
- **Audit the whole class of missing-context embeds.** In `HeroWorkshop`,
  `SoundBrowse`, `TextureBrowse`, and `PortraitBrowse` are all handed the hero
  (via `scopedRoster` or `hero=`) and `LibraryBrowse` is the lone exception.
  The generalizable fix is to make hero context an explicit required prop on
  every browse panel rather than an optional filter each one defaults for
  itself, so the next embed cannot silently forget it. A component test should
  assert that a hero-scoped embed never renders another hero's asset.
- **Raw codenames in hero dropdowns.** The hero filter labels fall back to the
  raw codename, so `punkgoat` (Billy), `nano` (Calico), `archer` (Grey Talon),
  `genericperson`, and `duo` appear as if they were hero names. The alias data
  to fix this already exists in
  [heroPortraitIdentity.ts](src/lib/heroPortraitIdentity.ts); the dropdown
  simply never consults it. Route the labels through the resolver, and present
  genuinely unknown codenames under an explicit unreleased/internal grouping
  (A3's datamining status, applied to a dropdown). See S5.
- ~~**Portrait upload slots dim base art and darken it further on hover.**
  [HeroCardPicker.tsx:536](src/components/locker/HeroCardPicker.tsx:536) plus
  [:538](src/components/locker/HeroCardPicker.tsx:538). This is the original
  20:04 request, still open and currently inverted. Small fix, high value: see
  Stage 3.~~ **Done in `b197fdb`** (closes issue #1); treatment extracted to
  [cardSlotStyles.ts](src/components/locker/cardSlotStyles.ts) with tests.
- **User-supplied assets show raw hashes (upstream issue #261).** An uploaded
  image displays its content-hash filename instead of the original name.
  Store and display the original filename alongside the hashed storage key
  everywhere user-supplied assets appear (Recent images, staged entries,
  Build tray).

### A2b-done. Landed on 2026-07-30

Driven and confirmed in the dev build after the change, not inferred.

- **Hero-scoped icon embed (S3).** `LibraryBrowse` now takes `hero`/
  `heroDisplayName` as props and opens on a `scope:<codename>` filter that means
  "this hero's assets plus the unattributed ones". The scope survives a category
  change (the reset goes back to the scope, not to `all`), and the widen
  affordance stays: the dropdown still offers `All heroes`, and the empty state's
  action becomes `Show assets from all heroes` inside a workshop. Live check in
  the Abrams workshop: `Showing 13 of 232 assets`, previously all 232 including
  Bebop, Lash, and Holliday.
- **Attribution is derived, not just filtered.** Ability icons live flat in
  `panorama/images/hud/abilities/` with `hero: null`, so a scope over the
  catalog's own attribution alone still showed every hero. `attributedHeroCodename`
  in `assetSearch.ts` reads the filename's leading token through the alias table
  (`bull_charge` -> Abrams, `inferno_dash` -> Infernus). **It fails open on
  purpose:** the naming is not systematic (most icons are named for the ability,
  not the hero: `uppercut`, `dragon`, `charged`), so an unrecognised token stays
  visible as shared. Two known leaks remain in the Abrams view, `giga_*` (Seven,
  whose panorama name is `gigawatt`) and `phalanx_*`. Closing them properly is
  the ability-to-hero mapping A0 called for, not more prefix guessing;
  `docs/per-ability-sound-map.json` already holds `class`/`image` pairs that
  would supply it.
- **Raw codenames in the hero dropdown (S5).** Labels resolve through the
  roster, then `displayNameForHeroCodename` (new, a reverse index over the same
  alias table), so `archer` reads as Grey Talon, `punkgoat` as Billy, `nano` as
  Calico. What is genuinely unresolved is now grouped under an explicit
  `Unreleased or internal` optgroup rather than sitting inline among heroes:
  live, that group is `duo, genericperson, grappler, targetdummy, theboss`.
- **Global no longer opens on an empty category (Stage 1's cheap half).** The
  Visuals landing type is now the first type with installed content; a prop
  container only lands by default when the whole inventory is empty, since its
  import-only empty state is the least informative thing to open on. It is state
  resolved at render, not in a `useState` initializer, because the mod list
  arrives after mount and the old initializer froze on the empty list. Live: the
  drill-in opens on `Hideout 2 mods` instead of `Soul Containers 0`.
- **Plural bug in the portrait coverage line.** It read `2 portrait family
  available`; the key had no `_one`/`_other` forms.

Tests: `assetSearch.test.ts` covers the scope filter (including "a hero-scoped
embed never renders another hero"), the flat-icon attribution, and the
fail-open cases; `heroPortraitIdentity.test.ts` covers the reverse lookup and
the codename scope.

### A2c. Establish what still needs looking at

- **Abrams portraits: no longer reproducing (checked 2026-07-30).** The Abrams
  workshop `Portraits` section now reads `2 portrait families available: base,
  card, card_critical, card_gloat, mm, sm, vertical` in the dev build against
  the current tree. Something between the two reports and today fixed it, and
  nothing in this pass touched `PortraitBrowse` beyond the plural string. Treat
  it as closed-unexplained rather than fixed: without the catalog diagnostics
  line below there is still no way to tell a user *why* it resolves, so if it
  returns the diagnosis starts from zero again. Ship the diagnostics.
- **The original report, for the record.** A screenshot from the 15-08 Codex session at 20:19 on 2026-07-29
  shows the Abrams workshop `Portraits` section reading "No portraits match /
  No portrait families match that hero or search" with an **empty search box
  and no hero filter applied**. The user reported it again in this session, so
  it has persisted for at least a day across two independent reports. Rule out
  filter state and investigate the real candidates: catalog indexing, hero
  panorama alias resolution for Abrams (whose codename is `atlas`, the same
  mismatch `heroPortraitIdentity.ts` was written for), or no indexed family.
  Treat this as a defect to fix in Pass A, not an observation to capture. The
  catalog diagnostics line should make the cause self-evident next time.
- **The "better older portrait editor" needs no investigation.** Session
  history settles it in Stage 3: no such editor existed. Do not spend Pass A
  time searching git history for portrait code to restore.
- Compare current fork navigation with upstream v1.26. Upstream is useful as a
  structural reference because it leads with a hero-first Foundry landing and
  retains a separate catalog mode. It does not provide this fork's portrait
  family editor or Global-sound inventory, so do not treat it as a visual spec.

### A2d. Score three bounded options

Build a lightweight interaction prototype or annotated wireframe, using the
same hero/family fixture and no new main-process work. Score it against
discoverability, installed-state clarity, data-mining access, keyboard flow,
and implementation risk.

| Option | Shape | Expected result |
| --- | --- | --- |
| Keep hard split | Locker manages installed art; Foundry opens separate full-screen authoring routes | Lowest code churn; retains the current discovery gap. |
| Shared hero shell (recommended starting prototype) | One hero context and family browser; each selected family offers `Manage installed` and `Explore/create` workspaces | A coherent journey without pretending staging is installed. |
| Full merge | One portrait surface owns catalog, installed sources, crop, staging, and build state | Potentially best flow, but highest risk of mixing state authority and making the Locker too heavy. |

The recommended starting point is the shared hero shell. It lets a family card
open into a Foundry-like expanded panel inside the hero context, then makes the
current action explicit: inspect installed sources, browse game variants, or
create a replacement. It can later become a full merge if the prototype proves
that the state boundaries stay legible.

A0's double-counting evidence (S1, S4) strengthens the merge case: the two
surfaces are already failing to agree on one inventory, so keeping them apart
is not buying separation, only inconsistency.

### A2d-decision. Shared hero shell. Decided 2026-07-30.

**The decision: option 2, the shared hero shell. Not a full merge, and not the
hard split.** Locker and Foundry keep their routes, their stores, and their
roles; they converge on one hero shell, one hero identity, and one family view
model.

**What settled it is that the shell already exists and is already shared.**
[HeroDetailFrame](src/components/common/HeroDetailFrame.tsx) is a fork-only
component taking a `surface` prop, and both hero surfaces already render through
it: [LockerHero.tsx](src/pages/LockerHero.tsx) with `surface="locker"` and
[HeroWorkshop.tsx](src/components/foundry/HeroWorkshop.tsx) with
`surface="foundry"`. Both get the same full-bleed backdrop, frosted rail, and
section nav. So the prototype the plan wanted built was already in the tree, and
scoring three options against a hypothetical was scoring the wrong thing: option
1 is what we would be *undoing*, and option 3's cost is real while its benefit is
already collected by the shell.

The two surfaces are also already sharing components across the boundary in the
direction the merge would formalise: `HeroCardPicker` (Locker) imports
`portraitFamily`, `AssetSourcesPanel`, `ChangePools`, and `changeList` from
Foundry. The boundary that matters is therefore not the file tree, it is state
authority, and that boundary is worth keeping:

- **Locker owns installed state**: enabled, priority, winner, delete.
- **Foundry owns authoring state**: staged, cropped, built.

A full merge would put both in one component and, on this codebase's evidence
(S1, S4: two derivations of one inventory already disagree), produce a third
place where they disagree. Nothing in A0 argues for merging the *stores*; it
argues for merging the *derivations*, which is S1's asset-claims index and does
not require merging any UI.

**What this decision commits Pass E to, and what it forbids.**

Committed:

1. One portrait-family view model consumed by both surfaces (names, aliases,
   variants, base preview, source state). `portraitFamily.ts` is already
   fork-only and shared across the boundary, so it is the seam.
2. One hero identity resolver (S5), now started: `heroPortraitIdentity.ts` gained
   the reverse lookup and codename scope this pass, and the remaining tables
   (`heroSoundCodenames`, `heroPortraits`, `heroPoseModels`) fold into it.
3. Deep links both ways, so the shell is a journey and not two dead ends:
   Locker's family card offers **Create replacement in Foundry** with the hero
   and family, and Foundry's My changes already links back to the Locker.
4. The Stage 2 selected-row `Sources & winner` summary, reused rather than
   reimplemented per surface.

Forbidden:

- Deleting either route, or moving the Foundry catalog into the Locker.
- A component that both toggles a mod and stages an edit.
- Any new derivation of "who claims this path". One index, consumed twice.

**Exit criteria.** ~~The screenshot matrix is not captured.~~ Captured on
2026-07-30, see A2d-matrix below. The decision record, the architecture choice
and the matrix are all done, so A2d is closed.

### A2d-matrix. The portrait state matrix. Captured 2026-07-30.

Six shots in [docs/screenshots/portrait-matrix](screenshots/portrait-matrix),
taken against the working tree at `8193f67` in dev slot 3 at 1440x900, on a
profile with 126 installed mods. The fixture is two heroes: **Wraith**, which
has no installed portrait source, and **Mina**, which has five (four enabled).

| State | Locker (`Cards & portraits`) | Foundry (`Portraits`) |
| --- | --- | --- |
| Stock | `locker-stock-wraith.png` | `foundry-stock-wraith.png` |
| Installed | `locker-installed-mina.png`, `locker-installed-mina-winners.png` | `foundry-installed-mina.png` |
| Empty | **no such state, see below** | `foundry-empty-filtered.png` |

The matrix was supposed to be a baseline. It is better read as evidence, because
four of the six cells disagree with a neighbour.

**1. Foundry shows vanilla art as though it were current.** Mina's `Card` family
in `foundry-installed-mina.png` renders the base game portrait. On the same hero
in the same session, `locker-installed-mina-winners.png` reports
`Hero card: Current winner: Lucy Cyberpunk Edgerunners as Mina`, resolved from
the same `panorama/images/heroes/vampirebat_card_psd.vtex_c` the Foundry card is
drawn from. Foundry says this is Mina's card; the game will draw something else.
This is a sharper case for one shared family view model than A0's double-counting
(S1, S4): those two derivations disagreed about a *count*, these two disagree
about *the picture on the screen*.

**2. The Locker has no stock state and no empty state.** It has "some installed
card art" and "none". `locker-stock-wraith.png` is the whole of the second case,
and it opens with `Card art found in your installed mods.` immediately above
`No card art found in your installed mods for Wraith.` Wraith's actual current
portrait appears nowhere on the surface except incidentally, as the faded
placeholder inside the six upload slots. The Locker never names a family, so it
cannot say "stock" and it cannot be empty. That is the browse-first gap in Part 2
of #10, and it is why the shared view model is the seam rather than a nicety.

**3. Two mods are both labelled `winner` in one flat list.**
`locker-installed-mina-winners.png` marks `Crying Girlfriend Mina` (priority 12)
and `Lucy Cyberpunk Edgerunners as Mina` (priority 27) both as `winner`. Both are
true: the first wins `card_critical`, the second wins the other five paths. The
per-path truth above the list says so; the badges below it do not carry the path
they won, so the list reads as a contradiction. Fix in the shared summary, not
per surface.

**4. The two surfaces call the same mod two different things, on the same
screen.** The family cards are headed `pak12`, `pak27`, `pak44`, `pak90`
(`modFileName`); the sources panel four rows below calls the same mods
`Crying Girlfriend Mina`, `Lucy Cyberpunk Edgerunners as Mina`,
`Vivian Banshee Mod (Mina)`, `Zarietu's Mina Icons`. Same component, one scroll
apart.

**5. The empty state cannot say why it is empty.** `foundry-empty-filtered.png`
was produced by typing a nonsense search, and it renders the exact string the
2026-07-29 Abrams report screenshotted: `No portraits match` /
`No portrait families match that hero or search.` A filter miss and a catalog
miss are indistinguishable, which is precisely why that report could not be
diagnosed. Ship the catalog diagnostics line (A2c) and split the two messages.

**6. The empty state is the least legible screen in the app.** Foundry passes
`contentWidth="fluid"`, so the content pane spans the full width while the veil
stays at `clamp(680px, 56vw, 1160px)`. The empty state centres itself in the
pane, which lands it on the unblurred hero art: in the shot, white body text sits
on Mina's face. Compare `foundry-stock-wraith.png`, where the family cards stop
at the veil edge and read cleanly. This is #15 Axis 1's `clearZoneStart` argument
with a photograph attached, and it is the reason that token must derive from the
veil rather than from the content pane.

**Two composition problems visible in passing**, both belonging to #15 Axis 1
rather than here. `locker-installed-mina.png` has a hard vertical seam about
three quarters of the way across, with the same backdrop art continuing on both
sides at different brightness; `foundry-installed-mina.png` shows the same hero
with no seam. **The cause is not established.** It did not reproduce when the
plate was re-inspected after the Axis 1 refactor, at which point the Locker was
serving Mina the hero render rather than a per-skin backdrop, so reproducing it
starts by getting a skin backdrop back on the stage. Recorded as an artifact to
diagnose, not as a diagnosis. And the header above the family cards reads
`2 portrait families available: base, card, card_critical, card_gloat, mm, sm,
vertical` for Mina, `3 ...` with the identical seven-name list for Wraith: the
count counts families and the list lists variants, so the sentence cannot be
read as written. Cheap string fix, tracked in A2b.

**What the matrix did not settle.** No hero on this profile has an *applied*
Locker card, so the "installed" row is "installed sources contend for this
family", not "a Grimoire-managed cosmetics VPK is winning". Reaching that state
means writing a VPK into the real game addons directory, which a dev slot does
not isolate. Capture it during Part 2, when there is a reason to apply one
anyway.

### A2d-lane. What the shared shell keeps open, and what would close it.

The shell was chosen partly because it is the reversible option, so the lane back
to either neighbour is worth writing down rather than rediscovering.

**Toward the full merge**, the only remaining step after Part 2 is deleting a
route and hoisting the Foundry catalog into the hero shell. Everything else the
merge wants (one hero identity, one family view model, one claims index, one
sources summary) is already committed above and is merge-shaped, not
split-shaped. So the merge stays one commit of UI away for as long as the two
stores stay separate.

**Back to the hard split** is cheaper still: stop passing the shared view model
and let each surface derive its own again. Nothing in the committed list is
load-bearing for the *routes*.

**What would close a door, and is therefore forbidden until re-decided:**

- Merging the two stores. Installed authority and authoring state in one store
  forecloses the split permanently and is the one thing A0's evidence argues
  against. This is the same boundary the "Forbidden" list above already draws;
  it is restated here because it is the only irreversible item on it.
- Teaching the shared view model about staging. A view model that carries
  `staged`/`cropped` stops being consumable by a Locker that does not author.
- Making `HeroDetailFrame` aware of either domain. It is the shell both options
  need; a `surface === 'foundry'` branch that reads Foundry types turns the
  shared shell into a merge that has not been decided.

Note that #15 Axis 1 lands `heroStage.ts` inside this lane deliberately: it owns
composition only, reads no store, and is therefore neutral between all three
shapes.

### A2d-part2. The browse-first journey. Landed 2026-07-30.

#10 Part 2 is built. The eleven "Done when" items map onto four pieces of code,
and the design input was A2d-matrix rather than the issue text: four of the six
matrix cells disagreed with a neighbour, and three of those disagreements are
now impossible to reintroduce because there is only one place left that answers
the question.

**The shared view model.**
[src/lib/portraitFamilyView.ts](../src/lib/portraitFamilyView.ts) is the seam
(item 9). It takes base-game family members, installed claimants, decoded
candidate art and a claims index, and returns one view per family: names,
aliases, variants, base preview, and source state. It is pure, reads no store,
and carries no staging or crop state, which is what A2d-lane requires of it.

Four things it settles that were previously settled twice, or not at all:

1. **`stockImage` and `currentImage` are different fields.** Matrix finding 1
   was Foundry drawing Mina's stock card as though it were current while the
   Locker, same session, reported `Lucy Cyberpunk Edgerunners as Mina` winning
   that exact path. `currentImage` is null exactly when something wins the path
   and the surface cannot decode its art, and both surfaces now say so out loud
   rather than falling back silently. That case is a test
   (`never presents stock art as current when a mod wins the path`).
2. **A winner is a `(variant, source)` pair.** Matrix finding 3 was two mods
   both badged `winner` in one flat list, both true per path, with no path on
   the badge. `family.winners` cannot be built without the variant.
3. **A source has one name.** Matrix finding 4 was `pak12` heading a card whose
   sources panel four rows below called the same mod `Crying Girlfriend Mina`.
   `name` is the mod's own name; the file name is a separate, secondary field.
   The Locker's installed-source cards were changed to match.
4. **`unknown` is a real status.** Foundry's catalog mode lists thousands of
   entries and deliberately inspects none of them, so it reports "not checked"
   instead of implying "stock". Only the hero-pinned surface inspects, where
   the question is bounded to one hero's families.

It also ends the two variant vocabularies. The base-card manifest said
`minimap`/`small` and the compiled catalog said `mm`/`sm`, with two sets of
translations behind them (`locker.cards.variants.*` and
`portraitEditor.variants.*`). Both are gone, replaced by one `portrait.*`
namespace that every surface labels from. Where one family genuinely contains
two entries under the same variant name (the pak ships a hash-suffixed
duplicate of `vampirebat_sm_psd`), the view model appends the file stem rather
than printing the same label twice with different states.

**The two browsers.**
[PortraitFamilyCard](../src/components/common/PortraitFamilyCard.tsx) and
[PortraitFamilyPreview](../src/components/common/PortraitFamilyPreview.tsx) are
view-model-only and shared, so the card is not derived twice (items 1, 2, 4).
The expanded preview is full colour throughout, zooms 1x to 4x, and answers #1's
complaint directly: nothing in it dims art to signal state, because state is
words. Hover and keyboard focus preview a sibling identically and neither
selects it, which is what keeps item 3's "never silently changes the family
image" true; selection is a click or Enter, and only then does the per-variant
action appear. Arrow keys walk the family, `+`/`-`/`0` zoom.

The Locker's browser
([HeroPortraitFamilies](../src/components/locker/HeroPortraitFamilies.tsx))
gives that surface its first stock state and its first empty state, which
matrix finding 2 says it never had. It builds the family from
`getCustomCardSlots`, which is one hero's card art and was already loaded for
the uploader, so item 7 holds: the Locker still does not copy the game catalog,
and `Create replacement in Foundry` routes out to it. The Stage 2 sources
summary is the same `AssetSourcesPanel`, handed the inspection it already has
(item 5).

**The deep link** carries `hero`, `section` and now `family`
(`/foundry?hero=Mina&section=portraits&family=panorama/images/heroes/vampirebat`),
and Foundry opens straight into that family's expanded preview. It links by
display name, so alias resolution is `heroPortraitIdentity.ts`'s job and Abrams
(`atlas`), Doorman, Paige (`bookworm`) and the legacy panorama codenames all
resolve through the one map rather than through a second table (item 6).

**Foundry's editor keeps its contract** (item 8). The crop frame, the coverage
refusal and the "staging adds this to the build tray, nothing is installed"
line are untouched; the family gallery simply moved ahead of the crop controls
in reading, tab and visual order.

**The empty states are two states now.** Matrix finding 5: a filter miss and a
catalog miss rendered the identical string, which is why the 2026-07-29 Abrams
report could not be diagnosed. They are separate messages, and the catalog miss
ships the diagnostics line.

**Matrix finding 6 is fixed, and it moved a number.** Foundry's fluid content
pane let the centred empty state land on unblurred hero art. `heroStage.ts`
gained `veiledContentWidth` and `VEILED_CONTENT_CLASS`, and PortraitBrowse is
the first consumer of the clear zone. Measuring it against the running build
corrected the token twice: the offset is the **wider** rail (340px, not 300px,
because available width is the clear zone *minus* the rail, so a narrow
assumption is the optimistic one) **plus the pane's own 24px padding**. With
both, the block's right edge lands exactly on the veil's clear stop at 1440px.
The cap is a `lg:` class rather than an inline style, because below `lg` the
plate and veil are `hidden` and there is nothing to avoid. It is written as a
literal string: an interpolated class name is invisible to Tailwind's scanner,
so the utility was never generated and `max-width` silently stayed `none`. A
test pins the literal to the variable name.

**Verified** in dev slot 3 at 1440x900 and 900x800, keyboard and mouse, with
`scripts/dev-driver.mjs`. Two shots in
[docs/screenshots/portrait-browse](screenshots/portrait-browse). The Locker card
for Mina draws the winning mod's art; Foundry's card for the same family draws
the stock art and says so. That is the same pair of surfaces that produced
matrix finding 1, now disagreeing about nothing.

**Still not captured:** the matrix's own open item. No hero on this profile has
an *applied* Locker card, because reaching that state writes a Grimoire-managed
VPK into the real game addons directory, which a dev slot does not isolate. Part
2 did not need to apply one, so it still has not been observed.

### A3. Keep Foundry's data-mining role explicit

Foundry should continue to expose the installed game's catalog, including
assets for in-development or unreleased heroes when the local game files
contain them. That is a valuable exploration and datamining capability, but it
needs an explicit build-derived status: `available in local catalog`,
`in-development`, or `not usable in a portrait family`. Do not surface those
assets as ordinary Locker content until there is an installed or stock family
to manage. This preserves the distinction between "interesting in the files"
and "safe to make or apply."

Exit: one selected architecture, a screenshot matrix for stock/installed/empty
portrait states, and a written explanation for any apparently missing family.
Only then schedule the later stages below.

## The structural causes underneath the symptoms

Every bug in A0 is an instance of one of these. Fixing symptoms one at a time
will keep regenerating them, so each pass below should be judged on whether it
moves one of these structures, not just whether the screenshot improves.

**S1. The same truth is derived independently per surface.** "What claims this
path, and which claimant wins" is computed by `buildSoundInventory` for the
Locker and by `foundryInspectAssetSources` for Foundry. Two derivations of one
fact is why the Announcer set can be counted in both the Visuals and Sounds
rails, and why a mod can be a "winner" in one view and unexplained in another.
*Direction:* one asset-claims index (path -> claimants, winner, enabled state)
computed once, consumed everywhere, invalidated on mod-state change. Ownership
stays keyed on exact VPK paths; only the derivation is centralised.

**S2. Three sound vocabularies, none authoritative.** The GameBanana category,
the Locker's `SoundCategory`, and Foundry's path-prefix catalog groups all
describe the same domain differently, and `Melee` exists in none of them. Weak
signals (a marketing title, a `shared` path segment) are consulted at render
time with no recorded evidence trail. *Direction:* one classification module
taking recorded evidence as input and returning a category plus the reason,
used by both surfaces, with the base-game catalog mapping into the same
vocabulary and free to add path-derived subgroups beneath it.

**S3. Panels own context they should receive.** `LibraryBrowse` defaults its
own hero filter to `all` and resets it on category change, so an embedding
surface cannot reliably scope it. This is the Abrams bug, and it is a class,
not an instance. *Direction:* context is a required prop; browse panels are
dumb about who they are inside.

**S4. Counts are per-view, so they disagree.** `4 categories` versus seven
rendered, `20 mods` versus `15 mods` for one inventory. *Direction:* counts are
projections of one inventory with one denominator, never computed inside the
view that displays them.

**S5. Hero identity is resolved by four separate tables.** Deadlock ships
different codenames per subsystem, and this fork has grown one mapping per
consumer: [heroPortraitIdentity.ts](src/lib/heroPortraitIdentity.ts) (renderer,
panorama aliases), [heroSoundCodenames.ts](electron/main/services/heroSoundCodenames.ts)
(sound events, from API `class_name`),
[heroPortraits.ts](electron/main/services/heroPortraits.ts), and
[heroPoseModels.ts](electron/main/services/heroPoseModels.ts) (model paths). The
aliasing is genuinely messy and worth respecting: Abrams is `abrams` to the
roster but `atlas` or `bull` in panorama and `hero_atlas` in the API; Apollo is
`fencer`; Billy is `punkgoat`; Calico is `nano`; Celeste is `unicorn`; Graves is
`necro`; Grey Talon is `orion` or `archer`; Holliday is `astro`; Infernus is
`inferno`; Ivy is `tengu`; Lady Geist is `ghost` or `spectre`; McGinnis is
`forge` or `engineer`; Mina is `vampirebat`; Mo & Krill is `mokrill` or `krill`.

The consequences are visible: the ability-icon dropdown shows `punkgoat` and
`genericperson` as if they were hero names because it consults no resolver at
all, and Abrams' icons cannot be found under his own name (A0). *Direction:* one
identity module holding the full alias set, with typed accessors per subsystem
(panorama, sound, model, display) so the tables stop drifting, plus an explicit
unresolved/internal bucket instead of a codename masquerading as a hero name.
Extend the existing `heroPortraitIdentity.test.ts` fixtures to cover it.

**S6. Visual patterns are copy-pasted, so quality is per-file.** The
hover/focus colour-restore treatment exists in exactly two lines of one
component. That is why the app feels like several products. *Direction:* the
card treatment is a shared primitive with rest/hover/focus/status built in
(Pass G), so a quality fix lands everywhere at once.

**S7. Requests get dropped between sessions.** Two of the user's asks sat
unimplemented for a full evening while being cited as the reference pattern in
a plan, and this document itself carried a wrong claim about portrait history
until the transcripts were checked. *Direction:* keep
`docs/codex-request-audit-2026-07-29.md` going as a request ledger, and when
this plan asserts history, cite the session or commit it came from.

**S8. Competing plan documents cause re-litigation.** A prior session found two
docs both defining a "Lane 2". This document must state its own scope and note
supersession where it overlaps `docs/locker-consistency-pass.md` and
`docs/ui-thoughtfulness-and-adjustability-plan.md`, rather than quietly
duplicating their lanes.

**S9. Fixes live in the working tree instead of in history.** Prior sessions
accumulated roughly thirty uncommitted files across several agents. This is not
hypothetical risk: A0c shows the *only* copy of the mojibake fix is uncommitted
while the bug ships to users, so a stray `git checkout` would reintroduce a
released defect. *Direction:* commit before Pass A and after every pass, and
treat "the fix is in the working tree" as not done.

## Ground truth to preserve

- Locker remains the installed-content manager: audition, enabled state,
  provenance, winner/conflict context, and a route to Installed.
- Foundry remains the authoring tool: inspect a base event/asset, choose a
  replacement, stage it, and forge it.
- Exact VPK paths, not labels or categories, remain the ownership key. A
  category can help someone find content; it must never decide the winner.
- Source inspection is expensive enough not to run for every result in a large
  catalog. It should, however, be immediate for the one row the user has
  selected and retain its answer while a refresh is underway.

## ~~Stage 0: inventory and classification evidence~~ DONE in a87eb6e

**Landed 2026-07-30.** Items 1, 2, 2b, 2c, and 4 are complete and the exit
criterion is met: the fixture lives in
[soundInventory.test.ts](src/lib/soundInventory.test.ts) under
`describe('the installed corpus')`, built from paths read out of the real
installed mods rather than invented, and it covers charged melee, parry,
Sinners, XP trooper/creep kill, and an intentionally unknown token. Per-item
status is annotated inline below.

**Item 3 (the override table) is committed.** `CLASSIFICATION_OVERRIDES` in
[soundInventory.ts](src/lib/soundInventory.ts) is deliberately empty, with its
two admission conditions documented at the definition: an exact entry path or
soundevent name as the key, and a written reason. An override table that starts
full is a rule set that gave up early.

Do this before changing labels or moving rows. Produce a checked-in fixture
covering the actual global sound cases in the screenshots and a representative
sample of each current category.

1. ~~For every installed/global sound mod, record its mod name, GameBanana
   category, recorded sound event, exact recorded paths when present, and the
   inspected VPK entries when metadata is missing.~~ **Done (a87eb6e).**
   `useDiscoveredSoundPaths` reads the VPK directory over the same cached parse
   the Installed page and conflict scanner already use, so the evidence is read
   at render time instead of transcribed once.
2. ~~Audit all current `shared` and `other` entries.~~ **Done (a87eb6e): every
   expected move below landed.** The known expected moves are:

   - player heavy/charged melee, punch, swing, parry, and shared player-melee
     paths -> **Melee**;
   - Sinners/Breed and XP-trooper/creep-kill sounds -> **NPC**;
   - UI/HUD/menu/shop/item paths -> their respective concrete categories;
   - the current `Announcer` shelf contents (per A0): JoJo/Colossus loop,
     Magic Carpet, JBL Speaker, Daft Punk Refresher -> **Music** or a
     `Killstreak / stinger` category, and `Pak92`/`Pak93` -> **Needs
     classification**, not Announcer.

   Do not treat `announcer` as trustworthy just because it is a concrete
   label. A0 shows it is currently absorbing anything music-shaped and any
   unnamed imported pak.

2c. **Done in part (a87eb6e).** The labels are reconciled: the base-game catalog
   now says `Items` and `NPC` rather than `Shop items` and `NPCs`, and
   `GlobalSoundBrowse.tsx` records why `gameplay` and `other` have no Locker
   equivalent (they are the engine's own groupings of 1100 base sounds, and the
   base-game melee pool lives under `gameplay`). **Still open:** the catalog has
   no `Melee` group, so a user who learns "Melee" in the Locker does not yet
   find it in Foundry. That needs the catalog engine taught about melee, not a
   rename, so it belongs to Pass C or later.

   Reconcile the two sound vocabularies. Foundry's base-game catalog groups
   1115 sounds by path prefix (`Interface · Music · Shop items · Gameplay ·
   NPCs · Ambience · Voice · Other`) while the Locker's installed inventory
   uses its own list. Melee currently exists in neither. Produce one shared
   category vocabulary used by both surfaces, with the base-game catalog free
   to show additional path-derived subgroups beneath it. A user who learns
   "Melee" in one surface must find it in the other.

2b. **Held to (a87eb6e).** NPC voice barks and NPC sound effects both classify
   as `npc`; `voice` is reserved for hero voice lines
   (`sounds/vo/<hero>/...`). No medium-based split was introduced. The
   secondary-chip half of this item belongs to Stage 4 and is still open.

   A category is a content domain, not a medium. NPC content includes both
   NPC voice barks and NPC sound effects; do not split them into NPC vs Voice
   by medium. Reserve **Voice** for hero voice lines. Where a mod genuinely
   spans domains, the primary category is deterministic and the rest appear
   as secondary chips (see Stage 4). If filtering by medium proves useful
   later, it becomes an orthogonal `Voice | SFX | Music` facet, never a
   parallel category tree.

3. ~~Add a small, reviewed override table keyed by stable evidence (exact event
   or normalized VPK path, not the download title) for exceptions that the
   general classifier cannot safely identify. Keep a reason beside each entry.~~
   **Done in `02edcde`.** `CLASSIFICATION_OVERRIDES` is checked first in
   `classifySoundToken` and is deliberately empty: every case in the installed
   corpus is handled by a rule, and an override table that starts full is a rule
   set that gave up early. Both admission conditions are documented at the
   definition.
4. ~~Replace the current `shared` fallback rule with either a concrete category
   or `unclassified`. Do not infer a category from a mod's marketing name.~~
   **Done (a87eb6e).** `shared` and `other` are both gone; the fallback is
   `unclassified`, rendered last as **Needs classification**. The download
   category is consulted only when no VPK entry was readable.

Concrete code evidence already in hand ~~(verify, then fix in this stage)~~
**(all three verified and fixed in a87eb6e)**:

- ~~`classifySoundToken` in `src/lib/soundInventory.ts` returns `'shared'` for
  any token containing `shared|generic|common`. This is the rule that files
  player melee under "Shared": the charged-melee pool lives in
  `sounds/player/melee/shared/`, so the path itself triggers the fallback.
  Path-segment rules (`player/melee` -> Melee) must run before the generic
  token check.~~ Fixed: path rules now run before word matching.
- ~~`globalCategory` maps a GameBanana category containing `killsound` to
  `'other'`. That single line is why "Minecraft XP Trooper/Creep Killsound"
  sits in Other; kill sounds attached to NPCs/creeps belong in NPC.~~ Fixed:
  creep/trooper kill sounds classify as `npc`, covered by a fixture test.
- ~~Classification is computed at render time from recorded metadata and the
  GameBanana category. **No database migration is needed**~~: confirmed, no
  migration was needed; the rule change reclassified every existing install on
  the next render. The stale case turned out not to need a background
  re-inspect either, because `useDiscoveredSoundPaths` reads the installed VPK
  directly for mods with no recorded write set. **Still open:** the download
  category remains the fallback when a VPK cannot be read at all.

~~Exit: the four "Other" rows in the screenshot and every `shared` entry have an
auditable placement or are visibly marked for review. Add unit tests to
`soundInventory.test.ts` for charged melee, parry, Sinners, XP trooper/creep
kill, and an intentionally unknown token.~~ **Met (a87eb6e).** The four Other
rows are now NPC (2) and Items (2), no `shared` entry exists, and all five
required tests are in `soundInventory.test.ts` alongside two evidence tests
asserting that classification follows the VPK and not the download category.

## Stage 1: one useful Global inventory

Replace the two-mode Global drill-in with one content region and a single
filter control:

- Header: **Global** with total installed count and compact summaries such as
  `Visuals 8 · Sounds 15 · Needs attention 2`. Count each mod once. Today the
  header count changes with the tab and the Announcer set is counted in both
  rails (A0); one inventory with one denominator removes that class of bug.
- Sound-shaped categories (`Announcer / SFX`, `Killstreak Music`) must leave
  the Visuals rail. Whatever the final filter model is, a category belongs to
  exactly one medium.
- ~~Never open on an empty category. Select the first category with content~~
  **done for Visuals in `ff9e8d3`** (the drill-in opens on `Hideout 2 mods`, not
  `Soul Containers 0`). Still open: the same landing rule for the Sounds rail,
  and saying so once at the inventory level when the whole inventory is empty
  rather than showing a category-specific import prompt as if it were the whole
  story.
- First control: `All content | Visuals | Sounds`, defaulting to **All
  content**. This is a local filter, not a navigation boundary; switching it
  preserves the selected category and scroll position where possible.
- Rail/grouping: use meaningful categories within the selected filter. ~~Sound
  categories become Announcer, Music, Interface, Ambience, NPC, Items, and
  Melee.~~ **The vocabulary landed in `a87eb6e`** (`GLOBAL_SOUND_SECTIONS`).
  Still open: Visual categories keeping their asset vocabulary, hiding empty
  categories by default, and the optional "show empty categories" preference.
- Put **Needs classification** last ~~(done in `a87eb6e`: it is the final entry
  in `GLOBAL_SOUND_SECTIONS` and replaces both `shared` and `other`)~~,
  **visually distinct**, with the reason an item is there and an "Inspect in
  Foundry" action. Those three are still open: it is currently ordered last but
  styled like any other shelf and gives no reason. It is a work queue, not a
  normal browsing category.
- Keep the contextual authoring action, but make it specific: **Create a
  sound swap in Foundry** from a sound category, and the existing relevant
  visual action from a visual category.

- Search must respect the taxonomy, not just filenames: searching `melee`
  should surface the charged-melee content even though its paths say
  `shared`, and category labels should act as search synonyms. Remove the
  existing special-case that maps a "charged" search onto the shared path
  once the classifier owns that mapping.

Do not render raw category tabs and a second parallel rail. On narrow widths,
the content filter becomes a segmented control above a horizontally scrollable
category strip; preserve the current accessible tab/arrow-key behavior.

Exit: a user opening Global sees both installed global sounds and visuals
without a mode switch, can reach all melee sounds under one label, and is never
shown `Shared` or an unexplained `Other` category.

## Stage 2: make source truth visible at selection time

The "Existing sources" button currently makes a user ask a second question
after they have already selected a base-game sound. Replace that interaction
with progressive disclosure:

1. A selected Foundry sound row immediately begins one debounced,
   cancellable `foundryInspectAssetSources` request for its exact paths.
2. While it resolves, show an inline **Checking installed replacements…**
   status in the row. Preserve the previous row's result until its replacement
   is ready; suppress stale responses on search/category changes.
3. Once resolved, show a compact, always-visible summary directly below the
   selected row:
   - `Stock` when no installed source claims the path;
   - `Current winner: <mod>` with enabled/disabled state when known;
   - an incomplete-inspection warning when a VPK could not be read.
4. Keep the detailed source list as an expandable disclosure for every
   claimant, exact paths, audition, enable/disable, and replacement gating.
   Rename the action from **Existing sources** to **Sources & winner** so its
   contents are predictable.
5. The search result must remain selected when its inspection finishes. It may
   never automatically stage a replacement, toggle a mod, or alter precedence.
6. Cache inspection results per exact path set so arrow-key navigation and
   revisiting a row are instant, and invalidate that cache on any mod state
   change. The panel's own **Disable** button is the sharpest case: clicking
   it must refresh the summary it sits inside, or the row keeps claiming a
   winner that is no longer enabled.

Apply the same selected-row summary contract to portrait families and visual
assets where exact paths are available. Reuse `AssetSourcesPanel`; extract a
small state hook only if necessary, rather than creating a new ownership path.

Exit: selecting the charged-melee event answers "what am I hearing now?"
without a second click, and the detailed source view remains available without
rescanning the full catalog.

## Stage 3: build a browse-first portrait experience

**Partly done. The 20:04 request is closed; the gallery is not built.**

- ~~The reported surface, `HeroCardPicker`'s upload slots.~~ **Fixed in
  `b197fdb`** ("reveal portrait base art on hover and focus instead of
  darkening it"), which closes issue #1. `opacity-30` and the
  `group-hover:bg-black/55` scrim are both gone: slots rest at `opacity-50`
  with a light desaturation and return to full colour and opacity on hover and
  keyboard focus, the upload hint moved to a corner badge so the reveal is not
  covered, and the treatment respects `motion-reduce`. The class logic lives in
  [cardSlotStyles.ts](src/components/locker/cardSlotStyles.ts) with tests, which
  is also where the Pass G shared card primitive should absorb it. Note it uses
  `group-focus-within`, not `focus-visible`, because this repo has already
  shipped a reveal that never fired under plain `:focus`.
- ~~The audit ledger's wrong "Fixed" line.~~ **Corrected in `ea49548`**, with
  success criteria recorded in `96b02c9`.
- ~~The Abrams "no portraits match" report.~~ **Closed-unexplained in A2c**, and
  the catalog diagnostics that would explain a recurrence shipped in `f4509b7`.
- **Still open: the browse-first gallery itself** (both subsections below). That
  is new design work, not a restoration, and it is Pass E under the shared hero
  shell decided in A2d.

### What happened to the earlier interaction (resolved from session history)

This section has been wrong twice. The Codex transcript settles it. Source:
`~/.codex/sessions/2026/07/29/rollout-2026-07-29T14-52-31-*.jsonl` and
`docs/codex-request-audit-2026-07-29.md`.

**The request was about portraits, and the fix was applied to the wrong
component.** The session that produced the 20:04 message opened at 19:52 with
*"Build the portrait shelf for Grimoire: give the Locker hero page's Cards
section the installed-content half..."* against `docs/portrait-shelf-plan.md`.
So the "upload your own tab" in

> *"the upload your own tab's stuff feels too greyed out, we can have the full
> color reapply on hover to show how the base one truely looks?"* (20:04)

is the **portrait** upload tab in `HeroCardPicker`, keyed
`locker.cards.uploadYourOwn` at
[HeroCardPicker.tsx:500](src/components/locker/HeroCardPicker.tsx:500). It is
not the skins panel.

**That surface was still unfixed at the time of writing, and hovering made it
worse.** (Fixed since, in `b197fdb`; line numbers below refer to the pre-fix
file.) At
[HeroCardPicker.tsx:536](src/components/locker/HeroCardPicker.tsx:536) the base
art renders `opacity-30` when no upload has been picked, with no hover or focus
restore. The very next element,
[:538](src/components/locker/HeroCardPicker.tsx:538), adds
`group-hover:bg-black/55` -- a dark scrim. So hovering a 30%-opacity portrait
*darkens* it further. The request asked for the exact opposite, and the code
does the inverse of it today.

The colour-restore treatment that was eventually written lived only in
[HeroSkinsPanel.tsx:456](src/components/locker/HeroSkinsPanel.tsx:456) and
[:473](src/components/locker/HeroSkinsPanel.tsx:473). It landed on skins while
the complaint was about portraits, which is why the portrait surface still
felt wrong and why the audit doc's "Fixed" line was misleading. Both are now
addressed: `b197fdb` gave portraits their own treatment in `cardSlotStyles.ts`,
and `ea49548` corrected the ledger.

**The second memory is a separate, real regression.** At **20:22** the same
evening: *"the locker looks a lot different from 1.25.1, did we change something
inadvertently?"* A permanent two-button pill strip pinned to every hero card
covered the hero-name logo on all 38 cards. Visible in the 20:27 screenshot as
two chips over the Abrams card. Raised once, left unresolved, then fixed later.

**What "expanded into an interactive high-res card" refers to.** No such
component exists in the tree or in the session's visualizations directory (it is
empty), so there is nothing to recover. What existed was the portrait-shelf
work in progress at the moment of the complaint: per-variant slots at true
aspect ratio showing real base art. The remembered quality is that idea seen at
full colour, which is precisely what `opacity-30` plus a hover scrim prevents.

**Consequences for this plan:**

1. ~~Fix the actual reported surface: remove the scrim-on-dim behaviour in
   `HeroCardPicker` and restore full colour on hover *and* keyboard focus, as
   originally asked at 20:04.~~ **Done in `b197fdb`, closing issue #1.**
2. **Still open (Pass E).** Stage 3 remains a first implementation, not a
   restoration. The expanded interactive high-res card is a **new** design: a
   variant slot that opens into a large, full-colour, zoomable preview. Design
   it deliberately.
3. ~~Correct `docs/codex-request-audit-2026-07-29.md`: entry 2 should say the fix
   was applied to `HeroSkinsPanel` while the request targeted `HeroCardPicker`,
   so it is still open.~~ **Done in `ea49548`.** This is S7 in action, and the
   ledger only helps if it is accurate.

The Foundry editor's later improvement added **Use current art** and **Recent
images**, but its modal is crop-first and visually dense, so it still does not
give a browse-and-compare experience.

### Locker: portrait browser and manager

Within **Cards & portraits**, add a family browser above the existing upload
strip:

- one card per base portrait family, with the current base preview and the
  installed replacement winner when there is one;
- a subdued rest state for unmodified base art, restoring full colour on hover
  and keyboard focus, matching the `HeroSkinsPanel` treatment (a new
  implementation for portraits, not a restoration: see above);
- visible status: Stock, installed mod name/provenance, disabled, or conflict;
- click selects the family and reveals its variant strip plus the immediate
  Sources & winner summary from Stage 2;
- **Create replacement in Foundry** deep-links to the matching hero and family.

This is a real portrait browser for the content the Locker manages. Do not copy
the entire game asset catalog into Locker. If a user wants to browse every
uninstalled source asset or author a new crop, route them to Foundry.

### Foundry: make the existing editor visually inspectable

Keep the crop and staging contract, but put a family gallery before the crop
controls:

- selected family/variant preview at useful size, with hover/focus full-colour
  previews for sibling variants;
- the same Stock/current-winner summary used in Locker;
- clear source choices: **Use current art**, **Recent**, and **Choose image**;
- selecting a sibling changes the crop target and exposes an explicit
  per-variant override, never silently changes the family image;
- preserve the coverage warning and Build Tray wording: browse/selecting an
  image does not install anything.

Use a shared portrait-family view model for names, aliases, variants, base
preview, and source state. The existing hero-identity resolver work remains a
prerequisite: Abrams, Doorman/The Doorman, and legacy panorama codenames must
find the same family in both Locker and Foundry.

Exit: keyboard and mouse users can compare stock, installed, and sibling
portrait variants before opening crop controls; Locker and Foundry agree on
the family and its winner while retaining their manage/create roles.

### The quality bar generalizes

The July 29 portrait slot treatment is liked because it is a browse-first,
visual, hover/focus-revealing selector with clear installed-state. That is a
pattern, not a portrait feature. Once the portrait gallery lands, extract the
card treatment (rest/hover/focus states, status badge, winner line, action
row) as a shared component and schedule the same quality pass for the other
pickers: ability icon cards, sound rows, and the variant strips. One pass per
surface, using the same audit checklist as Stage 4, so the app stops feeling
like three different products.

Upstream remains the structural reference for this: its hero-first landing
and single catalog mode are worth imitating for navigation, and if the shared
hero shell prototype holds up, Locker and Foundry converging behind that shell
is the honest end-state. The rule that keeps the merge safe is unchanged:
installed-state authority (enable/disable/winner) and authoring state
(stage/crop/build) stay separate stores, whatever the screen looks like.

## Stage 4: small consistency fixes found in the screenshots

- Replace top-level **Make one in Foundry** on an empty category with a
  category-specific destination and explanatory copy. For example, an empty
  Melee shelf says it manages installed melee sounds and offers to author a
  melee swap, not an unexplained blank page.
- Show counts as `installed mods` or `matching sounds` consistently; do not
  label a category full of files as merely `0 mods` without explaining the
  scope.
- Ensure a global mod that spans categories appears once in its primary
  category and exposes secondary category chips, rather than looking duplicated
  or disappearing from a filtered view. The primary category is deterministic
  from the reviewed order in Stage 0.
- Keep sound labels human-first. The base-game label and compiled file remain
  available for searching and provenance, but they should not crowd out the
  current-winner explanation.
- Locker sound rows show a `0:00` duration and an empty scrubber before any
  audio metadata loads. Either lazily load duration metadata when the row
  scrolls into view or hide the time/scrubber until play is pressed; a wall
  of dead `0:00` players reads as broken.
- Status must not be color-only: the orange `Enabled` text and the subdued
  hover-reveal treatment both need a non-color signal (icon, label, or
  border) for accessibility, and the hover/focus reveal should respect
  `prefers-reduced-motion` if it animates.
- **Background hero art is too strong behind content.** In the Global Sounds
  screenshots the building/skyline art sits at high opacity directly behind the
  category rail and the empty-state text, so `Shared melee 0 mods` and "No
  installed ... sound mods yet" compete with brickwork. Darken or blur the
  backdrop behind text regions, or confine the art to the header band. This is
  a contrast/legibility issue, so check it against the same WCAG bar as the
  colour-only status problem below.
- Unnamed imported paks (`Pak92`, `Pak93`) are unusable as list entries. Show
  something identifying (source archive name, import date, or a recorded path)
  and offer a rename, rather than a sequence number.
- Add a UI audit checklist for selected, loading, empty, populated, hover,
  keyboard-focus, disabled, and error states at desktop and narrow widths.

## Stage 5: export vanilla assets (the datamining role, made explicit)

Foundry already extracts base-game audio for audition and decodes textures
for preview; exporting is the same read path with a save dialog at the end.

- **Sounds:** an Export action on any base-game sound row saves the decoded
  clip (and offers the raw `.vsnd_c` for power users). Reuse the existing
  audition extraction cache.
- **Textures/images:** an Export action on any catalog card (icons, portraits,
  hero images) saves the decoded PNG; batch export for a selected family or
  category writes into a named folder.
- Exports are reads: no staging, no Build tray involvement, no mod state
  change. Default destination is a `Grimoire Exports` folder with
  human-readable names (`hero/family/variant.png`), not hashes.
- This also gives in-development/unreleased assets (A3) a safe outlet:
  export for inspection instead of pretending they are installable content.

## Delivery slices and stopping points

Keep this deliberately small. Each slice has one question, one affected
surface family, and a stop/go review before the next one consumes implementation
time.

1. **Pass A -- portrait/convergence evidence.** No architecture rewrite.
   Capture the current routes and screenshots, fix only a proven visibility bug,
   and choose hard split, shared shell, or full merge.
2. ~~**Pass B -- global sound taxonomy.** Pure classifier and fixture work only.
   Review every current `shared`/`other` entry, land Melee/NPC corrections and
   the visible `Needs classification` state, with no rail redesign yet.~~
   **Complete 2026-07-30 (`a87eb6e`).** Advances **S2** (one classification
   module reading recorded evidence, with the base-game catalog's labels pulled
   into the same vocabulary). No rail redesign was done, as scoped.
3. ~~**Pass C -- Global inventory prototype.** Apply the selected category model
   to one Global layout and test populated/empty/narrow states. Do not touch
   portrait code in this pass.~~
   **Counting half complete 2026-07-30** (`0b134f5`, `ffbb13b`). Advances
   **S1/S4**. See the Pass C note below for what is and is not closed.
4. **Pass D -- source-result interaction.** Add selected-row Sources & winner
   behavior to Foundry sound rows, test cancellation/staleness, and then reuse
   it only where the portrait decision says it belongs.
5. **Pass E -- portrait journey.** Implement the chosen Pass A architecture,
   starting with the browse/hover/keyboard gallery and only then crop/stage
   integration. The decision record determines whether this is a shared shell
   or a genuine merge.
6. **Pass F -- vanilla export.** Stage 5 as its own slice: sound export first
   (smallest, reuses audition extraction), then single-image export, then
   batch. No UI redesign in this pass.
7. **Pass G -- quality-pass rollout.** Extract the portrait card treatment as
   a shared component and apply it surface by surface (icons, sound rows,
   variant strips), one surface per session, each ending with the Stage 4
   audit checklist.

**Pass A is complete as of 2026-07-30.** The A0 live findings are recorded, the
packaged-build interface path (A0b) is established, the portrait-history question
is answered, the encoding fix and its CI guard shipped, the 20:04 portrait reveal
landed, the upstream boundary map is checked in at
[upstream-boundary-map.md](./upstream-boundary-map.md) (A1b), every A2b fix is in
(hero-scoped icon embed with derived attribution, resolved hero-codename labels,
non-empty default category, catalog diagnostics, original filenames for uploads),
A2c is closed, and A2d has a decision: **the shared hero shell**.

One A1b item was dropped deliberately: the fork-internal archaeology of the
July 29 portrait styling. Stage 3 already established from session history that
there is no earlier design to restore, so diffing for it would be looking for
something known not to exist.

**Pass B is complete as of 2026-07-30**, in commits `a87eb6e` and `02edcde`.
All of Stage 0 landed with its fixture tests; the Global sound rail
now reads `Announcer 0 · Music 4 · Interface 1 · Ambience 0 · NPC 2 · Items 6 ·
Melee 2 · Needs classification 0` against the same 15 mods that produced the
original defect. The pass advances **S2**, and incidentally **S1**: the two
`Pak92`/`Pak93` collisions it surfaced are the first time this fork showed two
mods fighting over one sound path from a browse surface.

~~One Pass B loose end carries into Pass C rather than blocking it: Foundry's
base-game catalog still has no `Melee` group, so the shared vocabulary is
honoured in wording but not yet in structure (Stage 0 item 2c). That needs the
catalog engine taught about melee, not a rename.~~ **Closed 2026-07-30
(`896c6f9`), and the reasoning above was wrong**: it needed no engine change at
all. See the S2 note under Pass C.

**Pass C's counting half is complete as of 2026-07-30**, in `0b134f5` and
`ffbb13b`. The Global drill-in and the Locker tile that leads to it now read
projections of one inventory (`countGlobalInventoryMods`,
`countGlobalInventoryCategories`), so a mod carrying a legacy sound-shaped
`globalType` is counted once rather than once per axis, and the header no
longer changes with the tab. Sound-shaped types are out of the visual rail
(`GLOBAL_VISUAL_MOD_TYPE_ORDER`) and out of the retag menu, which would
otherwise have moved a card into a list nothing renders.

The tile reads the installed VPKs to do it. That is the point rather than a
cost: without the discovered paths a sound mod falls back to the GameBanana
category that caused this defect, so the tile would have counted an honest
number of mods into dishonest categories.

What Pass C has NOT done is the layout half: the rail still lists empty visual
types, and the narrow-width behaviour is untested. Those are the remaining
prototype questions.

**S1/S4 and S2 landed alongside it** (`896c6f9`, `a2d8b14`), out of the pass
order, because #5's counting half could not be honestly closed while the fact
it counts was still derived twice:

- `src/lib/assetClaims.ts` is now the only place the load-order rule is
  written down. `inspectFoundryAssetSources` (main, over VPK directories) and
  `overlappingClaims` (renderer, over recorded entries) both project from it,
  keeping only the difference that is legitimate: what evidence each can see.
- `classifySound` returns the category **and** the reason, and the
  Needs-classification queue says which evidence ran out, so a queue item can
  be acted on.
- The Foundry base-game surface groups by `SoundCategory` through
  `soundCategoryFromCatalog`, which reads clip paths before falling back to the
  catalog engine's coarse families. **This closes the Pass B loose end recorded
  below**: the base-game catalog now has a Melee group. The earlier note that
  it needed "the catalog engine taught about melee" was wrong. The melee pool
  was always identifiable by its tree (`sounds/player/melee/`); only the
  grouping axis was the engine's rather than ours.
- The asset-source inspection cache is invalidated on any real mod-state
  change. It previously outlived the mod list it was a cache of, which made a
  stale ownership answer render instantly.

Each pass should also name which structural cause (S1-S9) it advances, so the
work stays aimed at the cause rather than the screenshot.

Every implementation pass should verify against the live app, not just tests:
run `GRIMOIRE_DEV_CDP_PORT=9222 pnpm dev` and use `scripts/dev-driver.mjs`
(`route`, `text`, `click`, `shot`) to drive the actual renderer, read what
rows really say, and capture the screenshot evidence each exit criterion asks
for. This capability already exists; no embedded assistant or extension is
needed.

Run each pass in a fresh session whose context is only this document's
relevant section plus the Stage 0 fixture; do not carry the whole planning
conversation into implementation. That is the token-budget discipline: the
document is the memory, not the chat.

Every pass ends with its focused unit/component tests, a live screenshot
comparison, `pnpm typecheck`, `pnpm lint`, and `pnpm i18n:check`. Do not carry
unresolved design questions into the next pass just to keep momentum.

## Implementation convention and verification

Work in this order: pure classification/view-model helpers with fixture tests;
shared source-selection state; Locker integration; Foundry integration; then
copy and visual polish. New strings belong in `src/locales/en/translation.json`.
Do not change IPC ownership semantics or the forge/install path.

i18n has a longer tail than `i18n:check` alone: renamed categories and new
labels (`Needs classification`, `Sources & winner`) add keys and orphan old
ones, so each pass that touches copy must also remove the dead keys, run
`pnpm i18n:manifest`, and accept that translated catalogs will show the new
strings in English until Weblate catches up. Update `docs/feature-status.md`
alongside any pass that changes user-visible behavior.

This fork tracks upstream, and Locker/Foundry are the highest-churn shared
surfaces. Prefer fork-local files (new components, `soundInventory.ts`,
`globalSoundSections.ts`) over restructuring files upstream also edits, and
note in each pass's decision record which upstream files were touched, to keep
future merges survivable.

For each stage, run focused Vitest tests first, then `pnpm typecheck`,
`pnpm lint`, and `pnpm i18n:check`. Live-check with the dev driver using real
examples from the Stage 0 fixture: charged melee, Sinners, XP trooper/creep
kill, a stock portrait family, an installed portrait family, and an unreadable
source case. Record screenshots for the hover/focus portrait state and the
automatic Sources & winner state before calling the stage complete.
