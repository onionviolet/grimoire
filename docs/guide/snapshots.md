---
title: Snapshots and rolling back
description: Automatic recovery points taken before risky operations, and how to use one to undo a bad update or a wrong profile.
slug: snapshots
order: 20
updated: 2026-07-29
---

# Snapshots and rolling back

A snapshot records **every mod you have installed**, enabled and disabled, so you can get back to a known-good setup. Grimoire takes them automatically before anything risky, and you can take one yourself.

They live on the **Profiles** page, under **Snapshots**.

## When Grimoire takes one

Automatically, before three things:

- **Before mod update**, when an update is about to change your installed set
- **Before applying profile**, since applying disables anything not in the profile
- **Before DMM import**, when adopting mods from Deadlock Mod Manager

Each one is labelled with which of those triggered it.

**Snapshot now** takes one on demand. Worth doing before you go experimenting.

## How they differ from profiles

| | Profile | Snapshot |
|---|---|---|
| Records | Only enabled mods | Every installed mod, on and off |
| Created | By you, deliberately | Automatically, before risky operations |
| Console commands and crosshair | Yes | **No** |
| Local mods | Yes | **No** |

Two gaps worth knowing. A snapshot **does not** back up your console commands or crosshair, despite living on the same page as profiles that do. And it skips local mods, the same as sharing does.

## Restoring one

Click **Restore** on the snapshot you want.

**This is not a one-click undo**, which surprises people. Restore opens the import dialog with the snapshot preloaded. Mods you still have are reused, missing ones are re-downloaded from GameBanana, and the result is a **new profile**.

You then apply that profile to actually get back to the old state.

The upside of doing it this way is that a snapshot can rescue you even from mods you have since deleted, because it can fetch them again.

## Undoing a bad update

The most common use. A mod updates, something breaks, and you want the old set back:

1. Go to **Profiles > Snapshots**.
2. Find the one labelled **Before mod update** from around when it broke.
3. Click **Restore**, let it resolve, and import.
4. Click **Apply** on the profile it created.

## Housekeeping

**Snapshots are never cleaned up automatically.** One is written before every mod update, so they accumulate indefinitely.

They are only lists of mod IDs, not copies of files, so the disk cost is negligible. Still, the list gets long. Use the header checkbox to select several and delete them in bulk.

**Deleting a snapshot does not touch your installed mods.** It only removes the recovery point.
