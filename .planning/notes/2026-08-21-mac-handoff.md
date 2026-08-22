# Handoff: Windows -> macOS (2026-08-21)

Everything through commit `77d9767` is on `origin/main`. Nothing is uncommitted
except `.reasonix/`, which is local editor metadata and deliberately not pushed.

## Where the work stands

Milestone **v1.27.5 "Chat Wheel parity"**, phase **9 "The Base Command
Catalogue"**, status **planning**.

Phase 9 has all four pre-plan artifacts written and committed:

| File | What it holds |
|------|---------------|
| `.planning/phases/09-the-base-command-catalogue/09-CONTEXT.md` | phase context gathered |
| `.planning/phases/09-the-base-command-catalogue/09-DISCUSSION-LOG.md` | the discuss-phase transcript |
| `.planning/phases/09-the-base-command-catalogue/09-RESEARCH.md` | research output |
| `.planning/phases/09-the-base-command-catalogue/09-UI-SPEC.md` | UI design contract |

There is no `09-PLAN.md`. Planning is the next step, not execution.

## Next action on the Mac

Clone the sibling repo first, then install, then plan:

```bash
git clone https://github.com/Slush97/grimoire-social.git ../grimoire-social && cd ../grimoire-social && pnpm install
```

`preinstall` hard-fails without it: `@grimoire/social-types` resolves through
`link:../grimoire-social/packages/social-types` and there is no
`pnpm-workspace.yaml` to make pnpm verify the path.

Then in this repo:

```bash
pnpm install && pnpm exec electron-rebuild -f -w better-sqlite3
```

Then run `$gsd-plan-phase 9`.

## macOS-specific notes

- **vpkmerge ships for `darwin-arm64` only.** On Apple Silicon `postinstall`
  fetches `vpkmerge-macos-aarch64` and mod merging works. On an Intel Mac the
  fetch script prints a skip warning and merging is unavailable, which takes out
  most of the Foundry surface.
- **Deadlock has no macOS build.** Every engine-tier row in
  `docs/ingame-verification-record.md` is unreachable from the Mac. App-tier
  checks via `pnpm verify:in-app` still run, because they read VPK bytes back
  rather than launching the game.
- `pnpm package:mac` exists if a local build is wanted.

## Carried over from v1.27, still open

1. Deferred real-game verification for phases 3, 4, and 5 (`$gsd-verify-work 3`,
   `4`, `5`). Needs a Deadlock install, so it cannot be closed on the Mac.
2. Broken windows 1 and 2 in `.planning/WINDOWS.md`, both unrun in-app
   verifications, both blocked on the same thing.

`workflow.windows_enforce` blocks `/gsd-ship` while `open_count > 0`, so these
two have to be closed or waived on a Windows machine before v1.27.5 ships.

## Stale file corrected

`.planning/HANDOFF.json` still pointed at phase `05-one-inventory-one-journey`
under milestone v1.27. It now reflects phase 9 under v1.27.5.
