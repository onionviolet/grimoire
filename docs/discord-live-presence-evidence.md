# Live Discord game presence investigation

Status: awaiting a runtime log capture. Investigated November 23, 2026.

## Existing behavior

`electron/main/services/discordRpc.ts` publishes Grimoire activity through the
local Discord client. `discordRpcEnabled` defaults to false. The renderer reports
the active Grimoire surface and, when applicable, the open Locker hero.
[Discord setup](discord-rpc-setup.md)

## Primary evidence

The [Deadlock Mod Manager privacy guide](https://docs.deadlockmods.app/using-mod-manager/privacy)
documents game presence containing menu, queue, match, spectator state, hero,
party size and elapsed time. The guide describes that application's behavior.

[Jelloge/Deadlock-Rich-Presence](https://github.com/Jelloge/Deadlock-Rich-Presence)
documents reading `console.log` generated with the `-condebug` launch option.
Inspected repository revision: `afa827c579e6314badcb970aca4b9ef07225a828`, dated
2026-03-23. Its diagnostic parser identifies event families including
`ChangeGameState`, Hideout lobby connection changes, HLTV state and loaded heroes.
The GPL-3.0 repository served as a reference for which events to look for.

Steam's local manifest reports build `26875936`. Inspection of that build's DLLs
found these log format strings.

| Binary | Format string present |
| --- | --- |
| `game/citadel/bin/win64/client.dll` | `Hideout Lobby Connection State: %s (%d)` |
| `game/citadel/bin/win64/server.dll` | `ChangeGameState: %s (%d)` |
| `game/citadel/bin/win64/server.dll` | `Citadel HLTV Director, Entering game state: %d (%s) %s` |
| `game/citadel/bin/win64/server.dll` | `Loaded hero %d/%s` |

`game/citadel/console.log` was absent. The game-tree search found one log,
`game/bin/win64/debug.log`, with Crashpad errors from 2024. Deadlock was idle
during inspection. A runtime capture is needed to establish the order of events
and identify which ones describe the local player. Publishing from format
strings alone could display stale or incorrect activity.

## Acceptance gate for implementation

Obtain a local `-condebug` capture from this installed build covering normal
transitions: menu, queue/cancel, match entry/exit, spectating and game shutdown.
Identify the local-player hero signal separately from precaching or other players'
hero loads. Sanitize captured excerpts before committing fixtures.

Then implement an independent parser and bounded log follower with rotation,
partial-line, truncation, startup-history and stale-state handling. Tests must
mock Discord and verify fallback to the current Grimoire surface whenever game
state is unknown or the game exits. A separate default-off setting can list the
fields shared through Discord. Keep raw logs local and publish only reviewed
activity fields.

The implementation gate is verified current runtime events and passing transition
fixtures. A real Discord publish is a separate human acceptance step.
