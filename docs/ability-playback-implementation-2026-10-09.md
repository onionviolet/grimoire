# Ability playback follow-through

Implemented in the working tree on `codex/finish-requested-features` after
`2aa5aef8`. The existing audition edits and unrelated dirty files were preserved.
This follows the [October 8 audit](./ability-playback-improvement-audit-2026-10-08.md).
The current inventory stays in `feature-status.md`; remaining scope stays in
BACKLOG B-04. This work is uncommitted, not installed or published.

## Implemented behavior

| Code | Result | Evidence |
|---|---|---|
| A1 | Animation and decoded audio share an absolute playhead. Asset readiness gates playback. Pause, seek, speed, replay, stop and finish operate on that playhead; saved sound pitch and gain remain separate. Stop returns the cast to frame zero, retaining its Canvas and camera. Closing disposes audio and model resources. | `AbilityPreview.tsx`, `abilityPlaybackController.ts`; real Three mixer tests, fake Web Audio scheduling, and loaded-scene integration tests |
| A2 | Idle and ability viewers share lighting, the HDR probe, camera/framing defaults and Source 2/NPR material passes. Ability models use the enriched GLTF texture loader. Original resources are captured before shader wrappers replace them, and late loads are disposed. A material restore-order bug is corrected. | `HeroPreviewScene.tsx`, `heroPreviewSceneSetup.ts`, `HeroPoseViewer.tsx`, `useOwnedGltf.ts`; real material ownership, tint, draw-state and resource-lifetime tests |
| A3 | Exact-entry exports can inspect their embedded ANIM/ASEQ event metadata. Exact sequence aliases, exported frame count and fps must agree. An applied model falls back to base event metadata only after conclusively containing zero embedded animations. Read errors cannot break model playback. Available events can be expanded in the audition dialog. | `abilityClipEvents.ts`, `heroPoseModels.ts`, `abilityPreview.ts`, `AbilityEventDetails.tsx`; synthetic parser-contract and donor-authority tests |

The separate standalone audio player was removed because it could run outside
the audition timeline. Failed loading or decoding now reports a failure rather
than leaving enabled playback controls or an endless loading state. A rejected
audio-resume request from a disposed audition cannot replace the current error.

## Event evidence and limits

The current engine does not expose the selected model entry for a `--hero`
discovery selector. Those exports do not receive guessed event metadata.
Exact `--entry` exports use the existing read-only generic KV3 decoder on a
validated private copy of the ANIM/ASEQ block. Temporary wrappers are removed.
No new engine verb, dependency or release is required.

Event name, authored payload, frame, cycle, duration and provenance are preserved.
Metadata availability does not establish an ability-slot association, resolve
sound resources, create a particle join, or schedule authored cast events.
The audition still starts its selected sound at timeline zero.

A genuine captured fixture from `onionviolet/vpkmerge` revision
`798f3a7d28f3ef314d8f6ebf51ced0d9fe049445` was decoded with the stock pinned
v0.19.1 binary. Fixture:
`morphic/fixtures/nm/yamato_reload_idle_quick.vnmclip_c`, SHA-256
`aa8e8a0c56b85e957958e18fae9e258ce498e5b5eabe7224739f6ace22efa6ee`.
It contains a legacy `AE_TAGGED_SOUND` event named `reload_end` at normalized
cycle `0.20000000298023224`, or `0.13333333929379787` seconds. This proves the
generic decoder exposes authored NM event data. It does not associate that
loose NM clip with the embedded animation used by the current exporter.
The new embedded parser tests are synthetic and labeled accordingly.

No real Deadlock installation was found locally. The user confirmed the game
is probably on another computer. A4's complete sprite cast pilot and A5's
gameplay comparison therefore remain open. Accessible game files are enough
for asset inspection; a comparison against gameplay can run on the other
computer. Custom animation retargeting remains outside this slice.

## Verification

| Check | Observed result |
|---|---|
| `pnpm typecheck` | Passed after correcting integration type errors |
| `pnpm lint` | Passed |
| `pnpm test` | 302 test files passed, 1 skipped; 3,208 tests passed, 12 skipped |
| `pnpm ui:check` | Passed |
| `pnpm i18n:check` and `pnpm i18n:manifest` | Passed; manifest regenerated |
| Production build with explicit HTTPS social URL and local fork marker | Passed; zero unresolved main-process bundled imports |
| macOS arm64 directory package with publishing disabled | Built, ad-hoc signed and signature verified |
| Packaged playback smoke | Not verified: both isolated test launches stalled in macOS Keychain access before creating a renderer. A process sample showed `SecKeychainFindGenericPassword` and Security decrypt waiting. Test instances were stopped; no Keychain approval or password was handled. |
| `git diff --check` | Passed |

The package is at
`/tmp/grimoire-ability-checks-2026-10-09/package/mac-arm64/Grimoire.app`.
Verification logs and the startup sample are in that temporary check directory;
captured decoder evidence is in `/tmp/grimoire-ability-events-source/evidence.json`.
No successful screenshot, live cast playback, Windows/Linux package validation,
installed-app update or human acceptance is claimed.

## Superseded B-04 paragraph

Preserved from the pre-change backlog for provenance:

> Material/lighting parity, NPR, cloth, and the rigged export path have landed.
> Experimental stock/applied clip/audio auditions, explicit manual clip selection,
> pause/resume/replay and native ambient sprite previews now exist. Retarget and verified cast-particle event joins remain open.
> Approximate sprite playback does not establish engine timing or full operator
> fidelity. Unknown hero/ability joins remain unavailable.
