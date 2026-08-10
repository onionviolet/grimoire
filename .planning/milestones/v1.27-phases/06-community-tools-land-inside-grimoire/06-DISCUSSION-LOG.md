# Phase 6: Community Tools Land Inside Grimoire - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-07
**Phase:** 6-Community Tools Land Inside Grimoire
**Areas discussed:** File destination (install vs Foundry), Catalog shape and entry review, Pre-write disclosure and refusal, Capture trust boundary

---

## Area selection

User was offered 4 phase-specific gray areas and selected all 4, plus added freeform guidance: "Decide what is most optimal/requires least work while being most comprehensive for each and then automode, dont forget upstream might work on things too."

This was treated as an explicit request to switch from the default interactive (4-questions-per-area) flow to auto-select behavior for the remainder of this discussion: Claude chose the recommended option for each area without further AskUserQuestion turns, logging the reasoning inline in CONTEXT.md, and weighting "least work" using the fork/upstream cost model in `docs/upstream-boundary-map.md` (prefer fork-only files over shared-and-modified files) rather than raw line count.

---

## File destination: install vs Foundry

| Option | Description | Selected |
|--------|-------------|----------|
| Existing install path (third-party mod) | Reuse `importCustomModSource` / `resolveInstallableVpk`, same as drag-drop and custom import | ✓ |
| Foundry's reviewed write set | Model as a `FoundryForgeEdit`, entering the combined build tray | |

**Selected:** Existing install path.
**Notes:** Foundry's edit model requires an `entryPath` and `precedence` for collision review, which a foreign already-built VPK does not have. Widening `FoundryForgeEdit` to accept an opaque blob would touch the shared `types/foundry.ts` union and `foundryForge.ts`'s collision logic for a case that model isn't shaped for, whereas the install path already handles "a bare local VPK file" today.

---

## Catalog shape and entry review

| Option | Description | Selected |
|--------|-------------|----------|
| Add a `kind` field, keyed handoff logic off it | mod-host / reference / tool / community-feed | ✓ |
| Keep URL-based matching, add Pimp My Hideout as a one-off special case | Cheaper short-term, doesn't satisfy the requirement's stated intent | |

**Selected:** `kind` field, four values, `nsfw` unchanged.
**Notes:** Default `kind` assignments were proposed for all 10 entries (9 existing + Pimp My Hideout) as a recommendation, not a verified fact — the actual "load each once, keep/correct/remove" pass (including the `deadlocked.wiki`/`deadlock.wiki` domain question the requirement itself flags) is left as execution work. Adding a crosshair-generator entry was considered and declined: Grimoire ships its own Crosshair Designer, and the requirement frames a duplicate answer as a UX cost.

---

## Pre-write disclosure and refusal

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse `useConfirm` | Shared confirm hook already standardized by the UI-consistency pass | ✓ |
| New bespoke modal | More visual control, more code, inconsistent with existing pattern | |

**Selected:** `useConfirm`.
**Notes:** Disclosure names the detected kind and the fixed destination, no manual save-path choice offered. Refusal for a non-VPK file uses `checkVpkFile`'s existing rejection-message voice, with no retry mechanism (the source page's own button can be clicked again).

---

## Capture trust boundary

| Option | Description | Selected |
|--------|-------------|----------|
| Capture downloads only from catalog `kind: 'tool'` destinations | Narrow, catalog-gated exception | ✓ |
| Capture downloads from any page in the browser | Wider surface, no vetting per site | |

**Selected:** Catalog-gated (`kind === 'tool'` only).
**Notes:** Mirrors the existing blanket-deny permission floor in `browserContentFilter.ts` — the new exception is pre-decided by a catalog entry, not granted at runtime by page content. The proposed mechanism (Chromium's `DownloadItem.setSavePath()` writing bytes without the guest needing preload/Node) was flagged explicitly as a research item for the planner to verify, not an assumed fact.

---

## Claude's Discretion

- Exact IPC channel/event shape for the main-to-renderer disclosure round trip.
- Whether the extended catalog stays inline in `Browser.tsx` or moves to its own fork-only module.
- Disclosure/refusal copy wording (all i18n keys).

## Deferred Ideas

- A crosshair-generator catalog entry (declined, not deferred to a later phase — see D-06 in CONTEXT.md).
- A general download manager or per-download destination picker (out of scope by design, see D-09).
