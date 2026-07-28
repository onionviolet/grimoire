# Contributing to Grimoire

Thanks for your interest in contributing.

## Development setup

Requirements:

- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/) 9+
- [Git](https://git-scm.com/)

Grimoire shares its social API types with
[grimoire-social](https://github.com/Slush97/grimoire-social) via the
`@grimoire/social-types` workspace dependency, which resolves to a **sibling
checkout**. Clone both into the same parent directory:

```bash
git clone https://github.com/Slush97/grimoire-social.git
cd grimoire-social && pnpm install && cd ..

git clone https://github.com/Slush97/grimoire.git
cd grimoire
pnpm install
pnpm exec electron-rebuild -f -w better-sqlite3
pnpm dev
```

The layout `pnpm install` expects:

```
parent/
├── grimoire/          # this repo
└── grimoire-social/   # sibling, with its own `pnpm install` run
```

`grimoire-social` needs its own install because the shared package declares
`zod` as a peer dependency and resolves it from its own `node_modules`.

If the sibling is missing, `preinstall` (`pnpm check-siblings`) fails with the
clone command. Skipping that check leaves you with a `pnpm install` that
reports success and a `pnpm typecheck` that fails with unresolved-module errors.

## Code style

- TypeScript everywhere
- `pnpm lint` before committing
- CI runs typecheck and build on every PR

## Project layout

| Directory | Purpose |
|-----------|---------|
| `electron/main/services/` | Backend logic (mods, downloads, API calls) |
| `electron/main/ipc/` | IPC handlers connecting frontend to backend |
| `src/pages/` | Page components |
| `src/components/` | Reusable UI components |
| `src/stores/` | Zustand state |

## Workflow

1. Fork the repo
2. Branch from `main` (`git checkout -b feat/my-feature`)
3. Make changes with conventional-commit messages
4. Test locally
5. Open a PR

Conventional commit prefixes used in this repo: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, `ui:`, `ci:`.

## Reporting issues

Include:

- Steps to reproduce
- Expected vs actual behavior
- OS and app version
- Relevant logs (Electron's main-process log lives in `%APPDATA%/Grimoire/logs/` on Windows)

## AI Usage
AI contributions are allowed
