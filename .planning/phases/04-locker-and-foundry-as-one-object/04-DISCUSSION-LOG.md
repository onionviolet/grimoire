# Phase 4: Locker And Foundry As One Object - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md; this log preserves the alternatives considered.

**Date:** 2026-08-08
**Phase:** 4-Locker And Foundry As One Object
**Areas discussed:** Shared frame and model as stage, Foundry tray preview, Locker pre-write disclosure, Foundry image sourcing, Foundry hero grid state

---

## Shared frame and model as stage

| Option | Description | Selected |
|--------|-------------|----------|
| Shared image frame only | Keep the delivered backdrop, glass, and rail composition as the final state | |
| Model replaces the frame | Rebuild the page around a full model stage | |
| Composable frame with replaceable stage | Keep shared chrome while allowing model or image stage modes | Yes |

**User's choice:** The user authorized the agent to choose the most useful comprehensive option and preserve future user choice where reasonable.
**Notes:** The composable option satisfies both contested intents without duplicating page chrome. Locker defaults to the model when available; Foundry preview remains opt-in and lazy.

## Foundry tray preview

| Option | Description | Selected |
|--------|-------------|----------|
| Latest edit only | Fast but does not show the forged result | |
| Whole reviewed tray | Preview the complete staged result over enabled skins | Yes |
| Install a temporary mod | Reuse installed-mod resolution at the cost of mutating game state | |

**User's choice:** Agent-selected comprehensive safe default.
**Notes:** Temporary path sources preserve installed state. Builds are debounced, supersedable, and cleaned up.

## Locker pre-write disclosure

| Option | Description | Selected |
|--------|-------------|----------|
| Always modal | Require confirmation for every write | |
| Inline disclosure | Keep fast actions fast and show exact consequences beside them | Yes |
| Move writes into tray | Defer Locker actions to Foundry review | |

**User's choice:** Agent-selected least disruptive option.
**Notes:** Destructive ambiguity may still use confirmation. Locker remains immediate-apply.

## Foundry image sourcing

| Option | Description | Selected |
|--------|-------------|----------|
| File input only | Preserve current behavior | |
| Mod images only | Reuse images found in the selected mod | |
| File, mod, and recent sources | One intake surface with all useful sources | Yes |

**User's choice:** Agent-selected comprehensive option.
**Notes:** Intake is shared where useful, but Foundry and Locker authoring components remain separate.

## Foundry hero grid state

| Option | Description | Selected |
|--------|-------------|----------|
| Foundry-local state | Add separate favorites and counts | |
| Shared Locker state | Reuse the same favorites and My Changes data | Yes |

**User's choice:** Agent-selected single-source-of-truth option.
**Notes:** Zero, loading, and unavailable counts remain distinct.

## the agent's Discretion

- Debounce timing and compact status presentation.
- Image-source layout within the existing portrait editor.
- Smallest reusable stage-controller boundary.

## Deferred Ideas

- Locker portrait-family awareness moves to Phase 5.
- Direct model ability, particle, and sound interaction remains outside Phase 4.
