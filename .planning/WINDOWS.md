---
schema_version: 1
open_count: 3
waived_count: 0
fixed_count: 0
total_count: 3
last_updated: 2026-08-31T00:00:00.000Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 3 | unrun-verify | src/components/foundry/recolorStagedEdit.ts |  | In-app UAT not run: Foundry Recolor Stage button producing a tray row with non-zero affected files and installing nothing (needs Deadlock install) | open |  | 2026-08-09T05:42:51.916Z |  |
| 2 | 04 | unrun-verify | src/components/common/HeroDetailFrame.tsx |  | In-game visual verification of the 3D model as the hero stage (Locker + Foundry), the veil-over-canvas reading, and the stale pill behavior was auto-approved under auto mode and remains for end-of-milestone UAT | open |  | 2026-08-09T06:59:08.794Z |  |
| 3 | 09 | unrun-verify | electron/main/services/chatWheel.roundtrip.test.ts |  | The populated-override real-binary round-trip case added in 09-02 skips on macOS (the bundled ChatLane converter is Windows-only), so byte-for-byte preservation of unknown root keys and unknown command IDs is proven by the model unit tests but not yet by the real converter | open |  | 2026-08-31T00:00:00.000Z |  |

````json
[
  {
    "id": 1,
    "kind": "unrun-verify",
    "phase": "3",
    "file": "src/components/foundry/recolorStagedEdit.ts",
    "line": null,
    "description": "In-app UAT not run: Foundry Recolor Stage button producing a tray row with non-zero affected files and installing nothing (needs Deadlock install)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-09T05:42:51.916Z",
    "resolved_at": null
  },
  {
    "id": 2,
    "kind": "unrun-verify",
    "phase": "04",
    "file": "src/components/common/HeroDetailFrame.tsx",
    "line": null,
    "description": "In-game visual verification of the 3D model as the hero stage (Locker + Foundry), the veil-over-canvas reading, and the stale pill behavior was auto-approved under auto mode and remains for end-of-milestone UAT",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-09T06:59:08.794Z",
    "resolved_at": null
  },
  {
    "id": 3,
    "kind": "unrun-verify",
    "phase": "09",
    "file": "electron/main/services/chatWheel.roundtrip.test.ts",
    "line": null,
    "description": "The populated-override real-binary round-trip case added in 09-02 skips on macOS (the bundled ChatLane converter is Windows-only), so byte-for-byte preservation of unknown root keys and unknown command IDs is proven by the model unit tests but not yet by the real converter",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-31T00:00:00.000Z",
    "resolved_at": null
  }
]
````
