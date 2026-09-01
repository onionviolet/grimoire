---
phase: 11-safety-and-dressing
plan: 01
subsystem: chat-wheel
tags: [ui, i18n, safety, removal]

requires:
  - 02-03 (Chat Wheel page, chat-wheel:save stamping sourceSection 'ChatWheel')
  - common/confirm (useConfirm provider)
provides:
  - isChatWheelAddon / chatWheelAddonsIn (src/lib/chatWheelAddon.ts)
  - confirmChatWheelUnbind, the one unbind warning both pages route through
  - RemoveWheelButton on the Chat Wheel page
  - Installed page delete paths (single, group, bulk) gated on the warning
  - 8 chatWheel.unbind.* i18n keys
affects: [REQ-cw-unbind-warning]

actuals:
  tokens: 0
  tasks: 1
  commits: 1

one_liner: Removing a chat wheel add-on from either page now warns that its custom menus must be unbound in the game first, and deletes nothing until that warning is confirmed.
---

# Plan 11-01 Summary: Warn before removing a still-bound chat wheel add-on

## Delivered

- `src/lib/chatWheelAddon.ts` (new): `isChatWheelAddon(mod)` is
  `sourceSection === 'ChatWheel'`, the only marker the renderer-side `Mod`
  carries (the sidecar's `chatWheel: true` never crosses IPC). Plus
  `chatWheelAddonsIn(mods)` for lists.
- `src/components/chatwheel/unbindWarning.ts` (new): `confirmChatWheelUnbind(confirm, t, mods)`
  resolves `true` without a dialog when no chat wheel add-on is present, so
  ordinary mods keep their existing removal flow; otherwise it shows the
  `useConfirm` dialog (danger variant, add-on names as `items`, count-aware
  title/message/label) and resolves to the answer.
- `src/components/chatwheel/RemoveWheelButton.tsx` (new): the Chat Wheel page
  had no removal action at all, so one was added. It owns the warning, the
  `deleteMod` call and its busy state; the page passes the selected wheel and
  an `onRemoved` that clears the selection and refreshes both lists, leaving
  the current YAML as a new-wheel draft.
- `src/pages/ChatWheel.tsx`: one import plus one JSX element in the sidebar.
- `src/pages/Installed.tsx`: three imports, `const confirm = useConfirm()`,
  and two guarded entry points. `deleteEntry` treats the warning as the
  confirmation for a chat wheel target and deletes directly on confirm (no
  second dialog); `openBulkDeleteConfirm` shows the warning first and then
  the usual bulk confirmation, since a mixed selection still needs it.
- `src/locales/en/translation.json`: `chatWheel.unbind.removeWheel`,
  `title_one/other`, `message_one/other`, `confirm_one/other`. Manifest not
  regenerated (orchestrator does it once after merge).
- `docs/chat-wheel.md`: new "Removing a wheel" section.

## Tests

- `src/lib/chatWheelAddon.test.ts` (3): detection and filtering.
- `src/components/chatwheel/unbindWarning.test.ts` (4): no dialog for plain
  mods, dialog contents and proceed on confirm, blocked on decline, plural.
- `src/pages/ChatWheel.test.tsx` (+2): selecting an installed wheel and
  pressing Remove wheel calls the confirm provider with the warning and
  `deleteMod('wheel-1')` only when confirmed; declining removes nothing and
  keeps the selection. The `deleteMod` mock was added to `apiMock`.

## Gate Results

- `tsc -b` exit 0
- `eslint .` exit 0
- `vitest run`: 218 files passed, 2 skipped; 2445 tests passed, 18 skipped
- `node scripts/check-i18n.mjs`: all 2844 referenced keys exist
- `node scripts/check-encoding.mjs`: clean (748 files)

## Notes / Carried Debt

- The Installed page has no render test (9.7k lines); its gating is covered
  at the helper level, and the page-level warning path is exercised through
  the Chat Wheel page test. No CDP run was made.
- The worktree needed a `node_modules` symlink to the main checkout to run
  the binaries; it is gitignored and not part of the change.
