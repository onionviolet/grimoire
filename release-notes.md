## [1.25.171] - 2026-07-28

### Added
- **Combined Foundry VPK forge.** Stage compatible sound and texture replacements,
  review the exact final write-set and collision winners, then export them as one
  VPK without changing the Installed library. Cancelling the save dialog leaves
  staged sources and installed mods unchanged.

### Fixed
- **Atomic Foundry exports.** Exports now copy to a temporary sibling file before
  renaming, so a failed copy never leaves a partial VPK at the selected path.
