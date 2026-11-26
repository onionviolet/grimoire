<!-- Source for Codex. Claude Code loads the twin .claude/rules/build-packaging.md by paths: frontmatter. Keep the text below identical in both files. -->
# Build, packaging and dependencies

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

## Gotchas that have shipped bugs

- **New main-process runtime deps must be bundled.** `build.externalizeDeps` leaves prod deps as bare imports, and `electron-builder.yml` strips `node_modules` except an explicit native allowlist. Add the package to the `exclude` list in `electron.vite.config.ts`, or every packaged user crashes on launch. After `pnpm build`, `grep -c 'Could not resolve "' dist/main/index.js` must print `0`.
- **`@grimoire/social-types` stays in `devDependencies`.** It is bundled into `dist/` at build time via `electron.vite.config.ts` (`externalizeDeps.exclude`), so `electron-builder.yml` does not need to allowlist it in `app.asar`.
- **pnpm 12 is pinned in `package.json`.** `engines.pnpm` rejects other versions locally and `pnpm/action-setup` reads `devEngines.packageManager` in CI. Keep `onFail: "ignore"`: any other value makes pnpm write a second YAML document into `pnpm-lock.yaml`, GitHub's dependency graph reads only the first, and Dependabot silently loses every dependency and marks open alerts fixed. Keep the version free of `>`, `<` and `^`, because the action passes it through `cmd.exe` unquoted on Windows. `pnpm-workspace.yaml` is tracked: it holds the `allowBuilds` list, and `better-sqlite3` stays `false` there because its install script deletes the binary on a failed build.

## Key Config Files

- `electron.vite.config.ts` - Three Vite builds: main (Node), preload (CJS), renderer (React)
- `electron-builder.yml` - Packaging targets and auto-update config
- `tsconfig.json` / `tsconfig.app.json` / `tsconfig.node.json` - TypeScript configs (strict mode)
- `eslint.config.js` - ESLint 9 flat config with TypeScript + React plugins
