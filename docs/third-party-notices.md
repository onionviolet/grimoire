# Third-party notices

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
