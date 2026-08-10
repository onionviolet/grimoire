# Phase 5 - UI Review

**Audited:** 2026-08-10
**Baseline:** 05-UI-SPEC.md (approved 2026-08-08)
**Screenshots:** not captured (code-only audit; the phase's render tests cover the four-state portrait surface and the undo wiring)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 2/4 | Four deviations from the approved copy contract (section label, filtered-zero block, unresolved hint, catalog-failed state); all i18n-keyed and self-consistent |
| 2. Visuals | 4/4 | Tri-state selector equal to the two it extends; captions subordinate; neutral unresolved tag |
| 3. Color | 4/4 | Accent reserved to selected segment, undo action, focus rings; failed state uses the error EmptyState treatment |
| 4. Typography | 4/4 | Declared 4 sizes / 2 weights held |
| 5. Spacing | 4/4 | 8-point scale with documented legacy exceptions |
| 6. Experience Design | 4/4 | Five portrait states distinct; hidden-empty + filtered-zero reset; one-shot undo with supersession; blocker lines; derived pak labels with loading/unknown states |

**Overall: 22/24**

---

## Top 3 Priority Fixes

1. **Catalog-failed copy not implemented as declared** - the contract declared a dedicated `foundry.portraits.catalogFailed` state ("Portrait catalog could not be read"); the implementation uses the generic `foundry.error.title` ("Couldn't read the catalog"). The distinctness requirement (failed != not indexed) is met, but the declared copy is missing. FIXED in Phase 7: keys added and wired into the failed branch.
2. **Filtered-zero reset copy drift** - declared "No results for {{filter}}." / "Nothing in this view matches the current filter." / "Clear filter"; implemented "No {{filter}} content installed" / "Empty categories are hidden, and nothing in this section has content." / "Show all content". FIXED in Phase 7: aligned to the contract.
3. **Section selector accessible label drift** - declared "Global inventory view"; implemented "Global Locker section". FIXED in Phase 7.

---

## Detailed Findings

### Pillar 1: Copywriting (2/4)

The declared vocabulary lock holds for the seven already-matching terms, and the scope captions ("This hero" / "All forged portraits") are verbatim at the correct call sites. The `All content` segment, membership caveat, and undo-toast copy are verbatim. Four contract deviations were found:

- `locker.global.sectionLabel` = "Global Locker section" vs declared "Global inventory view" (FIXED)
- `locker.global.filteredZeroTitle/Body/Reset` differ from the declared reset-state copy (FIXED)
- `portrait.family.unresolvedHint` = "Grimoire could not match these to a known hero. Their raw names are shown exactly as they appear in your game files." vs declared singular "Grimoire could not match this to a known hero. The raw name is kept below." - the implemented plural form is more correct for a group that can contain several unresolved names (the hint renders once per unresolved group); recorded as an accepted variance, no change.
- `foundry.portraits.catalogFailed` keys absent; the failed catalog read uses the generic `foundry.error.title` (FIXED with dedicated keys).

### Pillar 2: Visuals (4/4)

The tri-state selector reads as one control (three segments of equal weight, `All content` first and default). Rail rows for empty categories are hidden; the filtered-zero reset block is small, muted chrome. The unresolved tag is a neutral `Tag`; scope captions are `text-[11px] text-text-secondary`. The undo toast reuses the standard toast shape.

### Pillar 3: Color (4/4)

Accent appears only on the selected segment, the undo action button, and focus rings. The unresolved tag is neutral; the reset banner uses the warning-tone icon pattern; the failed portrait state uses the error `EmptyState` treatment (`state-danger`). No raw hex in the touched surfaces.

### Pillar 4: Typography (4/4)

All new text sits on the declared rows: Compact (`text-[11px]`) for scope captions and the compact link, Label (`text-xs`) for the unresolved tag, Body (`text-sm`) for the reset banner and toast. The `All content` segment inherits the existing segment size. No fifth size or third weight.

### Pillar 5: Spacing (4/4)

Selector segments `gap-2`; caption-to-toggle `gap-2`; reset banner `p-4`; Tag `py-0.5` legacy exception reused verbatim. All on the declared scale.

### Pillar 6: Experience Design (4/4)

The five portrait states are distinct in code and copy: loading (`foundry.loading`), not indexed (`foundry.portraits.notIndexed`), catalog failed (now dedicated copy, FIXED), no assets (Locker `noneTitle`/`noneBody` with retry), and filtered-to-zero (reset block). The Locker family surface distinguishes loading/failed/none/populated under render coverage. Bulk undo is one-shot with supersession, a partial-failure toast with counts, and rendered blocker lines (CR-01 fixed in the prior commit with hook-level regression coverage). Derived pak names lead with "Writes {{entryList}}", keep the raw name as a secondary line, and label unreadable/empty paks "Unknown content".

Remaining human-verification backstops (recorded, not code defects): longest-locale wrap checks for the new captions, and the in-app retry flow against a real catalog read.

---

**Registry audit:** shadcn not initialized; no third-party registries; not applicable.

_Audited: 2026-08-10 (Phase 7 UI review, first UI-REVIEW ever produced for this phase)_
