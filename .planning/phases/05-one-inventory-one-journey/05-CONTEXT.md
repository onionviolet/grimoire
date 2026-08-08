# Phase 5: One Inventory, One Journey - Context

**Gathered:** 2026-08-08
**Status:** Ready for planning after Phase 4

<domain>
## Phase Boundary

Phase 5 gives installed global content one coherent home, defines one portrait journey across Locker and Foundry, makes Locker portrait families variant-aware, fixes portrait alias and empty-state failures, and applies a consistency floor for undo, disabled-action explanations, and vocabulary.

Phase 4 is a planning and implementation dependency, not a discussion dependency. Research must inspect the post-Phase-4 shared frame, Foundry image intake, and hero-grid state before producing file-level tasks.

</domain>

<decisions>
## Implementation Decisions

### One global inventory

- **D-01:** The Locker Global drill-in is the canonical home for installed global content. It uses one shared inventory shell with `All content`, `Visuals`, and `Sounds` views. The dedicated Sound Locker route does not return as a second home for global inventory.
- **D-02:** Preserve the useful work from the Sound Locker variant inside the shared shell: exact-path ownership, runtime winner, provenance, audition, enable or disable, conflict disclosure, and links to the matching Foundry authoring tool. Existing legacy sound URLs continue to resolve into the canonical shell or the relevant hero's Sounds section.
- **D-03:** Hero-specific installed sounds remain under each Locker hero because that is the user's management context. Global sounds remain under Global. Foundry remains the authoring context. This is one inventory model with contextual views, not one giant route.
- **D-04:** Counts use unique installed mods in the active scope. Section counts may overlap and must be labeled as section membership, never presented as values that should sum to the header. Empty categories are hidden by default; if a filter produces no results, the state names the active filter and offers the nearest useful reset.
- **D-05:** `All content` is the default unless a deep link identifies a narrower view. Visual and sound categories never mix in their specialized rails, while `All content` may group both using the same underlying entries.

### One portrait journey

- **D-06:** The journey is: create or edit in Foundry, manage installed portrait families in Locker Cards, and inspect cross-hero forged pools in Foundry My Changes. Each surface states that role and links directly to the next relevant step.
- **D-07:** `HeroCardPicker` is the canonical per-hero management home. It shows a portrait family as one item with its variants, coverage, active source, ownership, and shuffle participation. Do not add a separate portraits route.
- **D-08:** Keep both delivered randomization views because they answer different questions: Locker Cards is the per-hero control, while Foundry My Changes is the cross-hero overview. Both read and write one shared pool identity and state. Labels explicitly distinguish `This hero` from `All forged portraits`, so two synchronized controls do not look like unrelated mechanisms.
- **D-09:** Foundry and Locker remain separate implementations behind shared family and ownership models. Do not merge authoring and installed-management components. Deep links carry hero and family identity so the user never has to find the same portrait twice.

### Portrait families, aliases, and failures

- **D-10:** Locker groups portrait entries through `portraitInventory.ts` and `HeroPortraitFamilies.tsx`; variant tokens order and label members, but exact normalized entry paths decide ownership. Partial family coverage is visible and actionable, not silently flattened into one card.
- **D-11:** Alias resolution is centralized and applied before inventory grouping, route matching, Foundry catalog filtering, and family lookup. Display names and codenames are presentation and lookup aliases, never ownership keys.
- **D-12:** Unresolved codenames remain visible under an explicit internal or unresolved label with their raw token. They are not dropped or silently attached to the currently selected hero.
- **D-13:** Portrait empty states distinguish `not indexed`, `loading`, `failed`, `no assets for this hero`, and `filtered to zero`. Each state has one next action appropriate to the cause. Loading never flashes as a true empty result.

### Undo and blocked actions

- **D-14:** Every bulk mutation in this phase captures an operation snapshot and offers a local `Undo` action after success. Undo restores both the affected data and the user's selection where it is still meaningful. It does not create a permanent history system.
- **D-15:** A newer mutation supersedes the previous undo offer for the same surface. While an operation or its undo is running, conflicting controls are disabled and name that reason. Partial failure reports what changed and keeps a recovery action visible.
- **D-16:** Disabled controls must expose the blocker beside the control or through an accessible description. A tooltip may supplement this but cannot be the only explanation. Prefer a corrective action such as reset filter, finish indexing, select a source, or inspect the unreadable mod.

### Vocabulary and empty-state contract

- **D-17:** Fix the English catalog vocabulary first, then update call sites to shared keys. The same concepts use the same names across Locker and Foundry: `Installed`, `My changes`, `Global`, `Visuals`, `Sounds`, `Portrait family`, `Variant`, `Enabled`, and `Active source`.
- **D-18:** Every empty state follows a three-part contract: what is missing, why this view is empty, and the next action. Do not use generic `Nothing here` text or imply a failure when indexing is still in progress.
- **D-19:** Imported paks without useful names use a derived description from exact paths when possible and retain the raw pak name as secondary identity. Unknown data is labeled unknown rather than guessed.

### the agent's Discretion

- Exact shared-shell layout and whether the `All content`, `Visuals`, and `Sounds` selector is rendered as tabs or a segmented control, provided it follows the repository's existing accessible tab contract.
- Exact duration and placement of local undo affordances.
- Exact family-card density and variant-chip presentation.
- Exact wording of blocker and empty-state copy, within the vocabulary contract above.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and contested variants

- `.planning/ROADMAP.md` section "Phase 5: One Inventory, One Journey" - goal, dependency, success criteria, and both open-decision records.
- `.planning/REQUIREMENTS.md` section "Inventory and journey coherence" - active requirement variants, alias sweep, and consistency floor.
- `.planning/INGEST-CONFLICTS.md` warnings for installed global sound inventory and portrait or Cards journey - equal-precedence conflicts and sequencing options.
- `docs/sound-locker-plan.md` - useful sound inventory behavior, exact-path ownership, audition, provenance, and cross-link requirements. Its dedicated global route is superseded by D-01.
- `docs/global-locker-foundry-ux-plan.md` - one-inventory diagnosis, shared-shell gate, portrait journey gate, verified layout defects, and taxonomy history.
- `docs/portrait-shelf-plan.md` - delivered Cards ownership, family handling, and both randomization views.

### Consistency and prior phase contracts

- `docs/locker-consistency-pass.md` - undo, blocker, empty-state, and shared-control consistency requirements.
- `docs/ui-thoughtfulness-and-adjustability-plan.md` - consequence visibility, adjustability, and recovery expectations.
- `.planning/phases/04-locker-and-foundry-as-one-object/04-CONTEXT.md` - shared stage, image sourcing, and single-source hero-state decisions this phase consumes after Phase 4.
- `docs/ui-conventions.md` - accessible tab, token, shared-component, focus, and i18n rules.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `src/lib/soundInventory.ts`: existing one-entry-per-mod-and-hero inventory model, including untagged third-party content.
- `src/components/locker/GlobalSoundShelf.tsx` and the Locker Global drill-in: delivered canonical-shell starting point.
- `src/components/locker/SoundEntryRow.tsx`: exact write-set, winner, audition, and enabled-state presentation.
- `src/lib/portraitInventory.ts`: shared portrait inventory and family grouping input.
- `src/components/locker/HeroCardPicker.tsx` and `HeroPortraitFamilies.tsx`: delivered Cards ownership and family UI.
- `src/components/foundry/MyChanges.tsx`: cross-hero forged-pool overview using `foundryShuffleIncluded`.
- Existing shared empty-state, confirm, preference, and scroll-restoration components from the UI consistency lanes.

### Established Patterns

- Exact normalized VPK paths determine ownership. Names, categories, and variant tokens are labels only.
- Installed and Locker remain the authority for enabled state; Foundry authors and links back rather than silently mutating inventory.
- Route compatibility is preserved through redirects and query-based deep links.
- Pure inventory and alias helpers are tested separately from renderer components.

### Integration Points

- Locker Global currently has Visual and Sound-shaped views whose category and header counts disagree; both must consume one inventory projection.
- `cardShuffleIncluded` and `foundryShuffleIncluded` currently expose two portrait-randomization perspectives and need one explicit identity and synchronization contract.
- `HeroCardPicker.tsx`, `HeroPortraitFamilies.tsx`, and `portraitInventory.ts` form the isolated Phase 5 portrait-variant lane moved out of Phase 4.
- `src/locales/en/translation.json` is the first vocabulary change point before component copy is normalized.

</code_context>

<specifics>
## Specific Ideas

- Preserve useful capabilities from both contested variants, but never preserve two homes or two sources of truth. Multiple views are acceptable when each has a distinct stated scope and shares the same underlying identity.
- Keep decisions reversible at the presentation layer through filters, deep links, and synchronized views. Do not make published data or route contracts one-way when redirects can preserve them.

</specifics>

<deferred>
## Deferred Ideas

- A separate top-level Sound Locker route is not planned. Reconsider only if the shared Global and hero Sounds surfaces cannot expose a concrete required workflow without duplication.
- A permanent multi-step operation history is outside this phase. The requirement is safe recovery from bulk actions, satisfied by local operation snapshots and undo.
- Empirical in-game verification of `minimap` and `small` portrait labels remains governed by its existing verification requirement and is not inferred from token names here.

</deferred>

---

*Phase: 5-One Inventory, One Journey*
*Context gathered: 2026-08-08*
