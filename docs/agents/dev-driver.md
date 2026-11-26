<!-- Source for Codex. Claude Code loads the twin .claude/rules/dev-driver.md by paths: frontmatter. Keep the text below identical in both files. -->
# Dev driver and in-app verification

`scripts/dev-driver.mjs` talks to the renderer over the Chrome DevTools Protocol, so a check can be a question about the DOM ("what do these rows say?") rather than a guess about pixels. Start the app with the port open, then drive it:

Use a numbered slot whenever another agent might be running a dev build. One
setting derives the Vite port, CDP port, and isolated user-data directory:

```bash
GRIMOIRE_DEV_SLOT=2 pnpm dev
GRIMOIRE_DEV_SLOT=2 node scripts/dev-driver.mjs route foundry
```

Slot 2 uses Vite `5175`, CDP `9224`, and a `<userData>-dev2` directory. Slot 0
keeps the normal ports and data directory; an unslotted `pnpm dev` is therefore
unsafe in a parallel session. `GRIMOIRE_DEV_CDP_PORT` remains an explicit CDP
override. Confirm the target before trusting it with
`node scripts/dev-driver.mjs eval "window.__GRIMOIRE_DEV_SLOT"`.

**A slot copies the real profile on its first boot** (`devSlotSeed.ts`), so it
opens with actual mods, settings, and caches rather than looking like a fresh
install. Without this a slot is close to useless for feature work: every mod
renders as `PakNN` because `mod-metadata.json` is missing, and the nav loses
every entry gated on a setting. Chromium's own profile state is deliberately
left behind, both because it must stay distinct and because it is ~90% of the
bytes. The copy happens on creation only; after that the slot owns its state.
Set `GRIMOIRE_DEV_SEED=0` for a genuinely blank slot, which is what onboarding,
first-run and migration work want. Delete the slot directory to re-seed.

The slots isolate userData, **not the game install**. Two slots toggling mods
are writing to the same addons directory.

**Measuring anything that renders needs `GRIMOIRE_DEV_NO_BACKGROUNDING=1`.**
Chromium suspends `requestAnimationFrame` and throttles timers to about 1Hz for
a window it considers hidden, and on Windows "hidden" includes a window merely
covered by other windows. On an unattended machine that means zero frames, so a
frame-time or animation check silently measures nothing. The trap is that
`shot` keeps working the whole time: `Page.captureScreenshot` forces a capture
regardless, so a screenshot shows a correctly rendered scene while the renderer
is producing no frames at all. A screenshot cannot tell you the renderer is
running. Check `document.visibilityState` and confirm rAF actually ticks before
trusting any timing number.

```bash
GRIMOIRE_DEV_SLOT=2 GRIMOIRE_DEV_NO_BACKGROUNDING=1 pnpm dev
```

Env-gated for the same reason the CDP port is, and never set in a packaged
build. It changes only whether Chromium keeps scheduling work for an
unfocused window, not what gets rendered.

```bash
node scripts/dev-driver.mjs route foundry
```

Commands: `eval`, `evalfile` (for expressions that lose a fight with shell quoting), `text <sel>`, `html <sel>`, `click <sel>`, `fill <sel> <value>`, `select <sel> <value>`, `route <name>`, `viewport <w> <h>`, `shot <file.png>`, `targets`. Selectors support a synthetic `:has-text(...)`, e.g. `button:has-text(My changes)`.

`shot` writes a PNG that can be read back, so visual checks are possible. Prefer `text`/`html` anyway: they say *why* something is wrong, a screenshot only says *that* it looks wrong.

**`pnpm verify:in-app`** (`scripts/verify-in-app.mjs`) is a purpose-built driver on the same CDP transport, not a general-purpose command: it settles the 23 app-tier rows of `docs/ingame-verification-record.md` unattended, forging, installing, enabling, disabling, and merging real mods through `window.electronAPI` and reading the resulting VPKs back with its own parser. A pass there proves Grimoire wrote the intended bytes to the intended path; it proves nothing about whether the Source 2 engine actually loads, plays, or draws them, which stays a `docs/ingame-verification-record.md` engine-tier row. The same slot rule applies and is enforced in code: never slot 0, never an unslotted app, and the runner refuses to start until it has confirmed the live `window.__GRIMOIRE_DEV_SLOT` matches. Run `node scripts/verify-in-app.mjs --dry-run` first; it prints the full plan and touches nothing.

Notes:

- The port is env-gated, not `is.dev`-gated, because it evaluates arbitrary code in the renderer. It is never set in a packaged build (`electron/main/index.ts`).
- The app mounts a HashRouter, so `route` sets `location.hash`; driving `pathname` changes the URL bar and nothing else.
- This drives the **working tree**, not the installed Grimoire. Uncommitted changes are what you are testing. The installed build is a separate app with its own userData, so it is not affected by anything done here.
- Opening `localhost:5173` in a plain browser is not a substitute: `window.electronAPI` is absent there, so anything touching IPC fails.
