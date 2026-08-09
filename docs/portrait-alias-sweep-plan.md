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

## Results (2026-08-09)

Legs B and C ran against the working tree on 2026-08-09. The tree was clean when the
build was driven: the only pre-existing change was the workflow's auto-advance toggle in
`.planning/config.json`, and it was committed first so the reading would be evidence
about this build and nothing else. The run used `GRIMOIRE_DEV_SLOT=2` (Vite 5175, CDP
9224), a non-zero slot nobody else held, and the slot's live identity was confirmed
before any reading: `window.__GRIMOIRE_DEV_SLOT` returned 2. The catalog came from the
game at `D:\Steam\steamapps\common\Deadlock`, the `deadlockPath` the slot's seeded
profile carries. The build was shut down after the readings and the slot left free.

**The catalog side (Leg B).** `window.electronAPI.foundry.ensureThumbnails('hero-image')`
returned 405 items covering 78 distinct non-null codenames, with no null-hero item. The
raw dump is held in the sweep scratchpad as JSON with the total item count.

**The resolver side (Leg B).** The unscoped portraits catalog's hero filter is the
centralized resolver's output at the point a user meets it: a codename the resolver can
place renders under its hero name with the codename as the hint, and a codename it
cannot place renders under the codename itself with the "Unreleased or internal" hint,
muted, sorted below the roster. Every claimed codename that ships in the catalog
resolves to its hero. The codenames the loaded build ships but the alias table never
claimed are the lowercase roster-name panorama folders (`billy`, `calico`, `geist`,
`grey`, `infernus`, `ivy`, `mina`, `paradox`, `pocket`, `seven`, `victor`, `vindicta`,
`vyper`) plus the internal set (`frog`, `generic`, `genericperson`, `mask`, `patience`,
`targetdummy`); they render unresolved per D-12. Some roster names do resolve (`abrams`,
`dynamo`, `mcginnis`, `krill`, `doorman`) because the panorama and roster namespaces
share those entries. None of the unresolved codenames is a claimed codename of a hero in
the mismatch list, so none changes a verdict row.

### Verdict table

One row per hero in the mismatch list. "In catalog" and "Resolver places" are stated per
codename. For the four codenames that ship no family in this build (`atlas`, `orion`,
`ghost`, `forge`), "Resolver places: yes" comes from Leg A's passing tests
(`displayNameForHeroCodename`), the only side that can state a mapping for a codename
the loaded build does not contain. "Families" is the count the hero's scoped Foundry
portraits surface reported, read off the DOM and stability-checked. A codename recorded
as "family present" is the healthy case the four-way table has no defect row for: it is
in the catalog, the resolver places it, and the scoped surface renders its families.

| Hero | Codenames | In catalog | Resolver places | Families | Verdict |
| --- | --- | --- | --- | --- | --- |
| Abrams | atlas, bull | atlas: no; bull: yes | both: yes | 2 | atlas: not indexed; bull: family present |
| Apollo | fencer | yes | yes | 3 | family present |
| Billy | punkgoat | yes | yes | 2 | family present |
| Calico | nano | yes | yes | 2 | family present |
| Celeste | unicorn | yes | yes | 3 | family present |
| Dynamo | dynamo, sumo | both: yes | both: yes | 3 | family present |
| Graves | necro | yes | yes | 3 | family present |
| Grey Talon | orion, archer | orion: no; archer: yes | both: yes | 2 | orion: not indexed; archer: family present |
| Holliday | astro | yes | yes | 3 | family present |
| Infernus | inferno | yes | yes | 2 | family present |
| Ivy | tengu | yes | yes | 1 | family present |
| Lady Geist | ghost, spectre | ghost: no; spectre: yes | both: yes | 2 | ghost: not indexed; spectre: family present |
| McGinnis | forge, engineer | forge: no; engineer: yes | both: yes | 2 | forge: not indexed; engineer: family present |
| Mina | vampirebat | yes | yes | 2 | family present |
| Mo & Krill | krill, digger | both: yes | both: yes | 3 | family present |

No row is blocked: every hero was measured on the driven build. No verdict was inferred
from a source read alone; the catalog facts came from the running app, the resolver
facts came from the rendered filter, and the four absent codenames used the Leg A tests
that are the only possible source for a mapping to a codename the build does not ship.

### Leg C record

Three heroes were driven end to end, and Abrams is among them because it is the hero
issue #4 names: Abrams, Grey Talon, and Mo & Krill.

| Hero | Foundry portrait workshop | Locker Cards & portraits | Surfaces agree |
| --- | --- | --- | --- |
| Abrams | 2 portrait families, grid state | "Portrait families", 1 family; slot reads "Replacement installed but disabled"; copy names Abrams; Edit in Foundry present | yes |
| Grey Talon | 2 portrait families, grid state | "Portrait families", 1 family; slot reads "Base game art"; copy names Grey Talon; Edit in Foundry present | yes |
| Mo & Krill | 3 portrait families, grid state | "Portrait families", 1 family; slot reads "Base game art"; copy names Mo & Krill; Edit in Foundry present | yes |

For each hero the Foundry workshop reported base-game portrait families from the loaded
catalog and the Locker cards section attributed a portrait family to the same hero, so
the two surfaces agree on whether that hero has a portrait family. The text assertions
above are the evidence; the screenshots are the illustration. Screenshots were written
to the sweep scratchpad (`C:\Users\wayba\AppData\Local\Temp\gsd-05-05-sweep\legc-foundry-*.png`
and `legc-locker-*.png`) for attaching to the issue.

### Standing conclusion

No alias miss was found. Every claimed codename that the loaded build ships resolves to
its hero in the rendered filter, and every hero in the mismatch list renders 1 to 3
portrait families on its scoped Foundry surface. The four claimed codenames the loaded
build does not ship families under (`atlas`, `orion`, `ghost`, `forge`) are "not
indexed" for that codename, and each of those heroes still has a sibling claimed codename
that does ship and resolve, so none of them empties the hero's surface.

The dual-table structure named as the most concrete lead is ruled out as the cause of
issue #4 on this loaded build. The reading that rules it out: Abrams's families in the
loaded catalog (`abrams`, `bull`) both resolve through the centralized resolver, and the
scoped Abrams surface renders 2 families. The #4 symptom, "Abrams Portraits resolves to
no families", did not reproduce. That is the sweep's outcome: a negative result, not an
absence of work. The record does not name a remaining defect; the lead consistent with
the pre-reproduction report but outside this measurement is a stale catalog cache or a
build whose folder naming predates the current table, and this sweep measured the
current loaded build, in which nothing points at the alias tables.

Plan 05-02 widened Leg A from the original twelve-hero mismatch subset to the whole
roster and added a cross-check that the two live alias tables cannot disagree. That
proves agreement wherever both tables have an opinion; it cannot prove either table is
complete. Completeness against the shipped build is exactly what this Results section
measures, and the measure came back clean for every mismatch hero.

## Running this concurrently: what is safe and what is not

Updated 2026-08-09. The 2026-07-30 pause is discharged: the in-flight work on this
surface (`heroFilterOptions.ts` and `HeroSelect.tsx`) has landed, and the dev-slot
mechanism documented in CLAUDE.md gives a sweep its own Vite port, CDP port and
user-data directory, so a second dev server no longer contends with another session on
the shared ports.

**Leg A is safe to run alongside other work,** in a worktree off a known commit. It touches
one test file and reads one module.

The constraints that stay are the permanent ones. Legs B and C drive the working tree, so
a sweep still needs a tree nobody else is editing and a slot nobody else holds: the
driver reads what the loaded build renders, and a dirty or shared tree makes the reading
uninterpretable as evidence about that build. Never slot 0 and never an unslotted app.
