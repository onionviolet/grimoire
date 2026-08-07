---
status: complete
phase: 02-a-supported-fork-release
source: [02-VERIFICATION.md]
started: 2026-08-07T17:18:07.185Z
updated: 2026-08-07T17:18:07.185Z
---

## Current Test

[testing complete]

## Tests

### 1. IG-23: packaged in-game colour check
expected: |
  Produce a packaged Windows build via .github/workflows/release.yml, install it,
  open Settings and read the engine version, replace a normal item icon and a
  DXT5-YCoCg item icon through Foundry, launch Deadlock, and confirm both icons
  render with correct colours and Settings reports a 798f3a7-suffixed engine version.
result: blocked
blocked_by: release-build
reason: "No packaged Windows build against a live Deadlock session was available during phase execution. The repository owner confirmed this verdict directly at plan 02-02's blocking checkpoint (recorded in 02-02-SUMMARY.md: 'the user confirmed blocked stands') and reaffirmed the same decision when routing phase completion after verification re-surfaced it as an open runtime fact. No CDP-driven script can assert what the Source 2 engine renders in a live session. docs/ingame-verification-record.md row IG-23 carries this same blocked verdict with a stated reason, matching Phase 1's precedent for accepted-outstanding engine-tier rows (D-26)."

## Summary

total: 1
passed: 0
issues: 0
pending: 0
skipped: 0
blocked: 1

## Gaps

[none]
