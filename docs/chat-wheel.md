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

## Current editor

`Create new wheel` resets to the bundled starter configuration after confirming
that unsaved changes may be discarded. It creates only a draft; installation
still happens only when the user chooses `Save & install`.

The page has a form editor and a live, non-destructive radial preview for the
ChatLane fields it understands. Advanced YAML remains available for every
supported and unsupported ChatLane option. The editor preserves text outside
the fields it owns, but editing unfamiliar YAML in Advanced YAML should be
validated before saving.
