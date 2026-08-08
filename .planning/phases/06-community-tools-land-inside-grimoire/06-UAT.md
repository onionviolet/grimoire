---
status: testing
phase: 06-community-tools-land-inside-grimoire
source: [06-VERIFICATION.md]
started: 2026-08-08T01:15:00Z
updated: 2026-08-08T01:15:00Z
---

## Current Test

number: 1
name: Live Pimp My Hideout Build VPK round trip
expected: |
  Clicking Pimp My Hideout in the Browser page's Tools group, building something on
  the real hosted tool, and clicking its Build VPK button produces a confirm dialog
  titled "Add this download to your mod library?" naming the captured file within a
  few seconds. Choosing "Add to library" lands the mod on the Installed page as an
  ordinary third-party mod, with no Foundry tray/My changes entry and nothing written
  to the OS Downloads folder. Walking away from /browser before the build finishes
  still surfaces the dialog wherever you land.
awaiting: user response

## Tests

### 1. Live Pimp My Hideout Build VPK round trip
expected: A confirm dialog titled "Add this download to your mod library?" appears within a few seconds of clicking Build VPK, naming the file; choosing "Add to library" lands the mod on the Installed page as an ordinary third-party mod with no Foundry tray/My changes entry; nothing appears in the OS Downloads folder; walking away from /browser before the build finishes still surfaces the dialog wherever you land.
result: [pending]

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
