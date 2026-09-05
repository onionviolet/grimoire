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

## Building menus

Menus can be built by drag-and-drop, the way ChatLane's own GUI worked, and
every drag-only interaction has a keyboard alternative. Every edit goes through
the same `updateChatWheelYaml` path as a typed change, so the byte-preserving
round trip is untouched.

- Catalogue rows carry a drag handle and an `Add` button. Dropping a row onto a
  menu's item list inserts the command before the row it lands on, or appends
  it anywhere else in the list; the `Add` button appends it to the menu the
  preview is showing.
- Item rows are draggable between and within menus. `Move up` / `Move down`
  buttons and Alt+Up / Alt+Down on the command input reorder within a menu;
  when there is more than one menu, a `Move to menu` select moves an item to
  another menu.
- On the preview, dragging a wedge onto another wedge reorders the menu, and
  dropping a catalogue command onto a wedge inserts it at that slot (or appends
  it when dropped on the surrounding surface). The wedges are one roving tab
  stop: arrow keys move focus around the ring and wrap, Home and End jump to
  the first and last slot, Enter or Space select the focused slot, and
  Alt+Arrow moves the focused command one slot.

Drag-and-drop does not recreate the game's own slot-binding editor: the game
still owns which Chat Wheel slot a custom menu is bound to.

## Known limitations

These are the ChatLane limitations documented upstream (RedMser/ChatLane,
"Known issues") that affect a saved wheel. The page discloses each one next
to the control it affects, as a statement of what the game and ChatLane do,
not a guarantee about any given match.

- Custom menu item order is reversed for players on the Archmother team. The
  preview shows the order as written.
- A custom menu bound to the top slot of the game's Chat Wheel opens in the
  wrong direction and cannot be used there.
- Depending on which slot a custom menu is bound to, some of its items cannot
  be selected.
- Opening the chat wheel or the settings can crash the game when a custom menu
  is still bound but its add-on is gone: after a game update resets
  `gameinfo.gi`, after removing a custom menu without unbinding it, or after
  uninstalling the add-on without unbinding its menus. Unbind custom menus in
  the game's Chat Wheel settings first.
- Selecting a custom menu itself, without picking one of its entries, plays a
  placeholder voice line.
- A custom menu holds at most 12 entries, filling the whole circle (the preview
  already shows this as the overflow warning).

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

## Game-asset dressing (spike, behind the Foundry flag)

The radial preview is a pure SVG wheel and that wheel is permanent, not a
placeholder. On top of it, and only when all three of the following hold, the
preview draws the game's own backplate art behind the ring:

- the Foundry experimental flag is on (`experimentalFoundry`),
- a game path is configured (the dev dummy path counts while dev mode is on),
- the base pak's texture catalog yields a `.vtex_c` under
  `panorama/images/hud/` whose name contains `wheel` and is not an icon, and
  the Foundry full-image decoder turns it into a PNG.

Any of those failing, including an unavailable catalog engine or a decode
error, resolves to null and the SVG wheel renders unchanged, with no extra
markup. The resolver (`electron/main/services/chatWheelDressing.ts`) owns no
decoding: it calls the existing Foundry `getTextures` and `ensureFullImage`,
so the PNG lands in the same `grimoire-foundry:` cache the Foundry lightbox
uses and the renderer never receives a filesystem path. The gate lives in
`useChatWheelDressing`; the IPC channel is `chat-wheel:dressing`.

The stock icons need no extraction. ChatLane embeds the game's
`scripts/ping_wheel_messages.vdata`, which names the in-game set as
`panorama/images/hud/ping/ping_icon_<name>.svg`; those are compiled `.vsvg_c`
entries the texture catalog does not index, and the eleven vendored ChatLane
icons in `src/lib/chatWheelIcons.ts` carry exactly those names. See
`.planning/phases/11-safety-and-dressing/11-02-SUMMARY.md` for the spike
verdict and what the pak was and was not found to contain.
