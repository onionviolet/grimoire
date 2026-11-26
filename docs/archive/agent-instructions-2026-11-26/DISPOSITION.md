# Disposition of the 2026-11-26 agent instruction split

Originals (verbatim): `AGENTS.original.md` (186 lines, 15407 bytes) and `CLAUDE.original.md` (226 lines, 18234 bytes). Line numbers below refer to those files.

Classes: **global** (repo-wide rule, now in root `AGENTS.md`), **subsystem** (now in a `docs/agents/<area>.md` and its `.claude/rules/<area>.md` twin), **status** (inventory or history, not an instruction), **duplicate** (said again elsewhere). Action `moved` means the text is verbatim in the destination (the root may also carry a shorter form). Action `drop` rows are the only intentional losses; `coverage_check.py` reads them.

Note: `.gitignore` ignored `.claude/*` except `settings.json`; `!.claude/rules/` was added so the rule twins are tracked.

| File | Lines | Class | Action | Destination or reason |
|---|---|---|---|---|
| AGENTS.md | 1 | status | drop | Title of the old file, replaced by the root title |
| AGENTS.md | 3 | global | moved | `docs/agents/github-boundary.md`; root carries the fork statement |
| AGENTS.md | 5-18 | global | moved | `docs/agents/github-boundary.md`; condensed in root "GitHub boundary" |
| AGENTS.md | 20-47 | subsystem | moved | `docs/agents/github-boundary.md` (root keeps the never-cite-upstream-numbers rule) |
| AGENTS.md | 49-66 | subsystem | moved | `docs/agents/github-boundary.md` |
| AGENTS.md | 68-71 | global | moved | `docs/agents/github-boundary.md`; condensed in root |
| AGENTS.md | 75, 77 | global | moved | root `AGENTS.md`, verbatim |
| AGENTS.md | 79-92 | global | moved | `docs/agents/build-packaging.md`; condensed in root "Commands" |
| AGENTS.md | 94 | global | moved | root `AGENTS.md` "Done means", verbatim |
| AGENTS.md | 96-108 | subsystem | moved | `docs/agents/main-process.md` |
| AGENTS.md | 112 | global | moved | root "Hard rules", verbatim sentence plus "Replies too." |
| AGENTS.md | 113, 114, 116 | subsystem | moved | `docs/agents/main-process.md`; condensed in root |
| AGENTS.md | 115 | subsystem | moved | `docs/agents/social.md`; condensed in root |
| AGENTS.md | 117 | global | moved | `docs/agents/topic-docs.md`; condensed in root |
| AGENTS.md | 118 | global | moved | `docs/agents/i18n.md`; condensed in root |
| AGENTS.md | 122-127 | subsystem | moved | `docs/agents/renderer-ui.md` |
| AGENTS.md | 131, 133 | subsystem | moved | `docs/agents/i18n.md` |
| AGENTS.md | 137, 138, 143 | subsystem | moved | `docs/agents/build-packaging.md` |
| AGENTS.md | 139 | subsystem | moved | `docs/agents/testing.md` |
| AGENTS.md | 140-142 | subsystem | moved | `docs/agents/main-process.md` |
| AGENTS.md | 145-161 | subsystem | moved | `docs/agents/topic-docs.md` (root routes to it) |
| AGENTS.md | 165 | subsystem | moved | `docs/agents/main-process.md` |
| AGENTS.md | 166-167 | subsystem | moved | `docs/agents/renderer-ui.md` |
| AGENTS.md | 168 | global | moved | root "Done means", verbatim |
| AGENTS.md | 171-186 | global | moved | Managed portable-rules block, byte-identical, at the end of root `AGENTS.md` |
| CLAUDE.md | 1, 3 | status | drop | Title and `@AGENTS.md` import, re-created in the new `CLAUDE.md` |
| CLAUDE.md | 5 | duplicate | drop | Restates AGENTS.md line 75; AGENTS.md is newer |
| CLAUDE.md | 7-17 | status | drop | Feature inventory; discoverable from README.md and `docs/feature-status.md` |
| CLAUDE.md | 18 | subsystem | moved | `docs/agents/topic-docs.md` "Feature notes" |
| CLAUDE.md | 19-20 | status | drop | Feature inventory (conflict detection, player stats) |
| CLAUDE.md | 21 | subsystem | moved | `docs/agents/topic-docs.md` (keeps the `experimentalDeadworksServers` gate) |
| CLAUDE.md | 22 | status | drop | Feature inventory (auto-update) |
| CLAUDE.md | 24-31 | status | drop | Stale stack list (says Electron 35; package.json and AGENTS.md say 44); discoverable from package.json |
| CLAUDE.md | 33-51 | status | drop | Hand-kept file tree, stale and discoverable; AGENTS.md architecture bullets own the layout |
| CLAUDE.md | 53-60 | duplicate | drop | Same content as AGENTS.md lines 96-102 |
| CLAUDE.md | 62-72 | duplicate | drop | Superseded by AGENTS.md Commands (`pnpm rebuild:electron` replaces `electron-rebuild`) |
| CLAUDE.md | 76-139 | subsystem | moved | `docs/agents/dev-driver.md`; the slot rule is also in root "Commands" |
| CLAUDE.md | 143-146 | subsystem | moved | `docs/agents/main-process.md` |
| CLAUDE.md | 150-153 | subsystem | moved | `docs/agents/build-packaging.md` |
| CLAUDE.md | 155-157 | status | drop | Test-coverage description (3D hero lib focus); `pnpm test` is in root |
| CLAUDE.md | 159-171 | subsystem | moved | `docs/agents/topic-docs.md` "Doc details" |
| CLAUDE.md | 175-178 | subsystem | moved | `docs/agents/social.md` |
| CLAUDE.md | 179 | duplicate | drop | Says import wire types from `../grimoire-social/src/shared/schemas.ts`; superseded by AGENTS.md line 115 (`@grimoire/social-types` package) |
| CLAUDE.md | 180-184 | subsystem | moved | `docs/agents/social.md` (text still says "planned" for Discover.tsx, which now exists; left verbatim) |
| CLAUDE.md | 188 | subsystem | moved | `docs/agents/i18n.md` |
| CLAUDE.md | 190-193 | subsystem | moved | `docs/agents/i18n.md` (line 192 describes on-demand catalog download; AGENTS.md line 133 says catalogs are bundled; both kept, reconcile when i18n is next touched) |
| CLAUDE.md | 197-201 | subsystem | moved | `docs/agents/encoding.md` |
| CLAUDE.md | 205 | duplicate | drop | Same rule as AGENTS.md line 112; "replies" folded into the root rule |
| CLAUDE.md | 206 | duplicate | drop | Same rule as AGENTS.md line 117 |
| CLAUDE.md | 207 | duplicate | drop | Same rule as AGENTS.md line 114 |
| CLAUDE.md | 208 | subsystem | moved | `docs/agents/main-process.md` (the per-API limits are unique) |
| CLAUDE.md | 211-226 | global | moved | Managed block, byte-identical, kept in the new `CLAUDE.md` |

Headings (lines starting with `#`) are structural and are skipped by the check. No GSD routing line existed in either original, so none was carried over.

One edit to moved text: CLAUDE.md line 180 had an em dash (banned by the repo rule); in `docs/agents/social.md` it reads "locked: additive-only". The check normalizes that one character.
