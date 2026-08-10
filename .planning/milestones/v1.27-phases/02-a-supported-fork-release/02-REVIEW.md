---
phase: 02-a-supported-fork-release
reviewed: 2026-08-07T00:00:00Z
depth: standard
files_reviewed: 61
files_reviewed_list:
  - .claude/settings.local.json
  - .husky/pre-push
  - docs/fork-maintenance.md
  - docs/ingame-verification-record.md
  - docs/profile-spec.md
  - docs/social-architecture-decisions.md
  - docs/social-architecture.md
  - electron/main/services/foundryAssetSources.ts
  - electron/main/services/heroPortraits.ts
  - electron/main/services/heroPoseModels.ts
  - electron/main/services/heroSoundCodenames.ts
  - electron/main/services/metadata.ts
  - electron/main/services/modIdentity.test.ts
  - electron/main/services/mods.ts
  - package.json
  - scripts/check-release-engine-pin.mjs
  - scripts/check-verification-record.mjs
  - scripts/check-verification-record.test.ts
  - scripts/fetch-vpkmerge.mjs
  - src/components/UpdateModal.tsx
  - src/components/foundry/AssetSourcesPanel.tsx
  - src/components/foundry/ChangePools.tsx
  - src/components/foundry/GlobalSoundBrowse.tsx
  - src/components/foundry/HeroWorkshop.tsx
  - src/components/foundry/LibraryBrowse.tsx
  - src/components/foundry/MyChanges.tsx
  - src/components/foundry/MySoundChanges.tsx
  - src/components/foundry/PortraitBrowse.test.ts
  - src/components/foundry/PortraitBrowse.tsx
  - src/components/foundry/PortraitEditor.tsx
  - src/components/foundry/SoundBrowse.tsx
  - src/components/foundry/TextureBrowse.tsx
  - src/components/locker/SoundEntryRow.tsx
  - src/components/settings/sections/SupportSection.tsx
  - src/components/social/dormantService.test.ts
  - src/components/supportDestinations.test.ts
  - src/lib/assetClaims.test.ts
  - src/lib/assetClaims.ts
  - src/lib/disabledModPrefs.ts
  - src/lib/globalSoundSections.ts
  - src/lib/heroCodenames.test.ts
  - src/lib/heroIdentity.test.ts
  - src/lib/heroIdentity.ts
  - src/lib/heroPortraitIdentity.test.ts
  - src/lib/heroPortraitIdentity.ts
  - src/lib/inspectedAssetClaims.test.ts
  - src/lib/inspectedAssetClaims.ts
  - src/lib/lockerRandomizer.ts
  - src/lib/portraitInventory.ts
  - src/lib/recordedClaims.ts
  - src/lib/soundInventory.test.ts
  - src/lib/soundInventory.ts
  - src/lib/soundVocabulary.test.ts
  - src/lib/soundVocabulary.ts
  - src/lib/useAssetClaims.ts
  - src/locales/en/translation.json
  - src/locales/manifest.json
  - src/pages/ChatWheel.test.tsx
  - src/pages/ChatWheel.tsx
  - src/pages/Foundry.tsx
  - src/stores/appStore.ts
findings:
  critical: 1
  warning: 3
  info: 1
  total: 5
status: issues_found
---

# Phase 02-a-supported-fork-release: Code Review Report

**Reviewed:** 2026-08-07
**Depth:** standard
**Files Reviewed:** 61
**Status:** issues_found

## Summary

This review covers the phase's own files plus two explicitly-included prior
trees the repository owner asked to be reconciled into this phase: the
`structural-refactor-7` merge (hero identity/portrait/sound consolidation,
Foundry pool/asset-claims plumbing) and the "stable mod uid" feature
(`metadata.ts`, `mods.ts`, `disabledModPrefs.ts`, `lockerRandomizer.ts`).

The hero-identity consolidation (`heroIdentity.ts` as the single four-namespace
table, with `assetClaims.ts`/`recordedClaims.ts`/`inspectedAssetClaims.ts` as
the one ownership-resolution pipeline shared by main and renderer) is careful,
well-tested work; I read the full call chain across process boundaries and did
not find a place where the renderer's cheap "recorded claims" view and the
main process's authoritative VPK-directory view could disagree in a way that
matters. The stable-mod-uid mechanism (`ensureModUids`/`mintModUid` in
`metadata.ts`, id-carry-through in `mods.ts`) is also sound and matches its own
test suite's claims (verified by re-deriving the collision/seeding logic by
hand).

One real correctness/data-loss gap surfaced in `mods.ts`'s priority-swap
fallback path (`directSwap`), which — unlike every other rename operation in
the same file — performs an unchecked, unrolled-back rename. Two Foundry
catalog components (`TextureBrowse.tsx`, `LibraryBrowse.tsx`) are missing the
request-cancellation guard that every sibling data-fetching component in the
same directory (`SoundBrowse.tsx`, `GlobalSoundBrowse.tsx`, `PortraitBrowse.tsx`)
consistently uses, which is a real, reproducible race condition under the
established pattern of this codebase, not a hypothetical one.

## Critical Issues

### CR-01: `directSwap` can silently overwrite an existing VPK and leaves no rollback on partial failure

**File:** `electron/main/services/mods.ts:1474-1499`

**Issue:** `swapModPriorityImpl` falls back to `directSwap(a, b)` whenever at
least one of the two mods being swapped is disabled (`aIdx === -1 || bIdx ===
-1`, mods.ts:1458-1462). `directSwap` computes each side's destination
filename with `renameWithPriority(fileName, newPriority)` and renames straight
to it:

```ts
const steps = [
    {
        from: join(parentA, a.fileName),
        tmp: join(parentA, `tmp${tmpId}_${a.fileName}`),
        final: join(parentA, renameWithPriority(a.fileName, b.priority)),
    },
    { /* same for b */ },
];

for (const step of steps) await fs.rename(step.from, step.tmp);
for (const step of steps) await fs.rename(step.tmp, step.final);
```

Every other rename path in this same file checks for a destination collision
before writing (`setModPriorityImpl`, mods.ts:1236-1248: `existsSync(...)` ->
`throw new Error('Priority ... is already in use')`), and the multi-mod
reorder path (`reorderModsImpl`) wraps its two-phase rename in a full
try/catch with an explicit rollback of every already-completed step
(mods.ts:1381-1414). `directSwap` has neither:

1. **No collision check.** A legacy pre-free-form-naming disabled mod (the
   kind `reconcileEnabledDisabledCollisions` explicitly still handles,
   mods.ts:607-627 comment) keeps a `pakNN_dir.vpk`-shaped filename and a real
   parsed priority (`scanFolder`'s `parseVpkPriority(entry) ??
   DEFAULT_MOD_PRIORITY`, mods.ts:358). Swapping such a legacy-named disabled
   mod against another mod computes a destination name that **is** a real
   `pakNN_dir.vpk` shape and can coincide with another file already at that
   slot in the same folder. On Windows, `fs.rename`/`MoveFileEx` (which
   libuv/Node uses under the hood) replaces an existing destination file
   rather than failing, so the pre-existing file at that name is silently
   destroyed with no user-facing warning.
2. **No rollback on partial failure.** If the second `fs.rename(tmp, final)`
   throws (e.g. the collision case above throwing `EPERM`/`EBUSY`, or the game
   briefly holding a handle), the first step's file is left stuck at its `tmp`
   name. That tmp name is `tmp<id>_<original _dir.vpk name>`, which still ends
   in `_dir.vpk`, so `isDeadlockModVpk`/`scanFolder` will pick it back up as a
   genuine (but oddly-named) orphan mod on the next scan — the metadata sidecar
   is never migrated for it because `migrateModMetadata` only runs after both
   renames succeed (mods.ts:1494-1498). `reorderModsImpl` avoids exactly this
   failure mode with its phase-tracked rollback; `directSwap` does not use the
   same pattern despite doing the same kind of two-phase rename.

**Fix:** Route the disabled-side swap through the same collision-checked,
rollback-capable machinery `reorderModsImpl` already has, or at minimum add
the same `existsSync` guard `setModPriorityImpl` uses before either rename,
plus a try/catch that reverses any already-completed step on failure:

```ts
async function directSwap(a: Mod, b: Mod): Promise<void> {
    const parentA = dirname(a.path);
    const parentB = dirname(b.path);
    const finalA = join(parentA, renameWithPriority(a.fileName, b.priority));
    const finalB = join(parentB, renameWithPriority(b.fileName, a.priority));
    if (existsSync(finalA) || existsSync(finalB)) {
        throw new Error('Cannot swap: destination slot already in use');
    }
    const tmpId = randomBytes(4).toString('hex');
    const steps = [
        { from: join(parentA, a.fileName), tmp: join(parentA, `tmp${tmpId}_${a.fileName}`), final: finalA },
        { from: join(parentB, b.fileName), tmp: join(parentB, `tmp${tmpId}_${b.fileName}`), final: finalB },
    ];
    const done: typeof steps = [];
    try {
        for (const step of steps) { await fs.rename(step.from, step.tmp); done.push(step); }
        for (const step of steps) await fs.rename(step.tmp, step.final);
    } catch (err) {
        for (const step of done.reverse()) {
            try { await fs.rename(step.tmp, step.from); } catch { /* best-effort */ }
        }
        throw err;
    }
    migrateModMetadata([
        { from: a.metaKey, to: metaKeyFor(finalA) },
        { from: b.metaKey, to: metaKeyFor(finalB) },
    ]);
}
```

## Warnings

### WR-01: `TextureBrowse.tsx`'s debounced catalog fetch has no stale-response guard

**File:** `src/components/foundry/TextureBrowse.tsx:115-149`

**Issue:** `load(category, heroFilter, search)` is debounced 250ms after any
of `category`/`heroFilter`/`search` change, but the async function itself has
no cancellation/generation guard:

```ts
const load = useCallback(async (cat, hero, term) => {
    setLoading(true);
    setError(null);
    try {
      const rows = await foundryTextures({ category: cat, hero: hero || undefined, search: term.trim() || undefined, limit: LIMIT });
      setItems(rows);
      setTruncated(rows.length >= LIMIT);
    } catch (e) { ... } finally { setLoading(false); }
}, []);

useEffect(() => {
    ...
    const handle = setTimeout(() => void load(category, heroFilter, search), 250);
    return () => clearTimeout(handle);
}, [category, heroFilter, search, ready, load]);
```

`clearTimeout` only prevents a *pending* (not-yet-started) fetch from firing;
once the 250ms timer has fired and the IPC call to the main process is
in-flight, a second debounce cycle (e.g. the user switches the hero filter
again, or types further) can start a second `foundryTextures` call whose
response arrives *before* the first one's, because IPC/VPK-scan latency is not
guaranteed to be monotonic with request order (a `hero-model` fetch over
hundreds of textures is measurably slower than a narrow `search`-filtered
one). Whichever response resolves last wins `setItems`, which can leave the
grid showing results for a stale category/hero/search combination with no
indication anything is wrong. Every sibling data-fetching component in this
same directory (`SoundBrowse.tsx`'s gameplay-sound effect, `GlobalSoundBrowse`'s
sound-list effect, `PortraitBrowse.tsx`'s catalog effect) guards exactly this
case with a `let cancelled = false` / `return () => { cancelled = true; }`
pattern; `TextureBrowse.tsx` is the odd one out.

**Fix:** Add the same cancellation guard used elsewhere in this file's own
sibling components:

```ts
useEffect(() => {
    if (!ready) { setItems([]); setTruncated(false); setError(null); return; }
    let cancelled = false;
    const handle = setTimeout(() => {
        void load(category, heroFilter, search).then((result) => {
            if (cancelled) return; // load() would need to return its result rather than setState directly
        });
    }, 250);
    return () => { cancelled = true; clearTimeout(handle); };
}, [category, heroFilter, search, ready, load]);
```
(or thread a monotonic request id through `load` the way `PortraitBrowse.tsx`'s
`PoolCard`/`inspect` callbacks in `ChangePools.tsx` already do with `requestId`.)

### WR-02: `LibraryBrowse.tsx`'s `loadCategory` has the same missing race guard

**File:** `src/components/foundry/LibraryBrowse.tsx:123-142`

**Issue:** Same shape as WR-01: `loadCategory(cat)` is called from a `useEffect`
that fires on every `category` change (and on mount), with no `cancelled` flag
or request-id check inside the async body:

```ts
const loadCategory = useCallback(async (cat: TextureCategory) => {
    setLoading(true);
    setError(null);
    try {
      const grid = await foundryThumbnails(cat);
      setItems(grid);
    } catch (e) { ... } finally { setLoading(false); }
}, []);

useEffect(() => {
    setHeroFilter(defaultHeroFilter);
    void loadCategory(category);
}, [category, loadCategory, defaultHeroFilter]);
```

A user clicking through `ability-icon` -> `item-icon` -> `hero-image` quickly
can have the `ability-icon` response (a large category) resolve after the
`hero-image` response and clobber it, showing the wrong category's grid while
the `category` select still reads `hero-image`.

**Fix:** Same as WR-01 — add a `cancelled` flag captured by the effect's
cleanup, and check it before each `setItems`/`setError`/`setLoading` call.

### WR-03: `renameWithPriority` silently no-ops for modern free-form disabled filenames inside `directSwap`

**File:** `electron/main/services/mods.ts:1198-1201`, used from
`directSwap` (mods.ts:1486, 1491)

**Issue:** `renameWithPriority` only rewrites a `pak\d{2}_` prefix:

```ts
function renameWithPriority(fileName: string, priority: number): string {
    const priorityStr = String(Math.min(MAX_VPK_PRIORITY, priority)).padStart(2, '0');
    return fileName.replace(/^pak\d{2}_/, `pak${priorityStr}_`);
}
```

Since `disableModImpl` now always gives a disabled mod a free-form name via
`makeDisabledFileName` (mods.ts:211-237, guarded against ever producing a
`pak\d` prefix), a disabled mod's filename never matches this regex, and
`renameWithPriority` returns it unchanged. When `directSwap` is invoked with a
modern (free-form-named) disabled mod as one side, that side's `final` path is
identical to its `from` path — the "swap" silently does nothing to the
disabled mod (which is arguably correct, since a disabled mod has no real load
order) but the caller (`swapModPriorityImpl`) has no way to know this happened
and the operation still runs its full two-phase rename dance and metadata
migration call for a no-op change, adding cost and — per CR-01 — one more
place where an interrupted rename can't roll back cleanly.

**Fix:** Have `swapModPriorityImpl` (or `directSwap` itself) short-circuit and
either reject or no-op cleanly when one side is a disabled mod with no
parseable `pakNN` slot, rather than running the full rename machinery for a
destination path that is guaranteed to equal the source path.

## Info

### IN-01: `SoundBrowse.tsx` is a single 1,440-line file covering four distinct concerns

**File:** `src/components/foundry/SoundBrowse.tsx`

**Issue:** The file combines the hero/voice-line browse UI, per-row rendering
(`SoundRow`), the inline audition/annotation logic, and the full sound-swap
authoring panel (`SwapPanel`, including pool-mode planning, conflict
resolution, and forge submission) in one module. This is a maintainability
observation, not a functional defect — the logic itself, read end to end, is
consistent with its own tests and with the shared `assetClaims`/`soundVocabulary`
modules it depends on.

**Fix:** Consider splitting `SwapPanel` (mods.ts-adjacent authoring UI, lines
~1018-1440) into its own file, mirroring how `PortraitEditor.tsx` was already
split out of `LibraryBrowse.tsx`/`PortraitBrowse.tsx`.

---

_Reviewed: 2026-08-07_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
