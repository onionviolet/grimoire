# Portrait alias sweep (issue #4, items 4 and 7)

Plan of record for the one remaining path to a root cause on
[#4](https://github.com/onionviolet/grimoire/issues/4) ("Abrams Portraits resolves to no
families"). Written 2026-07-30 while the defect is not reproducing.

## Why this is the path

Items 1 and 3 (root cause, regression test) are blocked on a reproduction that has not
come back. Item 4 is the only remaining work that could *produce* one rather than wait for
one, because it checks every hero with a codename mismatch instead of the single hero that
happened to get reported.

The reason it needs the real catalog: since `0fbef5b` the UI renders "no indexed family"
and "alias miss" through the *same* card. `foundry.portraits.notIndexed.*` fires whenever a
scoped hero yields zero families, and it cannot know whether that is because the resolver
failed to map the hero to its engine codename or because the pak genuinely has no family
under a codename that mapped fine. Only the indexed catalog, held next to the alias table,
separates them.

## The three-way test

For each hero in the mismatch list, hold two facts side by side: what
`resolvePortraitHero` / `portraitCodenamesForHero` (`src/lib/heroPortraitIdentity.ts`)
return, and which codenames the loaded catalog actually contains.

| Codename in catalog | Resolver maps it to a hero | Verdict |
| --- | --- | --- |
| yes | no | **Alias miss.** The table is missing a codename the build ships. This is the #4 hypothesis. |
| no | yes | **Not indexed.** Table is right, pak has no family. The current empty state is honest. |
| yes | yes, but zero families | Family key derivation is wrong, not the alias. Look at `portraitFamilyKey`. |
| no | no | Hero absent from this build. Not a defect. |

## Legs

**Leg A - alias table self-consistency.** Pure unit test, no catalog, no app. Every hero
named in #4 item 4 has its codenames present; no codename maps to two heroes; round-trip
`portraitCodenamesForHero` -> `displayNameForHeroCodename` returns the original display
name. Extends `src/lib/heroPortraitIdentity.test.ts`. This cannot find an alias *miss*
(the table cannot know what it omits) but it catches collisions and typos, and it is the
part that runs with nothing else running.

**Leg B - catalog cross-check.** Enumerate the codenames the indexed catalog contains,
run the table above, report per hero. Needs the real catalog through the Foundry IPC that
`CatalogDiagnostics` already uses (`f4509b7`). This is the leg that can find the root
cause.

**Leg C - dev-driver verification (item 7).** `scripts/dev-driver.mjs` across at least
three heroes including Abrams, with screenshots. Prefer `text`/`html` assertions over
`shot`; the screenshots are for the issue, the assertions are the evidence.

## Running this concurrently: what is safe and what is not

Checked 2026-07-30 12:36. `main` was at `8779e1b` at the start of this session and is now
at `cd6a57f`, so commits are landing live.

**Leg A is safe to run alongside other work,** in a worktree off a known commit. It touches
one test file and reads one module.

**Legs B and C are not, right now,** for two reasons:

1. *The dev-driver drives the working tree, and the working tree is not mine.* There are
   uncommitted changes in `src/components/foundry/LibraryBrowse.tsx`,
   `src/components/common/HeroSelect.tsx`, `electron/main/services/autoexec.ts`,
   `src/types/electron.ts`, plus untracked `src/components/foundry/heroFilterOptions.ts`
   and its test. A sweep run now would be measuring someone else's in-flight edits, and
   any result would be uninterpretable as evidence about #4.
2. *That in-flight work is on this exact surface.* `heroFilterOptions.ts` imports
   `displayNameForHeroCodename` from `heroPortraitIdentity` and already draws the
   "codename that resolves to no hero" distinction in the filter dropdown - the same
   distinction Leg B is trying to measure in the catalog. Sweeping mid-edit risks both
   confusing the result and duplicating work.

There is also a single dev server: port 5173 is listening (PID 43000) and port 9222 has
recent CDP client connections, so a driver session is already attached. Two `pnpm dev`
instances would contend on both ports.

**Therefore:** run Leg A now if anything. Legs B and C wait for the working tree to be
committed or stashed by whoever owns it, and are worth re-scoping once
`heroFilterOptions.ts` lands, since it may already cover part of Leg B's reporting.
