# Native ChatLane converter data

Grimoire ports the MIT converter from [RedMser/ChatLane](https://github.com/RedMser/ChatLane/tree/9a71e229f30e7a899699aa5f24d1fbe88da8ce00), pinned to commit `9a71e229f30e7a899699aa5f24d1fbe88da8ce00` (2026-01-24). The original MIT notice is preserved in `LICENSE`. The original project credits Valve for Deadlock's game data.

- `base-commands.json`: ordered, typed dump of `OriginalVData.GetData()` from `CLI/Serialize/OriginalVData.cs`. This preserves all 54 root entries and their original KV types, including Int64 IDs, floating-point margins and array property names. The original source identifies its game snapshot as 2025-10-31. This is the converter's pinned snapshot, not a live game extraction.
- `red2.bin`: the complete 934-byte `red2Data` array from `CLI/Serialize/Block.cs`, before its DATA CRC is patched. The native converter patches bytes 112 through 115 with the DATA CRC in little endian order, exactly as the C# implementation does.
- `starter.yml`: Grimoire's existing starter, unchanged.
- Historical `ChatLane.exe` and Windows DLLs remain tracked but are neither called by the native converter nor included in new installers. Their build provenance is unverified.

The native implementation is `electron/main/services/chatWheelNative.ts`. It ports `YAMLToKeyValues.cs`, `WriteBinaryKV3.cs`, `WriteResource.cs` and the RED2 patch in `Block.cs`. It writes the game asset at `scripts/ping_wheel_messages.vdata_c`, along with the original YAML and a README. Its VPK container uses the supported self-contained v1 format; the original ValvePak writer used v2. Container bytes and README copy differ; compiled game asset bytes match.

## Independent fixtures

`electron/main/services/fixtures/chatwheel/starter-original.vpk` and `overrides-original.vpk` were generated on macOS with the pinned original C# CLI and .NET SDK 9.0.318. The original conversion code was unchanged. Temporary diagnostic branches in Program.cs dumped typed base data and read generated resources through ValveResourceFormat; those diagnostics did not run while generating the fixtures. No game install was touched.

Build the original CLI from that pinned source:

```sh
DOTNET_CLI_TELEMETRY_OPTOUT=1 dotnet build CLI/ChatLane.csproj -o /tmp/chatlane-cli \
  -p:PublishTrimmed=false -p:SelfContained=false -p:PublishSingleFile=false
DOTNET_CLI_TELEMETRY_OPTOUT=1 dotnet /tmp/chatlane-cli/ChatLane.dll \
  /path/to/grimoire/resources/chatlane/starter.yml /tmp/starter-original.vpk
DOTNET_CLI_TELEMETRY_OPTOUT=1 dotnet /tmp/chatlane-cli/ChatLane.dll \
  /path/to/grimoire/electron/main/services/fixtures/chatwheel/overrides.yml /tmp/overrides-original.vpk
```

The native tests compare the entire game resource in both VPK fixtures byte for byte. They cover base data, property order, Int64 vs Int32, boolean overrides, unknown commands, custom menu IDs starting at 70, icons, empty menus, KV3 string/type tables, RED2 CRC and resource block offsets. YAML read-back also checks the original C# VPKs, not just native output.

The native writer corrects the original CLI's UTF-16 string-count bug by recording UTF-8 byte lengths in binary KV3. A resource with the custom menu name `菜单 ☕` was independently read back using the original CLI's ValveResourceFormat 15.0.4937 dependency, confirming both label tokens, menu ID 70 and slice type. ASCII resource fixtures remain byte-identical.

The native parser accepts unknown YAML fields and embeds the complete original UTF-8 text unchanged, including comments, BOM and CRLF. Unknown override command names are ignored for game compilation, matching the original converter. Required name/menu shapes and explicit boolean overrides are checked before staging a file. Omitted override maps or menu lists default to empty; the original CLI could throw on omitted maps. Duplicate keys, malformed YAML, invalid known field types and oversized input fail with diagnostics.

## Scope of evidence

These checks establish compatibility with the pinned original converter resource contract and independent ValveResourceFormat decoding. They do not establish current in-match game behavior, future game-update compatibility, or parity with the unverified historical Windows executable. The existing ChatLane game limitations still apply.
