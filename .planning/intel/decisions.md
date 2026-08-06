# Decisions (ADR intel)

Synthesized from ADR-classified docs. Precedence integers are manifest-supplied
(lower wins). `status: locked` reflects the classifier's `locked` flag, which is
set only for a terminal/Accepted status. Where a source declares its own status
line in different words ("shipped", "proposed", "Draft"), that wording is
preserved inside the decision text rather than being translated into a status.

---

## ADR-001: Steam OpenID as the sole identity provider
- source: docs/social-architecture-decisions.md
- status: locked (Accepted, 2026-05-15)
- decision: Use Steam OpenID 2.0 as the only login method in v1. No Discord, no email, no anonymous device IDs. Wrap auth behind an `IdentityProvider` interface from day one so Discord can be added later without rewriting handlers.
- scope: Grimoire Social, identity, authentication

## ADR-002: Like-only voting in v1
- source: docs/social-architecture-decisions.md
- status: locked (Accepted, 2026-05-15)
- decision: Single upvote ("like") per user per profile. No downvote, no rating.
- scope: Grimoire Social, voting model

## ADR-003: Cloudflare Workers + D1 + KV as the backend stack
- source: docs/social-architecture-decisions.md
- status: locked (Accepted, 2026-05-15)
- decision: Cloudflare Workers (HTTP), D1 (SQLite for relational data), KV (sessions + ephemeral state), Durable Objects (per-user rate windows). Hono as the HTTP framework.
- scope: Grimoire Social, backend stack, Cloudflare

## ADR-004: Durable Object for publish-window rate limiting
- source: docs/social-architecture-decisions.md
- status: locked (Accepted, 2026-05-15)
- decision: Use the Cloudflare Rate Limiting API binding for high-frequency limits where 10s/60s windows fit (likes, auth begin). For arbitrary windows (publish 1/10min, reports 5/day), use a Durable Object per Steam ID storing a `last_action_ts` map.
- scope: Grimoire Social, rate limiting

## ADR-005: API prefixed with `/v1/`, additive-only forever
- source: docs/social-architecture-decisions.md
- status: locked (Accepted, 2026-05-15)
- decision: All routes prefixed with `/v1/`. Once shipped, v1 is frozen: only additive changes (new optional request fields, new response fields, new endpoints). Breaking changes go to `/v2/` deployed alongside.
- scope: Grimoire Social, API versioning, wire format

## ADR-006: Inline gzipped profile blob in D1, not R2
- source: docs/social-architecture-decisions.md
- status: locked (Accepted, 2026-05-15)
- decision: Store the gzipped portable profile as a `BLOB` column in `published_profiles`. No R2 in v1. Revisit when user-uploaded preview images are added or median profile size exceeds ~10 KB.
- scope: Grimoire Social, storage

## ADR-007: Strict free-tier budget for v1
- source: docs/social-architecture-decisions.md
- status: locked (Accepted, 2026-05-15)
- decision: All v1 infrastructure runs on Cloudflare's free tier. Total recurring cost $0/year plus ~$12/year if a domain is purchased. Upgrade trigger: sustained 70% of any free-tier resource for a week.
- scope: Grimoire Social, infrastructure budget

## ADR-008: Skip Phase 0 (curated GitHub-only); ship full backend directly
- source: docs/social-architecture-decisions.md
- status: locked (Accepted, 2026-05-15)
- decision: Skip Phase 0 (static curated profiles in a GitHub repo). Build Phase 1 (full backend) directly. Mitigation: pre-seed Discover with featured profiles before launch (ADR-012).
- scope: Grimoire Social, delivery sequencing

## ADR-009: No comments in v1
- source: docs/social-architecture-decisions.md
- status: locked (Accepted, 2026-05-15)
- decision: No comment system in v1. Reactions are limited to the like button. Communication happens out-of-band (Discord). Revisit in Phase 2.
- scope: Grimoire Social, engagement surface, moderation cost

## ADR-010: Hand-rolled Steam OpenID 2.0 verification on Workers
- source: docs/social-architecture-decisions.md
- status: locked (Accepted, 2026-05-15)
- decision: Implement OpenID 2.0 verification manually using `fetch` (~80 lines): redirect to Steam's `checkid_setup`, receive callback, POST the params back with `openid.mode=check_authentication`, parse `is_valid:true`, extract SteamID64 from `openid.claimed_id`.
- scope: Grimoire Social, authentication implementation, Workers runtime

## ADR-011: Async safeStorage on the client; refuse to persist on Linux without a secret store
- source: docs/social-architecture-decisions.md
- status: locked (Accepted, 2026-05-15)
- decision: Use Electron's async safeStorage API (`isAsyncEncryptionAvailable`, async encrypt/decrypt). On Linux, if no real secret store is available, refuse to persist the token; the user re-logs each launch.
- scope: Grimoire Social, client session storage, Linux secret store

## ADR-012: Pre-seed featured profiles before launch
- source: docs/social-architecture-decisions.md
- status: locked (Accepted, 2026-05-15)
- decision: Hand-build 10-20 featured profiles before public launch. `published_profiles.is_featured` surfaces them in a "Featured" rail at the top of Discover, regardless of like count.
- scope: Grimoire Social, cold start, Discover feed

## ADR-013: D1 free-tier hard-cliff is a real risk; alert at 70% usage
- source: docs/social-architecture-decisions.md
- status: locked (Accepted, 2026-05-15)
- decision: Alert at 70K writes/day (70% of the 100K free-tier ceiling) and pre-emptively upgrade to Workers Paid before any high-traffic share. Show "service is busy, try again later" on 5xx publish/like, never a generic error.
- scope: Grimoire Social, capacity risk, D1 limits

## ADR-014: Account deletion = hard-delete user, soft-delete published profiles
- source: docs/social-architecture-decisions.md
- status: locked (Accepted, 2026-05-15)
- decision: `DELETE /v1/me` hard-deletes the `users` row and all the user's `likes`, soft-deletes their `published_profiles` (sets `deleted_at`), and invalidates all their sessions.
- scope: Grimoire Social, account deletion, privacy

## ADR-015: Shared types via Zod schemas package
- source: docs/social-architecture-decisions.md
- status: locked (Accepted, 2026-05-15)
- decision: Wire-format types live in a single `@grimoire/social-types` package. The Worker validates inbound bodies with Zod schemas exported from that package; the client imports the same Zod schemas for IPC payload typing and runtime validation of responses.
- scope: Grimoire Social, wire format, type sharing

## ADR-016: Owner-only PATCH for title + description on published profiles
- source: docs/social-architecture-decisions.md
- status: locked (Accepted, 2026-05-16)
- decision: Add `PATCH /v1/profiles/:id` (owner-only, `requireAuth`) updating `title` and `description` only. It does NOT touch the share blob or any derived field (`mod_count`, `has_nsfw`, `primary_hero`, `heroes`, `thumbnail_urls`); mutating the mod set still goes through unpublish + republish. Not gated by the publish DO.
- scope: Grimoire Social, profile editing, API surface

## ADR-017: Phase 1.5 write paths: coalesced view counts, paced revalidation cron
- source: docs/social-architecture-decisions.md
- status: locked (Accepted, 2026-07-28)
- decision: Views never touch D1 on the request path; `GET /v1/profiles/:id` hands the view to a sharded `ViewCounterDO` (8 shards) via `executionCtx.waitUntil`, flushed to D1 on a 5-minute alarm. Owner's own views are not counted. GameBanana revalidation runs on a weekly cron (`17 4 * * 1`), oldest-check-first, strictly serial at 250 ms spacing (4 req/sec), hard budget of 500 requests and 200 profiles per run, with a `mod_availability` table memoizing verdicts for 6 days. Probe results are three-state; inconclusive probes are neither cached nor recorded. `mods_available` is NULL until checked and clients must render that as unknown, never as "all available".
- scope: Grimoire Social, view counts, mod availability revalidation, D1 write budget

## Global Mods (the priority root)
- source: docs/locker-global-mods.md
- status: locked (source declares "Status: shipped")
- decision: A Global mod lives in `citadel/grimoire` instead of `citadel/addons`. That folder is the first `Game` line in the canonical SearchPaths block, and earlier lines win, so a Global mod beats every other mod on any file they share; the launch shuffle never disables one. The word "Global" deliberately means two things: `globalType`/`GlobalModType` is the classification axis (UI label "General") and `priorityMod`/`PRIORITY_TAB` is precedence/placement (UI label "Global"); code names and UI labels deliberately do not match because `globalType` is a persisted sidecar field whose rename would require a metadata migration. Invariants: the sidecar flag is the source of truth, not the folder; scanning (`getModScanRootPaths`) and allocating (`getAddonFolderPaths`) are deliberately different views and the priority root is never an allocation target; the scan skips the reserved range (pak01-pak04, owned by `lockerVpk.ts`, with `PRIORITY_FIRST_SLOT` = 5); `metaKeyFor` namespaces the folder as `grimoire/<file>`; load order goes through exactly one helper per side (`addonFolderIndex` main, `modLoadOrder` renderer); reorder skips priority-root mods, so Global survives profile switches and `priorityMod` is not carried in the portable profile format; placement changes are failure-atomic. There is no overflow for the priority root: it is one folder with one SearchPaths line, and at capacity `PRIORITY_LIMIT_MESSAGE` tells the user to remove one. Shuffle rules: a Global mod is never added to `disableIds`, a Global skin is dropped from the eligible pool, and Global mods are excluded from the `activeLockerSkin` avoid-current lookup.
- scope: citadel/grimoire priority root, priorityMod, globalType, modLoadOrder, shuffle planner, reserved Locker VPKs, metadata sidecar, Locker Global tab

## Fork divergence policy
- source: docs/fork-divergence-policy.md
- status: proposed (no Status field in source; written 2026-07-29 as seven standing rules)
- decision: Strategy is upstream-first, fork-selective: upstream is the default product-design authority for shared UI; absorb their general UX and structural improvements early, keep fork work narrow and composable, and invest scarce design attention in Grimoire-specific workflows (Locker, Foundry, staging, safe mod composition). The cost model is duplicated intent, not commit distance. Rule 1: check upstream's branches before starting a lane. Rule 1a: start with a thin vertical slice. Rule 2: build additively, in new files, because a new file is cheap to carry and an edit to a shared file is not. Rule 3: default to upstream on shared surfaces; the fork owns the consistency floor, the Foundry forge path and staged edits, and the performance card's surface, while upstream owns `src/pages/Settings.tsx` and `src/components/settings/**`, preset data and the applier's data model, and release plumbing and auto-update config. Rule 4: absorb on upstream's release cadence. Rule 5: send the generic work upstream. Rule 6: QoL lock is a quality gate, not a freeze (Understand / Control / Recover / Stay consistent / Prove it). Rule 6a: collect smoke evidence, do not demand it up front; a missing record means unverified manually, not blocked. Rule 7: keep the delivery workflow boring. Per absorption, record one of three verdicts (take / keep / port) per upstream UI commit, and resolve at the level of the verdict, never hunk by hunk.
- scope: fork divergence, upstream absorption, merge cost model, Settings.tsx ownership, Locker, Foundry, performance config, QoL lock, delivery workflow

## Fork maintenance policy
- source: docs/fork-maintenance.md
- status: proposed (no Status field in source)
- decision: This is an independent product fork; `main` is the integration branch and the authoritative source for releases, and work does not need to be shaped around an upstream pull request. Fetch `upstream/main` regularly and merge or selectively adopt; record fork-specific decisions in this repository. Attribution is mandatory on every surface that carries upstream's work: the GitHub repo description names the original project and disclaims affiliation, the README states the fork relationship near the top, Settings has an About block, the welcome modal says it on first run, and the Ko-fi link pays Slush97 and must never be labelled as the fork's own. Credit strings belong in `src/locales/en/translation.json`, and when the meaning of one changes, delete the key and add a new one rather than rewording in place. Branch hygiene: integrate completed work into `main` promptly, delete merged branches, and do not keep duplicate "-upstream" branches. Engine policy: the sibling `../vpkmerge` fork carries the engine behavior this app relies on; the stock `v0.19.0` download remains a fallback only until the fork publishes a versioned, checksum-pinned release, which must be promoted in `scripts/fetch-vpkmerge.mjs` rather than silently tracking a moving binary.
- scope: fork maintenance, upstream intake, attribution, Ko-fi donation copy, branch hygiene, releases, vpkmerge engine

## Performance config integration
- source: docs/performance-config-integration.md
- status: proposed (source status line reads "six selectable presets shipped, generated from pinned upstream commits")
- decision: Curate a small set of pinned upstreams (`Sqooky/OptimizationLock` and `dacooderr/OptiLock`, both GPL-3.0) rather than building a generic "apply any GameBanana gameinfo.gi config" ingester, which the recorded research shows cannot be made safe or low-maintenance (no reliable baseline, every config carries a full FileSystem/SearchPaths block, machine-specific `video.txt`, boolean-encoding chaos, and configs that disagree and contain author bugs). Do nothing for QOL Lock: it is a plain VPK the normal mod pipeline already handles. Six presets shipped, selected by id: `sqooky-default` (balanced, default), `sqooky-testing`, `boot-max-fps`, `kaizu-min-spec`, `optilock-fps`, `optilock-max`, generated into `performanceConfigData.ts` (never hand-edited) by `pnpm perf:presets` from pins in `scripts/performance-presets.json`. Invariants: patch in place, never replace the file; never touch FileSystem/SearchPaths (`fixGameinfo` in `system.ts` owns it); markers record stock values so Remove restores the original; LF-normalize before patching and restore EOL on write; switching preset removes the applied one by its markers first. Creator gameplay convars (visibility and camera framing) are stripped from every preset body at generation time and exposed as individual opt-in controls, enforced by `optIn.patterns` in the generator rather than a hand-audited list. `citadel_unit_status_use_new` is on `exclude.keys` because the fork already ships a stronger HUD toggle; `citadel_unit_status_hide_names` keeps upstream's `optIn.keys` classification. Explicitly out of scope: generic ingestion of arbitrary GameBanana gameinfo.gi configs, auto-applying `video.txt`, and dyson-style full-file replacement configs.
- scope: gameinfo.gi performance configs, performanceConfig.ts, performanceConfigData.ts, Sqooky/OptimizationLock, dacooderr/OptiLock, preset UI, video.txt, FileSystem/SearchPaths

## Ability VFX layer + recolor
- source: docs/ability-vfx-recolor.md
- status: proposed (source status line reads "shipped, with roster coverage essentially complete", re-verified 2026-07-28)
- decision: Two related capabilities for a hero's ability VFX, independent of the body skin: extract a hero's ability VFX as a standalone addon so a recolor can ride on top of any body skin, and recolor those abilities to an arbitrary new color in app. The load-bearing decision is that particle recolor must be a byte-faithful **in-place scalar patch** (`morphic::patch_kv3_resource_scalars`), never a KV3 re-encode: the encoder downgrades KV3 v5 to v4 and drops value flags and typed array tags, so the engine fails to bind resource references and renders the Source 2 error particle. There are three colour mechanisms, not two: particle params, model/self-illum textures, and baked mesh vertex colors (the ult horse/knight), and a complete recolor needs all three. Hue is set (absolute), while saturation and brightness are scaled (default 1.0), all in 8-bit display space, so one hue value lands particles, textures, and vertex colors on the same colour; neutral pixels stay neutral. LDR (8-bit) textures only; HDR is refused with a clear error. Meshopt vertex buffers are never re-encoded; they are decoded, colour-edited, and stored uncompressed. A standalone `vpkmerge particle recolor` subcommand was deliberately dropped in favour of composing the primitive inside `recolor-hero`, `prism`, and `trippy-vfx`. Trippy VFX drives off the same `HeroRecolorRecipe` write-set as the colour recolor and differs only in how each file is written. 38 heroes carry a pinned recipe (`COLOR_CODENAME_BY_HERO`, `RECIPE_CACHE_VERSION` v7); the bundled engine is the tagged, pinned `vpkmerge v0.19.0` release.
- scope: ability VFX, particle recolor, vpkmerge, detectVfxLayer, extractVfxLayer, HeroColorPicker, heroColors service, KV3 patching, hero dragon material

## UI conventions
- source: docs/ui-conventions.md
- status: proposed (no Status field in source)
- decision: House rules for the Grimoire renderer, aiming at uniformity by default. Tokens, not raw values: no raw hex in `className`/`style`, no raw Tailwind palette colors where a semantic token exists, prefer `text-text-primary` over `text-white` because the accent foreground flips by luminance at runtime and literal whites cannot. Components, not ad-hoc markup: use `Button`/`IconButton`, the `forms.tsx` primitives, `PageLayout`/`PageHeader`/`EmptyState`/`LoadingState`/`PageToolbar`/`ViewModeToggle`, `Modal`/`ConfirmModal`/`Menu`/the toast store, `Tag`/`Badge`/`Skeleton`. Visual scale: `rounded-sm` is the default and `rounded-full` only for pills/avatars; focus is `focus-visible:ring-2 focus-visible:ring-accent`, never `focus`; the canonical form-control surface is `bg-bg-tertiary border border-white/5 rounded-sm`. Hard rules: no em-dashes anywhere, every visible string is an i18n key added to `src/locales/en/translation.json` with `pnpm i18n:manifest` run, and `pnpm typecheck` + `pnpm lint` after UI changes.
- scope: design tokens, src/components/common, Button, IconButton, form controls, PageLayout, Modal, Menu, toast store, Tag, Badge, Skeleton, radius scale, focus rings, z-index ladder, i18n keys

## Upstream boundary map
- source: docs/upstream-boundary-map.md
- status: proposed (no Status field in source; generated 2026-07-30 against `upstream/main` at `f401f87`)
- decision: Classify every file under `src/` and `electron/` as fork-only or shared-and-modified so a change can be aimed at the cheap side of the line before it is written. Fork-only files do not exist upstream and cost nothing at merge time; prefer putting fork behaviour there. Shared-and-modified files are paid for again at each absorption, so a change there should be small or should move the logic into a fork-only module. Totals: 169 fork-only, 97 shared-and-modified, 0 deleted-from-upstream. Notes worth acting on: `src/pages/Settings.tsx` shows +106 / -1840 because upstream has grown a large Settings surface this fork has not taken, and absorbing it will be a project of its own rather than a merge; `performanceConfigData.ts` (+2742) and `performanceConfig.ts` (+475) are the single largest divergence and are almost pure data, so upstreaming any of it is worth more than carrying it; `translation.json` (+1044) diverges on every pass that adds copy and must be merged carefully because a bad merge is invisible until a string renders.
- scope: fork-only files, shared-and-modified files, upstream merge cost, churn vs upstream, src/, electron/, Settings.tsx, performanceConfigData.ts, translation.json

## Release maintenance and artifact retention
- source: docs/release-maintenance.md
- status: proposed (no Status field in source; operator checklist)
- decision: GitHub Releases are the permanent archive and a published release is never deleted to reclaim local disk, because old installers are the supported rollback path. The APT repository is intentionally latest-only and its publish job removes the previous `.deb`. In the local `release/` directory keep the current and previous version and move older ones into `release/archive-<version>/`. Never overwrite an existing version's installers: a corrected build must use a new version number. The release sequence is: clean tree and merge `upstream/main` (regenerating the locale manifest on translation conflicts), update `package.json` and `CHANGELOG.md`, validate the exact release commit with `pnpm typecheck` / `pnpm lint` / `pnpm test`, rebuild and select the sibling `vpkmerge` if required, produce Windows artifacts with `GRIMOIRE_FORK_BUILD` and `GRIMOIRE_SOCIAL_BASE_URL` set (the social URL is required so a packaged app cannot point at a development service), verify hashes and smoke-test the portable build, then push the release commit and an immutable version tag. Do not describe Linux or macOS artifacts as shipped until their build matrix is re-enabled. Advance the pinned `onionviolet/vpkmerge` revision in `.github/workflows/release.yml` deliberately, after validating the engine change locally.
- scope: release process, artifact retention, GitHub Releases, APT repository, Windows packaging, vpkmerge, release workflow

## Third-party notices
- source: docs/third-party-notices.md
- status: proposed (no Status field in source; classifier confidence medium)
- decision: This app is an independent fork of Grimoire (created by Slush97), neither affiliated with nor endorsed by the original project; both are MIT licensed, and the mod engine bundled in `resources/vpkmerge` is also Slush97's work. The Ko-fi link in Settings and the Discord invite carried throughout the app both belong to the upstream project and its author, not to this fork, and their labels must stay explicit about that. Foundry converts non-MP3 audio locally with `ffmpeg-static` (GPL-3.0-or-later); the selected audio and temporary conversion output never leave the computer, and release engineering must retain this notice and the license/source information for the exact distributed binary. The Chat Wheel icon previews (`src/assets/chatlane-icons/*.svg`) are vendored from RedMser/ChatLane (MIT), whose LICENSE is distributed alongside the bundled converter executable and covers the artwork as well.
- scope: Grimoire upstream fork attribution, vpkmerge, ffmpeg-static, FFmpeg, ChatLane chat wheel icons, Ko-fi and Discord links
