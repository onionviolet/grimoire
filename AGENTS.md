# Repository boundary rules

This workspace is the fork `onionviolet/grimoire`.

## GitHub scope

- Treat `origin` (`onionviolet/grimoire`) as the only repository that may be
  changed.
- Treat `upstream` (`Slush97/grimoire`) as read-only. Do not create, edit,
  comment on, close, reopen, label, assign, lock, transfer, or otherwise
  mutate upstream issues, pull requests, discussions, releases, or projects.
- Every mutating GitHub CLI/API command must name the target explicitly with
  `--repo onionviolet/grimoire` (or the equivalent API path). Never rely on
  the CLI's inferred repository.
- Before any mutating GitHub action, state the exact `owner/repository` and
  object number being changed, then verify it matches `onionviolet/grimoire`.
- If a task needs an upstream change, stop and ask for explicit direction. Do
  not use a fork-side action as a substitute.

## Cross-reference hygiene

- Do not mention upstream issue or pull-request identifiers in GitHub-facing
  fork content: commit messages, issue/PR titles or bodies, review comments,
  release notes, or discussion posts. GitHub can create an automatic backlink
  in the upstream timeline from such references.
- Record upstream provenance in repository files (for example `docs/`) when
  it is useful; GitHub does not create conversation backlinks from repository
  file contents.
- If a GitHub-facing fork issue or pull request must link upstream, use a
  `https://redirect.github.com/<owner>/<repo>/issues/<number>` URL instead of
  a GitHub issue shorthand or `github.com` URL. GitHub documents that this
  avoids generating a backlink.
- Do not use closing keywords for upstream objects in fork commits or pull
  requests.
- Treat existing automatic cross-references as benign metadata, not comments
  authored by an agent. Do not rewrite published history merely to remove one
  unless the user explicitly requests the history rewrite and accepts a
  force-push.
- A backlink is one-way and permanent. This was measured, not assumed: fork
  issues 6/13/17/18 were edited to replace their bare upstream numbers with
  redirect URLs, and every `cross-referenced` event stayed in the upstream
  timeline afterwards. Removing the referencing text is a fix for the next
  reader, never for the event. Prevention is the only control that works.
- Text inside backticks is inert. Fork issue 13 quoted an upstream commit
  title containing `(#113)` inside a code span and upstream 113 shows no
  backlink from it, while the bare numbers elsewhere in the same body all
  linked. Quoting a commit subject verbatim is fine if it stays in a code span.

## Enforcement

- `scripts/check-upstream-refs.mjs` fails a commit message that carries a bare
  `#n` in the upstream number range, a `Slush97/<repo>#n` reference, or a
  `github.com` upstream issue/PR URL. Backticked text and `redirect.github.com`
  URLs pass. Commits reachable from `upstream/main` are exempt, so merging
  upstream's own `(#326)` squash subjects does not trip it.
- It runs in three places: `.husky/commit-msg` (the message being written),
  `.husky/pre-push` via `pnpm refs:check` (catches amend, rebase and
  cherry-pick, which route around commit-msg), and the "Upstream backlink
  guard" step in `.github/workflows/ci.yml` (catches `--no-verify` and pushes
  from a machine without hooks installed).
- The bare-number rule keys off `UPSTREAM_NUMBER_FLOOR` in that script: fork
  issue numbers are two digits, upstream's are three. Raise the floor before
  fork numbering reaches it, or the gate will start rejecting our own refs.
- No gate exists for issue, PR, or comment bodies typed into GitHub; nothing
  local sees them. Those are covered by the rules above and by using
  `redirect.github.com` every time.

## Git remotes

- Fetching from `upstream` is allowed when needed for comparison or merging.
- Push only to `origin` unless the user explicitly authorizes another remote.

# Grimoire

Desktop mod manager for Deadlock (Valve). Electron 44 + React 19 + TypeScript 5.9 + Tailwind 4, pnpm. Ships for Windows, Linux (AppImage, deb, AUR, Flatpak) and macOS (Apple Silicon only, ad-hoc signed, no auto-update: see `docs/macos.md`).

Single maintainer. Part of the `grimoire-workspace` monorepo-ish root; sibling repos (`../grimoire-social`, `../vpkmerge`, ...) have their own `AGENTS.md`/`CLAUDE.md`.

## Commands

```bash
pnpm install                                     # postinstall fetches Electron and the pinned vpkmerge binary
pnpm dev                                         # predev auto-rebuilds better-sqlite3 for Electron, then runs electron-vite with HMR
pnpm rebuild:electron                            # force-rebuild better-sqlite3 for Electron's ABI
pnpm rebuild:node                                # build better-sqlite3 for plain Node (for SQLite vitest suites)
pnpm typecheck                                   # tsc -b: covers src/ AND electron/
pnpm lint
pnpm test                                        # vitest run (node env, no DOM)
pnpm i18n:check && pnpm i18n:manifest            # after touching any locale catalog
pnpm build                                       # needs GRIMOIRE_SOCIAL_BASE_URL set (any URL works locally)
pnpm package:linux | package:win | package:mac
```

Before calling a change done: `pnpm typecheck && pnpm lint && pnpm test` (plus `pnpm ui:check` for renderer UI). CI (`.github/workflows/ci.yml`) runs lint, the `ui:check` design-system ratchet, `tsc -b`, vitest, the i18n gates, then `electron-vite build`. The husky pre-push hook also runs encoding, upstream-reference, UI and engine-pin gates.

## Architecture

Electron multi-process with context isolation on and `nodeIntegration` off.

- `electron/main/`: Node side. `ipc/*` registers `ipcMain.handle` channels; `services/*` holds the logic (file I/O, SQLite, VPK work, external APIs, archive extraction).
- `electron/preload/index.ts`: the `contextBridge` API. Pure pass-through, no logic.
- `src/`: React renderer. `pages/` (routes, HashRouter), `components/` (feature folders + `common/` primitives), `stores/` (Zustand), `lib/` (pure helpers, most of the unit tests), `types/`, `locales/`.

**Adding an IPC method:** declare it once in the `ElectronAPI` interface in `src/types/electron.ts`, add the one-line bridge in `electron/preload/index.ts` (checked with `satisfies ElectronAPI`), then the handler in `electron/main/ipc/*`. **Adding a setting:** field in `AppSettings` (`src/types/mod.ts`) plus its default in `electron/main/services/settings.ts`.

Runtime data lives in the Electron `userData` dir: `mods-cache.db` (GameBanana catalog mirror + FTS5), `stats.db` (player stats), `unknown-crc-cache.db`, `settings.json`, `mod-metadata.json`, `profiles.json`, `interchange-ledger.json`, plus asset caches.

Heavy VPK/model/texture/sound work shells out to the bundled `vpkmerge` CLI (`resources/vpkmerge/`, version + sha256 pinned in `scripts/fetch-vpkmerge.mjs`).

## Hard rules

- **No em-dashes**, anywhere: UI strings, comments, docs, commit messages. Use a colon, period or parens.
- **No telemetry.** No analytics, usage pings or heartbeats. On its own the app only talks to services the user chose: GitHub for the app update check (which has a setting) and GameBanana for the catalog refresh, the Installed mod update check and mod thumbnails. Everything else waits for a click or an opt-in. Every request is listed on the privacy guide page (`src/content/docs/privacy.md` in `../grimoire-site`, published at grimoiremods.com/docs/privacy), so a new one needs an entry there. One that sends user data somewhere the user didn't choose also needs an off switch.
- **Main process owns secrets.** API keys and the social session token (stored via `safeStorage`) never reach the renderer. The main process attaches auth headers itself.
- **Wire-format types come from `@grimoire/social-types`** (published as a compiled release tarball from `Slush97/grimoire-social` and pinned in `package.json`). Never redeclare them here. Social routes are `/v1/*`, additive only; breaking changes go to `/v2/`.
- **External APIs go through a rate limiter** in `electron/main/services/rateLimiter.ts` (GameBanana, deadlock-api, Steam community, GitHub). New integrations reuse that pattern.
- **The portable profile format is Grimoire-only.** Don't claim compatibility with other mod managers in copy.
- **Visible strings are i18n keys** (see below). Never hardcode user-facing copy.

## UI and design

Read `docs/ui-conventions.md` before any renderer UI work. The short version:

- Reuse the primitives in `src/components/common/` (`ui.tsx`, `forms.tsx`, `PageComponents.tsx`, `Modal.tsx`, `menu.tsx`, `ToastStack.tsx`) before writing markup.
- Colors come from the tokens in `src/index.css` `@theme`, never raw hex or raw Tailwind palette colors.
- **The accent color is user-chosen at runtime** (`src/lib/accentColor.ts` rewrites `--color-accent*`), and so is the theme: dark, OLED or light (`src/lib/theme.ts`; each swaps the surface and ink tokens). Orange `#f97316` is only the default. Always use `accent`/`accent-hover`/`accent-foreground` utilities and never design around a specific hue.
- The z-index ladder is documented at the top of `src/index.css`. Don't invent new z values.

## i18n

`src/locales/en/translation.json` is the source of truth and the only catalog translators see (via Weblate). It must contain only keys actually referenced by `t()`/`<Tx>`. `src/locales/unwired-en.json` is an English-only to-do list of hardcoded strings still to be wired. It is never bundled or translated.

After any catalog change run `pnpm i18n:manifest`, or CI and pre-push fail. Translations come back on `translations/<lang>` branches. The app reads the manifest from `raw.githubusercontent.com/Slush97/grimoire/main`, but every catalog in the repo at build time is bundled, and a bundled language only updates with a release. Only a language added after the release is downloaded and refreshed from `main`. Full flow: `docs/localization.md`.

## Gotchas that have shipped bugs

- **New main-process runtime deps must be bundled.** `build.externalizeDeps` leaves prod deps as bare imports, and `electron-builder.yml` strips `node_modules` except an explicit native allowlist. Add the package to the `exclude` list in `electron.vite.config.ts`, or every packaged user crashes on launch. After `pnpm build`, `grep -c 'Could not resolve "' dist/main/index.js` must print `0`.
- **`@grimoire/social-types` stays in `devDependencies`.** It is bundled into `dist/` at build time via `electron.vite.config.ts` (`externalizeDeps.exclude`), so `electron-builder.yml` does not need to allowlist it in `app.asar`.
- **Tests run on Node 24 in CI** with no DOM. Node provides a global `navigator`, but `window` and `document` are still unavailable. Renderer modules that access DOM APIs at import time can fail every test that transitively imports them. Watch the test count, not just pass/fail.
- **The CSP only applies to packaged builds.** `pnpm dev` has none, so "works in dev, broken packaged" bugs (especially 3D previews over `grimoire-hero:`/`grimoire-soul:`/`blob:`) usually mean the `connect-src` in `electron/main/index.ts` needs updating.
- **vpkmerge version coupling.** A feature that needs a new vpkmerge flag or subcommand requires a vpkmerge release first, then a bump of the version + 3 sha256s in `scripts/fetch-vpkmerge.mjs`. `pnpm dev` hides the break when a locally built binary sits in `resources/vpkmerge/`.
- **Mod mutations are serialized.** Enable/disable/reorder share an in-process lock (`withModMutationLock` / `runExclusiveModMutation` in `electron/main/services/mods.ts`) because racing `pakNN` slot writes clobbered VPKs. Route new mutating operations through it.
- **pnpm 12 is pinned in `package.json`.** `engines.pnpm` rejects other versions locally and `pnpm/action-setup` reads `devEngines.packageManager` in CI. Keep `onFail: "ignore"`: any other value makes pnpm write a second YAML document into `pnpm-lock.yaml`, GitHub's dependency graph reads only the first, and Dependabot silently loses every dependency and marks open alerts fixed. Keep the version free of `>`, `<` and `^`, because the action passes it through `cmd.exe` unquoted on Windows. `pnpm-workspace.yaml` is tracked: it holds the `allowBuilds` list, and `better-sqlite3` stays `false` there because its install script deletes the binary on a failed build.

## Read before touching

| Area | Doc |
|---|---|
| Manager-neutral mod transfer | `docs/mod-interchange.md` |
| Portable profiles (`mp1:` codes, `.modprofile.json`) | `docs/profile-spec.md` |
| Social layer, ADRs (append-only, never edit a shipped ADR) | `docs/social-architecture.md`, `docs/social-architecture-decisions.md` |
| `gameinfo.gi` handling, Deadworks servers | `docs/deadworks-servers.md` |
| `citadel/grimoire` priority root, load order | `docs/locker-global-mods.md` |
| macOS / CrossOver, `steamRoots.ts`, `bottleLaunch.ts` | `docs/macos.md` |
| Ability VFX recolor (`detectVfxLayer`/`extractVfxLayer`) | `docs/ability-vfx-recolor.md` |
| Performance config presets | `docs/performance-config-integration.md` |
| Crosshair math | `docs/crosshair-geometry.md` |
| Foundry ("Door Stuck") | `docs/foundry-tab-design.md` |
| VPK embedded metadata | `docs/vpk-modinfo-spec.md`, `docs/vpk-metadata-embed-integration.md` |
| GameBanana API | `docs/gamebanana_api_reference.md`, `docs/gamebanana_categories_reference.md` |
| deadlock-api.com (stats) | `docs/deadlock-api-architecture.md`, `docs/DEADLOCK_STATS_API.md` |

## Working conventions

- Mod transfer uses the interchange format. DMM input is converted through the reader in `electron/main/services/modInterchange/`, and new source managers are registered in `electron/main/ipc/modInterchange.ts`.
- `Installed.tsx` and `Browse.tsx` are god files (thousands of lines). Put new features in their own components under `src/components/<feature>/` rather than growing them. When splitting, make move-only PRs with no behavior or visual change mixed in.
- Experimental features are gated behind `experimental*` settings (see `AppSettings`) and default off.
- Commits: imperative, conventional-style subjects (`fix(installed): ...`, `feat: ...`). PRs are squash-merged. Branch protection has no required checks, so `gh pr merge --auto` merges immediately: check `gh pr checks` first.


<!-- BEGIN PORTABLE AGENT RULES v1 -->
<!-- PORTABLE AGENT RULES MODE: global -->
## Working agreement source

The portable agreement is owned by the planning vault's
`_templates/portable_agent_rules.md`. `~/.claude/scripts/sync_user_prefs.py`
generates `~/.claude/user-preferences.md` and `~/.codex/AGENTS.md`.
Claude loads the former through `~/.claude/CLAUDE.md`; Codex loads the latter
as global instructions. Apply that already-loaded agreement without rereading it.
If your host did not load global preferences, read the corresponding generated
file once. If neither exists, read the canonical vault template before working.

This managed pointer is generated by the vault's
`.claude/scripts/sync_agent_rules.py`; edit its template, not repository copies.
Text outside the BEGIN/END markers belongs to this project.
<!-- END PORTABLE AGENT RULES v1 -->
