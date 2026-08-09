# Phase 5: One Inventory, One Journey - Research

**Researched:** 2026-08-08
**Domain:** React 19 / TypeScript renderer changes to an existing hand-rolled Electron design system (no new libraries). i18n catalog consolidation, accessible tab extension, undo-toast wiring, and a root-cause hunt for a non-reproducing alias defect.
**Confidence:** HIGH for the seven genuinely-open work items (all verified against the working tree this session); MEDIUM for the alias-sweep root cause itself, since the defect does not currently reproduce and Legs B/C were not run in this research session (they require a committed tree, which is confirmed available, plus a dev slot, which planning cannot reserve).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**One global inventory**

- **D-01:** The Locker Global drill-in is the canonical home for installed global content. It uses one shared inventory shell with `All content`, `Visuals`, and `Sounds` views. The dedicated Sound Locker route does not return as a second home for global inventory.
- **D-02:** Preserve the useful work from the Sound Locker variant inside the shared shell: exact-path ownership, runtime winner, provenance, audition, enable or disable, conflict disclosure, and links to the matching Foundry authoring tool. Existing legacy sound URLs continue to resolve into the canonical shell or the relevant hero's Sounds section.
- **D-03:** Hero-specific installed sounds remain under each Locker hero because that is the user's management context. Global sounds remain under Global. Foundry remains the authoring context. This is one inventory model with contextual views, not one giant route.
- **D-04:** Counts use unique installed mods in the active scope. Section counts may overlap and must be labeled as section membership, never presented as values that should sum to the header. Empty categories are hidden by default; if a filter produces no results, the state names the active filter and offers the nearest useful reset.
- **D-05:** `All content` is the default unless a deep link identifies a narrower view. Visual and sound categories never mix in their specialized rails, while `All content` may group both using the same underlying entries.

**One portrait journey**

- **D-06:** The journey is: create or edit in Foundry, manage installed portrait families in Locker Cards, and inspect cross-hero forged pools in Foundry My Changes. Each surface states that role and links directly to the next relevant step.
- **D-07:** `HeroCardPicker` is the canonical per-hero management home. It shows a portrait family as one item with its variants, coverage, active source, ownership, and shuffle participation. Do not add a separate portraits route.
- **D-08:** Keep both delivered randomization views because they answer different questions: Locker Cards is the per-hero control, while Foundry My Changes is the cross-hero overview. Both read and write one shared pool identity and state. Labels explicitly distinguish `This hero` from `All forged portraits`, so two synchronized controls do not look like unrelated mechanisms.
- **D-09:** Foundry and Locker remain separate implementations behind shared family and ownership models. Do not merge authoring and installed-management components. Deep links carry hero and family identity so the user never has to find the same portrait twice.

**Portrait families, aliases, and failures**

- **D-10:** Locker groups portrait entries through `portraitInventory.ts` and `HeroPortraitFamilies.tsx`; variant tokens order and label members, but exact normalized entry paths decide ownership. Partial family coverage is visible and actionable, not silently flattened into one card.
- **D-11:** Alias resolution is centralized and applied before inventory grouping, route matching, Foundry catalog filtering, and family lookup. Display names and codenames are presentation and lookup aliases, never ownership keys.
- **D-12:** Unresolved codenames remain visible under an explicit internal or unresolved label with their raw token. They are not dropped or silently attached to the currently selected hero.
- **D-13:** Portrait empty states distinguish `not indexed`, `loading`, `failed`, `no assets for this hero`, and `filtered to zero`. Each state has one next action appropriate to the cause. Loading never flashes as a true empty result.

**Undo and blocked actions**

- **D-14:** Every bulk mutation in this phase captures an operation snapshot and offers a local `Undo` action after success. Undo restores both the affected data and the user's selection where it is still meaningful. It does not create a permanent history system.
- **D-15:** A newer mutation supersedes the previous undo offer for the same surface. While an operation or its undo is running, conflicting controls are disabled and name that reason. Partial failure reports what changed and keeps a recovery action visible.
- **D-16:** Disabled controls must expose the blocker beside the control or through an accessible description. A tooltip may supplement this but cannot be the only explanation. Prefer a corrective action such as reset filter, finish indexing, select a source, or inspect the unreadable mod.

**Vocabulary and empty-state contract**

- **D-17:** Fix the English catalog vocabulary first, then update call sites to shared keys. The same concepts use the same names across Locker and Foundry: `Installed`, `My changes`, `Global`, `Visuals`, `Sounds`, `Portrait family`, `Variant`, `Enabled`, and `Active source`.
- **D-18:** Every empty state follows a three-part contract: what is missing, why this view is empty, and the next action. Do not use generic `Nothing here` text or imply a failure when indexing is still in progress.
- **D-19:** Imported paks without useful names use a derived description from exact paths when possible and retain the raw pak name as secondary identity. Unknown data is labeled unknown rather than guessed.

### Claude's Discretion

- Exact shared-shell layout and whether the `All content`, `Visuals`, and `Sounds` selector is rendered as tabs or a segmented control, provided it follows the repository's existing accessible tab contract.
- Exact duration and placement of local undo affordances.
- Exact family-card density and variant-chip presentation.
- Exact wording of blocker and empty-state copy, within the vocabulary contract above.

### Deferred Ideas (OUT OF SCOPE)

- A separate top-level Sound Locker route is not planned. Reconsider only if the shared Global and hero Sounds surfaces cannot expose a concrete required workflow without duplication.
- A permanent multi-step operation history is outside this phase. The requirement is safe recovery from bulk actions, satisfied by local operation snapshots and undo.
- Empirical in-game verification of `minimap` and `small` portrait labels remains governed by its existing verification requirement and is not inferred from token names here.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REQ-global-inventory-coherence | Global reads as one inventory; no stranding in an empty category while installed content is hidden behind another tab | `LockerMode`/`GLOBAL_SECTION_TABS` gap (below), the rail hide-empty correction with the corrected line citation, `countGlobalInventoryMods`/`countGlobalInventoryCategories` (already closed structurally) |
| REQ-sound-locker-surface | Contested-variant closure: no second global-sound home, useful `GlobalSoundShelf` capabilities preserved inside the shared shell | Confirmed delivered (`GlobalSoundShelf` inside `LockerGlobalView`); this phase only adds the third tri-state segment, does not rebuild the shell |
| REQ-portrait-journey-consolidation-gated | One stated portrait journey, both randomization views kept with distinguishing labels | D-08 caption placement sites verified (`HeroCardPicker.tsx:412`, `MyChanges.tsx:282`), `foundryShuffleIncluded`/`cardShuffleIncluded` confirmed as one shared pool identity |
| REQ-portrait-alias-sweep | Root-cause hunt for issue #4 (Abrams), three-leg test, feasibility of each leg | Leg A verified in this session (heroIdentity.ts:75, three of four D-11 call sites read directly); Legs B/C feasibility and exact commands documented below |
| REQ-ui-consequence-and-vocabulary | Bulk undo, disabled-control blockers, empty-state contract, vocabulary consolidation | Existing bulk-mutation pattern in `Installed.tsx` (no undo today), `ToastStack`/`showToast`/`dismissToast` API, `EmptyState`/`Tag` primitives, verified i18n key paths and one corrected key-namespace error in the UI-SPEC |
</phase_requirements>

## Summary

Phase 5's own UI-SPEC already ran a verified scope-correction pass, and this research independently re-verified its central claims by reading the cited files rather than trusting the citations. Most of them held. One did not: the UI-SPEC's citation for the unconditionally-rendered visual rail (`Locker.tsx:2407`) actually points at the **retag context menu**, a different `GLOBAL_VISUAL_MOD_TYPE_ORDER.map` call than the one that renders the rail. The real rail-render site, with the explicit comment stating the deliberate as-shipped behavior D-04 must reverse, is `Locker.tsx:1965-1982` (see Common Pitfall 1). A second, more consequential error: the UI-SPEC's copywriting contract writes several new/changed keys under a `portraitEditor.family.*` namespace (`portraitEditor.family.browserTitle`, `.unresolvedTag`, `.unresolvedHint`), but that namespace does not exist for family content anywhere in the tree. The real, already-shared namespace both Locker's `HeroPortraitFamilies.tsx` and Foundry's `PortraitBrowse.tsx` consume is `portrait.family.*` (verified at `translation.json:3873-3899`, and by grepping every `t('portrait.family...')` call site). `portraitEditor.*` is a real, populous namespace, but it belongs to the crop/staging editor (`PortraitEditor.tsx`), not to family browsing. Using the wrong namespace would create an orphaned, uninspected new sub-tree instead of extending the one both surfaces already read from.

The seven items CONTEXT.md and the UI-SPEC scope note call genuinely open are all confirmed narrow and additive: a third `LockerMode`-shaped tri-state (the type is a literal `'looks' | 'sounds'` union at `lockerMode.ts:9`, so widening it is a real, traceable type change, not a guess); reversing one deliberate unconditional-render decision at the corrected line range; two missing empty states layered onto an already-five-way-aware component; a bulk-undo mechanism that has **no existing bulk-mutation call site to attach to inside Locker today** (Locker.tsx has zero `bulk`/multi-select code; the only mature bulk-enable/disable/delete pattern in the whole app lives in `Installed.tsx`, which this phase's Global shell should mirror rather than reinvent); a derived-pak-description helper with a clear precedent in `docs/global-locker-foundry-ux-plan.md`'s Announcer-shelf fix; and an i18n consolidation that, per the UI-SPEC's own reconciliation table, changes **values at existing keys**, not key names, so it does not orphan translated catalogs in the technical sense `pnpm i18n:check` would catch (translated values simply go semantically stale until Weblate re-translates).

The alias-sweep root cause (REQ-portrait-alias-sweep) is the one item this research could not fully close, by design: Legs B and C require driving the live renderer over CDP with a committed tree and a free dev slot, which is execution-phase work, not research-phase work. What this session did establish, by reading source rather than inferring: Leg A already passes (Abrams resolves correctly in the alias table, confirmed at `heroIdentity.ts:75` and `heroPortraitIdentity.test.ts:24-25`), and three of the four D-11 call sites (Foundry catalog filtering, and both of the main-process "family lookup" services `getHeroPortraits`/`getCustomCardSlots`) verifiably consult that same centralized table. The fourth, Foundry's `?hero=` route matching, resolves through a **different** alias table (`HERO_DISPLAY_ALIASES` in `lockerUtils.ts`, consulted via `canonicalHeroName`) than the portrait-specific one (`heroIdentity.ts`, consulted via `resolvePortraitHero`/`portraitCodenamesForHero`). Two tables answering "is this the same hero" is exactly the S5 structural cause `docs/global-locker-foundry-ux-plan.md` already named; it is not yet proven to cause the Abrams defect (which does not currently reproduce), but it is the most concrete lead this research surfaced and Leg B/C should specifically probe whether the two tables can ever disagree.

**Primary recommendation:** Do the vocabulary catalog pass first (D-17, at existing keys, zero new architecture), then the tri-state selector and rail hide-empty logic together (they touch the same render block in `LockerGlobalView`), then the two portrait empty states and the D-11 alias-table cross-check (Leg A, safe to do alongside everything else), then wire bulk-undo onto whatever bulk mutations this phase's Global shell actually ships (there are none pre-existing to retrofit), and treat Legs B/C of the alias sweep as a dedicated, isolated execution-time task requiring its own dev slot and a committed tree (already true as of this session: `git status` is clean at `299d86c`).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Global inventory tri-state view (`All content \| Visuals \| Sounds`) | Frontend Server (renderer, `LockerGlobalView`) | — | Pure client-side filter over already-loaded mod/sound state; no new IPC |
| Hide-empty rail projection | Frontend Server (renderer, `Locker.tsx` rail render + `globalInventory.ts` helpers) | — | Pure derivation over `GlobalModGroups`/`SoundInventoryEntry[]`, already computed client-side |
| Portrait empty states (`failed`, `filtered to zero`) | Frontend Server (renderer, `PortraitBrowse.tsx`, `HeroPortraitFamilies.tsx`) | API/Backend (main, catalog build failure signal) | The "failed" state needs main to report a catalog-build failure distinctly from "built but empty"; the renderer only renders what main reports |
| Unresolved-codename indicator | Frontend Server (renderer) | — | Pure presentation over data the alias resolver (already renderer-side, `heroIdentity.ts`) already returns |
| Alias resolution centralization (REQ-portrait-alias-sweep) | Frontend Server (renderer, `heroIdentity.ts`) | API/Backend (main, `heroPortraits.ts`/`customHeroCards.ts` import the same renderer module) | The alias table is a renderer module imported by both renderer components and main-process services (via relative `../../../src/lib/...` import) — one source, two runtimes |
| Bulk-undo toast | Frontend Server (renderer, `toastStore.ts` + whichever store owns the mutated data) | — | `showToast`/`dismissToast` and the Zustand mod store are both renderer-side; no main-process round trip needed for undo itself (it re-applies prior renderer-known state through existing IPC mutators) |
| Derived pak descriptions | Frontend Server (renderer, presentation) | API/Backend (main, VPK entry read, already exists via `list-unknown-mod-files`) | Main already exposes the entry list this needs (used by the existing Announcer-shelf fix); this phase only adds renderer-side derivation and display, no new IPC |
| Vocabulary consolidation | Frontend Server (renderer, `src/locales/en/translation.json` + call sites) | — | Pure catalog and call-site work |

## Standard Stack

### Core

No new libraries. This phase is renderer-only changes to an existing hand-rolled design system.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19 (per CLAUDE.md) | Existing renderer framework | Already the whole app |
| react-i18next | already installed | i18n catalog and interpolation | `escapeValue: false` is set at `src/i18n.ts:190` because React already escapes JSX children; this phase must not introduce `dangerouslySetInnerHTML` around any interpolated mod name, filter term, or derived pak description, or that safety property breaks |
| Zustand | already installed | `appStore.ts` (mod/shuffle state), `toastStore.ts` (undo toast) | Already the state layer for everything this phase touches |
| lucide-react | `^0.562.0` (per UI-SPEC) | Icons for new empty states / tags | Already the icon library |

### Supporting

Nothing new. Every primitive this phase needs already exists: `Tag`, `EmptyState`, `ToastStack`/`showToast`/`dismissToast`, `useConfirm` (`src/components/common/confirmContext.ts`), `useSegmentedTabs`, `useEscapeKey`, `useDismissable`.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Extending `LockerMode` to a 3-value union | A separate boolean `showAll` flag alongside the existing 2-value mode | Rejected: D-05 treats `All content` as a real selectable view state that must be deep-linkable and default-selected, which is what a discriminated union member is for; a side flag would need to be kept in sync with `mode` everywhere `mode` is read, duplicating the D-05 default logic |
| Hand-rolling the tri-state tab wiring to match the existing `GLOBAL_SECTION_TABS` pattern | Migrating to `useSegmentedTabs` | Either is defensible (see Common Pitfall 4); recommend migrating since it is the file's own documented "canonical" hook and `docs/ui-conventions.md` names `SegmentedControl`/`ViewModeToggle` as the house pattern, but the existing 2-tab code already hand-rolls roving tabindex correctly and works, so this is genuinely the planner's/executor's call, not a blocking decision |

**Installation:** None. No `npm install` needed for this phase.

**Version verification:** Not applicable, no new packages.

## Package Legitimacy Audit

**Not applicable.** This phase installs no external packages. All work is renderer-side React/TypeScript using primitives already present in `src/components/common/*` and libraries already in `package.json`. No `npm view` / registry check was needed or performed.

## Architecture Patterns

### System Architecture Diagram

```
                    ┌─────────────────────────────────────────┐
                    │   Locker Global drill-in (renderer)      │
                    │   LockerGlobalView (Locker.tsx)          │
                    └───────────────────┬───────────────────---┘
                                         │
                    ┌────────────────────┼─────────────────────┐
                    │                    │                     │
              ?mode=looks           ?mode=all (new)       ?mode=sounds
                    │                    │                     │
                    ▼                    ▼                     ▼
         GLOBAL_VISUAL_MOD_TYPE_ORDER  merged projection   GLOBAL_SOUND_SECTIONS
         (groups[type], hide if 0)   (visual + sound rows,  (soundCounts, hide if 0)
                    │                 both hidden-if-0)         │
                    │                    │                     │
                    └──────────┬─────────┴──────────┬──────────┘
                               │                     │
                     countGlobalInventoryMods   countGlobalInventoryCategories
                     (globalInventory.ts)       (globalInventory.ts)
                               │
                               ▼
                     header "total" (Locker.tsx:1823-1826)


   Portrait alias resolution (D-11), the four call sites:

   heroIdentity.ts (ONE alias table, renderer)
        │
        ├── resolvePortraitHero / matchesPortraitHero ──▶ Foundry catalog filtering
        │                                                  (PortraitBrowse.tsx:105,113
        │                                                   via portraitFamiliesForHero)
        │
        ├── portraitCodenamesForHero ──▶ main: getHeroPortraits (heroPortraits.ts:87)
        │                            └─▶ main: getCustomCardSlots (customHeroCards.ts:100)
        │                                 ("family lookup" for HeroCardPicker/
        │                                  HeroPortraitFamilies)
        │
        └── (NOT consulted here) ──X── Foundry.tsx:161 "route matching"
                                        (?hero=<name> resolution) instead uses
                                        canonicalHeroName / HERO_DISPLAY_ALIASES
                                        from lockerUtils.ts — a SEPARATE table.
                                        This is the concrete lead for Legs B/C.

   portraitInventory.ts "inventory grouping" uses canonicalHeroName on
   Mod-recorded display names (not codenames) — a third, narrower axis that
   does not need panorama-codename resolution because it never sees a codename.
```

### Recommended Project Structure

No new files/folders required beyond what already exists. Touch points, in the order the Summary's recommendation suggests:

```
src/locales/en/translation.json     # D-17 vocabulary pass first (value changes at
                                     # existing keys; 2 new keys: locker.global.sectionAll,
                                     # and whichever singular "Portrait family" key E1/E4/E5
                                     # actually need — see Common Pitfall 2 for the correct
                                     # namespace)
src/lib/lockerMode.ts               # widen LockerMode to 'all' | 'looks' | 'sounds'
src/pages/Locker.tsx                # LockerGlobalView: GLOBAL_SECTION_TABS, the rail
                                     # render (~1965-1982), activeRailKey/activeType wiring
src/lib/globalInventory.ts          # merged-projection helper for the "All content" rail
                                     # if the planner wants it pure/tested separately from
                                     # the render (recommended: mirrors countGlobalInventoryMods)
src/components/foundry/PortraitBrowse.tsx       # "failed" + "filtered to zero" states
src/components/locker/HeroPortraitFamilies.tsx  # same two states, Locker side; unresolved tag
src/lib/heroIdentity.ts             # Leg A cross-check target; do not add a second table
src/components/locker/HeroCardPicker.tsx        # E3 "This hero" caption beside card-shuffle
src/components/foundry/MyChanges.tsx            # E3 "All forged portraits" caption beside
                                                 # FoundryPoolList (both the cross-hero view
                                                 # and the embed inside HeroCardPicker)
src/stores/toastStore.ts            # already has showToast/dismissToast; no changes needed,
                                     # only new call sites
```

### Pattern 1: Extending a route-mode discriminated union safely

**What:** `LockerMode` is consumed by `lockerModeFromSearch`, `resolveLockerRoute`, `GLOBAL_SECTION_TABS`, and every `section === 'sounds'`-shaped conditional in `Locker.tsx`.
**When to use:** Any time D-05's tri-state default needs to be the type-level default, not a runtime special case.
**Example (verified read, not invented):**
```typescript
// Source: src/lib/lockerMode.ts:9-14 (current, 2-value)
export type LockerMode = 'looks' | 'sounds';

export function lockerModeFromSearch(search: string): LockerMode | null {
  const mode = new URLSearchParams(search).get('mode');
  return mode === 'looks' || mode === 'sounds' ? mode : null;
}
```
Widening this to a 3-value union and updating the `mode === X` checks is a compiler-verified change: TypeScript will flag every `switch`/conditional over `LockerMode` that does not handle the new member, because `resolveLockerRoute`'s return type and `GLOBAL_SECTION_TABS`'s array type both derive from it. This is the concrete reason D-05 is "genuinely unbuilt, not doc drift" per the UI-SPEC, and also why it is a bounded, traceable change: `tsc -b` enumerates every call site that needs updating.

### Pattern 2: One shared alias table, imported from both runtimes

**What:** `src/lib/heroIdentity.ts` is a renderer module (`src/lib/...`) imported directly by main-process services via a relative path (`../../../src/lib/heroPortraitIdentity` from `electron/main/services/heroPortraits.ts:23-26`).
**When to use:** Any time REQ-portrait-alias-sweep's Leg A needs extending, or a new alias consumer is added.
**Example (verified read):**
```typescript
// Source: electron/main/services/heroPortraits.ts:23-26
import {
    portraitCodenameForHero,
    portraitCodenamesForHero,
} from '../../../src/lib/heroPortraitIdentity';
```
The one thing this pattern forbids, per D-11 and per the existing `heroPortraitIdentity.ts` file comment ("Nothing here holds a table any more... it still belongs there, on the row"): do not add a second lookup for the same question. `HERO_DISPLAY_ALIASES` in `lockerUtils.ts` (consulted by `canonicalHeroName`, used at `Foundry.tsx:161-162` for `?hero=` route matching) is exactly such a second table, predates the centralization work, and is the concrete candidate the alias sweep should check for divergence from `heroIdentity.ts`'s roster/display names.

### Pattern 3: Bulk mutation with snapshot-and-undo (the pattern to mirror, not the one to copy verbatim)

**What:** `Installed.tsx` already has a mature multi-select + bulk-enable/disable/delete implementation, but **no undo**. This phase needs to add undo to whatever bulk actions the Global shell ships, and `Installed.tsx`'s shape is the closest existing precedent for the selection/progress mechanics.
**When to use:** Any bulk mutation this phase's Global shell introduces (bulk enable/disable in the tri-state view, per E7's copy contract).
**Example (verified read):**
```typescript
// Source: src/pages/Installed.tsx (verified line ranges)
// :1116-1124  selectedIds: Set<string>; bulkProgress: { verb, done, total } | null
// :2513-2529  handleBulkEnable: iterates targets, updates bulkProgress per item
// :2474       useEscapeKey(exitSelectMode, selectMode && !bulkProgress && !modToDelete)
```
**Gap this phase must close, not copy:** Nothing in `Installed.tsx`'s bulk handlers captures a snapshot for undo. D-14 requires the snapshot to exist; the planner should design it as a small, pure "prior state for these mod ids" capture taken immediately before the bulk mutation runs (the Zustand store already holds `enabled`/`priority` for every mod, so the snapshot is a `Map<modId, Pick<Mod, 'enabled'>>` or similar, not a new subsystem).

### Pattern 4: The two-vocabulary rail, and what "one denominator" already looks like

**What:** `countGlobalInventoryMods`/`countGlobalInventoryCategories` already solved S1/S4 (the double-counting defect) by computing one Set-deduplicated total over both `GlobalModGroups` and `SoundInventoryEntry[]` together.
**When to use:** Building the "All content" merged rail projection (D-05's "may group both using the same underlying entries").
**Example (verified read):**
```typescript
// Source: src/lib/globalInventory.ts:16-26
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
The "All content" rail's row list is the natural extension of this: concatenate `GLOBAL_VISUAL_MOD_TYPE_ORDER`-derived rows and `GLOBAL_SOUND_SECTIONS`-derived rows into one list, filtered to `count > 0` (D-04's hide-empty), with the membership-caveat copy (E1's `sectionMembershipHint`) shown once above it per D-04's "labeled as section membership, never... sum to the header."

### Anti-Patterns to Avoid

- **A second alias/identity table for "is this the same hero."** `heroIdentity.ts` already centralizes this for the panorama namespace; `HERO_DISPLAY_ALIASES` in `lockerUtils.ts` is a pre-existing second one for the roster-display-name namespace. Do not add a third. If Leg B/C of the alias sweep finds these two disagree for any hero, the fix is to make one consult the other (or merge), not to patch the disagreement at the call site.
- **Writing new copy under `portraitEditor.family.*`.** See Common Pitfall 2. The correct, already-shared namespace is `portrait.family.*`.
- **Treating the retag menu's `GLOBAL_VISUAL_MOD_TYPE_ORDER.map` (`Locker.tsx:2407`) as the rail to fix for D-04.** It is a different, unrelated unconditional map (a context menu listing every category a mod could be retagged into, which correctly lists all categories regardless of count — that one should stay unconditional). The rail to change is `Locker.tsx:1965-1982`.
- **A generic global `useState` toggle for hide-empty instead of respecting D-04's "hidden by default."** The UI-SPEC's own E2 `partial` backstop names this exact ambiguity (fixed rule vs. user toggle) as unresolved; default to the fixed rule (no new preference) per its stated assumption, since CONTEXT.md's Discretion section does not name a hide-empty toggle as open.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Undo toast | A new toast/snackbar component | `showToast(message, { actionLabel, onAction })` / `dismissToast(id)` from `src/stores/toastStore.ts` | Already used by 22 files per `docs/locker-consistency-pass.md`; verified API shape at `toastStore.ts:18-27,48-49,58,65` |
| Confirmation before a destructive bulk action (if any new one is added) | `window.confirm` or a bespoke modal | `useConfirm()` from `src/components/common/confirmContext.ts` | Already the house pattern (Lane 6 of the consistency pass, "no `window.confirm` left in `src/`"); confirmed still the only confirm hook in the tree (11 files import it) |
| Accessible tab wiring for the tri-state selector | Hand-rolled `aria-selected`/`aria-controls` bookkeeping from scratch | `useSegmentedTabs<T>()` from `src/components/common/useSegmentedTabs.ts`, or extend the existing hand-rolled pattern already in `LockerGlobalView` (both are consistent with `docs/ui-conventions.md`) | The 2-tab version already works and is arrow-key/roving-tabindex correct; widening it in place is lower-risk than introducing the shared hook mid-file, but either is acceptable (see Alternatives Considered) |
| Empty/error state layout | A new empty-state component per surface | `EmptyState` from `src/components/common/PageComponents.tsx` (`icon`, `title`, `description`, `action`, `variant: 'default' | 'error'`) | Already takes all three parts D-18 requires; the existing "failed"/"filtered to zero" gap is a missing *call site*, not a missing *component* |
| Unresolved-codename badge | A new status-chip component | `Tag` from `src/components/common/ui.tsx` (`tone="neutral"`, `title` for the raw codename) | Verified props at `ui.tsx:80-93`; `tone`, `variant`, `title` all already exist exactly as the UI-SPEC's E4 spec needs |

**Key insight:** Every UI primitive this phase needs already exists and is already used at scale elsewhere in the app. The actual engineering risk in this phase is not "which component to build" but "which existing derivation/table to extend without creating a second one" (S1/S4/S5 from `docs/global-locker-foundry-ux-plan.md` are the named structural failure modes, and this phase's whole job is closing the last instances of them).

## Runtime State Inventory

This is not a rename/refactor/migration phase in the filesystem-state sense (no directory renames, no key-value store migrations), but D-17's vocabulary work has rename-shaped optics worth answering explicitly per the verification protocol.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None. No database schema, mod metadata field, or persisted store key is renamed by this phase. `PortraitInventoryEntry`, `SoundInventoryEntry`, and every `Mod` field stay as they are | None |
| Live service config | None. This phase touches no GameBanana sync state, no `gameinfo.gi`, no external service config | None |
| OS-registered state | None | None |
| Secrets/env vars | None | None |
| Build artifacts | None. No package rename, no build-output path change | None |
| **i18n catalog keys** (not a listed category above, but the closest analog) | Per the UI-SPEC's own reconciliation table, D-17's "Active source" and "Portrait family" corrections are **value changes at existing key names** (`locker.cards.winner`, `locker.cards.isWinner`, etc. keep their keys; only the English string changes), plus a small number of genuinely new keys for new UI elements (E1's `locker.global.sectionAll`, and the correctly-namespaced `portrait.family.*` additions for E4's unresolved tag). **Verified:** `locker.cards.winner` = `"Current winner: {{name}}"` at `translation.json:527`; `locker.cards.isWinner` = `"winner"` at `translation.json:538` | No data migration. Existing translated locales (`bg`, `fr`, `ru` per `docs/global-locker-foundry-ux-plan.md`'s A0c note) keep their keys and will show a stale translation of the old English meaning until Weblate re-translates the new value; `pnpm i18n:check` will not flag this because the key still exists. Run `pnpm i18n:manifest` after any catalog change per the standing i18n gate rule |

**Nothing found in the first five categories** — verified by reading `portraitInventory.ts`, `globalInventory.ts`, and confirming no IPC/schema changes are implied by any of the seven open work items.

## Common Pitfalls

### Pitfall 1: Trusting the UI-SPEC's `Locker.tsx:2407` citation for the rail fix

**What goes wrong:** A planner or executor opens `Locker.tsx:2407` expecting to find the rail render that lists `GLOBAL_VISUAL_MOD_TYPE_ORDER` unconditionally (per the UI-SPEC's Scope note table), and instead finds the **retag context menu** (`role="menu"`, opened from a mod's kebab, listing every category a mod could be moved into). That map is *correctly* unconditional (a retag target list should show every category, not just non-empty ones) and must not be touched for D-04.
**Why it happens:** `Locker.tsx` has two separate `GLOBAL_VISUAL_MOD_TYPE_ORDER.map(...)` call sites (verified via grep: lines 1977 and 2407). The UI-SPEC cited the second without disambiguating.
**How to avoid:** The actual rail-render site to modify for D-04's hide-empty rule is `Locker.tsx:1965-1982`, which contains the explicit as-shipped-behavior comment: *"Both list every entry with its count, empty ones included, and every row is clickable: an empty row opens its own empty state, which is more discoverable than a dead disabled row."* That comment is the design note D-04 is reversing; changing it means filtering the `(isSounds ? soundCounts... : GLOBAL_VISUAL_MOD_TYPE_ORDER...).map(...)` array (built at 1970-1982) to `count > 0` before rendering rows, not touching the retag menu at 2407.
**Warning signs:** If an implementation diff touches the retag menu's category list and doesn't touch the array built at 1970-1982, D-04 is not actually implemented.

### Pitfall 2: Writing new portrait-family copy under the wrong i18n namespace

**What goes wrong:** New keys land at `portraitEditor.family.browserTitle`, `portraitEditor.family.unresolvedTag`, etc. (as the UI-SPEC's copywriting contract literally specifies), creating a second, unused family-copy subtree while the actual rendered surfaces (`HeroPortraitFamilies.tsx`, `PortraitFamilyCard.tsx`, `PortraitFamilyPreview.tsx`, `PortraitBrowse.tsx`) keep reading `portrait.family.*` and never see the new strings.
**Why it happens:** The name `portraitEditor.family.*` is a plausible-sounding guess (there is a genuine, large `portraitEditor` namespace at `translation.json:3747`), but it belongs to `PortraitEditor.tsx` (the crop/staging tool: `portraitEditor.title`, `.stage`, `.recrop`, etc., verified via grep of `t('portraitEditor.` call sites, all in `PortraitEditor.tsx` and `LibraryBrowse.tsx`/`PortraitBrowse.tsx`'s staging toast). The shared family-browsing namespace both surfaces actually consume is `portrait.family.*` (verified: `HeroPortraitFamilies.tsx:147,160,163,172,174` all call `t('portrait.family.*')`, and `translation.json:3873-3899` is that exact key subtree with `browserTitle`, `loading`, `noneTitle`, `noneBody`, `sourcesTitle`, etc. already present).
**How to avoid:** Add the E4 unresolved-tag key at `portrait.family.unresolvedTag` and `portrait.family.unresolvedHint` (or an equally-scoped sibling under `portrait.*`), not under `portraitEditor.*`. Grep `t('portrait.family.` before adding any new family-copy key to confirm the target file already reads from that namespace.
**Warning signs:** `pnpm i18n:check` will pass either way (a key that exists and is simply never read is not "missing"), so this defect is invisible to the automated gate. Verify by grepping the component file for the exact key string before considering the copy task done.

### Pitfall 3: Building a fifth alias table instead of checking the two that exist

**What goes wrong:** REQ-portrait-alias-sweep's Leg B/C investigation (or a fix attempted without it) adds a new resolution step somewhere in the four D-11 call sites, rather than checking whether `heroIdentity.ts` (panorama-scoped, used by 3 of 4 call sites) and `lockerUtils.ts`'s `HERO_DISPLAY_ALIASES` (roster-display-scoped, used by Foundry's `?hero=` route matching at `Foundry.tsx:161-162`) can disagree for any hero.
**Why it happens:** The two tables answer superficially similar questions ("what names does this hero go by") for different namespaces, and nothing enforces that they agree, because nothing has ever needed them to until the alias-sweep requirement's four-call-site claim.
**How to avoid:** Leg A should extend `heroPortraitIdentity.test.ts` (or a new fixture) to assert, for every hero in `heroIdentity.ts`, that `canonicalHeroName(hero.displayName)` (the `lockerUtils.ts` table) and `resolveHeroByName(hero.displayName)?.displayName` (the `heroIdentity.ts` table) return consistent, non-contradictory answers. This is the cheap, static half of the sweep and can run without a dev slot.
**Warning signs:** A hero whose GameBanana category name, roster display name, and panorama alias are three different strings (Abrams is exactly this case: `abrams` roster/sound, `atlas`/`bull` panorama) is the highest-risk case to check first.

### Pitfall 4: Assuming bulk-undo has an existing mutation to attach to

**What goes wrong:** D-14/D-15 are written as if bulk mutations already exist in the Locker Global shell and only need an undo affordance bolted on. They do not: `Locker.tsx` has zero `bulk`/multi-select/`selectedIds` code today (verified: a grep for `bulk|Bulk|selectedIds|multiSelect` across the whole file returns no matches). The only bulk-mutation UI in the entire app lives in `Installed.tsx` (multi-select, `handleBulkEnable`/`handleBulkDisable`, bulk delete with `isBulk`), and it has no undo either.
**Why it happens:** The UI-SPEC's E7 copy contract mentions "bulk enable/disable, retag, delete in the Global shell" as if scoping existing controls, but per-mod retag (`retagMenu`) is the only bulk-shaped control that exists in `Locker.tsx` today, and it is single-mod, not multi-select.
**How to avoid:** The planner must treat "which bulk mutations exist in scope for this phase" as an open design decision, not a given. The two defensible options: (a) this phase adds multi-select + bulk enable/disable to the Global shell for the first time, mirroring `Installed.tsx`'s pattern, with undo built in from the start; or (b) "bulk mutation" in D-14 is read narrowly to mean whatever action-in-aggregate this phase's own new UI introduces (e.g., a single "hide empty categories" toggle is not a mutation and doesn't need undo; a "disable all mods in this category" action would). Either is legitimate, but the plan must state which bulk actions D-14 applies to rather than assuming they pre-exist.
**Warning signs:** A plan that says "add undo to the existing bulk actions" without naming which file/lines those actions live in has not actually located them.

### Pitfall 5: Two-state `activeRailKey`/`activeType`/`activeSoundCategory` logic silently breaking under a third state

**What goes wrong:** `LockerGlobalView` threads `isSounds`, `activeType`, `activeSoundCategory`, and `activeRailKey` through `useState`, a `useLayoutEffect` measuring the sliding tab indicator, and the retag menu's category list, all keyed on the assumption that exactly one of two rail vocabularies is showing. Adding `All content` without auditing every one of these derived values risks a rail row that highlights nothing, or a retag menu that offers the wrong category set while `All content` is selected.
**Why it happens:** The 2-state branch (`isSounds ? soundCounts... : GLOBAL_VISUAL_MOD_TYPE_ORDER...`) at `Locker.tsx:1970-1982` is the single place that would need a third branch, but `activeType`/`selectedType`/`activeSoundCategory`/`selectedSoundCategory` are four separate pieces of `useState`, and the merged view needs to decide what "the active row" even means when both vocabularies are visible at once.
**How to avoid:** Design the `All content` selection state explicitly before implementing: does selecting a row in the merged view set `selectedType` or `selectedSoundCategory` (whichever vocabulary the clicked row belongs to), or does it need a third, unified `activeMergedKey` state? The retag menu (which only makes sense for visual types) needs an explicit decision for what it does when a sound-category row is the active one in `All content` view.
**Warning signs:** A TypeScript compile that passes but a runtime state where `activeRailKey` matches no rendered row.

## Code Examples

### Toast with undo (D-14/D-15 pattern)

```typescript
// Source: src/stores/toastStore.ts (verified API shape at lines 18-27, 48-49, 58, 65)
showToast(t('common.bulkUndo.message', { count: affected.length }), {
  actionLabel: t('common.bulkUndo.action', 'Undo'),
  onAction: () => restoreSnapshot(snapshot),
});
// D-15's supersession rule: dismiss the prior toast the instant a new bulk
// mutation on the same surface starts, rather than stacking a second toast.
dismissToast(previousUndoToastId);
```

### Empty state, three-part contract (D-18)

```typescript
// Source: src/components/common/PageComponents.tsx:105-130 (verified props)
<EmptyState
  icon={AlertTriangle}
  variant="error"
  title={t('foundry.portraits.catalogFailed.title')}
  description={t('foundry.portraits.catalogFailed.description')}
  action={<Button onClick={retryCatalogBuild}>{t('locker.pose.retry')}</Button>}
/>
```

### Unresolved-codename tag (D-12)

```typescript
// Source: src/components/common/ui.tsx:80-124 (verified TagProps)
<Tag tone="neutral" title={rawCodename}>
  {t('portrait.family.unresolvedTag', 'Unresolved')}
</Tag>
```

### Alias-table cross-check fixture shape (Leg A)

```typescript
// Extends the existing pattern at src/lib/heroPortraitIdentity.test.ts:24-25,
// which already proves resolvePortraitHero('Abrams') returns
// { displayName: 'Abrams', panoramaCodenames: ['atlas', 'bull'] }.
// Leg A's remaining gap: no existing test cross-checks heroIdentity.ts against
// lockerUtils.ts's HERO_DISPLAY_ALIASES for the same hero.
import { canonicalHeroName } from '../lockerUtils'; // HERO_DISPLAY_ALIASES table
import { resolveHeroByName } from '../heroIdentity';  // the centralized table

for (const hero of ALL_HEROES) {
  const viaLockerUtils = canonicalHeroName(hero.displayName);
  const viaHeroIdentity = resolveHeroByName(hero.displayName)?.displayName;
  expect(viaLockerUtils).toBe(viaHeroIdentity ?? hero.displayName);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Two sound vocabularies (`shared`/`shared melee`/`other` fallback categories) | One classification module (`classifySound`) returning category + reason, `Needs classification` queue | `a87eb6e`, 2026-07-30 | Closed; not this phase's concern, but the rail this phase touches inherits its output (`GLOBAL_SOUND_SECTIONS`) |
| Top-level `Looks \| Sounds` mode switch over two hero grids | One hero grid, hero page has a `Sounds` tab; `?mode=` now selects only the Global drill-in's section | 2026-07-29 (superseded per `docs/ui-thoughtfulness-and-adjustability-plan.md`) | `LockerMode`'s remaining job is exactly the tri-state this phase widens |
| `SoundLocker.tsx` as a separate full-page route | `GlobalSoundShelf.tsx`, a body component mounted inside `LockerGlobalView`'s right pane | Lane 1 of `docs/locker-consistency-pass.md`, delivered | This is D-01/D-02's "already delivered" baseline; do not rebuild it |
| Two derivations of "who owns this path" (`buildSoundInventory` vs `foundryInspectAssetSources`) | `src/lib/assetClaims.ts` as the one load-order rule, both derivations project from it | `896c6f9`, 2026-07-30 | S1 closed for sound/asset claims generally; portrait alias resolution (S5) is the remaining open instance of the same structural problem, which is exactly REQ-portrait-alias-sweep's target |

**Deprecated/outdated:**
- `docs/sound-locker-plan.md`'s dedicated `/locker/sounds` route proposal: superseded by D-01. The doc itself is retained as historical record of the useful capabilities (audition, exact-path ownership, provenance) D-02 requires preserving, not as a route to build.
- The two variant vocabularies `minimap`/`small` (base-card manifest) vs `mm`/`sm` (compiled catalog): already unified under one `portrait.*` namespace per `docs/global-locker-foundry-ux-plan.md`'s A2d-part2 section, "Both are gone, replaced by one `portrait.*` namespace." Confirms `portrait.*` (not `portraitEditor.*`) is the intentional, already-established shared namespace referenced in Pitfall 2.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Hide-empty rail (D-04) is a fixed, always-on rule with no user-facing toggle, per the UI-SPEC's own E2 `partial` backstop note | Anti-Patterns, Pitfall 5 | If wrong, a "show empty categories" preference control is expected and this phase under-builds; low risk since CONTEXT.md's Discretion section does not name this as open, and D-04's wording ("hidden by default") permits but does not require a toggle |
| A2 | The `All content` selector's loading behavior (whether it shows a transient loading state before `globalGroups`/`globalSoundEntries` first resolve) follows the existing 2-tab behavior (render immediately, populate under it) | UI-SPEC E1 loading backstop, inherited here | Low risk; matches existing 2-tab code path exactly (no `loading` state exists for `groups`/`soundEntries` today, they arrive via the mod store) |
| A3 | A codename that fails resolution because the **catalog itself failed to load** routes to the "failed" (E5) state, never to the "Unresolved" (E4) tag, which fires only after a successful catalog read leaves a codename unplaced | UI-SPEC E4 error backstop, inherited here | Medium risk: REQ-portrait-alias-sweep's own verdict table treats "unresolved" and "catalog load failure" as different diagnoses, consistent with this assumption, but no explicit decision confirms the UI routing |
| A4 | A partially-failed bulk mutation (some mods updated, some rejected) surfaces as **one** toast whose message names the successful count and whose body names what could not be changed, rather than two separate toasts | UI-SPEC E6 error backstop, inherited here | Medium risk; D-15 requires "reports what changed and keeps a recovery action visible" but does not specify one-toast vs two-toast, and this affects the toast API shape (whether `showToast` needs a second `detail`/body param) |
| A5 | This phase's bulk mutations (whichever are chosen per Pitfall 4) are: bulk enable/disable in the Global shell, mirroring `Installed.tsx`'s existing pattern | Pitfall 4 | High risk if wrong: if the intended scope is narrower (e.g., only retag, or nothing genuinely "bulk" ships this phase), D-14/D-15/D-16 have no mutation to attach to and the plan must explicitly scope what "bulk" means for this phase |
| A6 | `HERO_DISPLAY_ALIASES` (`lockerUtils.ts`) and `heroIdentity.ts` do not currently disagree for any shipped hero, and the Abrams defect (not reproducing) is unrelated to this dual-table structure | Pitfall 3, Summary | Medium risk: this is exactly what Leg A's fixture extension (Code Examples) should prove or disprove; unverified in this research session because it requires enumerating and comparing both tables' full hero lists, which was not done here |

**If this table is empty:** N/A, six assumptions recorded above.

## Open Questions

1. **Which bulk mutations does this phase actually add, and does D-14 apply retroactively to any pre-existing single-mod actions treated as a batch (e.g., "disable all mods in a filtered-to-zero category")?**
   - What we know: no bulk UI exists in `Locker.tsx` today; `Installed.tsx` has the only existing bulk pattern in the app, with no undo.
   - What's unclear: whether this phase is expected to build bulk enable/disable into the Global shell for the first time, or whether "bulk mutation" should be read narrowly.
   - Recommendation: the plan should explicitly enumerate the bulk actions in scope before writing undo/blocker tasks against them (see Pitfall 4, Assumption A5).

2. **Does the Abrams alias defect (issue #4) actually involve the `HERO_DISPLAY_ALIASES` vs `heroIdentity.ts` dual-table structure, or is it a red herring since the defect currently does not reproduce?**
   - What we know: Leg A (static, this session) shows `heroIdentity.ts` resolves Abrams correctly and 3 of 4 D-11 call sites consult it; the 4th call site (`Foundry.tsx` route matching) uses a different table entirely.
   - What's unclear: whether the two tables can produce different answers for any hero, and whether that divergence, if it exists, is actually reachable from the Abrams-portraits user flow (route matching feeds which hero's workshop opens, not directly which portrait family resolves inside it).
   - Recommendation: run the Leg A fixture extension (Code Examples) first, cheaply, alongside other phase work. If it finds no divergence, Legs B/C (execution-time, CDP-driven) become lower priority and the alias-sweep requirement may close as "checked, no defect found, verdict: not-in-catalog-and-resolved is the honest empty state" rather than a code fix.

3. **What exactly triggers the Foundry "failed" portrait-catalog state (E5), given no such signal currently exists?**
   - What we know: `foundryThumbnails('hero-image')` in `PortraitBrowse.tsx:73-88` already has a `.catch` that sets an `error` string state; the missing piece is distinguishing "the catalog build itself failed" from "the catalog built successfully but is empty."
   - What's unclear: whether the existing `error` state (already caught) is sufficient to drive E5's "failed" `EmptyState`, or whether a new main-process signal is needed.
   - Recommendation: check whether `foundryThumbnails`'s existing rejection path already carries enough information (verified: `PortraitBrowse.tsx:60-88` already sets `error` on catch) before assuming new IPC/main-process work is needed; this may be a pure renderer wiring task (render `EmptyState variant="error"` when `error` is non-null, rather than the current unstyled fallback), not a new capability.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Committed working tree (no uncommitted changes) | REQ-portrait-alias-sweep Legs B/C (`scripts/dev-driver.mjs` drives the working tree) | Confirmed clean at commit `299d86c` as of this research session | — | Re-check with `git status --short` immediately before running Legs B/C at execution time, since other work may land between now and then |
| A free dev slot (`GRIMOIRE_DEV_SLOT=N`, nobody else attached) | Legs B/C, and any live verification of the tri-state selector / rail hide-empty behavior | Not verified in this research session (no dev build was started; research must not mutate a shared dev environment) | — | None; this is a hard precondition CLAUDE.md states explicitly ("never slot 0, never an unslotted app") |
| `pnpm exec vitest run`, `pnpm lint`, `pnpm i18n:check`, `pnpm i18n:manifest`, `pnpm encoding:check` | Every gate this phase's changes must pass | Confirmed present in `package.json` scripts (lines 31,34-36,39) | — | — |

**Missing dependencies with no fallback:**
- A free dev slot for Legs B/C. This is an execution-time scheduling concern, not a research blocker: the commands are documented (see below) and the tree is ready.

**Missing dependencies with fallback:**
- None beyond the dev slot.

**Leg B/C exact commands (for the executor, not run in this research session):**
```bash
GRIMOIRE_DEV_SLOT=<N> pnpm dev
GRIMOIRE_DEV_SLOT=<N> node scripts/dev-driver.mjs route foundry
GRIMOIRE_DEV_SLOT=<N> node scripts/dev-driver.mjs eval "window.__GRIMOIRE_DEV_SLOT"
# Leg B: what resolvePortraitHero/portraitCodenamesForHero return per hero (already
#   known statically for Abrams; drive the app to confirm the *catalog* the running
#   build actually contains for each codename)
# Leg C: which codenames the loaded Foundry catalog actually contains, per the
#   REQ-portrait-alias-sweep verdict table (in-catalog+unresolved = alias miss;
#   not-in-catalog+resolved = honest empty state; resolved+zero families =
#   portraitFamilyKey bug; neither = hero absent from this build)
```

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (verified `vitest.config.ts`: `environment: 'node'`, includes `src/**/*.test.ts(x)`, `electron/**/*.test.ts`) |
| Config file | `vitest.config.ts` (repo root) |
| Quick run command | `pnpm exec vitest run src/lib/lockerMode.test.ts src/lib/globalInventory.test.ts src/lib/portraitInventory.test.ts src/lib/heroPortraitIdentity.test.ts` |
| Full suite command | `pnpm exec vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-global-inventory-coherence | `LockerMode` widened to include `'all'`; `resolveLockerRoute`/`lockerModeFromSearch` handle it; legacy URLs unaffected | unit | `pnpm exec vitest run src/lib/lockerMode.test.ts` | ✅ exists, extend it |
| REQ-global-inventory-coherence | Hide-empty rail projection (merged `All content` row list, count > 0 filter) | unit | `pnpm exec vitest run src/lib/globalInventory.test.ts` | ✅ exists, extend it |
| REQ-portrait-alias-sweep | Leg A: `heroIdentity.ts` vs `lockerUtils.ts` alias-table cross-check for every hero | unit | `pnpm exec vitest run src/lib/heroPortraitIdentity.test.ts` | ✅ exists, extend it (new fixture, see Code Examples) |
| REQ-portrait-journey-consolidation-gated | `foundryShuffleIncluded`/`cardShuffleIncluded` remain one shared pool identity after caption changes (no behavior change expected, regression guard) | unit | `pnpm exec vitest run src/lib/foundryChanges.test.ts` (or wherever `groupFoundryShufflePools` is tested) | ❌ Wave 0: confirm exact existing test file name before planning tasks against it |
| REQ-ui-consequence-and-vocabulary | i18n catalog completeness after value changes and 2 new keys | automated (repo gate, not Vitest) | `pnpm i18n:check && pnpm i18n:manifest` | ✅ existing gate script |
| REQ-ui-consequence-and-vocabulary | Bulk-undo snapshot capture and restore (pure logic, once the mutation surface is chosen per Open Question 1) | unit | new test file, name TBD by planner once bulk-mutation scope is decided | ❌ Wave 0 |
| REQ-portrait-alias-sweep | Legs B/C (live catalog cross-check) | manual/CDP-driven, not Vitest | `node scripts/dev-driver.mjs` commands documented above | N/A, not a Vitest-shaped check |

### Sampling Rate

- **Per task commit:** the relevant unit test file(s) from the map above, plus `pnpm typecheck` and `pnpm lint` per `docs/ui-conventions.md`'s "after UI changes" rule.
- **Per wave merge:** `pnpm exec vitest run` (full suite), `pnpm i18n:check`, `pnpm encoding:check`.
- **Phase gate:** full suite green before `/gsd-verify-work`; Legs B/C of the alias sweep recorded with their verdict (per-hero, per the REQ's own four-way verdict table) even if the underlying defect turns out not to reproduce.

### Wave 0 Gaps

- [ ] Confirm the exact existing test file covering `groupFoundryShufflePools`/`foundryShuffleKey` (grep did not surface one distinctly named `foundryChanges.test.ts` in this research pass; verify before assuming it exists).
- [ ] A new test file for bulk-undo snapshot capture, once Open Question 1 resolves which mutation(s) are in scope.
- [ ] No framework install needed; Vitest is already configured and green per the codebase's existing 1140+ test count (per `docs/locker-consistency-pass.md`'s status line).

## Security Domain

`security_enforcement` is absent from `.planning/config.json`, so treated as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | This phase touches no auth surface |
| V3 Session Management | No | No session/token handling in scope |
| V4 Access Control | No | No new IPC channel, no new privilege boundary |
| V5 Input Validation | Marginal | i18n interpolation of user/GameBanana-controlled strings (mod names, derived pak entry-list descriptions in E8, filter terms in E2's "filtered to zero" banner). `escapeValue: false` is set at `src/i18n.ts:190` because React already escapes JSX children on render; this is safe **only** as long as no interpolated value in this phase's new copy is ever routed through `dangerouslySetInnerHTML`, which nothing in the affected components currently does |
| V6 Cryptography | No | Not applicable |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via interpolated mod/entry names in new copy (E1 filter hint, E8 derived pak description, undo toast message) | Tampering/Information Disclosure (if ever rendered via `dangerouslySetInnerHTML`) | Keep all interpolation flowing through normal JSX children (React's default escaping), exactly as every existing `t()` call in these files already does; do not introduce a `dangerouslySetInnerHTML` call as part of this phase |
| Two divergent alias tables silently resolving a hero to the wrong content | N/A (correctness bug, not a security threat) | Not a security concern; recorded here only to note it was considered and ruled out as a threat pattern, since it affects which portrait art displays, not any privilege or data boundary |

## Sources

### Primary (HIGH confidence, read directly this session)

- `src/lib/lockerMode.ts` (full file) - `LockerMode` type, `resolveLockerRoute`, `legacySoundTarget`
- `src/pages/Locker.tsx:1680-1990, 2390-2430` - `LockerGlobalView`, `GLOBAL_SECTION_TABS`, rail render, retag menu, header total
- `src/lib/globalInventory.ts` (full file) - `countGlobalInventoryMods`, `countGlobalInventoryCategories`
- `src/lib/globalSoundSections.ts` (full file) - `GLOBAL_SOUND_SECTIONS`
- `src/lib/heroPortraitIdentity.ts` (full file), `src/lib/heroIdentity.ts:1-30,75,163` - alias resolution
- `src/lib/portraitInventory.ts` (full file) - inventory grouping, `canonicalHeroName` usage
- `src/components/foundry/portraitFamilyLookup.ts` (full file), `src/components/foundry/PortraitBrowse.tsx:1-120` - catalog filtering call site
- `electron/main/services/heroPortraits.ts` (full file), `electron/main/services/customHeroCards.ts:95-125` - family lookup call sites
- `src/pages/Foundry.tsx:100-199` - route matching (`linkedHero`, `canonicalHeroName`)
- `src/components/locker/HeroPortraitFamilies.tsx` (full file), `HeroCardPicker.tsx:380-430` - portrait family UI, D-08 caption sites
- `src/components/foundry/MyChanges.tsx` (grep at lines 34,95,160-161,282-352) - D-08 caption site, `foundryShuffleIncluded`
- `src/locales/en/translation.json:260-274, 520-544, 2908-2922, 3747, 3840-3899` - verified key values and namespace boundaries
- `src/stores/toastStore.ts` (grep, lines 18-27,48-49,58,65) - undo toast API
- `src/components/common/PageComponents.tsx:105-130` - `EmptyState`
- `src/components/common/ui.tsx:80-124` - `Tag`
- `src/components/common/useSegmentedTabs.ts` (full file)
- `src/pages/Installed.tsx` (grep, bulk-mutation pattern, lines 95-2545 range)
- `src/pages/Conflicts.tsx` (grep, bulk-ignore only, no per-item bulk enable/disable)
- `src/lib/lockerUtils.ts:143-157` - `canonicalHeroName`, `HERO_DISPLAY_ALIASES`
- `src/i18n.ts:190` - `escapeValue: false`
- `vitest.config.ts` (full file)
- `.planning/config.json` (full file) - confirmed `nyquist_validation` and `security_enforcement` both absent/default-enabled
- `package.json` (grep, scripts section) - gate commands
- `git status --short` / `git log -1` - confirmed clean tree at `299d86c`

### Secondary (MEDIUM confidence)

- `docs/global-locker-foundry-ux-plan.md` (full file, 1435 lines) - structural causes S1-S9, historical decision record for the shared-shell architecture, Stage 0-5 status
- `docs/sound-locker-plan.md`, `docs/portrait-shelf-plan.md` - superseded route proposals, preserved-capability lists
- `docs/locker-consistency-pass.md`, `docs/ui-thoughtfulness-and-adjustability-plan.md` - Lane 9/10 (undo, blockers, vocabulary) requirements this phase closes
- `docs/ui-conventions.md` - house rules for tokens/components/i18n
- `.planning/phases/05-one-inventory-one-journey/05-UI-SPEC.md` - approved design contract, independently re-verified this session (one line-citation error and one namespace error found and corrected above)
- `.planning/phases/04-locker-and-foundry-as-one-object/04-CONTEXT.md` - confirms Locker portrait-family work was deliberately deferred to this phase

### Tertiary (LOW confidence)

- None used without cross-reading source.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new libraries, all primitives verified present with exact file/line citations
- Architecture: HIGH for the seven open work items (all traced to exact, currently-existing code); MEDIUM for the alias-sweep root cause specifically, since it depends on a live-catalog cross-check (Legs B/C) not run in this research session
- Pitfalls: HIGH - all five are independently re-derived from reading source, not carried from the UI-SPEC uncritically (two of them are corrections *to* the UI-SPEC)

**Research date:** 2026-08-08
**Valid until:** Re-verify against the working tree before planning if more than 14 days elapse or if Phase 4 execution (which this phase depends on) lands additional changes to `Locker.tsx`, `HeroCardPicker.tsx`, or `heroIdentity.ts` in the meantime.
