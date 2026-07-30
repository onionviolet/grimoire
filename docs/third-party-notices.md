# Third-party notices

## Grimoire (upstream) and vpkmerge

This app is an independent fork of Grimoire, the Deadlock mod manager created
by Slush97, and is neither affiliated with nor endorsed by the original
project. Both are MIT licensed. The mod engine bundled in `resources/vpkmerge`
is also Slush97's work: the fork builds from `onionviolet/vpkmerge`, itself a
fork of the upstream engine, and falls back to the pinned upstream release (see
`scripts/fetch-vpkmerge.mjs`).

- Grimoire (upstream): https://github.com/Slush97/grimoire (MIT)
- grimoiremods.com: https://grimoiremods.com
- vpkmerge (upstream): https://github.com/Slush97/vpkmerge
- vpkmerge (fork build): https://github.com/onionviolet/vpkmerge

The Ko-fi link in Settings and the Discord invite carried throughout the app
both belong to the upstream project and its author, not to this fork. Keep
their labels explicit about that.

## FFmpeg / ffmpeg-static

Foundry converts non-MP3 audio locally with the `ffmpeg-static` npm package
(pinned in `package.json`). It invokes a platform-specific FFmpeg executable;
the selected audio and temporary conversion output never leave the computer.

- `ffmpeg-static`: https://github.com/eugeneware/ffmpeg-static (GPL-3.0-or-later)
- FFmpeg: https://ffmpeg.org/
- FFmpeg source and licensing: https://ffmpeg.org/legal.html
- Windows binary supplier: https://www.gyan.dev/ffmpeg/builds/

Release engineering must retain this notice and the license/source information
for the exact distributed binary. `ffmpeg-static` identifies each prebuilt
binary's source in its package/release metadata.

## ChatLane chat wheel icons

The Chat Wheel page's icon picker previews (`src/assets/chatlane-icons/*.svg`)
are vendored from RedMser/ChatLane (`GUI/ping_icons/`), the same MIT-licensed
project whose converter CLI Grimoire bundles in `resources/chatlane` (its MIT
`LICENSE` file is distributed alongside the executable and covers this artwork
as well).

- ChatLane: https://github.com/RedMser/ChatLane (MIT)
