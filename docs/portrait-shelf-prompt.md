# Prompt: build the portrait shelf

Paste the block below as the opening message of a fresh session.

---

Build the portrait shelf for Grimoire: give the Locker hero page's Cards section
the installed-content half that the Sound Locker just gained, and pull portrait
randomization into one home. Read these first:

* `docs/portrait-shelf-plan.md` (the plan; follow its lane order and its "what
  this deliberately does not do" list)
* `docs/sound-locker-plan.md` + `src/lib/soundInventory.ts` +
  `src/components/locker/SoundEntryRow.tsx` (the shape to mirror: a pure tested
  read model, on-demand ownership resolution, under-report-only overlap)
* `docs/locker-foundry-parity-plan.md` (the thesis: Locker manages what you
  have, Foundry makes more of it)
* `src/components/locker/HeroCardPicker.tsx` (the surface to grow, not
  duplicate) and `src/components/foundry/portraitFamily.ts`
* `src/lib/foundryChanges.ts` (`foundryShuffleKey`, `partitionFoundryPools`) and
  `src/components/foundry/ChangePools.tsx` (the existing pool UI to reuse)
* `src/types/portrait.ts` (`HeroPortrait.modFileName`, `CustomCardSlot.entry`)
  and `src/types/mod.ts` (`textureReplacement`, `foundryBuild`,
  `lockerCosmetics`)

Scope, in order:

1. **Inventory model (pure, tested).** `src/lib/portraitInventory.ts`: fold
   installed mods into per-hero portrait entries from `textureReplacement`,
   `foundryBuild` recorded entries, and `lockerCosmetics` selections. One entry
   per (mod, hero), exact `.vtex_c` paths only, `paths: []` when unrecorded
   rather than a guess. Include `overlappingClaims` over enabled entries with
   recorded paths only. Tests beside it mirroring `soundInventory.test.ts`.
2. **Cards section ownership readout.** In `HeroCardPicker`: group the portrait
   tiles by `modFileName`, badge provenance and enabled state, and add a
   per-group expander that runs `foundryInspectAssetSources` over the family's
   exact entries (from `getCustomCardSlots`) and names the winner per variant
   with a jump to the winning mod. Add a section-level overlap note. Keep the
   existing coverage-gap warning separate and unchanged: it answers a different
   question.
3. **One home for portrait randomization.** Surface the forged-portrait pools
   (`partitionFoundryPools` filtered to this hero) next to the existing card
   shuffle toggle in the Cards section, reusing `foundryShuffleIncluded` and
   `foundryShuffleKey`. Do not add a second grouping concept, and do not remove
   the My changes pool view.
4. **Variant label honesty.** Verify in game where `minimap` / `small` /
   `vertical` actually render, then replace the raw tokens in `VARIANT_LABEL`
   with honest labels carrying the raw token in a tooltip. If a variant renders
   nowhere the user can see, say that rather than naming a surface it does not
   have.

Constraints: renderer talks to main only via IPC; reuse existing services rather
than adding new sidecar calls where the data already exists (every call this
needs is one an existing surface already makes); no em-dashes in strings or
comments; new user-facing strings go in `src/locales/en/translation.json` and
must pass `pnpm i18n:check`; add vitest coverage for the inventory model; verify
live with `GRIMOIRE_DEV_CDP_PORT=9222 pnpm dev` and `scripts/dev-driver.mjs`
(close the installed Grimoire first, it holds the single-instance lock, and
relaunch it when done). The plan doc already exists, so implement it rather than
re-planning; if the ground truth has drifted, correct the doc as you go.

---

## Known gaps from the Sound Locker pass, worth folding in

- The "Open in Sound Locker" link in Foundry's `My changes` group header could
  not be exercised live: the dev install had no forged changes at the time. Make
  a forged sound change and confirm the link renders and lands on the right
  shelf.
- `SoundBrowse`'s row chrome still carries hardcoded English (`Base-game label:`,
  `Existing sources`, `Annotate`). Out of scope then, worth wiring now that the
  row is being touched again.
