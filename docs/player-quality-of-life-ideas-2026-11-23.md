# Small Grimoire features that would make Deadlock easier or more fun

These proposals follow five everyday moments in the November 23 fork working
tree. The existing behavior comes from source and repository guides. The
proposed interactions and checks are for future playtests.

## F1. Undo queue removal

Two versions of a skin have nearly identical filenames. You hit the wrong X
and the queue empties. Grimoire already removes individual files, supports
drag reordering, and can prioritize a queued file. Cancelled managed jobs can
already be retried from Recovery. The compact history entry, however, appears
only when there is a paused or failed job, so an accidental cancellation can
make the nearby route to retry disappear.

Show a named confirmation with **Undo** after removing a waiting managed
download. Requeue the same file once, as close to its old spot among the
remaining waiting jobs as possible. If it has already started by the time the
click is handled, explain what happened and give active cancellation its own
action. Check with two files from the same listing and a queue that advances
while the player is clicking.

[Queue row](../src/components/downloads/DownloadQueueRows.tsx#L73) ·
[History](../src/components/downloads/DownloadHistory.tsx#L30) ·
[Cancellation routing](../electron/main/services/download.ts#L376)

## F2. Open an overlap from the mod that has it

A skin is enabled, but the game shows the other skin. Installed has an
Overlap badge and a global Overlap button. The Overlap page already has search
and can show which mod wins. Make the card badge open Overlap filtered to that
mod, including its relevant variants. Use the mod's identity so renamed and
same-name local mods lead to the right results. If the overlap has cleared,
show that directly and let the player go back to the same card.

[Installed card](../src/components/installed/ModCard.tsx#L995) ·
[Overlap search](../src/pages/Overlap.tsx#L142) ·
[Overlap winner](../src/components/overlap/OverlapCard.tsx#L153)

## F3. Stress-test a crosshair before launching

A reticle looks clean while standing still and gets hard to follow during a
fight. Crosshair already has game backgrounds, zoom, and resolution scaling.
Add a short preview that expands and settles the gap over the existing
backgrounds, with an instant return to the resting state. Label the motion as
illustrative until it can be compared with the game. Check whether it helps
players catch gaps and outlines they would change after trying both presets in
Deadlock.

[Crosshair stage](../src/pages/Crosshair.tsx#L298) ·
[Preview limits](guide/crosshair.md#what-the-preview-cannot-show-you)

## F4. Try a mod on top of the current setup for one session

A player wants to hear a new dash sound alongside their usual HUD, skin and
other audio. Installed already offers **Launch with only this mod** for
isolation. Add a separate **Try for one launch** action that shows what the
trial will add or override, launches, then restores the prior setup when the
session ends. Start with one installed, disabled mod. Preview a variant swap
if the selected mod belongs to a group. Before offering it broadly, check
restoration after normal exit, launch failure, and Grimoire closing first.
Use the existing reviewed restore machinery as the starting point.

[Solo launch](../src/pages/Installed.tsx#L2612) ·
[Reviewed profile recovery](../src/components/profiles/ProfileRecoveryPanel.tsx#L28)

## F5. Hear an ability sound three times in a row

A joke sound can be great once and exhausting by the third cast. Locker
already auditions individual sounds and has an experimental combined ability
preview. Offer a short, explicitly started repeat audition of the selected
sound at its configured volume and pitch, with stock audio one click away
when the slot has a playable stock clip. Tap-to-stop matters as much as play.
Check that switching heroes stops the audition and that making the
comparison leaves the selected override alone.

[Locker sound audition](../src/components/locker/SoundEntryRow.tsx#L260) ·
[Ability preview](../src/components/locker/AbilityPreview.tsx#L159)

I would start with F1 for a small improvement players can use immediately,
then F3 for something players can feel before starting a match. F4 offers
the biggest change to how people experiment and needs the strongest recovery
proof. F5 is a cheaper way to test whether players want more realistic
auditions.
