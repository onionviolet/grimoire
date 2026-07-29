# Spec audit verdicts, 2026-07-28

Output of [spec-audit-prompt.md](./spec-audit-prompt.md), sections A through J,
run read-only against the working tree at v1.25.171 (which carries uncommitted
Foundry work: `services/foundryForge.ts`, `src/lib/chatWheelModel.ts`, and edits
across `ipc/foundry.ts`, `preload/index.ts`, `api.ts`, `FoundryBuildTray.tsx`,
`LibraryBrowse.tsx`, `SoundBrowse.tsx`, `GlobalSoundBrowse.tsx`).

**This file is step 0's output.** [work-order.md](./work-order.md) says every wave
item checks its verdict here first: SHIPPED is dropped from scope, PARTIAL is
narrowed to the missing part only.

## Gates, as run

| Command | Result |
| --- | --- |
| `pnpm exec vitest run` | 73 files, 753 tests, all passed |
| `pnpm typecheck` | clean, no output |
| `pnpm lint` | clean, no output |
| Foundry area files (6) | 17 tests passed |
| Chat Wheel area files (2) | 4 tests passed |

No failures. Nothing below is blocked by a red gate.

## Scope changes to the wave plan, up front

Read this before planning anything.

| Wave item | Verdict | What changes |
| --- | --- | --- |
| **1A** Foundry source actions | PARTIAL | Unchanged in substance. Proceed, minus the two sub-items noted below. |
| **1B** Merge review UI | PARTIAL, chain break identified | Proceed. The break is precise: main-process analysis is complete and correct; it reaches no renderer. |
| **2A** Foundry combined output | **SHIPPED** | **Drop almost all of it.** Three small remainders only. See below. |
| **2B** Performance ConVars | PARTIAL | Unchanged. All four sub-items confirmed missing. Proceed as written. |
| **3A** 3D rigged spine spike | **PREMISE FALSE** | The spike's stated blocker does not exist. Rewrite the item before running it. |
| **3B** Social phase 1.5 | MISSING, as described | Unchanged. Proceed as written. |

Wave 2 item A collapsing has a knock-on: **work-order.md's stated dependency of
wave 2 on wave 1 is now weak**. Step 2 was supposed to build on step 1's
`ipc/foundry.ts` and `SoundRow` additions. Step 2 is already built. Waves can be
resequenced; see "Thoughts on sequencing" at the end.

---

## Wave 1, item A: Foundry source actions

**Verdict: PARTIAL. Proceed, with two sub-items removed.**

### What already ships, and must not be re-implemented

The exact-path ownership foundation is complete and fixture-covered end to end:

- `electron/main/services/foundryAssetSources.ts:53` normalizes to lowercase
  forward-slash (`:39`), matches enabled and disabled owners, derives provenance
  from metadata (`:43`), resolves the winner as lowest enabled priority (`:88`),
  and reports unreadable VPKs as uncertainty rather than dropping them (`:66`).
- Chain: `ipc/mods.ts:1396` → `preload/index.ts:670` → `types/electron.ts:1131`
  → `lib/api.ts:1464` → `AssetSourcesPanel.tsx:17`. No layer is missing.
- Tests: `foundryAssetSources.test.ts:7` (normalization + priority winner), `:18`
  (enabled/disabled/provenance/unreadable), `:31` (serializability, duplicate VPK
  spellings). All pass.

**Yes, the Global sounds case specifically works.** A row in the Global sound
browser does show every installed or disabled mod that writes that exact sound
file, under that specific sound. It is easy to miss by grepping the wrong file:
`GlobalSoundBrowse.tsx` contains no panel code. It renders the shared `SoundRow`
from `SoundBrowse.tsx:708` (imported at `GlobalSoundBrowse.tsx:21`, rendered at
`:322`), passing `sourceClipPaths={row.vsnd}` at `:333` and the soundevents file
via `swapContextFor` at `:353`. `SoundRow` builds the inspection path set at
`SoundBrowse.tsx:734` (every clip in the pool, not just the auditioned one, plus
the event container) and mounts `AssetSourcesPanel` at `:850` behind a per-row
"Existing sources" disclosure.

The same is true for hero sounds (`SoundBrowse.tsx:480`, `:491`), voice lines
(`:629`, `:641`), texture and icon cards (`TextureCard.tsx:76`), the texture
lightbox (`TextureLightbox.tsx:111`), and library browse
(`LibraryBrowse.tsx:180`). Portrait families inspect every variant together via
`visualEdits.ts:36`, tested at `visualEdits.test.ts:28`.

Third-party VPKs are discovered by entry-path inspection, never by metadata:
`provenance()` at `foundryAssetSources.ts:43` returns `Third-party` as the
*fallback* after all metadata signals miss, so an untracked VPK still appears as
an owner. This satisfies the non-negotiable invariant.

### What is actually missing, and is your scope

1. **Panel actions. All five are absent.** `AssetSourcesPanel.tsx:25`-`:64` is
   the entire render body: one "Existing sources" button (`:27`), a winner line
   (`:44`), a source list (`:48`), an unreadable-VPK warning (`:58`). No
   audition, no open-in-Installed, no mod-store enable/disable, no shuffle pool,
   no create-replacement.
   Cheapest first cut: open-in-Installed needs no new IPC.
2. **`MySoundChanges` is 50 lines.** `MySoundChanges.tsx:44` (toggle), `:46`
   (delete), `:21` (rename). No winner context, no jump-to-conflict, no
   annotation access, no re-forge. All four are yours.
3. **Pool editor completion.** Confirmed still open.

### Removed from your scope

- **Do not "add" third-party discovery or unreadable-VPK handling.** Both ship.
- **Do not rebuild the panel's data contract.** `FoundryAssetSourcesInspection`
  is stable, serializable (asserted at `foundryAssetSources.test.ts:66`), and
  already consumed by four call sites. Extend it additively or not at all.

### One-line bug found in your files, fix it while you are here

`AssetSourcesPanel.tsx:41` normalizes the requested path with
`.replace(/\\/g, '/').replace(/^\/+/, '')` but **omits `.toLowerCase()`**, while
the service key at `foundryAssetSources.ts:40` is lowercased. Any requested path
containing an uppercase character therefore never matches `result.winners`, and
the "Current winner" line silently does not render. Today's catalog paths appear
to be lowercase, so it is latent, not visibly broken. Append `.toLowerCase()`.

---

## Wave 1, item B: Merge review UI

**Verdict: PARTIAL. The break is at a precise layer. Proceed.**

`analyzeMerge` in `services/modMerger.ts:517` is complete and correct:

- Read-only: it calls `scanMods` and `parseVpkDirectoriesAsync` and writes
  nothing.
- It orders sources by the same rule the real merge uses (`:527`-`:529`).
- **It distinguishes an unreadable VPK from an empty one**, which the roadmap
  requires: `entryCount` is `null` for unreadable (`:574`) versus `0` for empty,
  and unreadable ids are listed separately at `:581` with a warning at `:559`.
- It excludes inert imprint metadata from collision totals (`:544`).
- Tested at `modMerger.addSources.test.ts:291`.

The chain reaches `ipc/mods.ts:1953` → `preload/index.ts:335` →
`types/electron.ts:841` and **stops there**. There is no `src/lib/api.ts`
wrapper and no renderer caller anywhere in `src/`.

So your scope is exactly: add the `api.ts` wrapper, then build the review UI on
top of a service that already returns everything you need (grouped collisions
with `category`, `winnerModId` per collided path, per-source `winsCollisions`,
`totalInputSize`, `totalEntries`, `warnings`).

Milestones 2 through 5 are genuinely absent, not half-wired: no matches for
`mergeRecipe`, `recipeVersion`, `pathPolicy`, `includePrefixes`, or
`excludePrefixes` anywhere in `electron/` or `src/`. Nothing to clean up before
you start, and nothing tempting you into the recipe schema early.

---

## Wave 2, item A: Foundry combined output

**Verdict: SHIPPED. Drop the item as written. Three small remainders.**

Every premise in the wave prompt for this item is false as of the working tree.

- "The sound serializer is not called by any live forge path" — it is:
  `SoundBrowse.tsx:1035` calls `serializeSoundStagedEdit`.
- "Neither feeds the build-tray review" — both do: `Foundry.tsx:60` is
  `stageEdit`, passed to `SoundBrowse` (`:237`), `GlobalSoundBrowse` (`:241`),
  and both `LibraryBrowse` mounts (`:247`, `:249`); the tray renders at `:253`.
- "Wire both flows into one reviewed write set first, then implement the build" —
  both are done. `FoundryBuildTray.tsx:36` computes the review, `:78` renders
  collision winners, `:79` renders the final write set, `:48` is the explicit
  confirmation naming the path count and collision-winner count.
- The build exists: `services/foundryForge.ts:45` builds each edit in an isolated
  temp dir, merges once with precedence-ordered inputs (`:66`-`:69`), verifies
  (`:70`), and **re-derives the review in main and rejects a stale or tampered
  confirmation** (`:50`) and any built VPK whose actual entries do not match the
  confirmed write set (`:73`). Chain completes through `ipc/foundry.ts:104` →
  `preload/index.ts:674` → `types/electron.ts:1126` → `api.ts:1479` →
  `Foundry.tsx:63`. Unit-tested at `foundryForge.test.ts:4`.

One design fact the docs did not record: **the build is export-only.** It writes
through a native save dialog (`ipc/foundry.ts:110`); build parts never enter
Installed, and a cancelled dialog is a normal `{ exported: false }` that changes
nothing. This is deliberate (`ipc/foundry.ts:101`-`:103`). Do not "fix" it into
an install without deciding that explicitly.

### The three remainders, which are the real wave 2 item A

Items 1 and 2 were fixed on 2026-07-28, after this audit ran. Only item 3 is
left; the record of 1 and 2 is kept because it explains the current code.

1. ~~**The staged sound path skips the exact-path preflight.**~~ **FIXED.**
   The visual flow runs it: `LibraryBrowse.tsx:57` inspects, `:58` throws on
   unreadable VPKs, `:62` asks before an enabled conflict. The sound flow staged
   and returned before ever reaching `foundryInspectSoundConflicts`, violating
   the invariant "a failed or unreadable inspection blocks the ambiguous
   action". `SoundBrowse.tsx:1043` now runs the same preflight on the staging
   branch. Note for anyone extending it: the install path's `disable-conflicts`
   and `replace-managed` resolutions are deliberately **not** offered at staging
   time, because staging installs nothing and must not mutate enabled state or
   precedence. Staging blocks on unreadable and otherwise asks for
   acknowledgement only.
2. ~~**Stale UI copy.**~~ **FIXED**, and it was in three places, not one. The
   `FoundryBuildTray.tsx` sentence was deleted; the `foundry.sound.swap.drop`
   en catalog value still said "Drop an MP3 here" and was overriding an accurate
   component fallback, so that was the string users actually saw; the orphan
   `foundry.sound.swap.mp3only` key was deleted; and the staging toast was
   reusing the install path's `done` key, so a staged edit reported "Installed
   ... enable it in the Installed tab". It now has its own `staged` key.
   Lesson for later waves: a correct inline `t()` fallback proves nothing. The
   catalog value wins at runtime. Grep `translation.json`, not just the JSX.
3. **No cancellation / installed-state regression test**, and
   `FoundryForgeEdit` (`src/types/foundry.ts:320`) admits only `sound` and
   `texture`. Recolor and model edits have no serializer and cannot enter a
   combined build. `foundryForge.ts:55`-`:63` would also misalign its `built`
   array against `request.edits` if a third kind were ever added, since only
   sound and texture push. The type prevents it today. Keep it that way, or fix
   the loop when you widen the union.

### Related: audio transcoding also shipped

`feature-status.md` listed non-MP3 sound input as a confirmed gap. It is not.
`ffmpeg-static` is a dependency (`package.json:62`), asar-unpacked
(`electron-builder.yml:41`), resolved outside the asar at
`services/audioConversion.ts:19`, and `prepareAudioForMint` (`:38`) transcodes
non-MP3 input to 44.1 kHz stereo MP3 on the way into `buildHeroSoundSwapVpk`
(`services/foundryCatalog.ts:257`, `:263`). MP3 input passes through
byte-for-byte (`:40`). The picker already advertises those formats
(`SoundBrowse.tsx:1123`) and now honours it.

`services/audioConversion.ts` has **no test**. Worth one.

---

## Wave 2, item B: Performance ConVars

**Verdict: PARTIAL. All four sub-items confirmed missing. Proceed as written.**

What exists: bounded HUD/minimap controls at
`components/performance/PerformanceConfigCard.tsx:48`-`:55`, each with `min`,
`max`, `step`, `defaultValue`.

Against your four sub-items:

1. **Per-control reset: missing.** Only a bulk
   `resetPerformanceConfigOverrides` at `:295`.
2. **Value-state badge: partial.** A card-level applied/edited/wiped/error badge
   at `:208`-`:210`, and a per-control "using game default" hint at `:360` shown
   when `raw === undefined`. No four-state per-control badge.
3. **Out-of-range warning: missing, and it silently falls back today.** `:333`
   reads the stored value, `:334` replaces it with `control.defaultValue` when
   not finite; an out-of-range but finite value is then clamped by the range
   input itself. Nothing warns.
4. **Pending versus applied summary: missing.**

Also confirmed for context: the multi-preset applier from
`performance-config-integration.md` Phase 2 does not exist. `PRESET_ID` is a
single constant (`services/performanceConfigData.ts:32`); the `presetId` field
at `services/performanceConfig.ts:759` is a record of what was applied, not a
selector. That is a different slice and is **not** your scope.

---

## Wave 3, item A: 3D rigged spine spike

**Verdict: the spike's premise is false. Rewrite the item before running it.**

The wave prompt says "Grimoire always passes `--pose` to the model export, which
discards the skeleton and clips". That was true when
`3d-preview-fidelity-plan.md` was written and is not true now.

`services/heroPoseModels.ts` maintains **two sibling exports**:

- `:169` the static `--pose` bake, described in-file as "the legacy/default glb",
  invoked with `'--pose'` at `:852` and `'--require-pose'` at `:856`.
- `:171` a rigged sibling: "Rigged (no `--pose`, single-clip) SkinnedMesh +
  animated glb". Built at `:882` ("but WITHOUT `--pose`, filtered to one ranked
  animated clip") and `:972` ("NO --pose: keep the skeleton + skin + clip").
  It has its own cache version line at `:264`.

So the no-pose path is not an unrun spike. Phases 2 through 4 of the fidelity
plan have also landed, with real coverage: `lib/deadlockMaterial.ts`,
`lib/source2Preview/` (`compileScene`, `drawState`, `debugSummary`, all tested),
`lib/source2NprMaterial.ts` (tested), `lib/useClothSim.ts` with
`clothMath.test.ts`, `feModel.test.ts`, `useClothSim.restpose.test.ts`, and
`useClothSim.harness.test.ts`.

**What to do instead.** The useful question is no longer "can the no-pose path
run" but "what is its measured quality and cost, and should it become the
default". Keep the deliverable shape (a written report, pilots `bookworm`,
`astro`, `gigawatt`, static preview stays the fallback) and re-aim it at:

- per-pilot: does the rigged sibling load and play the hero's own idle clip on
  the turntable today, and where does it fail
- frame budget and glb size delta, rigged versus static
- NPR shell behaviour under animation, given the skinning chunk
- whether cloth (already built) behaves on the rigged path per pilot
- recommendation: promote rigged to default, keep it opt-in, or gate per hero

Phases 5 through 7 (retarget, ambient FX, ability casts) are confirmed
not started, and are **no longer blocked** by anything. If the report is
positive, custom-animation retarget is the natural next item; a bone-map JSON
for one pilot hero is the smallest start.

---

## Wave 3, item B: Social phase 1.5

**Verdict: MISSING as described. Proceed as written.**

Phase 1's client half is done and should not be revisited: 14 IPC handlers at
`ipc/social.ts:50`-`:117`, Discover with NSFW gating (`Discover.tsx:54`, `:116`),
`components/social/` (Publish, PublishPicker, EditProfile, MyPublished,
SocialAccountSection, SocialProfileHeader), account deletion
(`SocialAccountSection.tsx:47`), async `safeStorage` (`socialAuth.ts:96`,
`:121`) with the Linux keychain refusal at `:63`.

**The token invariant holds today. Do not regress it.** The session bearer lives
in main-process module memory and is attached at `services/social.ts:130`.
`SocialSessionStatus` (`src/types/social.ts:13`-`:19`) carries `signedIn`,
`user`, `persistenceMode`, `expiresAt` and **no token field**. `preload/index.ts`
exposes no token accessor. Phase 1.5 adds no reason to change that.

Phase 1.5 items confirmed absent: revalidation cron, mods-available badge,
"mods I'm missing" against local install state, owner-only view stats, admin
analytics, dedicated offline/service-busy states.

One drift to decide rather than silently keep: the TOS gate fires at first
**publish** and is localStorage-backed (`PublishDialog.tsx:14`, `:23`), where
`social-architecture.md` put it at first **login**. localStorage is per-machine
and clearable, so it is not an account-level record of acceptance. Not phase 1.5
scope; flag it and move on unless told otherwise.

---

## Items outside the waves that the audit also settled

Useful context, not scope.

Verdicts below are the audit's, recorded as run. Where later work has closed a
gap, a **Resolved** note is appended to the row; the original wording is left
intact so this file stays a snapshot of what was true on the audit date.

| Area | Verdict | Note |
| --- | --- | --- |
| Locker hero card apply | SHIPPED, one renderer gap | Apply/swap/revert/custom/teardown/hiding all confirmed. But `heroCards.ts:361` and `:389` return `missingSourceFileNames` and `HeroCardPicker.tsx:153`, `:206` read only `activeSourceFileName` and discard it, so a vanished source drops a card silently. One-line fix into the existing `actionError`. **Resolved 2026-07-28 (`b629833`):** both apply paths now report the dropped names through `reportMissingSources` (`HeroCardPicker.tsx:147`) into `actionError`, via the new `locker.cards.missingSources` key. Deviation 5 in `locker-hero-card-apply.md` updated to match. |
| VFX recolor roster | SHIPPED | 38 heroes pinned (`heroColors.ts:55`-`:94`), every one with a matching `recipe_for` arm in `vpkmerge-core/src/hero_recolor.rs:71`. The "only Paige and Celeste" claim was two heroes out of date by 36. Remaining work is in-game screenshots, not code. |
| VFX preview fallback | SHIPPED, brittle | `HeroColorPicker.tsx:291` detects "no preview texture" by substring-matching `'particle-only'` in the engine's error string. A reworded engine message makes the picker retry a doomed preview on every slider tick. No test. **Resolved 2026-07-28 (`711cb7f`):** the substring match is gone. `previewHeroColor` returns `Promise<string \| null>` (null means no renderable swatch, do not retry; a throw stays a transient failure), classified once in `heroColors.ts` and threaded through IPC, preload, `electron.ts`, and `api.ts`. Covered by `heroColors.previewHeroColor.test.ts`. |
| Chat Wheel | SHIPPED, thin tests | Validation tested (`chatWheel.test.ts:29`, `:44`, converter faked, which the spec permits). YAML round-trip tested (`chatWheelModel.test.ts:7`, `:11`). Nothing tests `chat-wheel:read` or `chat-wheel:starter`, so the VPK round-trip and reset are unverified. The experimental gate is enforced on the sidebar entry (`Sidebar.tsx:514`) but not on the route itself. |
| Overflow W1-W10 | SHIPPED | `deadlock.ts:209`, `:217`, `:238`, `:268` and callers. Doc accurate. |
| Deadworks servers | SHIPPED | `deadlock.ts:298`, `:326`; `system.ts:34`, `:198`, `:273`, `:355`; `deadworksServers.ts:380`. Doc accurate, including the gameinfo weaving. |
| Portable profiles | SHIPPED | `types/portableProfile.ts:6`-`:9` matches the spec's `1.1` / `mp1:`. One copy issue: `profile-spec.md:3` markets cross-manager interop, which `CLAUDE.md` forbids claiming. |

## Docs already corrected by the audit session

Do not redo these. `feature-status.md`, `ability-vfx-recolor.md`,
`3d-preview-fidelity-plan.md`, `locker-hero-card-apply.md`, and
`remaining-work-phases.md` (all `[doc]` tags resolved and retired). Wave steps
still own updating `feature-status.md` and `remaining-work-phases.md` for what
each wave actually lands.

## Thoughts on sequencing

The wave plan's own stated dependency was "wave 2 depends on wave 1 because step
2 builds on step 1's `ipc/foundry.ts` and `SoundRow` additions". Step 2 is built.
That dependency is gone, and wave 2 item A has shrunk to a preflight fix, a
deleted sentence, and a test.

A more honest grouping now:

1. The preflight fix (old 2A remainder 1) plus the tray copy. Small, and it is
   the only live correctness gap on the board. Do not let it wait two waves
   behind a large UI item.
2. Foundry source actions (1A) plus merge review UI (1B), unchanged. These are
   now the two largest real items and still have disjoint file sets.
3. Performance ConVars (2B) plus the re-aimed 3D report (3A), or social 1.5 (3B).

The invariants section of the wave prompt stands as written and was checked
against the code: exact normalized paths are the ownership key everywhere,
Installed/Locker remains the enabled-state authority, and no Foundry action
mutates load order. The one place the invariants are violated today is the
staged sound preflight, item 1 above.
