# VPK composition roadmap

## Goal

Evolve Grimoire's existing reversible VPK merge feature into a safe mod-composition
workflow: users can understand collisions before writing, choose intended content,
and later reproduce or update a composition.

This roadmap is deliberately additive. Existing `merge-mods`, `unmerge-mod`,
`extract-merge-source`, and `add-merge-sources` IPC calls, existing merge metadata,
and existing embedded `vpk-modinfo` records remain valid. Old app versions simply
ignore every new optional field/API; new app versions must treat absent fields as
the current default behaviour (all source entries, priority-derived winner, and
non-strict merge).

## Safety invariants

1. Analysis is read-only: it scans VPK trees and never reserves slots, writes
   metadata, changes `gameinfo.gi`, or moves a source.
2. A failed build never replaces a live merged VPK or disables a source.
3. Existing, recipe-less merges remain editable, unmergeable, extractable, and
   rebuildable using their recorded source order.
4. Any new recipe is optional and versioned. Unknown recipe versions are displayed
   as unsupported, never interpreted loosely.
5. A client must feature-detect a newer API; it must not assume an older backend
   supports analysis or path rules.

## Milestones

### 1. Read-only merge analysis (complete)

Add an additive `analyze-merge` IPC endpoint. It reports source order, parsed
entry counts, total input size, collision paths, and which source wins under the
same priority ordering used by the current merge. It must distinguish unreadable
VPKs from an empty VPK and omit inert imprint metadata from collision totals.

No existing merge invocation changes in this milestone. The `analyze-merge`
endpoint and its focused service tests now exist; renderer review integration
remains the next user-visible step.

### 2. Review UI and ordering

Show analysis before confirmation, including grouped collisions and the effective
winner. Let users change source ordering in the *new* composition workflow, while
the legacy merge path retains its current Deadlock-priority order. Strict mode
continues to mean "abort on any collision."

### 3. Recipe schema and rebuilds

Introduce an optional, versioned merge recipe storing source identities, order,
and policy. Persist it alongside existing `MergedModInfo` and embed it only after
the base schema has an explicitly compatible optional location. Missing recipe =
legacy default policy.

### 4. Prefix/path policy

Support include, exclude, and winner rules over normalized VPK paths/prefixes.
Compile policy into a deterministic `vpkmerge` split/repack plan, build to a temp
file, validate the complete tree, embed provenance, then atomically replace.

### 5. Composition UX

Add editable merged contents, content presets (model, VFX, sounds, UI), rebuild
diffs, and source-update review. Recipe export/import extends portable profiles
only through optional fields so old profile readers continue to consume the
ordinary source entries.

## Compatibility matrix

| Artifact | Older Grimoire | New Grimoire |
| --- | --- | --- |
| Existing merge metadata | Works unchanged | Uses default policy when recipe is absent |
| New analysis IPC | Not called | Optional enhancement; no persisted state |
| Future recipe fields | Ignored | Validated by schema version |
| Existing profile/share code | Works unchanged | Imports as a default-policy merge |
| Future recipe-aware profile | Imports ordinary source entries | Can restore the recipe when supported |

## Verification

Unit tests cover path normalization, category grouping, priority winner selection,
metadata exclusion, duplicate source detection, unreadable VPK reporting, and
stable result ordering. Service tests cover that analysis performs no writes.
Future rebuild tests must prove transaction rollback and legacy merge reconstruction.
