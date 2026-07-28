# Work order

The order to actually do the work in [remaining-work-phases.md](./remaining-work-phases.md).
Written 2026-07-28. Replaces the eight-lane parallel plan, which was more
coordination than this project can pay for.

## Why serial, mostly

Eight concurrent lanes assumed eight independent workers. With one or two
people, parallelism costs more than it saves here:

- Nearly every lane appends to the same four files (`preload/index.ts`,
  `types/electron.ts`, `lib/api.ts`, `translation.json`), so every extra lane
  adds a merge tax.
- The two highest-value items (Foundry source actions, Foundry combined output)
  share files with each other and must be sequential regardless.
- Step 0 is an audit that is expected to delete items from the list. Work started
  before it finishes may be work on something already shipped. That already
  happened three times in the docs.

So: one ordered spine, with exactly two things parked alongside it because they
are human-gated rather than code-gated.

## The order

### 0. Audit first. Everything else waits on it. **DONE 2026-07-28.**

Ran [spec-audit-prompt.md](./spec-audit-prompt.md), sections A through J,
read-only. **Output: [audit-2026-07-28-verdicts.md](./audit-2026-07-28-verdicts.md).
Read it before starting any step or wave below.** Doc headers were corrected in
the same session.

It did shorten the list, as expected. Headline changes, all detailed in the
verdicts file:

- **Step 2 / wave 2 item A (Foundry combined output) has shipped.** It reduces to
  a preflight fix, one deleted UI sentence, and a missing test. This also removes
  wave 2's stated dependency on wave 1.
- **Step 5's 3D spike premise is false.** The rigged no-`--pose` export path
  already exists; re-aim the spike at measuring it, not at proving it can run.
- **Audio format conversion has shipped**, so it leaves "deliberately not
  scheduled".
- **The VFX recolor roster has shipped** at 38 heroes, not two.
- One live correctness gap found: staged sound edits skip the exact-path
  preflight that the visual flow runs. Highest-priority item on the board.

Cost: one session. Blocks: nothing further.

### 1. Foundry source actions

`AssetSourcesPanel` is inspect-only. Add audition, open in Installed,
enable/disable via the mod store, shuffle-pool add/remove, and create-replacement.
Then extend `MySoundChanges`, then finish the pool editor (assignment preview,
persisted seed, `Shuffle now`).

Why here: it is the most user-visible gap, it needs nothing new underneath, and
it lands the `ipc/foundry.ts` and `SoundRow` changes that step 2 builds on.

### 2. Foundry combined output

Wire the live sound and visual authoring flows into one reviewed write set in the
build tray, then implement the confirmed named-VPK build with atomic cancel.

Why after 1: same files, and 1's IPC additions come first. This also unblocks the
Foundry models/VFX slice, which is otherwise dead.

### 3. Merge review UI

Surface the existing read-only `analyze-merge` before a merge is confirmed:
grouped collisions, effective winner, source reordering in the new workflow only.
Milestone 2 of the composition roadmap, nothing further.

Why here: small, self-contained, no dependency on Foundry. Good recovery work
after two large steps.

### 4. Performance ConVar controls

Reset-to-game-default per control, value-state badges, out-of-range warning
instead of silent clamp, pending-versus-applied summary.

Why here: also small and self-contained. Steps 3 and 4 are interchangeable.

### 5. Pick exactly one long-lead item

Do not start all three. In descending order of recommendation:

- **3D rigged spine spike.** Highest technical risk, highest ceiling, and it
  gates four downstream phases. Timeboxed, ends in a report, not a feature.
- **Social phase 1.5.** Straightforward but spans two repos.
- **VFX recolor roster.** Pure grind: one recipe per hero, each needing an
  in-game screenshot.

### Parked alongside (human-gated, not code-gated)

- **Release integrity.** The packaged Windows smoke test is a human sitting in
  front of the game. Ungated 2026-07-28: **it does not block a release.** Run it
  whenever a build exists and fix forward. It remains the only thing that would
  catch a packaging or in-game regression, so shipping without it means shipping
  on the strength of unit tests and types alone.
- **VFX in-game confirmations.** The outstanding Paige and Celeste checks are
  screenshots, not code. Do them next time the game is open.

### Deliberately not scheduled

Foundry models/VFX browsing (blocked on a trustworthy path catalog; the step 2
dependency is satisfied), composition milestones 3 through 5 (blocked on step 3),
3D retarget and ability-cast phases (blocked on the re-aimed spike's report,
not on the rigged path itself, which exists), social phase 2 (moderation cost
postponed on purpose), overflow renderer polish (optional).

Audio format conversion left this list: it shipped. FFmpeg is bundled and
asar-unpacked, and non-MP3 input is transcoded before the mint path runs.

## Waves

The spine above, regrouped into three waves. Each wave holds two items whose
file sets do not intersect, so one worker can hold both in a session without
merge pain. A wave starts only when the previous wave's gate is green.

Revised after the step 0 audit. The original wave 2 item A collapsed, which both
frees its slot and removes wave 2's dependency on wave 1.

| Wave | Items | Why they are safe together | Gate to open the next wave |
| --- | --- | --- | --- |
| **0.5** | Staged-sound preflight fix + stale MP3-only copy | **DONE 2026-07-28.** Gate green: typecheck, lint, 753 tests, `i18n:check` (1969 keys), manifest regenerated. Still needs a human in-game check that a staged-then-forged sound plays. |
| **1** | Foundry source actions (step 1) + Merge review UI (step 3) | Foundry components vs `MergeModsModal`/`modMerger`; no shared file | Gate green |
| **2** | Performance ConVars (step 4) + one long-lead item (step 5) | `components/performance` vs Locker preview or `Discover`/`social`; no shared file | Gate green; spike report written or social gate green in both repos |

Wave 0.5 exists because the audit found one live correctness gap and it should
not sit behind a large UI item for two waves. It is roughly an hour of work.

No wave now depends on another for shared IPC. They are ordered by value, not by
dependency, so any of them can slip without cost.

Within a wave, land the shared-surface additions (`preload/index.ts`,
`types/electron.ts`, `lib/api.ts`, `translation.json`) in one small commit per
item before the feature work, so the two items never race on those four files.

Parked across all waves: the release-integrity smoke checklist and the VFX
in-game confirmations. Both are human tasks and block nothing.

The wave gate is:

```
pnpm typecheck && pnpm lint && pnpm test
```

plus `pnpm i18n:check` and one `pnpm i18n:manifest` if any translation key
changed. A red gate stops the wave; it does not roll into the next one.

## Prompts

Each step's prompt is self-contained and states its owned files, its invariants,
and its exit gate. Every step ends with the repository gate:

```
pnpm typecheck && pnpm lint && pnpm test
```

and, if any translation key changed, `pnpm i18n:check` then `pnpm i18n:manifest`.

Step 0's prompt is [spec-audit-prompt.md](./spec-audit-prompt.md). The rest are
in the session that produced this plan; regenerate from
[remaining-work-phases.md](./remaining-work-phases.md) if lost.
