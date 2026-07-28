# Chat Wheel

Grimoire's Chat Wheel page edits the YAML format used by
[ChatLane for Grimoire](https://github.com/onionviolet/chatlane-grimoire) and
uses its bundled CLI to convert that YAML to a Deadlock add-on VPK. The
converter is a derivative of the original
[RedMser/ChatLane](https://github.com/RedMser/ChatLane); its MIT `LICENSE` is
distributed alongside the executable.

Open a compatible ChatLane VPK to recover its embedded `chatlane.yml`, edit
the YAML, then save. Grimoire validates it with the converter before changing
the managed add-on: saving a selected wheel replaces that VPK in its current
slot, while a new wheel is allocated through the normal managed-mod flow.
The page never edits `gameinfo.gi`.

## Known interaction gap (next iteration)

`Start a new wheel` currently reloads the same starter YAML that is already
loaded when the page opens. If no installed wheel is selected, this has no
visible effect; selecting `New chat wheel` again also cannot fire a selection
change. A new wheel is only created after `Save & install`, so the current
label makes the workflow appear broken.

The editor is YAML-only today. There is no chat-wheel visualizer, radial
preview, or direct manipulation UI in the renderer.

Next iteration:

1. Replace the ambiguous action with an explicit `Create new wheel` flow that
   confirms resetting unsaved changes and clearly states that installation
   happens on save.
2. Parse the supported ChatLane YAML into a typed, lossless editor model; keep
   unsupported fields and comments intact when serializing it back to YAML.
3. Add a live radial preview with menu navigation, icons, labels, and empty or
   invalid-slot states. Selecting a preview slot should focus its form fields.
4. Add a form-based editor for wheel settings, menus, and commands alongside
   an advanced YAML view, with two-way synchronization and inline validation.
5. Cover the reset/create flow, YAML round-tripping, preview layout, and
   converter failures with unit and end-to-end tests before lifting the
   experimental gate.
