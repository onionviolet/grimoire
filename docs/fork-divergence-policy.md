# Fork divergence policy

How this fork decides what to build, what to take from Slush97/grimoire, and
what to send back. Read this before starting a lane, not after.

Written 2026-07-29, from what the v1.26.0 absorption actually cost.

## Strategy: upstream-first, fork-selective

Upstream is the default product-design authority for shared UI. They ship more
often, in smaller increments, and have more experience maintaining those
surfaces across releases. That is useful evidence, not a reason to copy
blindly: their work should be the baseline we absorb, learn from, and improve
only when Grimoire has a clear product-specific reason.

This fork should not try to win by shipping a larger, parallel version of every
upstream feature. With a smaller and less experienced team, that strategy turns
review, testing, release support, and later absorption into one large unknown.
We win by being selective:

- absorb upstream's general UX and structural improvements early;
- make fork work narrow, composable, and easy to remove or re-apply;
- invest our scarce design attention in Grimoire-specific workflows, especially
  Locker, Foundry, staging, and safe mod composition;
- treat polish, accessibility, and recovery from mistakes as release work, not
  optional finishing work.

When there is no written user problem or differentiator, prefer upstream and
wait. "We can build it too" is not a sufficient reason to diverge.

## The cost model

Absorption cost is **not** how many commits behind we are. It is how many files
both sides edited, and whether we edited them for the same reason.

The v1.26.0 evidence: 11 upstream commits touched 47 files. We had touched 24 of
them. 15 conflicted. Fourteen of those fifteen were cheap, because the two sides
had grown in different files for different reasons. Exactly one was expensive,
and it was expensive for one reason: **both sides built the same feature
independently.** `performanceConfig.test.ts` conflicted add/add because each side
wrote that file from nothing.

So the thing to minimize is not divergence in general. It is duplicated
intent.

## Rule 1: look at upstream's branches before starting a lane

This is the rule that would have prevented the whole performance-config port.

Upstream carries roughly thirty branches with unmerged work at any time. Several
sit directly on top of this fork's roadmap. As of 2026-07-29:

| Branch | Ahead | Overlaps |
|---|--:|---|
| `fix/imprint-followups` | 10 | imprint/hero preview |
| `feat/locker-3d-card-snapshots` | 9 | Locker card surfaces |
| `fix/pre-release-cleanup` | 9 | broad |
| `discord-feature-requests` | 8 | broad |
| `feat/prism-tuning-ui` | 5 | Foundry / VFX |
| `feat/unified-launcher-backgrounds` | 5 | appearance |
| `feat/hero-pose-locker` | 4 | hero preview, Locker |
| `feat/soul-container-yaw-ui` | 3 | Foundry / VFX |
| `feat/locker-hide-empty-and-quick-install` | 2 | Locker parity |
| `feat/dmm-import` | 2 | import surfaces |
| `feat/foundry-sound-import` | 1 | our Sound Locker and source panels |
| `refactor/ui-modernization` | 1 | the whole consistency pass |

Before opening a lane:

```
git fetch upstream
git branch -r --list 'upstream/*' --sort=-committerdate
git log --oneline upstream/main..upstream/<branch>
```

If a branch is already doing it, the cheap move is to wait for it to land and
absorb, or to build the part upstream is not building. Building it in parallel
is the expensive move, and it is expensive twice: once at merge, and again every
time either side touches the file afterward.

## Rule 1a: start with a thin vertical slice

Do not begin with a broad redesign or a multi-page feature plan. Describe one
user outcome in a sentence, then ship the smallest end-to-end slice that makes
that outcome real. A slice includes the user-visible UI, its data/error state,
and the check that proves it works; it does not include speculative settings,
secondary variants, or a component-library rewrite.

For a larger idea, use this sequence:

1. Write the user problem, the relevant upstream work, and the intended fork
   differentiator in the lane doc or PR description.
2. Build one bounded slice in new files where possible.
3. Use it with real app data; fix confusing wording, empty states, failure
   recovery, keyboard handling, and layout before expanding scope.
4. Absorb or inspect current upstream again before starting the next slice.

This gives us the advantage of upstream's smaller shipments without pretending
we can match their throughput. It also makes a wrong design cheap to revise.

## Rule 2: build additively, in new files

The re-apply cost of our work scales with how much of it lives inside files
upstream also owns.

What re-applied almost for free in the v1.26.0 merge:

- `useEscapeKey` / `useDismissable`, `ResultSummary`, `uiPrefs`, the shared
  confirmation dialog. New modules that existing files call. Upstream's version
  of the caller can adopt them in one line.
- `setPerformanceHudConvars`, `setPerformanceAdvancedConvars`,
  `clearPerformanceConvars`, `HUD_CONVARS`, `ADVANCED_GAMEINFO_CONVARS`. New
  exports upstream does not define, so they collide with nothing.

What cost the most:

- 325 lines added to the `src/pages/Settings.tsx` monolith, which upstream then
  split into eight section files. Every one of those lines had to be re-homed by
  hand.

The lesson is mechanical, not aesthetic: **a new file is cheap to carry, an edit
to a shared file is not.** When a change could be either, make it a new module
and have the shared file call it.

## Rule 3: default to upstream on shared surfaces

When upstream's version of a surface is better, or even just equal, take
upstream's. Keep ours only where it is a deliberate fork differentiator we can
name.

Areas this fork owns, and intends to keep owning:

- The consistency floor: one Escape contract, real tablist wiring, one
  result-count convention, one confirmation dialog, one preference store. See
  `docs/locker-consistency-pass.md`.
- The Foundry forge path and staged edits.
- The performance card's surface: staged edits, per-value origin badges,
  HUD/advanced rows.

Areas upstream owns, and we should stop editing except through new modules:

- `src/pages/Settings.tsx` and `src/components/settings/**`. Upstream just
  restructured this whole tree; fighting it is pure cost.
- Preset data and the applier's data model. The reason is in
  `docs/performance-config-integration.md`: preset values drift with every
  Deadlock patch, and that is only safe when the upstream author maintains the
  manifest.
- Release plumbing and auto-update config.

## Rule 4: absorb on upstream's release cadence

11 commits behind cost 15 conflicts and one hard port. The relationship is worse
than linear, because divergence compounds: every commit we land on a file
upstream is also changing makes the eventual merge harder, and we do not find
out until the merge.

Absorb at every upstream release tag rather than when the gap becomes annoying.
`git fetch upstream && git log --oneline HEAD..upstream/main` is a ten-second
check; make it a habit at the start of a lane.

## Rule 5: send the generic work upstream

This is the highest-leverage item here and the only one that reduces divergence
permanently rather than managing it.

Most of the consistency pass is not fork-specific. "Everything dismissible is
Escape-dismissible", "every `role="tab"` names a panel that exists", "one
sentence for what a filtered list narrowed to", "one confirmation dialog instead
of twelve `window.confirm` calls" are improvements any Grimoire benefits from,
and upstream has a `refactor/ui-modernization` branch suggesting they want the
same thing.

Work that lands upstream stops being divergence. It becomes code both sides
maintain, which means the next absorption does not have to re-apply it. Work we
keep to ourselves has to be re-applied at every merge, forever.

Candidates to offer upstream, roughly in order of how likely they are to be
taken:

- `useEscapeKey` / `useDismissable` and the dismissal contract (`53a0773`)
- the tablist wiring (`6b88984`)
- the result-count convention (`c66520b`)
- the shared confirmation dialog (`b61ed27`)
- the typed preference store (`d66f4d7`)

Keep as fork-only what is genuinely a different product opinion, not merely
ours.

## Rule 6: QoL lock is a quality gate, not a freeze

"QoL lock" means we do not add another feature to a surface that is currently
hard to understand, inconsistent, or unsafe to use. It does **not** mean the
UI is frozen or that small repairs need a new roadmap. During the lock, prefer
small fixes that reduce user effort and make the next feature safer to build.

Before a UI slice is called complete, verify the applicable items below:

- **Understand:** the primary action, current state, and consequence of a
  destructive action are clear without reading a guide.
- **Control:** keyboard focus is visible; Escape closes dismissible UI; tabs and
  controls have correct semantics; controls work at narrow window sizes.
- **Recover:** loading, empty, error, and partial-success states explain what
  happened and offer the next useful action. Staged edits can be reviewed,
  discarded, or applied deliberately.
- **Stay consistent:** use existing primitives, wording conventions, tokens,
  confirmation dialog, and preference store. A new pattern needs a documented
  reason and an owner.
- **Prove it:** run the focused tests and manually exercise the normal workflow
  when it is convenient. Automated checks are the merge gate; an unavailable
  manual smoke is evidence we have not collected yet, not a reason to strand a
  reviewed change. Add a regression test when behavior, not just styling, was
  changed.

The reference for shared UI conventions is `docs/ui-conventions.md`; the active
cross-surface cleanup is `docs/locker-consistency-pass.md`. If a change violates
either, fix that before expanding the feature.

## Rule 6a: collect smoke evidence, do not demand it up front

Manual testing is useful because it catches integration and visual failures that
unit tests cannot see. It is a poor blocking ritual when the person with the
game is not currently available or does not know what to look for. Do not make
an unstructured "please smoke test this" a merge or planning gate.

When someone does run the app or game, the tooling/agent should collect what it
can automatically first: app and sidecar version, commit, active preset or
feature flags, relevant diagnostics/log excerpt, and the exact artifact or
development command used. It should then ask only the smallest useful set of
observable questions, for example:

- Did the intended action complete, and what changed on screen or in game?
- Did any warning, error, stale state, or unexpected visual result appear?
- If the workflow changed state, did closing/reopening or undoing it leave the
  expected result?

The answer becomes a dated smoke record attached to the change or release. A
missing record means **unverified manually**, not **blocked**. A specific failed
record creates a focused follow-up with its artifact/diagnostic context; it does
not reopen unrelated work.

## Rule 7: keep the delivery workflow boring

Inexperience is best managed by making the safe path routine and reviewable.
Every lane should have one owner, a narrow goal, a small sequence of commits,
and a stopping point after the first usable slice. Avoid combining a feature,
refactor, visual redesign, and upstream absorption in the same change unless
there is no separable path.

Before merge, the author records:

- the upstream branch/tag checked and whether it overlaps;
- the user outcome and any intentional fork differentiator;
- tests and manual workflow exercised;
- follow-ups deliberately left out of this slice.

Reviewers should be able to answer four questions quickly: *What user problem
did this solve? Why is upstream not already the answer? What happens when it
fails? Can we absorb upstream afterward without rebuilding this by hand?* If
those answers are unclear, reduce scope or defer the work.

## Per-absorption habit: decide each UI commit explicitly

The failure mode is not choosing wrong, it is not noticing there was a choice.
For each upstream commit that touches a surface we also touch, record one of
three verdicts in that absorption's doc, with a reason:

- **take** upstream's wholesale, drop ours
- **keep** ours, and say what makes it a differentiator
- **port**, meaning take upstream's structure and re-apply our surface on top

Take and keep are cheap. Port is what cost a whole pass in v1.26.0, so a port
verdict should come with an explicit reason it is worth it.

Resolve at the level of the verdict, never hunk by hunk. Hunk-level resolution
of two independent implementations produces code neither side reviewed, which is
the worst outcome available.

## Deferred: splitting old commits

Considered and deliberately not done: rewriting history to split over-stuffed
old commits (`106b4b8`, 70 files, "six-lane changes plan **plus** the VPK
identity gate"; `0fbef5b`, 39 files, still labelled `wip`) into per-feature
commits.

It would raise the ahead-count without adding work, and the count is not a
measure of anything: a reader sees the diff, not the number. Against that it
costs a force-push of 144 rewritten SHAs, invalidates every SHA cited in
`docs/upstream-absorption-1.26.md`, and risks clobbering concurrent work in
other checkouts of this repo.

If it is ever worth doing: only after an absorption has landed and been pushed,
only with no other session working the repo, and only on those two commits. The
better answer is Rule 2 plus splitting new work as it lands, which the
consistency-pass commits already do.
