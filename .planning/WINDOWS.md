---
schema_version: 1
open_count: 0
waived_count: 4
fixed_count: 2
total_count: 6
last_updated: 2026-09-05T00:00:00.000Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

**2026-09-01.** Ledger clear: entries 1-3 (all `unrun-verify`) waived, because
verification debt is deferred by decision and gates nothing; entries 4 and 5
fixed in Phase 9.1. Neither was new breakage: both were already failing, hidden
inside the "26 failing tests" figure that Phase 9 exited against.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 3 | unrun-verify | src/components/foundry/recolorStagedEdit.ts |  | In-app UAT not run: Foundry Recolor Stage button producing a tray row with non-zero affected files and installing nothing (needs Deadlock install) | waived | deferred by decision 2026-09-01: each needs a real Deadlock install or a Windows machine, none gates a release, and the app-tier verification record is already green and strict (42 rows, 0 blank) | 2026-08-09T05:42:51.916Z | 2026-09-01T00:00:00.000Z |
| 2 | 04 | unrun-verify | src/components/common/HeroDetailFrame.tsx |  | In-game visual verification of the 3D model as the hero stage (Locker + Foundry), the veil-over-canvas reading, and the stale pill behavior was auto-approved under auto mode and remains for end-of-milestone UAT | waived | deferred by decision 2026-09-01: each needs a real Deadlock install or a Windows machine, none gates a release, and the app-tier verification record is already green and strict (42 rows, 0 blank) | 2026-08-09T06:59:08.794Z | 2026-09-01T00:00:00.000Z |
| 3 | 09 | unrun-verify | electron/main/services/chatWheel.roundtrip.test.ts |  | The populated-override real-binary round-trip case added in 09-02 skips on macOS (the bundled ChatLane converter is Windows-only), so byte-for-byte preservation of unknown root keys and unknown command IDs is proven by the model unit tests but not yet by the real converter | waived | deferred by decision 2026-09-01: each needs a real Deadlock install or a Windows machine, none gates a release, and the app-tier verification record is already green and strict (42 rows, 0 blank) | 2026-08-31T00:00:00.000Z | 2026-09-01T00:00:00.000Z |
| 4 | 9.1 | failing-test | electron/main/services/browserDownloadCapture.test.ts | 553 | sweepToolDownloadTempRoot (WR-05) 'a symlink entry in the root is skipped and never followed' expects 1 deletion and gets 2. Genuinely red on main since v1.27.1, not absorbed debt; it was hiding inside the quoted 26-failure baseline. | fixed | Fixed: the symlink target lived inside the swept root, where a regular file is orphaned by construction, so the sweep was right to delete 2. Target moved outside the root, which is what "never followed" actually requires. | 2026-09-01T00:00:00.000Z | 2026-09-01T00:00:00.000Z |
| 5 | 9.1 | toolchain | vitest.config.ts |  | Node 26 ships a native localStorage global that is unavailable without --localstorage-file and shadows jsdom's, so all 25 storage-touching tests (uiPrefs 19, heroStageMode 6) fail locally and pass on CI's Node 20. The repository declares no supported Node (no engines field, no .nvmrc), so the split is invisible until someone reads a failure count. | fixed | Fixed by vitest.setup.ts: localStorage is repaired from the unshadowed sessionStorage instance and Storage is republished from that instance so Storage.prototype spies still reach it. .nvmrc and engines.node declare Node 20. Guarded by src/lib/domStorage.test.ts. | 2026-09-01T00:00:00.000Z | 2026-09-01T00:00:00.000Z |
| 6 | 11 | failing-test | electron/main/services/forgeBridge.test.ts | 535 | 'serves more concurrent connections than a browser will open' times out on this macOS machine (Node 26.4) only: of 8 concurrent loopback connects, 6 reach the server's connection event and 2 never arrive, while a plain node:http server on the same port 43110 answers a 40-connect burst in 22 ms both bare and under vitest. The bridge file is unchanged since v1.27.1 and the case passed on 2026-09-01, so it is environmental and unexplained, not caused by phases 10 or 11. Left red rather than quarantined: it is a security regression test and CI on Node 20 is the authoritative run. | waived | waived 2026-09-05: passes on CI (Node 20, run 33946155282 at cbdd674), so the failure is local to this macOS machine; nothing to quarantine and nothing gates a release | 2026-09-05T00:00:00.000Z | 2026-09-05T00:00:00.000Z |

````json
[
  {
    "id": 1,
    "kind": "unrun-verify",
    "phase": "3",
    "file": "src/components/foundry/recolorStagedEdit.ts",
    "line": null,
    "description": "In-app UAT not run: Foundry Recolor Stage button producing a tray row with non-zero affected files and installing nothing (needs Deadlock install)",
    "status": "waived",
    "reason": "deferred by decision 2026-09-01: each needs a real Deadlock install or a Windows machine, none gates a release, and the app-tier verification record is already green and strict (42 rows, 0 blank)",
    "recorded_at": "2026-08-09T05:42:51.916Z",
    "resolved_at": "2026-09-01T00:00:00.000Z"
  },
  {
    "id": 2,
    "kind": "unrun-verify",
    "phase": "04",
    "file": "src/components/common/HeroDetailFrame.tsx",
    "line": null,
    "description": "In-game visual verification of the 3D model as the hero stage (Locker + Foundry), the veil-over-canvas reading, and the stale pill behavior was auto-approved under auto mode and remains for end-of-milestone UAT",
    "status": "waived",
    "reason": "deferred by decision 2026-09-01: each needs a real Deadlock install or a Windows machine, none gates a release, and the app-tier verification record is already green and strict (42 rows, 0 blank)",
    "recorded_at": "2026-08-09T06:59:08.794Z",
    "resolved_at": "2026-09-01T00:00:00.000Z"
  },
  {
    "id": 3,
    "kind": "unrun-verify",
    "phase": "09",
    "file": "electron/main/services/chatWheel.roundtrip.test.ts",
    "line": null,
    "description": "The populated-override real-binary round-trip case added in 09-02 skips on macOS (the bundled ChatLane converter is Windows-only), so byte-for-byte preservation of unknown root keys and unknown command IDs is proven by the model unit tests but not yet by the real converter",
    "status": "waived",
    "reason": "deferred by decision 2026-09-01: each needs a real Deadlock install or a Windows machine, none gates a release, and the app-tier verification record is already green and strict (42 rows, 0 blank)",
    "recorded_at": "2026-08-31T00:00:00.000Z",
    "resolved_at": "2026-09-01T00:00:00.000Z"
  },
  {
    "id": 4,
    "kind": "failing-test",
    "phase": "9.1",
    "file": "electron/main/services/browserDownloadCapture.test.ts",
    "line": 553,
    "description": "sweepToolDownloadTempRoot (WR-05) 'a symlink entry in the root is skipped and never followed' expects 1 deletion and gets 2. Genuinely red on main since v1.27.1, not absorbed debt; it was hiding inside the quoted 26-failure baseline.",
    "status": "fixed",
    "reason": "Fixed: the symlink target lived inside the swept root, where a regular file is orphaned by construction, so the sweep was right to delete 2. Target moved outside the root, which is what \"never followed\" actually requires.",
    "recorded_at": "2026-09-01T00:00:00.000Z",
    "resolved_at": "2026-09-01T00:00:00.000Z"
  },
  {
    "id": 5,
    "kind": "toolchain",
    "phase": "9.1",
    "file": "vitest.config.ts",
    "line": null,
    "description": "Node 26 ships a native localStorage global that is unavailable without --localstorage-file and shadows jsdom's, so all 25 storage-touching tests (uiPrefs 19, heroStageMode 6) fail locally and pass on CI's Node 20. The repository declares no supported Node (no engines field, no .nvmrc), so the split is invisible until someone reads a failure count.",
    "status": "fixed",
    "reason": "Fixed by vitest.setup.ts: localStorage is repaired from the unshadowed sessionStorage instance and Storage is republished from that instance so Storage.prototype spies still reach it. .nvmrc and engines.node declare Node 20. Guarded by src/lib/domStorage.test.ts.",
    "recorded_at": "2026-09-01T00:00:00.000Z",
    "resolved_at": "2026-09-01T00:00:00.000Z"
  },
  {
    "id": 6,
    "kind": "failing-test",
    "phase": "11",
    "file": "electron/main/services/forgeBridge.test.ts",
    "line": 535,
    "description": "'serves more concurrent connections than a browser will open' times out on this macOS machine (Node 26.4) only: of 8 concurrent loopback connects, 6 reach the server's connection event and 2 never arrive, while a plain node:http server on the same port answers a 40-connect burst in 22 ms both bare and under vitest. Unchanged bridge code since v1.27.1, passed 2026-09-01; environmental and unexplained. Left red rather than quarantined because it is a security regression test and CI on Node 20 is the authoritative run.",
    "status": "waived",
    "reason": "waived 2026-09-05: passes on CI (Node 20, run 33946155282 at cbdd674), so the failure is local to this macOS machine; nothing to quarantine and nothing gates a release",
    "recorded_at": "2026-09-05T00:00:00.000Z",
    "resolved_at": "2026-09-05T00:00:00.000Z"
  }
]
````
