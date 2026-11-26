<!-- Source for Codex. Claude Code loads the twin .claude/rules/social.md by paths: frontmatter. Keep the text below identical in both files. -->
# Social layer and grimoire-social

- **Wire-format types come from `@grimoire/social-types`** (published as a compiled release tarball from `Slush97/grimoire-social` and pinned in `package.json`). Never redeclare them here. Social routes are `/v1/*`, additive only; breaking changes go to `/v2/`.

The social layer (publish profiles, browse, like) lives in a separate repo at `../grimoire-social`. It's a Cloudflare Worker (Hono + D1 + KV + Durable Objects) consumed exclusively by this desktop client.

When you're working on social features in this repo:


- All social API routes are prefixed `/v1/`. Versioning is locked: additive-only changes (see `../grimoire-social/CLAUDE.md`).
- The session token (returned by Steam OpenID auth) lives in the main process via `safeStorage` (async API; refuse to persist on Linux without libsecret). **The renderer must never see the token.** New IPC handlers in `electron/main/ipc/social.ts` will attach the bearer in the main process.
- Social UI lives in `src/pages/Discover.tsx` and `src/components/social/`. Existing `src/components/profiles/ImportProfileDialog.tsx` is reused as the import surface from a discovered profile.

If the parent design needs to change (API surface, schema, identity provider), update `docs/social-architecture.md` and add an ADR to `docs/social-architecture-decisions.md` rather than editing existing ADRs.
