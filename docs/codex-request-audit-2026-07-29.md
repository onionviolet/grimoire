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
   **Fixed:** `HeroSkinsPanel` restores full colour on hover *and* keyboard
   focus, for both the thumbnail and the glass backdrop.

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
