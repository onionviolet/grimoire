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
   **Partly fixed, and on the wrong surface:** `HeroSkinsPanel` restores full
   colour on hover *and* keyboard focus, for both the thumbnail and the glass
   backdrop. See the correction below: the request was about portraits, so this
   entry is **still open**.

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

## Correction (2026-07-29, later): request 2 was about portraits, not skins

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

**Current behaviour is the inverse of the request.** At
`HeroCardPicker.tsx:536` an unpicked variant slot renders its base art at
`opacity-30` with no hover or focus restore, and the very next element
(`:538`) adds `group-hover:bg-black/55`. Hovering a dimmed portrait therefore
*darkens* it. The ask was to reveal full colour on hover.

### Definition of done (all must hold)

1. `HeroCardPicker.tsx:536` no longer applies a flat `opacity-30` at rest with
   no recovery path. Resting dimming may stay, but hover and focus must reach
   full opacity and full colour.
2. The `group-hover:bg-black/55` scrim no longer darkens the art while it is
   being revealed. The upload affordance stays discoverable (badge, ring, or
   caption) without covering the preview.
3. Keyboard parity: `group-focus-within` (or equivalent) produces the same
   reveal as hover. Do **not** rely on `focus-visible:`, which this repo has
   already been burned by (see "Defects found while verifying" above).
4. `prefers-reduced-motion: reduce` disables any transition on the reveal while
   still reaching the revealed state.
5. Contrast: revealed and resting states both keep caption and status text at
   WCAG AA against the art behind them.
6. A component test asserts, for one unpicked slot, that the rest state and the
   hover/focus state differ in opacity class and that no darkening class is
   applied in the revealed state.
7. Verified in the running app with `scripts/dev-driver.mjs`, with before/after
   screenshots of one unpicked slot at rest and revealed. Because `:focus` does
   not match while the Electron window is unfocused, assert the focus path from
   generated CSS or behaviour, not a computed style probe.
8. Gates green: `pnpm lint`, `pnpm exec vitest run`, `pnpm i18n:check`, and
   `pnpm i18n:manifest` if any key moved.
9. This audit entry is updated to **Fixed** only once 1-8 hold, naming the
   component actually changed.

**Scope note.** Extracting the reveal into a shared card primitive is the right
end-state (see structural cause S6 in `global-locker-foundry-ux-plan.md`), but
it is not required for this entry to close. Fix the reported surface first.
