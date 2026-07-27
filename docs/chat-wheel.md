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
