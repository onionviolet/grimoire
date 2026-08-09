# Phase 5: One Inventory, One Journey - Pattern Map

**Mapped:** 2026-08-08
**Files analyzed:** 12 (new/modified) + 1 catalog (translation.json)
**Analogs found:** 12 / 12 (all files being modified have a strong in-file or sibling analog; this phase is almost entirely extension-in-place, not new-file creation)

**Scope reminder:** the shared Global shell, `HeroCardPicker` as the canonical portrait home, and shuffle mechanism are already delivered — do not re-plan them. This map covers only the genuinely open items: E1 tri-state selector, E2 hide-empty rail, E3 scope captions, E4 unresolved tag, E5 two missing portrait empty states, E6 bulk-undo, E7 disabled blockers, E8 derived pak descriptions, and the D-17 vocabulary pass.

## File Classification

| File | Role | Data Flow | Closest Analog | Match Quality |
|------|------|-----------|-----------------|---------------|
| `src/lib/lockerMode.ts` (widen `LockerMode` union) | utility (pure type/route helper) | transform | itself — extend the existing 2-value union in place, `resolveLockerRoute` is the analog for how a new discriminant value must be threaded | exact (self-analog) |
| `src/pages/Locker.tsx` — `GLOBAL_SECTION_TABS` tri-state selector (E1) | component (tab/segmented control) | request-response (click/keyboard -> `onSelectSection`) | itself, lines 1698, 1806-1819, 1921-1950 — the existing 2-tab roving-tabindex implementation | exact (self-analog, widen in place) |
| `src/pages/Locker.tsx` — rail hide-empty projection (E2) | component (list render) | transform | itself, lines 1965-1996 — the unconditional `.map` to be filtered to `count > 0` | exact (self-analog) |
| `src/lib/globalInventory.ts` — merged "All content" row-list helper | utility (pure derivation) | transform | itself, `countGlobalInventoryMods`/`countGlobalInventoryCategories` (lines 16-45) — same Set-dedup-over-two-axes shape | exact (same file, sibling function) |
| `src/components/foundry/PortraitBrowse.tsx` — "failed" + "filtered to zero" states (E5) | component (empty/error state) | request-response | itself, lines 60-88 (`loading`/`error` state) and 280-351 (existing `EmptyState` call sites) | exact (self-analog, add 2 more `EmptyState` branches) |
| `src/components/locker/HeroPortraitFamilies.tsx` — same 2 states + unresolved tag (E4, E5) | component (empty/error state + tag) | request-response | itself, lines 144-174 (`loading`/`noneTitle`/`noneBody` branches) | exact (self-analog, add branches) |
| `src/lib/heroIdentity.ts` — Leg A cross-check target (no new table) | utility (pure lookup table) | transform | `src/lib/heroPortraitIdentity.test.ts:24-25` (existing fixture pattern to extend) | exact |
| `src/lib/lockerUtils.ts` — `HERO_DISPLAY_ALIASES`/`canonicalHeroName` (read-only reference for the cross-check, do not add a second table) | utility (pure lookup table) | transform | n/a — this is the second table being audited, not modified unless Leg A finds divergence | reference-only |
| `src/components/locker/HeroCardPicker.tsx` — "This hero" caption (E3) | component (label/caption) | request-response | itself, lines 408-414 — existing `FoundryPoolList` embed beside the card-shuffle toggle | exact (self-analog) |
| `src/components/foundry/MyChanges.tsx` — "All forged portraits" caption (E3) | component (label/caption) | request-response | itself, lines 281-289 — existing `FoundryPoolList` render site | exact (self-analog) |
| Locker Global shell — new bulk enable/disable + undo (E6, E7) | component (bulk-mutation UI, net-new in this surface) | CRUD (batch) | `src/pages/Installed.tsx` lines 1116-1124, 2503-2547, 4285-4291, 5017-5071 — the only mature multi-select/bulk pattern in the app | role-match (bulk mechanics only; undo itself has no analog anywhere in the app) |
| Locker Global shell — unnamed pak derived description (E8) | utility + component (transform + label) | file-I/O (VPK entry read) -> transform | existing Announcer-shelf fix (`useDiscoveredSoundPaths`, referenced at `Locker.tsx:1764-1771`) and `SoundEntryRow`'s expander (per RESEARCH.md) | role-match |
| `src/locales/en/translation.json` (D-17 vocabulary pass) | config (i18n catalog) | transform | itself — existing key/value pairs at `locker.cards.winner` (line 527), `locker.cards.isWinner` (538), `portrait.family.*` (3873-3899) | exact (value-only edits at existing keys, plus ~4 new keys) |

## Pattern Assignments

### `src/lib/lockerMode.ts` (utility, transform)

**Analog:** itself (widen in place)

**Current 2-value union** (lines 9-14):
```typescript
export type LockerMode = 'looks' | 'sounds';

export function lockerModeFromSearch(search: string): LockerMode | null {
  const mode = new URLSearchParams(search).get('mode');
  return mode === 'looks' || mode === 'sounds' ? mode : null;
}
```

**Downstream consumer that must get a third branch** (`resolveLockerRoute`, lines 58-81):
```typescript
if (/^\/locker\/global\/?$/.test(pathname)) {
  return { drillIn: 'global', section: lockerModeFromSearch(search) ?? 'looks' };
}
```
Per D-05, the default becomes `'all'` (or whichever name is chosen for the third member) unless a deep link names `looks`/`sounds`. `tsc -b` will enumerate every `mode === X`/`switch` site that needs the third arm — treat that as the authoritative checklist, per RESEARCH.md Pattern 1.

**Test to extend:** `src/lib/lockerMode.test.ts` (exists) — add cases for the new default and the widened `lockerModeFromSearch`.

---

### `src/pages/Locker.tsx` — E1 tri-state selector + E2 hide-empty rail

**Analog:** itself, `LockerGlobalView` (lines 1690-1996)

**Tab list pattern to extend from 2 to 3 entries** (line 1698, 1806-1819):
```typescript
const GLOBAL_SECTION_TABS: readonly LockerMode[] = ['looks', 'sounds'];
// ...
const onSectionTabKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
  const index = GLOBAL_SECTION_TABS.indexOf(section);
  let next = index;
  if (event.key === 'ArrowRight') next = (index + 1) % GLOBAL_SECTION_TABS.length;
  else if (event.key === 'ArrowLeft')
    next = (index - 1 + GLOBAL_SECTION_TABS.length) % GLOBAL_SECTION_TABS.length;
  else if (event.key === 'Home') next = 0;
  else if (event.key === 'End') next = GLOBAL_SECTION_TABS.length - 1;
  else return;
  event.preventDefault();
  const target = GLOBAL_SECTION_TABS[next];
  if (target !== section) onSelectSection(target);
  sectionTabRefs.current.get(target)?.focus();
};
```
This roving-tabindex loop is already index/length-generic — widening `GLOBAL_SECTION_TABS` to 3 entries requires no change to this function itself, only to the array and to `role="tab"` render loop below.

**Tab render loop** (lines 1916-1950):
```typescript
<div role="tablist" aria-label={t('locker.global.sectionLabel', 'Global Locker section')} ...>
  {GLOBAL_SECTION_TABS.map((tab) => {
    const selected = tab === section;
    return (
      <button key={tab} ref={...} type="button" role="tab"
        id={`${sectionTabsId}-tab-${tab}`} aria-controls={`${sectionTabsId}-panel`}
        aria-selected={selected} tabIndex={selected ? 0 : -1}
        onClick={() => onSelectSection(tab)} onKeyDown={onSectionTabKeyDown}
        className={`rounded px-2.5 py-1.5 cursor-pointer ${selected ? 'bg-accent/15 text-white' : 'text-text-secondary hover:text-white'}`}>
        {tab === 'sounds' ? t('locker.mode.sounds', 'Sounds') : t('locker.global.visuals', 'Visuals')}
      </button>
    );
  })}
</div>
```
Add an `'all'` branch to the label ternary using the new `locker.global.sectionAll` key. Per RESEARCH.md's Alternatives Considered, `useSegmentedTabs` (`src/components/common/useSegmentedTabs.ts`) is the house-documented canonical hook, but widening this hand-rolled version in place is lower risk — planner's/executor's call either way.

**Rail row array to filter for E2** (lines 1965-1996, THE site — not the retag menu at line 2407):
```typescript
{/* One rail, two vocabularies... every row is clickable: an empty row opens
    its own empty state, which is more discoverable than a dead disabled row. */}
{(isSounds
  ? soundCounts.map(({ id, count }) => ({
      key: `sound:${id}`, label: globalSoundSectionLabel(t, id), count,
      onSelect: () => setSelectedSoundCategory(id),
    }))
  : GLOBAL_VISUAL_MOD_TYPE_ORDER.map((type) => ({
      key: type as string, label: GLOBAL_MOD_TYPE_LABELS[type], count: groups[type].length,
      onSelect: () => setSelectedType(type),
    }))
).map((row) => {
  const isActive = row.key === activeRailKey;
  const isEmpty = row.count === 0;
  return ( <button key={row.key} ...> ... </button> );
})}
```
D-04 requires this array be `.filter((row) => row.count > 0)` before `.map`, reversing the deliberate comment above it. **Do not touch `Locker.tsx:2407`'s `GLOBAL_VISUAL_MOD_TYPE_ORDER.map`** — that is the retag context menu, correctly unconditional, verified as a distinct call site.

**Header total (already correct, do not change; reference only)** (lines 1905-1914):
```typescript
<h2 ...>{t('locker.page.global')}</h2>
<span ...>{t('locker.page.modCount', { count: total })}</span>
```

**Test to extend:** `src/lib/globalInventory.test.ts` (exists) for the merged-projection helper; component-level rail behavior is not currently under a dedicated Locker.tsx unit test per RESEARCH.md.

---

### `src/lib/globalInventory.ts` (utility, transform) — merged "All content" projection

**Analog:** itself, `countGlobalInventoryMods` (full file, lines 1-45)

```typescript
export function countGlobalInventoryMods(
  groups: GlobalModGroups,
  soundEntries: readonly SoundInventoryEntry[]
): number {
  const ids = new Set<string>();
  for (const type of GLOBAL_VISUAL_MOD_TYPE_ORDER) {
    for (const mod of groups[type]) ids.add(mod.id);
  }
  for (const entry of soundEntries) ids.add(entry.modId);
  return ids.size;
}
```
The new merged-row-list helper (recommended, not mandated, by RESEARCH.md) should mirror this shape: concatenate visual-type rows and sound-category rows into one list, each carrying `{ key, label, count }`, filtered to `count > 0` per D-04, with the E1 `sectionMembershipHint` copy rendered once above the list (not per row) per D-04's "never presented as values that should sum to the header."

---

### `src/components/foundry/PortraitBrowse.tsx` (component, request-response) — E5 "failed" + "filtered to zero"

**Analog:** itself, existing `loading`/`error` state and `EmptyState` call sites (lines 60-88, 280-351)

**Existing state shape to route the new "failed" branch through:**
```typescript
// PortraitBrowse.tsx:61-62
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
```

**Existing EmptyState pattern to copy for both new states:**
```typescript
// PortraitBrowse.tsx:280-291
{loading ? (
  <div ...><Loader2 .../> <Tx k="foundry.loading" fallback="Building catalog from your game files..." /></div>
) : error ? (
  <div ...>
    <EmptyState
      icon={...}
      variant="error"
      title={<Tx k="foundry.error.title" fallback="Couldn't read the catalog" />}
      description={error}
    />
  </div>
) : ( /* populated / other empty branches at 313-351 */ )}
```
Per Open Question 3 in RESEARCH.md, `foundryThumbnails`'s existing `.catch` already sets `error` — the "failed" state (E5) may be a pure wiring task: render `EmptyState variant="error"` with the new `foundry.portraits.catalogFailed.title`/`.description` keys and a `Retry` action (reuse `locker.pose.retry` string verbatim) instead of the current unstyled fallback. "Filtered to zero" is a **new, distinct** branch (search/filter yields nothing against a successfully-built, non-empty catalog) using `foundry.portraits.filteredZero.title`/`.description` and a "Clear search" action — must read as a different fact from "failed," per D-13.

---

### `src/components/locker/HeroPortraitFamilies.tsx` (component, request-response) — same 2 states + E4 unresolved tag

**Analog:** itself, lines 144-174

```typescript
if (loading) {
  return ( <div ...><Loader2 className="h-4 w-4 animate-spin" /> {t('portrait.family.loading')}</div> );
}
// ...
{families.length === 0 ? (
  <div>
    <p>{t('portrait.family.noneTitle')}</p>
    <p>{t('portrait.family.noneBody', { hero: heroName })}</p>
  </div>
) : (
  <div>
    <p className="text-xs font-semibold text-text-primary">{t('portrait.family.browserTitle')}</p>
    <p>{t('portrait.family.browserCount', { count: families.length })}</p>
    ...
  </div>
)}
```
Add a "failed" branch (parallel to `PortraitBrowse.tsx`'s `error` state — this component currently has no distinct failure path, only `loading`/`noneTitle`/populated) and an `Unresolved` `Tag` rendered per unresolved family member, with the explanatory hint rendered once per unresolved group (not per tag), per the UI-SPEC's Copywriting Contract.

**CRITICAL i18n namespace correction (Pitfall 2 from RESEARCH.md):** new keys go under `portrait.family.*` (verified real, already-consumed namespace — `translation.json:3873-3899`, confirmed by `t('portrait.family.*')` call sites at lines 147, 160, 163, 172, 174 of this file), **never** `portraitEditor.family.*` (a plausible-sounding but wrong/unused namespace — `portraitEditor.*` belongs to `PortraitEditor.tsx`'s crop/staging tool). Grep `t('portrait.family.` before adding any key to confirm.

**Existing namespace to extend** (`translation.json:3873-3899`):
```json
"family": {
  "title": "{{hero}}: {{variant}}",
  "browserTitle": "Portrait families",
  "browserCount_one": "{{count}} family",
  "browserCount_other": "{{count}} families",
  "loading": "Reading the base game portrait family...",
  "noneTitle": "No base game portrait family",
  "noneBody": "Grimoire could not read a base game portrait family for {{hero}} ...",
  ...
}
```
Add `unresolvedTag: "Unresolved"` and `unresolvedHint: "Grimoire could not match this to a known hero. The raw name is kept below."` as siblings here.

---

### `src/lib/heroIdentity.ts` (utility, transform) — Leg A alias cross-check

**Analog:** `src/lib/heroPortraitIdentity.test.ts:24-25` (existing fixture pattern)

**File header, establishing the "one table, don't add a fifth" constraint** (lines 1-30):
```typescript
/**
 * Hero identity: one table, four namespaces.
 * ... Four tables drift: Abrams alone is `abrams` to the roster, `atlas` or
 * `bull` in panorama, `hero_atlas` in the API, `abrams` in sound paths ...
 * That is structural cause S5.
 * Everything a subsystem needs about a hero's names lives here, and every
 * other module reaches it through a namespace-scoped accessor rather than
 * reading the table.
 */
```

**Second table to cross-check against, do NOT merge/duplicate without a decision** (`src/lib/lockerUtils.ts:138-145`):
```typescript
const HERO_DISPLAY_ALIASES: Readonly<Record<string, string>> = { /* ... */ };
export function canonicalHeroName(name: string | undefined | null): string {
  // ...
  return HERO_DISPLAY_ALIASES[name] ?? name;
}
```
Leg A fixture (new test, per RESEARCH.md Code Examples): for every hero, assert `canonicalHeroName(hero.displayName)` (lockerUtils table) and `resolveHeroByName(hero.displayName)?.displayName` (heroIdentity table) agree. This is a pure-unit-test addition, no renderer/component change. **Anti-pattern to avoid: do not add a third alias table anywhere in the four D-11 call sites.**

---

### `src/components/locker/HeroCardPicker.tsx` (component, request-response) — E3 "This hero" caption

**Analog:** itself, lines 408-414 (existing `FoundryPoolList` embed)

```typescript
{portraitFoundryChanges.length > 0 && (
  <div className="rounded-[10px] border border-border/70 bg-bg-sunken/55 p-3">
    <p className="text-xs font-semibold text-text-primary">{t('locker.cards.forgedPools')}</p>
    <p className="mt-1 text-[11px] text-text-secondary">{t('locker.cards.forgedPoolsNote')}</p>
    <div className="mt-2">
      <FoundryPoolList mods={portraitFoundryMods} changes={portraitFoundryChanges}
        included={foundryShuffleIncluded} onToggleShuffleKey={toggleFoundryShuffleIncluded}
        onToggleMod={(modId) => void toggleMod(modId)}
        onOpenInInstalled={(modId) => { window.location.hash = `#/?focusMod=${encodeURIComponent(modId)}`; }} />
    </div>
  </div>
)}
```
Add the E3 caption (`locker.cards.shuffleScopeThisHero` = "This hero") as a `text-[11px] text-text-secondary` compact line beside/beneath the existing card-shuffle toggle (near line 412, the `cardShuffleIncluded` control this file already renders around line 421 per RESEARCH.md), matching the compact-caption convention already established beside `HeroCardPicker`'s coverage-gap warning.

---

### `src/components/foundry/MyChanges.tsx` (component, request-response) — E3 "All forged portraits" caption

**Analog:** itself, lines 275-289

```typescript
) : viewMode === 'pools' ? (
  <FoundryPoolList
    mods={mods}
    changes={visible}
    included={foundryShuffleIncluded}
    onToggleShuffleKey={toggleFoundryShuffleIncluded}
    onToggleMod={(modId) => void toggleMod(modId)}
    onOpenInInstalled={openInInstalled}
    ...
```
Add the E3 caption (`foundry.myChanges.shuffleScopeAllForged` = "All forged portraits") beside every render site of this `FoundryPoolList` — both here (the cross-hero view) and inside `HeroCardPicker.tsx`'s per-hero embed above, since both read the same `foundryShuffleIncluded` pool identity and must visibly distinguish scope per D-08.

---

### Locker Global shell — E6 bulk-undo + E7 disabled blockers (net-new bulk-mutation surface)

**Analog:** `src/pages/Installed.tsx` — the only mature bulk-mutation pattern in the app. **No undo exists anywhere in the app to copy; the undo half of this pattern has no analog.**

**Selection/progress state shape** (`Installed.tsx:1116-1124`):
```typescript
const [selectMode, setSelectMode] = useState(false);
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
// ...
const [bulkProgress, setBulkProgress] = useState<{
  verb: string; done: number; total: number;
} | null>(null);
```

**Bulk handler shape to mirror** (`Installed.tsx:2513-2547`):
```typescript
const handleBulkEnable = async () => {
  // Snapshot the work list before the loop so the progress total stays
  // stable even as `mods` updates after each toggle.
  const targets = selectedMods.filter((m) => !m.enabled);
  if (targets.length === 0) { exitSelectMode(); return; }
  setBulkProgress({ verb: 'Enabling', done: 0, total: targets.length });
  for (let i = 0; i < targets.length; i++) {
    const ok = await toggleMod(targets[i].id);
    setBulkProgress({ verb: 'Enabling', done: i + 1, total: targets.length });
    if (!ok) break;
  }
  setBulkProgress(null);
  exitSelectMode();
};
```
**Gap this phase must close, not copy (D-14):** before the loop starts, capture a snapshot (`Map<modId, Pick<Mod, 'enabled'>>` or similar — the Zustand store already holds this) so `Undo` can restore prior state. This is new code; `Installed.tsx` has nothing to lift for the snapshot/restore half.

**Busy-state gating precedent** (`Installed.tsx:2474, 4288`):
```typescript
useEscapeKey(exitSelectMode, selectMode && !bulkProgress && !modToDelete);
// ...
disabled={!!bulkProgress}
```
Mirror this shape for E7: while a bulk mutation (or its undo) is in flight, disable conflicting controls and pair the `disabled` with a visible adjacent blocker line (D-16 forbids tooltip-only), e.g. `locker.global.bulkBusy` = "Finish the current update before starting another."

**Undo toast wiring (E6)** — API already exists, no new toast component:
```typescript
// src/stores/toastStore.ts:18-27,32-33,58,65 (verified API shape)
showToast: (message: string, opts?: { actionLabel?: string; onAction?: () => void }) => number;
dismissToast: (id: number) => void;
```
```typescript
showToast(t('common.bulkUndo.message', { count: affected.length }), {
  actionLabel: t('common.bulkUndo.action', 'Undo'),
  onAction: () => restoreSnapshot(snapshot),
});
// D-15 supersession: dismiss the prior toast the instant a new bulk mutation
// on the same surface starts, rather than stacking a second toast.
dismissToast(previousUndoToastId);
```

**Open scope decision this phase must state explicitly (Pitfall 4):** which bulk actions the Global shell ships (bulk enable/disable is the recommended default, mirroring `Installed.tsx`) must be named in the plan before writing undo/blocker tasks — there is nothing pre-existing in `Locker.tsx` to retrofit.

**Test to add:** new unit test file for bulk-undo snapshot capture/restore (pure logic), name TBD once scope is fixed — Wave 0 gap per RESEARCH.md.

---

### Locker Global shell — E8 unnamed pak derived description

**Analog:** existing Announcer-shelf VPK-entry-read fix, referenced via `useDiscoveredSoundPaths` (`Locker.tsx:1764-1771`):
```typescript
// Read what each unrecorded sound mod actually writes, so the rail classifies
// on the mod's own VPK entries instead of the category its author picked on GameBanana.
const discoveredPaths = useDiscoveredSoundPaths(mods);
const globalSoundEntries = useMemo(
  () => buildSoundInventory(mods, { discoveredPaths }).global,
  [mods, discoveredPaths]
);
```
Main already exposes the entry list this needs (`list-unknown-mod-files`, per RESEARCH.md's Architectural Responsibility Map) — this is renderer-side derivation and display only, no new IPC. Cap the visible entry list (e.g. first 3 + "+N more") per the E8 `overflow` backstop; fall through to `locker.global.unnamedPakUnknown` = "Unknown content" when zero entries are readable, per D-19.

---

### `src/locales/en/translation.json` (config, transform) — D-17 vocabulary pass

**Analog:** itself — existing keys to correct in place, not rename

**"Active source" consolidation targets (verified current values):**
```json
// translation.json:527
"winner": "Current winner: {{name}}",
// translation.json:538
"isWinner": "winner",
```
Plus `foundry.subtools.winner` ("Wins: {{name}}"), `overriddenBy`/`openWinner`, `randomize.winner` ("in game now"), `foreignWinner` — six divergent phrasings collapsing to **"Active source: {{name}}"** (sentence form) / **"Active source"** (label form), same keys, new values.

**"Portrait family" singular addition** — `portrait.family.browserTitle` = "Portrait families" (plural, unchanged); add the singular per-item label using the existing `_one`/`_other` i18n pluralization pattern already used at `portrait.family.browserCount_one`/`_other` (lines 3876-3877) as the copy-paste template.

**New keys this phase adds (not renames):** `locker.global.sectionAll`, `locker.global.sectionLabel`, `locker.global.sectionMembershipHint`, `locker.global.filteredZeroTitle`/`filteredZeroBody`/`filteredZeroReset`, `locker.cards.shuffleScopeThisHero`, `foundry.myChanges.shuffleScopeAllForged`, `portrait.family.unresolvedTag`/`unresolvedHint`, `foundry.portraits.catalogFailed.title`/`.description`, `foundry.portraits.filteredZero.title`/`.description`, `common.bulkUndo.message`/`.action`, `locker.global.bulkBusy`, `locker.global.unnamedPakDerived`/`unnamedPakUnknown`.

**Gate to run after any catalog change:** `pnpm i18n:check && pnpm i18n:manifest` (both existing scripts, per RESEARCH.md's Runtime State Inventory — no data migration, existing translated locales keep their keys and go semantically stale until Weblate re-translates).

## Shared Patterns

### Empty/error state primitive
**Source:** `src/components/common/PageComponents.tsx:105-130`
**Apply to:** E5 (`PortraitBrowse.tsx`, `HeroPortraitFamilies.tsx`)
```typescript
interface EmptyStateProps {
  icon: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  variant?: 'default' | 'error';
  className?: string;
}
export function EmptyState({ icon: Icon, title, description, action, variant = 'default', className = '' }: EmptyStateProps) {
  const iconColor = variant === 'error' ? 'text-state-danger' : 'text-text-secondary';
  const titleColor = variant === 'error' ? 'text-state-danger' : 'text-text-primary';
  return (
    <div className={`flex flex-col items-center justify-center h-full text-text-secondary animate-fade-in ${className}`}>
      <Icon className={`w-16 h-16 mb-4 opacity-50 ${iconColor}`} />
      <h2 className={`text-xl font-semibold mb-2 ${titleColor}`}>{title}</h2>
      {description && <div className={`text-center max-w-md ${variant === 'error' ? 'text-state-danger' : ''}`}>{description}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
```
Already takes all three parts D-18 requires (what/why/next-action via title/description/action). The gap is a missing call site (E5's two new branches), not a missing component.

### Neutral tag primitive
**Source:** `src/components/common/ui.tsx:80-124`
**Apply to:** E4 unresolved-codename indicator
```typescript
interface TagProps {
  children: ReactNode;
  tone?: TagTone;          // 'accent' | 'warning' | 'danger' | 'success' | 'info' | 'neutral'
  variant?: 'overlay' | 'inline';
  icon?: LucideIcon;
  title?: string;
  className?: string;
}
```
Usage per UI-SPEC E4: `<Tag tone="neutral" title={rawCodename}>{t('portrait.family.unresolvedTag', 'Unresolved')}</Tag>` — `title` carries the raw codename verbatim so the raw token is never lost.

### Toast with undo
**Source:** `src/stores/toastStore.ts:18-27,32-33,58,65`
**Apply to:** E6 bulk-undo, all bulk mutations this phase's Global shell introduces
```typescript
export const showToast: (message: string, opts?: { actionLabel?: string; onAction?: () => void }) => number;
export const dismissToast: (id: number) => void;
```
22 existing files already use this exact API per `docs/locker-consistency-pass.md` — no new toast component.

### Confirmation before destructive actions (if any new one is added)
**Source:** `src/components/common/confirmContext.ts`
**Apply to:** any destructive bulk action this phase's E6/E7 controls might gate (not required per the UI-SPEC — enable/disable/retag are reversible via undo, not destructive)
`useConfirm()` — house pattern, 11 existing importers, no `window.confirm` anywhere in `src/`.

### Roving-tabindex accessible tablist
**Source:** `src/pages/Locker.tsx:1806-1819, 1916-1950` (`LockerGlobalView`'s existing 2-tab implementation)
**Apply to:** E1's tri-state selector
Already index/length-generic (`GLOBAL_SECTION_TABS.length`-driven arrow/Home/End handling) — widening the backing array to 3 entries is the primary change; `useSegmentedTabs.ts` is the documented house alternative if the planner prefers migrating instead of extending in place.

## No Analog Found

| File/Surface | Role | Data Flow | Reason |
|------|------|-----------|--------|
| Bulk-undo snapshot capture/restore logic (E6, D-14) | utility (pure state capture) | CRUD (batch) | No undo mechanism of any kind exists anywhere in the app today (`Installed.tsx`'s bulk handlers have no undo either) — this is genuinely new logic, not an extension. Design as a small `Map<modId, Pick<Mod, 'enabled'>>`-shaped capture per RESEARCH.md Pattern 3, not a new subsystem |
| The "failed" catalog-build signal distinguishing itself from "not indexed" (E5) | component + possible main-process signal | request-response | `PortraitBrowse.tsx`'s existing `error` catch may already be sufficient (Open Question 3) — confirm before assuming new main-process/IPC work is needed; if the existing `.catch` path is reused, this row can be reclassified as "exact" at execution time |

## Metadata

**Analog search scope:** `src/pages/Locker.tsx`, `src/pages/Installed.tsx`, `src/lib/lockerMode.ts`, `src/lib/globalInventory.ts`, `src/lib/heroIdentity.ts`, `src/lib/lockerUtils.ts`, `src/components/locker/HeroCardPicker.tsx`, `src/components/locker/HeroPortraitFamilies.tsx`, `src/components/foundry/PortraitBrowse.tsx`, `src/components/foundry/MyChanges.tsx`, `src/components/common/PageComponents.tsx`, `src/components/common/ui.tsx`, `src/stores/toastStore.ts`, `src/locales/en/translation.json`
**Files scanned:** 14 (all read directly this session; RESEARCH.md's own verified line citations cross-checked against source rather than trusted uncritically, per its own Pitfall 1/2 corrections)
**Pattern extraction date:** 2026-08-08
