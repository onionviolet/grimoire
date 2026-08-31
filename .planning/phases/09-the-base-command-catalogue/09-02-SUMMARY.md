---
phase: 09-the-base-command-catalogue
plan: 02
subsystem: chat-wheel
tags: [tests, ipc, audit-gap, roundtrip]

requires: []
provides:
  - Always-run coverage for readChatWheelStarter (happy path + missing template)
  - Always-run coverage for readChatWheelVpk (both guards, happy path, error propagation, temp hygiene)
  - Populated-override real-binary round-trip case
affects: [REQ-cw-test-gap, REQ-cw-override-editing]

actuals:
  tokens: 0
  tasks: 2
  commits: 0

one_liner: The two audit-flagged read paths now have deterministic stubbed coverage, and the real-converter suite carries a populated-override round trip.
---

# Plan 09-02 Summary: Closing the chat-wheel read/starter test gap

## Delivered

**Task 1 - `electron/main/services/chatWheel.test.ts` (extended, no production code touched)**

- The hoisted harness gained `mode: 'ok' | 'fail'` and `outputText`. The spawn
  stub holds its stdout/stderr emitters in local `const` bindings before
  `Object.assign` (the assign's return value is discarded, so `child.stderr`
  would not typecheck), emits `outputText` on stderr then `close(1)` in fail
  mode, and writes a known YAML constant then `close(0)` in ok mode. Default
  stays `'ok'`, so the two pre-existing validate tests pass unchanged.
- `appRootWithConverter()` builds the fixture all three guards require: a fresh
  `mkdtemp` app root with a platform-named converter stub under
  `resources/chatlane`.
- `readChatWheelStarter`: returns the template byte-for-byte including its
  comment line; rejects with a message naming `starter.yml` when absent.
- `readChatWheelVpk`: a `.zip` path and a missing `.vpk` both reject with
  `Select an existing .vpk file.` and leave `harness.calls` empty (the guard
  precedes `mkdtemp`, so there is no temp dir to assert on); the happy path
  passes the vpk as args[0], a `chatlane.yml` under a `grimoire-chatwheel-`
  temp dir as args[1], resolves to that file's contents, and the temp dir is
  gone; a failing run rejects with the trimmed converter output and cleans up;
  a silent failure rejects with the exact `ChatLane exited with status 1.`
- The read block's `beforeEach` resets `mode`, `outputText`, `calls` and
  `harness.appPath`, so it does not depend on declaration order.
- The temp-dir assertions capture the exact path from `args[1]`, deliberately
  departing from the roundtrip suite's prefix scan: with a stubbed spawn the
  path is deterministic and immune to the cross-worker interference that file
  warns about.

**Task 2 - `electron/main/services/chatWheel.roundtrip.test.ts` (extended)**

- New case under the existing `describe.skipIf` gate: a fixture with both
  override maps populated (`Flank`, `Good Game (Post Game) - All Chat`,
  `You're Welcome`, `Totally Unknown Cmd`, plus a ping-wheel entry and a
  custom_menus block) is built with the real converter and read back. It
  asserts the suite's trimmed equality AND each of the four override lines
  verbatim, so a converter that reorders or reserializes the maps fails loudly.
- The stale comment at the top of the suite no longer claims starter.yml is
  CRLF or that the comparison is byte-for-byte; it now says LF-only and
  trimmed equality.

## Gate Results

- `vitest run electron/main/services/chatWheel.test.ts` - pass (9 tests, was 2)
- `tsc -b` - pass
- `eslint .` - pass
- Full `vitest run`: 3 failed files / 26 failed tests, all pre-existing and at
  or below the documented baseline. No new failures.

## Notes / Carried Debt

- **The Task 2 case has not been executed.** `resources/chatlane/` ships
  `ChatLane.exe` only, so `chatLaneBinaryPath()` throws on this macOS machine
  and the whole roundtrip suite skips (6 skipped, was 5). The new case
  typechecks, lints, and is gated exactly like its siblings, but its assertions
  have never run against the real binary. It needs one run on a Windows dev
  machine before roadmap criterion 3 can be called verified. If ChatLane
  reserializes the maps there, the four verbatim line assertions are what will
  say so.
- No `ipcMain` mock was added: the handlers are one-line delegations and the
  repo has no IPC-handler test precedent (09-RESEARCH 2.4).
