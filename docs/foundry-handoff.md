# Foundry handoff (next agent)

Picking up the Grimoire **Foundry** tab. Read [foundry-tab-design.md](./foundry-tab-design.md)
for the full vision. This file is the "where we are / what's next" snippet.

Refreshed against `main` at v1.24.0. Everything below was re-verified against the
code rather than carried forward; the previous revision described a pre-merge
world (unpushed branches, three sub-tabs still `soon`, an engine binary without
`catalog`) that main had long since overtaken.

Sound annotations have since landed on `main`. Global Sound Forge rows and hero
gameplay/voice rows share one annotation seam: local names and notes keyed by
event plus first clip path, persisted in an atomic user-data JSON store and
reached through the preload bridge. Import validates the envelope, rejects
malformed or unsupported shapes, bounds key length and entry count, normalizes
text, and merges without discarding existing entries. Because the key is event
plus clip path, annotations survive catalog refreshes. Shared-pool warnings are
the next feature: they must say whether a swap affects one event, an inherited
base event, or the shared melee clip pool. QOL Lock content remains out of scope.

## State

**Engine.** `vpkmerge` v0.19.0 is the pinned release (`VPKMERGE_VERSION` in
`scripts/fetch-vpkmerge.mjs`), and it ships the whole catalog + replace surface:

```
vpkmerge catalog voiceline|herosounds|texture|voiceclip|heroes|cache [--json]
vpkmerge soundswap --from-vpk <pak> (--clip <ENTRY> | --event <NAME> (--hero <CODE> | --soundevents <ENTRY>))
                   --audio <mp3> [--trim-start/--trim-end] [--gain-db] [--loop] [--pool] --encode-vpk <OUT>
vpkmerge icon --template-vpk <pak> --set <ENTRY>=<user.png> --encode-vpk <OUT>
vpkmerge recolor-hero | prism | vmat | trippy-*
```

There is no longer a release gate on any shipped Foundry feature: the bundled
binary has everything the GUI calls. A locally built CLI still overrides via
`$VPKMERGE_BINARY`, and `pnpm dev` also auto-detects a sibling
`../vpkmerge/target/release/vpkmerge` build.

**GUI.** All five sub-tools in `SUBTOOLS` (`src/pages/Foundry.tsx`) are
`enabled: true`. The rail is the tool-first *Catalog* mode; the default landing
is now hero-first (`HeroWorkshop.tsx`).

| Sub-tool | Browse | Replace |
|---|---|---|
| Library | yes, grid + lightbox | n/a |
| Sound | yes, hero gameplay + VO | yes, `foundry:swapSound` (drop MP3, mint, install as a tracked local mod) |
| Texture | yes, `TextureBrowse` grid + lightbox | **no, the remaining work** |
| Items | yes, `item-icon` slice | no, same |
| Recolor | n/a | yes, `RecolorTool` wraps the Locker's `HeroEffectsPanel`, bakes and applies |

So browse is finished everywhere and the sound half of replace is finished. The
one genuinely unbuilt thing is **drag-and-drop texture/item replace**, ask 3.

Key files: `src/pages/Foundry.tsx` (shell) ·
`src/components/foundry/{LibraryBrowse,SoundBrowse,TextureBrowse,RecolorTool,SoundImportEditor,TextureGrid,TextureCard,TextureLightbox}.tsx`
· `src/components/foundry/useClipPlayer.ts` (shared audition) ·
`electron/main/services/foundryCatalog.ts` (engine bridge, thumbnail cache,
`grimoire-foundry:` protocol) · `electron/main/ipc/foundry.ts` ·
`electron/main/ipc/mods.ts` (`foundry:swapSound`) · `src/lib/api.ts` ·
`src/types/foundry.ts`.

## Ask 3: drag-and-drop replace for textures and items, the remaining work

The engine verb is built and in-game-proven:

```
vpkmerge icon --template-vpk <pak01_dir.vpk> --set <ENTRY>=<user.png> --encode-vpk <OUT_dir.vpk>
```

`vpkmerge-core/src/icon.rs` reads the template `.vtex_c` for its format + dims,
resizes the user PNG, and splices via `morphic::replace_mip_chain` **in the
template's own format** (BC7/DXT5, not inline PNG), packing it at the entry path
so it overrides in place. This is exactly the Locker custom hero-card upload
path (`electron/main/services/customHeroCards.ts`, the only `icon --set` caller
in the main process today).

To ship it, reuse the existing build-VPK-then-install-as-tracked-mod pattern:
`electron/main/ipc/mods.ts` `import-soul-container-glb` and the sound-swap
handler both do build, allocate ENABLED slot, copy, write metadata. Mirror it as
`forge-texture-replace`: drop PNG on a `TextureCard`, run `vpkmerge icon --set
<card.entry>=<png>`, install as a local mod.

**BLOCKER, still open on this repo's pinned engine:** the icons being browsed
(`item-icon` / `ability-icon`) include **DXT5-YCoCg** textures. `icon` re-encodes
new pixels as raw DXT5 but keeps the template's `RED2` block, which still carries
the `YCoCg Conversion` special-dependency. In-engine, YCoCg flag + non-YCoCg data
renders garbled colors, so a naive drag-drop replace of a YCoCg icon looks wrong.

What makes this nastier than "some textures need a fix": YCoCg is **mixed inside
the item-icon category**, not absent from it. A pak-wide scan found 197 YCoCg
textures out of 12,561, and among item icons
`panorama/images/items/brawl/aerial_mastery_psd.vtex_c` is uncompressed
`Bgra8888` while `panorama/images/items/spirit/suppressor_psd.vtex_c` is
DXT5-YCoCg. An unfixed replace therefore works or garbles depending on which icon
the user happens to drop on, which is harder to debug than uniformly broken.

Detection already exists (`morphic::TextureInfo.ycocg`, set from `RED2`). Fixes,
in preference order: YCoCg-**encode** on the write path (inverse of
`morphic::apply_ycocg`); strip the YCoCg special-dependency from `RED2` on
re-encode; or re-encode to a non-YCoCg format and clear the flag.
[Slush97/vpkmerge#43](https://github.com/Slush97/vpkmerge/pull/43) proposes the
first. It is **open, not merged**, so treat this blocker as live until that lands
and the pin here is bumped.

## Still open (smaller)

- **Randomizer pools audition only `vsnd[0]`.** `useClipPlayer` plays the first
  clip of the pool. 35% of indexed global events carry more than one clip (max
  58), so this hides most of what a pool actually sounds like. The *swap* is
  unaffected: it runs `--pool all` and overrides every clip.
- **Events that only inherit a `base` template are skipped.** The catalog drops
  any event with no own `vsnd_files`, so e.g. `Abrams.Wpn.Whizby` is absent
  entirely while `Yamato.Wpn.Whizby` (which overrides) is present. Not
  auditionable or swappable at this layer; needs `base` inheritance resolved in
  `vpkmerge-core/src/catalog.rs`.
- **Ability display names are the soundevent codeword.** `Finesse`, not the
  localized in-game name. Needs the vdata join.
- **Asset lightbox for models and sounds.** Textures have one; models could reuse
  the Locker's `HeroPoseViewer` (R3F) via `vpkmerge model export ... --glb`.
- **Non-power-of-two display paths still uncropped** on the engine side:
  `vpkmerge-core/src/portrait.rs`, `recolor_texture_preview_png`, the old `gui/`
  preview. `morphic::crop_to_actual` exists; apply it there too.
- **Non-MP3 audio input.** `foundry:swapSound` rejects anything but `.mp3`
  (`soundswap` parses MP3 frame headers natively, no decoder). wav/ogg/flac needs
  either a bundled `ffmpeg-static` in Electron or a Rust decode crate in
  vpkmerge; the first costs roughly 80 MB on the packaged app, so it is a
  packaging decision rather than a code one.

## Key reuse patterns

- Spawn engine: `runVpkmerge` / `runVpkmergeStdout` (`services/modMerger.ts`);
  honors `$VPKMERGE_BINARY`, then a sibling dev build, then the bundled binary.
- Build-VPK-then-install-as-local-mod: `ipc/mods.ts` (`import-soul-container-glb`,
  `import-custom-mod`, `foundry:swapSound`).
- Serve generated images to the sandboxed renderer: custom protocol scheme, see
  `registerFoundryThumbnailProtocol` / `grimoire-soul:`.
- Audition: `ensureVoiceclip(vsndPath)` runs `catalog voiceclip`, caches under
  `userData/foundry-voiceclips/<fingerprint>/<sha1>.mp3`, returns a
  `data:audio/mpeg` URL. It accepts the index's `.vsnd` path directly (the CLI
  normalizes to the packed `.vsnd_c`). **CSP:** `data:` must stay in `media-src`
  (prod-only CSP, `electron/main/index.ts`) or audition breaks in packaged builds.

## Verify quickly

```bash
# The bundled binary already has catalog; build only if you're changing the engine.
cd vpkmerge && cargo build --release -p vpkmerge-cli
PAK=~/.local/share/Steam/steamapps/common/Deadlock/game/citadel/pak01_dir.vpk
target/release/vpkmerge catalog texture --vpk "$PAK" --category item-icon --thumbs /tmp/t --thumb-size 128

# grimoire dev (auto-detects the sibling build above; $VPKMERGE_BINARY overrides)
cd ../grimoire && pnpm dev
# (experimentalFoundry is already enabled in ~/.config/grimoire/settings.json)
```
