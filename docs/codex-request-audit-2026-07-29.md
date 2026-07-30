# Audit: were the 2026-07-29 Codex requests actually acted upon?

Method: extracted every user message from the nine Codex sessions whose `cwd`
was `C:\Users\wayba\dev\grimoire` on 2026-07-29 (39 messages, from
`~/.codex/sessions/2026/07/29/*.jsonl`), then checked each concrete ask against
the working tree.

Only messages containing a concrete, checkable request are listed. Approval
prompts, file-path-only messages, and "continue"/"what's left" turns are
omitted.

## Acted upon

| Ask | Where |
| --- | --- |
| Portrait shelf: Locker Cards section gains the installed-content half; portrait randomization gets one home | `HeroCardPicker`, `heroPortraitIdentity.ts` |
| Heroes missing portraits / codename mismatch (Abrams, Doorman) needs a tested resolver | `src/lib/heroPortraitIdentity.ts` + `.test.ts` |
| Rename hero `Cards` section to "Cards & portraits" | `LockerHero.tsx` rail |
| Search on the Conflicts page | `src/lib/conflictSearch.ts` + `.test.ts` |
| Consistent Foundry search affordance | `FoundrySearchInput.tsx`, `assetSearch.ts` |
| Keep the product and primary route named "Locker" | page title is `Locker`; no rename shipped |
| Sound Locker merged into Locker rather than a sibling destination | folded into the hero page's Sounds tab |
| Sound Locker global view had no way back | Global Sounds now has **Back to Locker** |

## Raised but NOT acted upon until now

These were the gaps this session closed.

1. **"the locker looks a lot different from 1.25.1, did we change something
   inadvertently?"** (20:22)
   Raised once and never resolved. The regression then got *worse*: the
   Looks/Sounds work added a permanent two-button pill strip pinned to the
   bottom of every hero gallery card, which covered the hero name logo on all
   38 cards and turned the poster grid into rows of chunky black pills.
   **Fixed:** card is poster art again; whole-card click opens the hero, and a
   small hover/focus chip carries the sound count.

2. **"the upload your own tab's stuff feels too greyed out, we can have the
   full color reapply on hover to show how the base one truly looks?"** (20:04)
   Never implemented, despite becoming the *reference pattern* in Lane 2 of the
   UI plan ("Resting art can be subdued, but hover and keyboard focus reveal
   the full preview"). Inactive skin thumbnails were `grayscale-[0.6]
   opacity-[0.7]` with no hover or focus restore.
   **Fixed (2026-07-30, commit b197fdb) in `HeroCardPicker`,** the surface the
   request was actually about. Empty slots rest at `opacity-50` with a light
   desaturation and return to full colour and opacity on hover and keyboard
   focus; the upload hint moved to a corner badge so revealing the art no
   longer covers it. `HeroSkinsPanel` had already received the same treatment
   for inactive skin thumbnails. See the correction below for why this took two
   attempts.

3. **"cards in the big locker should have sub card for the sounds too"** (20:27)
   Attempted via the pill strip, which is what caused (1). The intent is now
   served by the hover/focus Sounds chip that deep-links to the hero's Sounds
   tab.

## Defects found while verifying

Not user-reported, found by driving the running build:

- The Looks-mode `?hero=` handler ran even in Sounds mode, so the per-card
  Sounds link raced it and landed on the Looks hero page instead.
- Global Sounds' back control went to *Looks*, losing the user's place, and the
  Sounds landing carried a duplicate "Looks" button beside its own tablist.
- `LockerModeSwitch`, the Global `Visuals|Sounds` tabs, and the per-card
  buttons shipped hardcoded English rather than `t()` keys.
- The hero rail's "All sound mods for this hero" and "Pick sounds per ability"
  both linked away to surfaces now rendered on the same page.
- Card hover controls used `focus-visible:opacity-100`, so the reveal never
  fired for the Browse/Favorite buttons under plain `:focus`.

## Still open

Lanes 1-3 of `ui-thoughtfulness-and-adjustability-plan.md` (weak-state audit,
interaction patterns, bounded adjustability) and the follow-on search polish on
Installed, Browse, Profiles, and Stats.

## Correction (2026-07-30): request 2 was about portraits, not skins

This audit misidentified the surface, and the fix landed on the wrong
component. Recording it here because the mistake was then repeated twice in
`global-locker-foundry-ux-plan.md` before the transcript was checked.

**Evidence.** The session containing the 20:04 message
(`~/.codex/sessions/2026/07/29/rollout-2026-07-29T14-52-31-*.jsonl`) opened at
19:52 with *"Build the portrait shelf for Grimoire: give the Locker hero page's
Cards section the installed-content half that the Sound Locker just gained, and
pull portrait randomization into one home"*, against
`docs/portrait-shelf-plan.md`. So "the upload your own tab" is the **portrait**
upload tab in `HeroCardPicker`, keyed `locker.cards.uploadYourOwn` at
`src/components/locker/HeroCardPicker.tsx:500`. Calling it the skins panel was
wrong.

**The behaviour was the inverse of the request.** An unpicked variant slot
rendered its base art at `opacity-30` with no hover or focus restore, and the
very next element added `group-hover:bg-black/55`. Hovering a dimmed portrait
therefore *darkened* it. The ask was to reveal full colour on hover.

Fixed in commit b197fdb. The class logic now lives in
`src/components/locker/cardSlotStyles.ts` with tests in
`cardSlotStyles.test.ts`.

### Definition of done, and how each was met

1. Rest state is `opacity-50` with `grayscale-[0.35]`, and hover/focus reach
   `opacity-100 grayscale-0`. Done.
2. The full-cover `bg-black/55` scrim is gone. The upload hint is a corner
   badge at `bottom-1 right-1`. Verified in the running app: zero elements
   covering >=90% of the slot carry a `bg-black` class. Done.
3. `group-focus-within` gives keyboard parity, and a test asserts
   `focus-visible` does not appear. Done.
4. `motion-reduce:transition-none` on both image and badge; the reveal is a
   class swap, so the revealed state is still reached. Done.
5. Captions sit below the tile, not over the art, so the reveal cannot reduce
   their contrast. Done.
6. `cardSlotStyles.test.ts` asserts rest vs revealed differ, that no darkening
   class appears in either state, and that rest and filled are distinguishable.
   Done.
7. Verified in the running app. **A note on how**, because the obvious probe
   lies: Chromium does not apply `:focus`/`:focus-within` *styles* while the
   Electron window is unfocused, even though `element.matches(':focus-within')`
   returns true and `document.activeElement` updates. A computed-style read
   therefore reports a false negative. Asserted instead that Tailwind generated
   every reveal utility, that the reveal rules follow the base utilities in
   source order, that the reveal rule carries higher specificity
   (`.group-focus-within\:opacity-100:is(:where(.group):focus-within *)`), and
   that the slot image matches both rules while focused. Screenshot captured of
   the rest state showing visible base art with corner badges.
8. `pnpm lint`, `pnpm typecheck`, `pnpm exec vitest run` (1217 passing),
   `pnpm i18n:check`, and `pnpm encoding:check` all green. No i18n keys moved.
9. Entry updated above, naming `HeroCardPicker` as the component changed.

**Scope note.** Extracting the reveal into a shared card primitive is the right
end-state (see structural cause S6 in `global-locker-foundry-ux-plan.md`), but
it is not required for this entry to close. Fix the reported surface first.
