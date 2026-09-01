# Chat Wheel

Grimoire's Chat Wheel page edits the YAML format used by
[ChatLane for Grimoire](https://github.com/onionviolet/chatlane-grimoire) and
uses its bundled CLI to convert that YAML to a Deadlock add-on VPK. The
converter is a derivative of the original
[RedMser/ChatLane](https://github.com/RedMser/ChatLane); its MIT `LICENSE` is
distributed alongside the executable. The fork's repository link above is not
publicly readable today (it returns 404), so the vendored command catalogue in
`src/lib/chatWheelCommands.ts` is pinned to an upstream RedMser commit instead;
whether the bundled executable was built from that exact commit is unverified.

Open a compatible ChatLane VPK to recover its embedded `chatlane.yml`, edit
the YAML, then save. Grimoire validates it with the converter before changing
the managed add-on: saving a selected wheel replaces that VPK in its current
slot, while a new wheel is allocated through the normal managed-mod flow.
The page never edits `gameinfo.gi`.

## Current editor

`Create new wheel` resets to the bundled starter configuration after confirming
that unsaved changes may be discarded. It creates only a draft; installation
still happens only when the user chooses `Save & install`.

The page has a form editor and a live, non-destructive radial preview for the
ChatLane fields it understands. Advanced YAML remains available for every
supported and unsupported ChatLane option. The editor preserves text outside
the fields it owns, but editing unfamiliar YAML in Advanced YAML should be
validated before saving.

## Base command catalogue

Beneath the menu editor, the `Base command catalogue` section lists every
base-game voice command ChatLane knows about, so the two override maps
(`override_bindable` and `override_ping_wheel_bindable`) no longer need to be
edited by hand in Advanced YAML.

- Search narrows the list case-insensitively by command name, and the four
  category chips (All, Default, Hidden, Broken) filter by ChatLane's own
  categories with their static catalogue totals.
- Each row states the command's game default: bindable, hidden (available in
  game but not bindable on the stock wheel), or game-state dependent. Where a
  command's ping-wheel default differs from its Chat Wheel default, a second
  tag names the ping default.
- Each row carries two three-state controls, one per map: Inherit (no YAML
  entry, the game default governs), On (`true`) and Off (`false`). Changing one
  rewrites only that entry in the YAML.
- Override keys that are not in the catalogue appear in an `Other commands in
  this file` group with their raw YAML key and editable booleans. Switching one
  off writes an explicit `false`; entries are never deleted here. Removing an
  entry outright stays an Advanced YAML action.

The section is a projection of the YAML: Advanced YAML remains the single
source of truth, so a manual edit there flows straight back into the controls,
and nothing here edits `gameinfo.gi`.

## Removing a wheel

Deadlock binds a custom menu to the add-on that defines it, and only the
game's own Chat Wheel settings can unbind it. Removing the add-on while a
custom menu is still bound can crash the game when the chat wheel or the
settings screen opens, and Grimoire cannot repair that binding afterwards.
So `Remove wheel` on this page, and deleting a chat wheel add-on from the
Installed page (singly or inside a bulk selection), first shows the unbind
warning and removes nothing until it is confirmed. Ordinary mods keep their
usual delete flow. The detection (`sourceSection === "ChatWheel"`) lives in
`src/lib/chatWheelAddon.ts` and the dialog in
`src/components/chatwheel/unbindWarning.ts`, so both surfaces share one copy.
