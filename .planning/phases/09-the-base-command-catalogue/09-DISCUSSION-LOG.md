# Phase 9: The Base Command Catalogue - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-11
**Phase:** 9-The Base Command Catalogue
**Areas discussed:** Catalogue identity & labels, Category surface, Toggle semantics, UI shape

---

## Overview

The four proposed gray areas were presented to the user via a multi-select
question. The user selected **all four** and responded with a delegation
mandate rather than individual picks:

> "for everything, just pick the considerations that are most useful/comprehensive/if conflicting potentially implement all of them and let the user choose in the future, keep going without human stoppage if its reasonable and wont cause lasting harm, or lower quality, the idea is for UI and other important stuff to be planned by a more capable model before hand"

**User's choice:** Full delegation of all four areas to the builder, with the
instruction to prefer comprehensive options, implement conflicting options
together where feasible, and let the user choose later.

**Notes:** This also means the user wants autonomous continuation (discuss →
plan → execute) without per-step stops, gated only by "reasonable and won't
cause lasting harm or lower quality".

---

## Catalogue Identity & Labels

| Option | Description | Selected |
|--------|-------------|----------|
| Raw English display strings | YAML keys are the display strings (verified against `voice_commands_db.gd` + `example.yml`); UI shows exactly what the game shows, honest WYSIWYG | ✓ (D-01, D-02) |
| Localized labels | ChatLane's `vc-item-*` i18n keys, which the game itself never displays | |

**User's choice:** Delegated. Builder picked raw display strings: the wire
format has no separate ID, so keying on display strings is the only way to
round-trip byte-for-byte. ChatLane's label keys are kept for provenance only.

---

## Category Surface

| Option | Description | Selected |
|--------|-------------|----------|
| Show all three categories | default / hidden / broken, with honest copy that availability is a game capability, not a guaranteed outcome | ✓ (D-03) |
| Hide `broken` behind a disclosure | Post-game all-chat set hidden until revealed | |

**User's choice:** Delegated. Builder picked the comprehensive option: all
three categories with filter chips, honest caveat copy on `broken`.

---

## Toggle Semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Three-state (inherit / on / off) | Absent = inherit default, `true` = force on, `false` = force off; matches what the YAML format and ChatLane's loader accept | ✓ (D-04, D-05) |
| Two-state (only write true) | Simpler but cannot express force-off for a default-true command | |

**User's choice:** Delegated. Builder picked three-state: the format accepts
booleans (`config.gd` validates bool values), so explicit false is legal and
must be representable. Resolves the conflict between force-off and inherit on
default-true commands without precluding any user choice.

---

## UI Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Per the authored plan | Search + category filters + compact count + two controls per row + "Other commands in this file" group, collapsible section beneath "Menus and commands" | ✓ (D-06, D-07) |
| Changed layout | Any deviation the user wanted | |

**User's choice:** Delegated. Builder kept the authored plan's shape (it is
already thorough), added the keyboard-accessibility floor, and refused to bloat
the starter template with no-op entries.

---

## Claude's Discretion

All four areas were delegated wholesale. The three-state toggle model is the
single resolution point for the force-off vs inherit conflict. Exit criteria
anchor to the authored option-catalog plan.

## Deferred Ideas

- Known-limitations disclosures, arrow-key ring nav, drag-and-drop (Phase 10)
- Unbind-before-delete warning, game-asset wheel dressing (Phase 11)
- In-game slot-order verification row (explicitly not selected by the user)
