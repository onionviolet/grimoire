# Grimoire

## What This Is

Grimoire is a mod manager and companion tool for Deadlock (Valve's hero shooter), shipped as an Electron 35 desktop app for Windows and Linux. It browses and installs mods from GameBanana, manages what is installed and in what order, organizes cosmetics per hero in the Locker, authors new assets in the Foundry (sound swaps, texture and icon replacement, ability VFX recolor, combined builds), and carries companion surfaces for player stats, crosshairs, autoexec, profiles, and the Deadworks server browser.

This repository is an independent product fork of Slush97/grimoire, maintained at onionviolet/grimoire. `main` is the integration branch and the authoritative source for releases; the fork does not shape work around an upstream pull request, but it does absorb upstream on upstream's cadence.

## Core Value

A Deadlock player can change their game and always know exactly what changed, who owns it, and how to undo it.

## Current State

**Shipped: v1.27 "verified, supported, coherent" (2026-08-10).** Six phases and
32 plans landed and were archived: the fork's game-facing paths now carry an
automated verification record (23 rows settled by a CDP runner, 18 engine-tier
rows deferred with reasons), the fork ships as a supported release with a
pinned engine and decided social disposition, the Foundry build contract is
complete (recolor/model edits join combined builds), Locker and Foundry share
one object model, global inventory reads as one inventory, and community tools
hand their built VPKs into the app. Human in-game verification for phases 3-5
is deferred by explicit user decision (out-of-game tool; VPK-level work is
deterministic); the milestone audit records the accepted gaps.

**Shipped: v1.27.1 "absorb, review, ship" (2026-08-10).** The fork absorbed
upstream v1.27 verbatim (DeadlockForge 1-click installs over a loopback bridge,
GameBanana mirror routing with fileserver failover, the download-servers
diagnostics card, crosshair rasterization like the game, and the VPK
`treeSize` clamp), resolved its version scheme to 1.27.1, produced the first
retroactive six-pillar UI reviews of the shipped frontend phases (03-06) with
the copy-contract fixes, and shipped the fork's own GitHub Release with
installer, checksums, and provenance attestations.

## Next Milestone Goals

**v1.27.5 "Chat Wheel parity"** (in progress): bring the embedded Chat Wheel
editor to parity with the original ChatLane tool. SEED-001 (generic
local-install protocol for browser-built VPKs) stays dormant for a future
milestone. Carried debt includes the two pre-existing Linux-CI test issues
(encoding-check fixture decoding; download-capture symlink sweep), the standing
deferred in-game verification rows, and the Nyquist VALIDATION.md reconciliation
TODO.

## Current Milestone: v1.27.5 "Chat Wheel parity"

**Goal:** The embedded Chat Wheel editor reaches parity with the original
ChatLane: users can browse and toggle the base-game voice command catalogue
(both override maps), see the game's documented limitations where they bite,
build and reorder menus by drag-and-drop, get warned before removing an add-on
that must be unbound first, and optionally dress the preview with the game's
own art. The untested VPK read/starter paths close, and the fork ships v1.27.5.

**Target features:**
- Base command catalogue (`src/lib/chatWheelCommands.ts`) + override-editing UI for `override_bindable` / `override_ping_wheel_bindable`
- Known-limitations disclosures, radial-preview arrow-key nav, drag-and-drop menu building
- Unbind-before-delete safety warning; game-asset wheel dressing spike (SVG stays the fallback)
- Close the `chat-wheel:read`/`starter` test gap; release v1.27.5

**Key context:** SEED-001 stays dormant (future milestone seed); deferred
in-game verification from v1.27 stays tracked, not re-scoped; upstream stays
read-only and commit messages never carry bare upstream PR numbers. Versioning
stays below upstream (1.27.5, not 1.28) so a fork patch can never overtake the
upstream version line.

## Requirements

### Validated

Shipped and confirmed in the codebase. Full evidence per item is in `.planning/REQUIREMENTS.md` under "Delivered".

- Mod install, catalog sync, conflicts, profiles, portable profile export/import, stats, crosshair, autoexec, Deadworks servers
- Locker: hero cosmetics, card apply pipeline, the `citadel/grimoire` priority root, global sound taxonomy driven by VPK entry paths, honest pose-failure states
- Foundry: exact-path asset source inspection, sound and visual staging with preflight, combined reviewed write set, forge to export or install, `My changes`, launch shuffle over contended pools, VPK identity gate and impostor reconcile
- Merge: read-only `analyze-merge` plus the renderer review and winner-first source ordering
- 3D hero preview: static posed export, Source 2 material and lighting parity, NPR, cloth, and a rigged sibling export (dev-gated)
- Social phase 1 and 1.5 client, plus the Worker-side revalidation cron and view counter (built, undeployed)
- UI consistency pass lanes 1 through 8 (shell rule, route resolver, `uiPrefs`, `useConfirm`, `SearchInput`, `useScrollRestore`, keyboard and assistive-tech floor)
- A supported fork release: pinned-SHA fork engine build with a release-workflow guard, support destinations moved to the fork's own issue tracker, `structural-refactor-7` merged and the branch set consolidated to `main` only, a decided (dormant) social service disposition recorded in ADR-018, and the last ungated experimental surface (Chat Wheel) closed. The in-game colour half of the engine-pin criterion stays an explicitly accepted `blocked` row (IG-23) pending a packaged build and a live Deadlock session - validated in Phase 2 (2026-08-07)
- Verified against the game: 23 app-tier verification rows settled by `pnpm verify:in-app`, 18 engine-tier rows deferred with per-row reasons, and the six Foundry render lanes under jsdom render tests - v1.27
- Foundry completes its build contract: recolor and model edits enter the combined reviewed build, sound shuffle is reachable from Foundry, pools audition every clip - v1.27
- Locker and Foundry as one object: 3D model stage with pop-out, pre-write disclosure that names owners, portrait variant awareness, hero-grid authored-state badges - v1.27
- One inventory, one journey: Global reads as one inventory with a tri-state view, the portrait alias sweep verdicts are recorded for all 15 mismatch heroes, every reversible bulk action offers one-shot undo with a rendered blocker line, and provenance is one phrase and one target - v1.27
- Community tools land inside Grimoire: a checked browser destination catalog, disclose-before-write tool-download handoff with VPK identity gating, and an unchanged webview hardening floor - v1.27

### Active

The v1.27.5 milestone (confirmed scope):

- [ ] Base command catalogue: typed readonly `chatWheelCommands.ts`, provenance-pinned to the bundled ChatLane release
- [ ] Override-editing UI for `override_bindable` and `override_ping_wheel_bindable` (search/filter/browse; unknown entries preserved byte-for-byte)
- [ ] Known-limitations disclosures near the relevant controls; radial-preview arrow-key nav
- [ ] Drag-and-drop menu building and wheel reordering (keyboard alternatives preserved)
- [ ] Unbind-before-delete safety warning on Chat Wheel removal
- [ ] Game-asset wheel dressing spike (SVG stays the permanent fallback)
- [ ] Close the `chat-wheel:read`/`starter` main-process test gap
- [ ] Release engineering: package.json 1.27.5, CHANGELOG, tag v1.27.5, GitHub Release

### Out of Scope

- **Foundry models, VFX, and broad thumbnail browsing (slice G)**: blocked on a trustworthy path catalog; adjacent UI existing is not a reason to start
- **Social phase 2 (comments, search, follows, collections, Discord OAuth)**: moderation cost postponed deliberately; re-decide before starting, do not drift into it
- **Merge recipes, path policy, and composition UX (milestones 4b to 4d)**: assessed 2026-07-28 as the least important item on the board: pure groundwork with no standalone user benefit
- **`video.txt` auto-apply**: machine-specific; guided merge only
- **A general raw-ConVar editor as the default experience**: expert editing, if ever added, goes behind a warning in its own marked managed block
- **Locker overflow renderer polish (W11)**: marked optional; only if a user-visible problem appears
- **Cross-manager compatibility claims for the portable profile format**: the format is Grimoire-only in copy, whatever the schema permits
- **Hosting a Deadworks game server**: joining is cross-platform, hosting requires Windows and is not our surface

## Context

**This is a large mature codebase, not a greenfield project.** 169 fork-only files and 97 shared-and-modified files under `src/` and `electron/`; the fork leads upstream by roughly 225 commits at v1.26.20 against upstream v1.26.0. `.planning/codebase/` holds the current map.

**Doc status headers in this repo have drifted badly behind the code, repeatedly and in both directions.** The 2026-07-28 spec audit found four claims wrong in the code's favour (combined output, audio transcoding, the VFX recolor roster, the rigged 3D spine) and one wrong in the doc's favour. Work has been started three times on things that already shipped. Verify against the tree before planning anything, and prefer `.planning/REQUIREMENTS.md` "Delivered" over any doc's own status line.

**Verification debt was the dominant risk and is now a recorded, accepted one.** The v1.27 milestone drove 23 app-tier rows over CDP against a live dev build (`pnpm verify:in-app`), added jsdom render coverage to the six Foundry lanes, and deferred the 18 engine-tier rows plus the phases 3-5 human checks by explicit user decision (out-of-game tool; VPK-level work is deterministic). The full suite now stands at 1931 tests across 175 files. Nobody has yet started Deadlock and confirmed the engine loads what the app says it will; that remains deferred by decision and is tracked in the milestone audit.

**Three product decisions are open and must not be settled by an implementer.** Where installed global sound inventory lives; whether the portrait and Cards journey is defined before its code consolidates; and what the Locker hero page's target state is. All three are recorded in `.planning/INGEST-CONFLICTS.md` and carried as competing requirement variants; they route to `/gsd-discuss-phase`.

**The ingest that produced this planning set ran with an overridden blocker gate.** Three cross-reference cycles held nine source docs out of `.planning/intel/`, including the delivery contract (`docs/feature-status.md`) and the verified ground truth (`docs/audit-2026-07-28-verdicts.md`). Those nine were read directly when this roadmap was written. If the ingest is re-run, break the cycles first.

**Development can be checked, not guessed at.** `scripts/dev-driver.mjs` drives the running renderer over CDP, so a check can be a question about the DOM rather than a guess about pixels. Numbered dev slots (`GRIMOIRE_DEV_SLOT`) isolate userData but not the game install.

## Constraints

- **Tech stack**: Electron 35 + electron-vite, React 19, React Router 7, TypeScript 5.9 strict, TailwindCSS 4, Zustand, better-sqlite3, pnpm. Two SQLite databases (`mods-cache.db`, `stats.db`), both WAL with foreign keys.
- **Process boundary**: main owns secrets (session tokens, API keys) and all file, SQLite, and external-API work; the renderer reaches it only through the context-isolated preload bridge. The social session bearer lives in main-process memory and `SocialSessionStatus` carries no token field. Never regress this.
- **Ownership key**: exact normalized VPK entry paths decide who owns what. Labels, hero names, and mod metadata are never a substitute. Installed and the Locker are the only authority for enabled state. A Foundry action may open, request, or display a mod-store change but may never silently change load order or overwrite a third-party VPK. A failed or unreadable inspection blocks the ambiguous action and leaves every installed mod untouched.
- **`gameinfo.gi`**: Grimoire owns and rewrites the entire SearchPaths block, so any mount point must be a conditional line inside the canonical block, never added out of band.
- **Upstream boundary**: a new fork-only file is cheap to carry; an edit to a file upstream also owns is paid for again at every absorption. Aim changes at the cheap side before writing them. `src/pages/Settings.tsx` and `src/components/settings/**` are upstream's; reach them from new modules.
- **Compatibility**: additive-only wire and file formats. Grimoire Social `/v1/` is frozen. The portable profile format bumps MINOR for additive changes and readers refuse an unknown MAJOR. `vpk-modinfo` evolves additively within a major version. Multi-folder overflow keying is deliberately asymmetric to avoid a migration.
- **Canonical VPK identity**: the original, pre-first-imprint whole-file sha256, fixed at first imprint and never recomputed from already-imprinted bytes.
- **Privacy**: no telemetry, no phone-home. Discoverable social content is gated behind explicit navigation. The catalog is built locally from the user's own paks.
- **House style**: no em-dashes anywhere, including comments and planning files. Every visible string is an i18n key in `src/locales/en/translation.json`; `pnpm i18n:check` and a regenerated `src/locales/manifest.json` are CI and pre-push gates, as is `pnpm encoding:check`.
- **Repository gate**: `pnpm typecheck && pnpm lint && pnpm test`, plus `pnpm i18n:check` and `pnpm i18n:manifest` when a catalog key changed. `pnpm build` additionally requires `GRIMOIRE_SOCIAL_BASE_URL` set to an https value.
- **Attribution**: every surface carrying upstream's work names the original project and disclaims affiliation. The Ko-fi link pays Slush97 and must never be labelled as the fork's own.

## Locked Decisions

Accepted ADRs. These are binding and are not re-litigated by implementation work.

<decisions locked="true">

| ID | Decision | Scope |
|----|----------|-------|
| ADR-001 | Steam OpenID 2.0 is the sole identity provider in v1, behind an `IdentityProvider` interface | Social identity |
| ADR-002 | Like-only voting: one upvote per user per profile, no downvote, no rating | Social voting |
| ADR-003 | Cloudflare Workers + D1 + KV + Durable Objects, Hono as the HTTP framework | Social backend |
| ADR-004 | Rate Limiting API binding for 10s/60s windows; a Durable Object per Steam ID for arbitrary windows | Social rate limiting |
| ADR-005 | All routes prefixed `/v1/` and frozen once shipped: additive only, breaking changes go to `/v2/` | Social API versioning |
| ADR-006 | The gzipped portable profile is an inline D1 BLOB, not R2, in v1 | Social storage |
| ADR-007 | All v1 infrastructure runs on Cloudflare's free tier; upgrade trigger is 70% of any resource for a week | Social budget |
| ADR-008 | Skip Phase 0 (curated GitHub-only) and ship the full backend directly, mitigated by pre-seeded featured profiles | Social sequencing |
| ADR-009 | No comment system in v1; reactions are the like button only | Social engagement |
| ADR-010 | Hand-rolled Steam OpenID 2.0 verification on Workers using `fetch` | Social auth implementation |
| ADR-011 | Async `safeStorage` on the client; on Linux without a real secret store, refuse to persist the token | Social client session |
| ADR-012 | Hand-build 10 to 20 featured profiles before public launch, surfaced by `is_featured` | Social cold start |
| ADR-013 | D1's free tier is a hard cliff: alert at 70K writes/day and show "service is busy" rather than a generic error | Social capacity |
| ADR-014 | Account deletion hard-deletes the user and their likes, soft-deletes their published profiles, invalidates sessions | Social privacy |
| ADR-015 | Wire-format types live in one Zod schemas package shared by Worker and client | Social wire format |
| ADR-016 | Owner-only `PATCH /v1/profiles/:id` updates title and description only; the share blob and derived fields are untouched | Social profile editing |
| ADR-017 | Views never touch D1 on the request path (8 sharded `ViewCounterDO`, 5-minute alarm flush); GameBanana revalidation is a weekly serial cron at 4 req/sec with a hard per-run budget and three-state probes; `mods_available` NULL means unknown, never "all available" | Social write paths |
| GLOBAL-MODS | A Global mod lives in `citadel/grimoire`, the first `Game` line in the canonical SearchPaths block, so it beats every other mod on any shared file and the launch shuffle never disables one. `globalType` is classification (UI label "General"); `priorityMod` is placement (UI label "Global"); the code names and UI labels deliberately do not match because `globalType` is a persisted sidecar field. The sidecar flag is the source of truth, not the folder; the priority root is never an allocation target; the scan skips reserved pak01 to pak04; load order goes through exactly one helper per side; reorder skips priority-root mods; there is no overflow for the priority root | Locker priority root |

</decisions>

## Standing Policy

Written policy that constrains how and where work is done. Recorded with the source's own status wording; none declares a literal Accepted status, but all are treated as binding by the docs that reference them.

<decisions locked="false" status="proposed">

| Policy | What it binds | Source |
|--------|---------------|--------|
| Fork divergence | Upstream-first, fork-selective. Check upstream branches before opening a lane; start with a thin vertical slice; build additively in new files; default to upstream on shared surfaces; absorb on upstream's cadence; send generic work upstream; treat the QoL lock (Understand, Control, Recover, Stay consistent, Prove it) as a quality gate not a freeze. The cost model is duplicated intent, not commit distance | `docs/fork-divergence-policy.md` |
| Upstream boundary map | 169 fork-only files cost nothing at merge; 97 shared-and-modified files are paid for again at each absorption. Aim a change at the cheap side before writing it. `Settings.tsx` absorption is a project of its own, not a merge | `docs/upstream-boundary-map.md` |
| Fork maintenance | Independent product fork; `main` is authoritative. Attribution is mandatory on every surface carrying upstream's work. Credit strings change by deleting the key and adding a new one. Delete merged branches; keep no duplicate "-upstream" branches. The stock vpkmerge v0.19.0 download is a fallback only until the fork publishes a versioned, checksum-pinned release | `docs/fork-maintenance.md` |
| Performance config integration | Curate a small set of pinned upstream presets rather than ingesting arbitrary GameBanana `gameinfo.gi` configs, which the recorded research shows cannot be made safe. Patch in place, never replace; never touch FileSystem or SearchPaths; markers record stock values so Remove restores the original. `performanceConfigData.ts` is generated, never hand-edited | `docs/performance-config-integration.md` |
| Ability VFX recolor | Particle recolor is a byte-faithful in-place scalar patch, never a KV3 re-encode: the encoder downgrades v5 to v4 and drops value flags, so the engine renders the error particle. Three colour mechanisms, not two (particle params, textures, baked vertex colors). LDR only. Meshopt vertex buffers are never re-encoded | `docs/ability-vfx-recolor.md` |
| UI conventions | Tokens not raw values (no raw hex, prefer `text-text-primary` because the accent foreground flips by luminance); shared components not ad-hoc markup; `rounded-sm` default; `focus-visible:ring-2 focus-visible:ring-accent`; no em-dashes; every visible string is an i18n key | `docs/ui-conventions.md` |
| Release maintenance | GitHub Releases are the permanent archive and a published release is never deleted. Never overwrite an existing version's installers; a corrected build takes a new version number. Windows artifacts are produced with `GRIMOIRE_FORK_BUILD` and `GRIMOIRE_SOCIAL_BASE_URL` set. Advance the pinned vpkmerge revision deliberately, after local validation | `docs/release-maintenance.md` |
| Third-party notices | This app is an independent fork of Grimoire (Slush97), neither affiliated with nor endorsed by it. The Ko-fi link and the Discord invite belong to the upstream project, not this fork, and their labels must stay explicit about that. `ffmpeg-static` is GPL-3.0-or-later and its notice and source information must be retained for the exact distributed binary; ChatLane icons are MIT and their LICENSE ships alongside the converter | `docs/third-party-notices.md` |

</decisions>

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Defer human in-game verification for phases 3-5 (2026-08-09, confirmed 2026-08-10) | Grimoire is an out-of-game tool; VPK work done correctly is deterministic, so in-game verification can be deferred by decision rather than blocking the milestone | ✓ Accepted - recorded in `.planning/milestones/v1.27-MILESTONE-AUDIT.md`; resume via `$gsd-verify-work 3/4/5` |
| The packaged Windows smoke record does not block a release (2026-07-28) | It is a human sitting in front of the game; gating on it stalled every release. Tracked as post-release verification, fix forward | Pending |
| This fork relies on the upstream social deployment (2026-07-29) | Forking `grimoire-social` means repointing the sibling remote, CI's hardcoded checkout, and the baked release URL, then deploying with migration 0005 | ✓ Revisited in Phase 2 (ADR-018, 2026-08-07): stays on the upstream Worker, wave-3 features (cron, view counter) stay dormant, client already degrades correctly |
| Availability fields absent means "this service does not report it", null means "not checked yet" | Without the split, every Discover card carried a permanent "not checked yet" badge advertising a check that was never coming | ✓ Good |
| An installed Foundry build is deliberately not a Locker skin | A build may be a portrait, an icon, a sound, or several at once; an active-skin card, a load-order slot, a shuffle entry, and a 3D merge source are all claims it cannot honour | ✓ Good |
| The Foundry shuffle pool is keyed on content hash, never `mod.id` or `metaKey` | Both are pakNN-derived and change on every toggle, so a persisted opt-in keyed on either would detach the first time it ran | ✓ Good |
| Staging never offers the install path's disable-or-replace resolutions | Staging installs nothing and must not mutate enabled state or precedence; it blocks on unreadable and otherwise asks for acknowledgement | ✓ Good |
| Serial waves, not eight parallel lanes | Nearly every lane appends to the same four files (`preload/index.ts`, `types/electron.ts`, `lib/api.ts`, `translation.json`), so extra lanes are pure merge tax with one or two people | ✓ Good |
| Audio conversion is bundled, not refused | `ffmpeg-static` is asar-unpacked and transcodes non-MP3 input before the mint path; the packaging cost was accepted | ✓ Good |
| The Sound Locker route was built, then folded back into the Locker shell | Two hero grids for one hero's content was the distance the lane set out to remove; legacy `/locker/sounds*` URLs are rewritten | ⚠️ Revisit (contested variant 1) |

---
*Last updated: 2026-08-11 at the start of v1.27.5 "Chat Wheel parity"*
