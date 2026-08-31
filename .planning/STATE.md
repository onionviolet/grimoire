---
gsd_state_version: 1.0
milestone: v1.27.5
milestone_name: Chat Wheel parity
current_phase: 9
current_phase_name: The Base Command Catalogue
status: in-progress
stopped_at: Wave 1 (09-01, 09-02) executed; wave 2 (09-03) not started
last_updated: "2026-08-31T00:00:00.000Z"
last_activity: "2026-08-31: wave 1 executed (09-01 catalogue + override model, 09-02 chat-wheel read/starter tests)"
progress:
  total_phases: 1
  completed_phases: 0
  total_plans: 3
  completed_plans: 2
last_activity_desc: Wave 1 executed. 09-01 vendored the 53-entry catalogue and taught the form model both override maps with byte-preserving in-place edits (plus the custom_menus end-scan fix); 09-02 closed the chat-wheel read/starter audit gap with 7 new stubbed tests and added a populated-override case to the real-binary round-trip suite, which cannot run on macOS (Windows-only converter)
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-11)

**Core value:** A Deadlock player can change their game and always know exactly what changed, who owns it, and how to undo it.
**Current focus:** Milestone v1.27.5 "Chat Wheel parity"

## Current Position

Phase: 9 (The Base Command Catalogue)
Plan: wave 1 (09-01, 09-02) complete; wave 2 (09-03, the catalogue UI) is next
Status: Catalogue data and the byte-preserving override model exist and are tested; the two audit-flagged read paths are covered. One carried item: the new real-binary round-trip case in 09-02 skips on macOS and still needs a Windows run.
Last activity: 2026-08-31: wave 1 executed

## Blockers

(none)

## Session

**Last session:** 2026-08-31
**Stopped at:** Wave 1 executed and summarized; next step is plan 09-03 (the catalogue UI)
**Resume file:** .planning/phases/09-the-base-command-catalogue/09-03-PLAN.md
