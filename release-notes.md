## [1.25.171] - 2026-07-28

### Added
- **Combined Foundry VPK forge.** Stage compatible sound and texture replacements,
  review the exact final write-set and collision winners, then export them as one
  VPK without changing the Installed library. Cancelling the save dialog leaves
  staged sources and installed mods unchanged.
- **Chat Wheel form editor.** Edit a wheel's name, menus, and commands in a form
  with a live radial preview, alongside the existing Advanced YAML view. Comments
  and ChatLane options Grimoire does not recognize are preserved verbatim.

### Fixed
- **Atomic Foundry exports.** Exports now copy to a temporary sibling file before
  renaming, so a failed copy never leaves a partial VPK at the selected path.
- **Conflict check when staging a sound.** Staging a sound edit now runs the same
  exact-path conflict check the texture flow runs. A VPK that cannot be read
  blocks staging with an explanation, and an existing enabled owner is reported
  before the edit is staged.
- **Sound input wording.** The audio picker no longer claims MP3-only input;
  WAV, OGG, FLAC, M4A, AAC, and Opus are converted automatically. Staging a
  sound also no longer reports it as installed.
