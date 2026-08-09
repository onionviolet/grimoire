---
schema_version: 1
open_count: 1
waived_count: 0
fixed_count: 0
total_count: 1
last_updated: 2026-08-09T05:42:51.916Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 3 | unrun-verify | src/components/foundry/recolorStagedEdit.ts |  | In-app UAT not run: Foundry Recolor Stage button producing a tray row with non-zero affected files and installing nothing (needs Deadlock install) | open |  | 2026-08-09T05:42:51.916Z |  |

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
  }
]
````
