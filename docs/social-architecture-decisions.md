# Grimoire Social: Architecture Decision Records

A log of the load-bearing decisions made while planning Grimoire Social. Each entry is short by design — the *why* matters, not the prose. Companion to `social-architecture.md`.

**Format:** Status / Context / Decision / Consequences / Alternatives considered. Each ADR is self-contained; later ADRs may supersede earlier ones, never edit them in place.

---

## ADR-001: Steam OpenID as the sole identity provider

**Date:** 2026-05-15
**Status:** Accepted

**Context.** Publishing and voting need a stable per-user identity. Grimoire's audience is Deadlock players, who all have Steam accounts. We need something that's free, sticky (hard to throwaway), and gives us a unique ID with minimal integration cost.

**Decision.** Use Steam OpenID 2.0 as the only login method in v1. No Discord, no email, no anonymous device IDs.

**Consequences.**
- (+) Free, no new account for the user, ties social identity to in-game identity (good for reputation and bans)
- (+) Hand-rolled OpenID verification on Workers is ~80 lines; one POST back to Steam
- (-) Locks out players who don't want to associate Steam with publishing
- (-) Single point of failure if Steam ever drops OpenID 2.0 (deprecated by Google et al., still alive at Steam)
- (-) Requires a Steam Web API key (free, tied to a domain)

**Alternatives considered.** Discord OAuth (extra account, broader reach but less sticky). Anonymous device IDs (vote stuffing trivial). Email magic links (needs paid email service, adds account-creation friction).

**Mitigations.** Wrap auth behind an `IdentityProvider` interface from day one so Discord can be added later without rewriting handlers.

---

## ADR-002: Like-only voting in v1

**Date:** 2026-05-15
**Status:** Accepted

**Context.** Voting models range from single-like (Steam Workshop) to up/down (Reddit) to star ratings. Each invites different abuse patterns and moderation costs. We're a solo-dev shop with no comment system to soak engagement.

**Decision.** Single upvote ("like") per user per profile. No downvote, no rating.

**Consequences.**
- (+) No brigading drama; nothing to "review-bomb"
- (+) Simple aggregation; trivially understood by users
- (+) Easy to add downvotes later if needed; impossible to remove them once shipped
- (-) Less expressive; can't surface "popular but controversial"
- (-) Top-sort skews toward older content with accumulated likes (mitigated with `created_at` tiebreak in the index)

**Alternatives considered.** Up/down voting (brigading risk especially with NSFW content). 1-5 stars (hard to aggregate fairly with low vote counts; cognitive overhead).

---

## ADR-003: Cloudflare Workers + D1 + KV as the backend stack

**Date:** 2026-05-15
**Status:** Accepted

**Context.** Need a backend that costs $0 at small scale, scales without operator intervention, has minimal ops burden for a solo dev, and runs globally for a desktop app with users everywhere.

**Decision.** Cloudflare Workers (HTTP), D1 (SQLite for relational data), KV (sessions + ephemeral state), Durable Objects (per-user rate windows). Hono as the HTTP framework.

**Consequences.**
- (+) Free tier covers expected v1 load (~10K MAU) with 10-100x headroom on most resources
- (+) Global edge presence; low latency from a desktop app's perspective
- (+) No server to babysit; deploys via `wrangler`
- (+) D1 is just SQLite — schema is portable; export with `wrangler d1 export`
- (-) Ties us to Cloudflare; vendor lock-in is real (mitigated by SQLite portability)
- (-) D1 free tier hard-stops at 100K writes/day (see ADR-013)
- (-) Workers runtime restricts Node-only libraries (see ADR-010 for OpenID consequence)

**Alternatives considered.** Supabase (built-in auth, free tier limits bite sooner; Steam auth needs custom OAuth glue anyway). Fly.io / Railway VPS ($5/mo, more ops). Self-hosted (rejected, too much overhead).

---

## ADR-004: Durable Object for publish-window rate limiting

**Date:** 2026-05-15
**Status:** Accepted
**Verified via:** Cloudflare Workers docs (context7), `developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit`

**Context.** We want "1 publish per 10 minutes per Steam ID" to stop drive-by spam. Cloudflare ships a first-party Rate Limiting API binding, but documentation explicitly states *"The `period` must be either 10 or 60 seconds."* That can't express a 10-minute window.

**Decision.** Use the RL API binding for high-frequency limits where 10s/60s windows fit (likes, auth begin). For arbitrary windows (publish 1/10min, reports 5/day), use a Durable Object per Steam ID storing a `last_action_ts` map.

**Consequences.**
- (+) Strongly-consistent across colos — no race between two POPs
- (+) Per-key isolation; one user's hot path can't starve others
- (-) DO has its own pricing dimension once we go to Workers Paid
- (-) Slightly more code than a single binding call

**Alternatives considered.** All-KV (rejected: ~60s eventual consistency lets a user race two publishes through different colos). Multiple RL bindings stacked (e.g. limit=1/period=60 fired ten times — gameable, doesn't actually enforce a 10-min window). Cloudflare WAF rate limiting (operates at the wrong layer for per-Steam-ID).

---

## ADR-005: API prefixed with `/v1/`, additive-only forever

**Date:** 2026-05-15
**Status:** Accepted

**Context.** The Electron client ships in releases. Old clients persist in the wild for years — auto-update is not always taken, and some users are on offline machines. A breaking API change would brick installed apps until the user updates.

**Decision.** All routes prefixed with `/v1/`. Once shipped, v1 is frozen: only additive changes (new optional request fields, new response fields, new endpoints). Breaking changes go to `/v2/` deployed alongside.

**Consequences.**
- (+) Installed clients never break from a server-side change
- (+) Forces backward-compatible thinking at design time
- (-) Schema cruft accumulates over time; v1 will grow ugly
- (-) When v2 ships, we maintain two surfaces until v1 usage drops to ~zero (which may be never)

**Alternatives considered.** Header-based versioning (less obvious, harder to debug). No versioning + force-update (rejected — would brick offline users and undermines the offline-first promise).

---

## ADR-006: Inline gzipped profile blob in D1, not R2

**Date:** 2026-05-15
**Status:** Accepted

**Context.** Published profiles are portable profile JSON, ~3.5 KB raw, ~1 KB gzipped. We need to store and serve them. Cloudflare R2 is free for our scale and has no egress fees, but adds a round-trip per detail view.

**Decision.** Store the gzipped portable profile as a `BLOB` column in `published_profiles`. No R2 in v1.

**Consequences.**
- (+) Single round-trip for profile detail (one D1 SELECT)
- (+) Atomic with the metadata row; no consistency dance between two stores
- (+) Total storage at 10K profiles ~10 MB, well under D1's 5 GB free tier
- (-) Migrating to R2 later (e.g. if we add user-uploaded preview images) requires a copy
- (-) Each row is ~1 KB heavier; row-count storage limits hit slightly sooner

**Alternatives considered.** R2 + metadata in D1 (rejected: extra latency + consistency complexity for no benefit at 1 KB blobs). Hybrid (small inline, large in R2) (rejected: premature; profiles are bounded ~256 KB by validation cap).

**Revisit when.** We add user-uploaded preview images, or median profile size exceeds ~10 KB.

---

## ADR-007: Strict free-tier budget for v1

**Date:** 2026-05-15
**Status:** Accepted

**Context.** Grimoire is a personal project with a small Deadlock-modder audience. There's no funding model. Recurring infrastructure cost is a non-starter for v1.

**Decision.** All v1 infrastructure runs on Cloudflare's free tier. Total recurring cost: $0/year + ~$12/year if we buy a domain.

**Consequences.**
- (+) Project is sustainable indefinitely without revenue pressure
- (+) Forces architectural discipline (writes are scarce, so we denormalize and cache)
- (-) Hard cliff if we exceed free limits (see ADR-013)
- (-) Some features can't be built (e.g. always-on background workers cost real money)

**Alternatives considered.** $5-50/mo budget tier (rejected per user explicit choice; can be reconsidered if usage grows).

**Upgrade trigger.** Sustained 70% of any free-tier resource for a week.

---

## ADR-008: Skip Phase 0 (curated GitHub-only); ship full backend directly

**Date:** 2026-05-15
**Status:** Accepted

**Context.** A staged path was considered: Phase 0 = static curated profiles in a GitHub repo (zero backend, validates demand), then Phase 1 = full backend if demand exists. Tradeoff is upfront effort vs. risk of building unwanted features.

**Decision.** Skip Phase 0. Build Phase 1 directly.

**Consequences.**
- (+) Faster to product-market fit; one ship instead of two
- (+) Don't have to throw away the Phase 0 curation UX
- (-) ~3-4 weeks of backend work before any user feedback
- (-) Risk that the social loop doesn't resonate and the work was wasted

**Alternatives considered.** Phase 0 first (recommended originally; user explicitly rejected — wants to build the full thing).

**Mitigation.** Pre-seed Discover with featured profiles before launch (see ADR-012) so the empty-state risk is contained even without the Phase 0 warmup.

---

## ADR-009: No comments in v1

**Date:** 2026-05-15
**Status:** Accepted

**Context.** Comments are a primary engagement loop on social platforms — but they are also the dominant moderation cost driver. We are one developer.

**Decision.** No comment system in v1. Reactions are limited to the like button. Communication happens out-of-band (Discord).

**Consequences.**
- (+) Moderation surface stays small (titles + descriptions + reports)
- (+) No threading data model to maintain
- (-) Loses the conversational engagement loop; profiles feel inert
- (-) Authors can't get feedback on what to improve

**Alternatives considered.** Comments at launch (rejected: triples moderation cost). Disqus / external embed (rejected: privacy regression and ugly UX).

**Revisit when.** Phase 2, after the publish/like loop is proven and there's enough volume to justify the moderation investment.

---

## ADR-010: Hand-rolled Steam OpenID 2.0 verification on Workers

**Date:** 2026-05-15
**Status:** Accepted
**Verified via:** context7 returned no Workers-compatible Steam OpenID library

**Context.** Steam still uses OpenID 2.0, which Node libraries (`passport-steam`, `steam-signin`) handle but require Node built-ins (`http`, `crypto`) that don't exist in the Workers runtime.

**Decision.** Implement OpenID 2.0 verification manually using `fetch`. ~80 lines: redirect to Steam's `checkid_setup`, receive callback, POST the params back with `openid.mode=check_authentication`, parse `is_valid:true`, extract SteamID64 from `openid.claimed_id`.

**Consequences.**
- (+) Zero dependencies; fits the Workers runtime perfectly
- (+) Full control over error handling and logging
- (-) Hand-rolled crypto-adjacent code is a maintenance burden
- (-) If Steam changes their OpenID flow we own the fix
- (-) Need our own test coverage; no library validation to lean on

**Alternatives considered.** Using a library (rejected: none compatible with Workers). Running a separate Node process just for auth (rejected: defeats the all-Workers architecture).

---

## ADR-011: Async safeStorage on the client; refuse to persist on Linux without a secret store

**Date:** 2026-05-15
**Status:** Accepted
**Verified via:** Electron `docs/api/safe-storage.md` (context7)

**Context.** The session token must be stored on the client between launches. Electron's `safeStorage` provides OS-keychain-backed encryption. On Linux, if no secret store (`kwallet`, `gnome-libsecret`, Portal Secret D-Bus) is available, Electron falls back to a *hardcoded plaintext password* — effectively no encryption.

**Decision.** Use Electron's async safeStorage API (`isAsyncEncryptionAvailable`, async encrypt/decrypt). On Linux, if no real secret store is available, refuse to persist the token; the user re-logs each launch.

**Consequences.**
- (+) Async API supports Portal Secret D-Bus on Linux Flatpak/Snap (the sync API does not)
- (+) Non-blocking; supports key rotation
- (+) No false sense of security on Linux without libsecret
- (-) Some Linux users will be annoyed by re-login (mitigated by clear in-app messaging explaining why)

**Alternatives considered.** Persist anyway with a warning toast (rejected: security regression; users won't read the toast). Use sync API (rejected: doesn't support Portal Secret on sandboxed installs).

---

## ADR-012: Pre-seed featured profiles before launch

**Date:** 2026-05-15
**Status:** Accepted

**Context.** Cold-start social products die in the empty-feed problem. Day one, Discover has zero profiles, the first-time user sees nothing, leaves, never returns. Without the Phase 0 curation runway (rejected in ADR-008), we need an alternative.

**Decision.** Hand-build 10-20 featured profiles before public launch. `published_profiles.is_featured` flag surfaces them in a "Featured" rail at the top of Discover, regardless of like count.

**Consequences.**
- (+) Discover is never empty; first-time UX has something to look at and import
- (+) Featured profiles model the kind of content we want to encourage
- (+) Admin CLI's `feature-profile` / `unfeature-profile` lets us highlight community gems later
- (-) ~half a day of manual profile curation work pre-launch
- (-) Risk of taste mismatch: our featured profiles may not match what the community wants

**Alternatives considered.** Empty Discover at launch with strong CTA (rejected: empty-state risk too high). Phase 0 curation first (rejected per ADR-008). Aggregating GameBanana collection authors automatically (interesting but Phase 2 — we don't own those profiles).

---

## ADR-013: D1 free-tier hard-cliff is a real risk; alert at 70% usage

**Date:** 2026-05-15
**Status:** Accepted
**Verified via:** Cloudflare D1 pricing FAQ (context7)

**Context.** Cloudflare docs state plainly: *"Exceeding daily read/write limits on the Free plan will prevent D1 queries from running, returning errors to your client."* This is not throttling — it's a hard error wall until the daily counter resets.

**Decision.** Acknowledge this as a high-impact risk. Build the system to alert at 70K writes/day (70% of the 100K free-tier ceiling) and pre-emptively upgrade to Workers Paid before any high-traffic share (Discord launch post, Reddit thread, etc.). Show "service is busy, try again later" toast on 5xx publish/like — never a generic error.

**Consequences.**
- (+) We don't get caught by surprise; the upgrade path is clear and cheap ($5/mo)
- (+) Graceful client-side messaging preserves user trust during outages
- (-) Manual monitoring discipline required (no built-in alerts on free tier; use a daily admin script)
- (-) Viral moment without pre-emptive upgrade = several hours of broken publish

**Alternatives considered.** Stay on free tier indefinitely (rejected: this risk eventually materializes). Pre-emptively start on Workers Paid (rejected per ADR-007 budget constraint).

---

## ADR-014: Account deletion = hard-delete user, soft-delete published profiles

**Date:** 2026-05-15
**Status:** Accepted

**Context.** Users must be able to delete their account (basic privacy hygiene; GDPR-aligned even if not strictly required for our scale). But their published profiles may already be in other users' libraries, and deleting them outright would break those imports' provenance.

**Decision.** `DELETE /v1/me` hard-deletes the `users` row and all the user's `likes`, soft-deletes their `published_profiles` (sets `deleted_at`), invalidates all their sessions. The profiles become invisible in listings but the underlying rows remain so that owner-references stay referentially intact.

**Consequences.**
- (+) Identity is genuinely gone; re-login creates a fresh user
- (+) Other users' import history doesn't reference orphaned IDs
- (+) Like counts re-derive correctly via cascade (their likes are removed)
- (-) Asymmetric deletion semantics is non-obvious; needs documenting in the privacy policy
- (-) Soft-deleted profiles still occupy storage (negligible at our scale)

**Alternatives considered.** Hard-delete everything (cleaner but breaks references and history). Anonymize (`voter_steam_id = '__deleted__'`) (preserves counts perfectly but clutters the data model and is less GDPR-clean). Hard-delete profiles too (would orphan IDs in users' import history, confusing for them).

---

## ADR-015: Shared types via Zod schemas package

**Date:** 2026-05-15
**Status:** Accepted

**Context.** Two TypeScript codebases (Electron client, Workers server) sharing a wire format will silently drift. We've seen this pattern fail before at every shop.

**Decision.** Wire-format types live in a single source: a `@grimoire/social-types` package. Worker validates inbound bodies with Zod schemas exported from that package; client imports the same Zod schemas for IPC payload typing and runtime validation of responses.

**Consequences.**
- (+) Schema drift is impossible — both sides import the same definitions
- (+) Runtime validation catches malformed responses (Worker bug, transit corruption)
- (+) Generated TS types via `z.infer<>` flow naturally to both sides
- (-) Adds a publish step (or path-based dependency) to the dev loop
- (-) Schema changes require coordinated version bumps in both repos

**Alternatives considered.** Copy-paste with a header comment + CI diff check (rejected: invites drift). OpenAPI codegen (rejected: heavyweight for our scope). No shared types, document the wire format in markdown (rejected: docs rot).

---

## ADR-016: Owner-only PATCH for title + description on published profiles

**Date:** 2026-05-16
**Status:** Accepted

**Context.** Owners need to fix typos and tighten descriptions on profiles they've already published. Without an update endpoint the only workaround is unpublish + republish, which (a) burns the per-user publish window (ADR-004), (b) generates a new profile id so anyone who imported the old one loses provenance, and (c) resets the like count. None of those are appropriate for a copy edit.

**Decision.** Add `PATCH /v1/profiles/:id` (owner-only, `requireAuth`) that updates `title` and `description` and returns the full `ProfileDetail`. Both fields are optional individually; at least one must be present. The endpoint does NOT touch the share blob or any derived fields (`mod_count`, `has_nsfw`, `primary_hero`, `heroes`, `thumbnail_urls`): mutating the mod set still goes through unpublish + republish, because those derived fields anchor the integrity of the like count and the moderation surface. The PATCH is not gated by the publish DO; it's a cheap text edit, not a publish.

**Consequences.**
- (+) Owners can copy-edit without losing likes, id, or burning the publish gate
- (+) Wire-format change is purely additive (new endpoint + new request schema): ADR-005 compliant
- (+) `viewer_has_liked` returns `null` on PATCH responses because the action is owner-only and the client already knows its own like state; this avoids a second query
- (-) Adds a small write path that bypasses the DO rate limit; abuse risk is bounded by the Cloudflare Rate Limit API global throttles and the fact that only the owner can call it
- (-) Editable text means cached card previews in other clients can drift until next list/detail fetch; acceptable since lists already refetch on every Discover open

**Alternatives considered.** Rebuild the publish path to accept an existing `id` (rejected: conflates create and update, and the DO gate makes copy edits prohibitively expensive). Allow editing the share blob too (rejected: derived fields and like-count integrity make this a separate, larger decision; defer until we have a real use case beyond text fixes). Skip and tell users to unpublish/republish (rejected: ruined the "your profile" tab UX in Discover).

---

## ADR-017: Phase 1.5 write paths: coalesced view counts, paced revalidation cron

**Date:** 2026-07-28
**Status:** Accepted

**Context.** Phase 1.5 adds two things that both want to write on behalf of traffic we do not control.

1. **Owner-only view counts.** The obvious implementation is `UPDATE published_profiles SET view_count = view_count + 1` inside `GET /v1/profiles/:id`. That puts an unbounded write on the single hottest read path in the product. D1's free tier hard-stops at 100K writes/day (ADR-013: a cliff, not throttling), so one profile linked in a busy Discord channel could exhaust the daily write budget and take publish and like down with it. The failure mode is the whole social layer going 5xx because a vanity stat got popular.
2. **GameBanana revalidation.** Published profiles are recipes pointing at submissions we do not host, and authors delete and archive them. To render "11 of 12 mods available" we have to ask GameBanana about every referenced submission, from a cron, unsolicited, against a volunteer-run service.

**Decision.**

*View counts.* Views never touch D1 on the request path. `GET /v1/profiles/:id` hands the view to a sharded `ViewCounterDO` (8 shards, profile id hashed to a shard so a profile's deltas accumulate in one place) via `executionCtx.waitUntil`. The DO accumulates per-profile deltas in DO storage and flushes them to D1 on a 5-minute alarm. D1 writes are therefore bounded by *distinct profiles viewed per 5-minute window*, not by view volume: a profile viewed 10,000 times in an hour costs at most 12 writes. We accept DO storage writes per view (cheap, separate budget, no cliff) to avoid D1 writes per view. The owner's own views are not counted, so the number means "other people looked". On flush we delete the pending keys before writing to D1, so a failed batch under-counts rather than double-counts: for a vanity stat, under-counting is the safer direction.

*Revalidation.* A weekly cron (`17 4 * * 1`) walks published profiles oldest-check-first (`ORDER BY mods_revalidated_at ASC`; SQLite sorts NULL first, so never-checked profiles lead). Requests to GameBanana are strictly serial at 250 ms spacing (4 req/sec) with a hard per-run budget of 500 requests and 200 profiles. The Electron client's limiter allows 10 req/sec because a user is waiting; nobody is waiting on a cron, so it gets half that and a ceiling. A `mod_availability` table memoizes each submission's verdict for 6 days across profiles and across runs, so the popular mods that show up in half the feed cost one request per run rather than one per profile. Probe results are three-state: 404/410 is "gone", a 200 with `_idRow` is "available", and everything else (429, 5xx, timeout, network) is "could not tell" and is neither cached nor recorded. A profile with any inconclusive probe is left untouched and re-picked next run.

*Never-checked is not healthy.* `mods_available` is `NULL` until the cron has seen the profile. Clients must render that as unknown, never as "all available". This is why the field is nullable rather than defaulting to `mod_count`.

**Consequences.**
- (+) The detail route stays read-only against D1; view popularity cannot trigger the free-tier cliff
- (+) Revalidation cost per run is capped and predictable, and the backlog drains over weeks instead of hammering GameBanana in one burst
- (+) Purely additive wire changes (`mods_available`, `mods_revalidated_at`, `unavailable_mod_ids`, `view_count`): ADR-005 compliant
- (-) View counts lag by up to 5 minutes, and a DO eviction between flush-delete and D1 write loses one window
- (-) Availability badges can be up to a week stale, and a mod deleted an hour ago still reads as available
- (-) A second DO class means a second `[[migrations]]` entry and one more moving part to reason about at deploy time
- (-) `mod_availability` is a new table that grows with the distinct-mod count; it is a cache and can be truncated at any time

**Alternatives considered.** Increment `view_count` directly with sampling (count 1 in N and multiply) (rejected: still an unbounded hot-path write, and it makes small numbers wrong in a way owners will notice). Keep view counts in KV (rejected: KV is eventually consistent and its free write ceiling is 1K/day, far tighter than D1's). One DO per profile (rejected: unbounded object count for a stat nobody but the owner sees). Revalidate on read, when a profile detail is fetched (rejected: puts GameBanana latency and rate-limit exposure on a user-facing path, and hot profiles get checked constantly while cold ones never do). Revalidate from the client during import (rejected: the import flow already discovers a dead mod naturally; the point of the badge is to warn *before* the user commits to importing).

---

## ADR-018: This fork points at the upstream Worker and its wave 3 features stay dormant

**Date:** 2026-08-07
**Status:** Accepted

**Context.** `.github/workflows/release.yml` bakes `GRIMOIRE_SOCIAL_BASE_URL: https://grimoire-social.slusheliott.workers.dev` into every packaged Windows build. That Worker is upstream-owned. Three commits (`5f870bd` adding the mod-availability and owner view-count wire fields, `754efe7` adding the revalidation cron and coalesced view counts, `13a5695` fixing a detail-read failure when no execution context exists) sit unpushed in the local `../grimoire-social` checkout, whose only remote is `Slush97/grimoire-social`. No `onionviolet/grimoire-social` fork exists. Migration `0005_revalidation_and_views.sql`, which adds the four columns those commits' code selects, has not been applied to any database this fork controls.

**Decision.** Per project decision D-01, the shipped installer keeps pointing at the upstream Worker. The sibling is not forked. `.github/workflows/ci.yml`'s and `.github/workflows/release.yml`'s sibling checkouts, and `scripts/check-sibling-repos.mjs`'s `SIBLINGS` entry, keep naming `Slush97/grimoire-social`. The three commits stay unpushed. Migration 0005 is not applied. No Worker is deployed.

**Consequences.**
- (-) The revalidation cron and the view counter do not run against the deployment this fork ships against, so `mods_available`, `mods_revalidated_at`, `unavailable_mod_ids`, and `view_count` are absent from every response in practice, not merely null.
- (+) The client was built for exactly that. `resolveModsAvailability` in `src/components/social/availability.ts` treats an absent `mods_available` as `{ kind: 'unsupported' }` and renders no badge, distinct from a present `null` (`{ kind: 'unknown' }`, rendered as "not checked yet"); the defined-check in `src/components/social/SocialProfileHeader.tsx` (`isOwner && viewCount !== undefined`) renders no view-count row when the field is absent, and still renders a real zero. `src/components/social/dormantService.test.ts` is the guard that keeps both gates in place: it fails if either check is loosened to a truthiness test or removed.
- (+/-) The `ProfileDetailWithAvailability` shim in `src/types/social.ts`, a local widening of the sibling's `ProfileDetail` with the `view_count` and `unavailable_mod_ids` fields the deployed service does not send, stays necessary. It stops being necessary only if the sibling change becomes reachable from CI (the sibling is pushed and `ci.yml`/`release.yml` check out a ref that includes it).
- (+) The CI-truth typecheck taken for this decision passed: the local sibling was confirmed clean on `main`, 3 commits ahead of `origin/main`, then detached to `origin/main` (resolved `efffe0b`) to match what a fresh CI checkout resolves, and `pnpm exec tsc -b --force` exited 0 against that detached state. This repository currently builds from a clean CI checkout of the sibling; there is no divergence-caused typecheck failure today. The sibling was restored to `main` afterward.
- (-) `.github/workflows/ci.yml`'s sibling checkout is pinned to `ref: main`, a moving branch rather than a commit SHA. This is a pre-existing supply-chain soft spot this decision leaves in place, unlike the forked-vpkmerge checkout in the same workflow family, which plan 02-02 pins to a fixed SHA specifically to avoid this class of drift.
- (-) The GameBanana mod-title tooltip in `src/components/social/ModsAvailableBadge.tsx` still shows raw numeric ids (`GameBanana: #123, #456`) rather than mod titles, and is deliberately not built: `unavailable_mod_ids` never populates against a service that does not run the revalidation cron, so there is nothing to look titles up for. Build it when a deployment that runs the revalidation cron exists, which is the trigger this decision is leaving unbuilt work waiting on.

**Alternatives considered.** Forking `grimoire-social` to `onionviolet`: repoint the three call sites above, push the three unpushed commits, create a D1 database, apply migration 0005, then rebake the URL and deploy the Worker. Rejected for this plan's scope per D-01; every step is real work with its own risk (a schema push, a fresh D1 instance, a Wrangler deploy) and none of it is reversible from this plan. Offering the cron and counter upstream as a pull request to `Slush97/grimoire-social`: rejected as out of scope here, and contingent on upstream wanting the change, which this plan does not decide.

**Ordering constraint, recorded because it is the fact most likely to be lost if this decision is revisited.** Migration 0005 adds the four columns (`mods_available`, `mods_revalidated_at`, `unavailable_mod_ids`, `view_count` and their supporting shape) that the profile routes' `SELECT` statements read in the commits above. It must be applied to the target D1 database *before* a Worker build that selects those columns is deployed to that database. These are two separate, non-atomic operations: a deploy that runs ahead of its migration will 500 on every profile read the moment the new Worker code executes a `SELECT` for a column that does not exist yet.

**Terms-of-service gate placement (Task 2 of the plan that produced this ADR).** `docs/social-architecture.md` said the TOS gate fires "at first login" in two places (Liability framing, and the Phase 1 checklist). The shipped code fires it inline in `PublishDialog.tsx` at the moment of publish, storing acceptance under a `localStorage` key (`grimoire-social-tos-accepted-v1`) rather than at sign-in. Decided **doc-follows-code**: the design document is corrected to say first publish, matching the code, rather than moving the gate to first login. Reasoning: the gate already sits at the moment consent actually matters (when content leaves the machine), moving it would add a new surface, new catalog keys, and translator work for a flow only users who sign in would see, and a user who only signs in and browses has agreed to nothing either way, which is an acceptable outcome under this framing. Either placement stores acceptance identically: per-machine, in `localStorage`, clearable by the user. That is not a durable, account-bound, or server-recorded consent record regardless of which surface shows the checkbox, and the corrected document text says so explicitly rather than implying otherwise.

---

## Index of decisions

| ID | Title | Status |
|---|---|---|
| ADR-001 | Steam OpenID as the sole identity provider | Accepted |
| ADR-002 | Like-only voting in v1 | Accepted |
| ADR-003 | Cloudflare Workers + D1 + KV as the backend stack | Accepted |
| ADR-004 | Durable Object for publish-window rate limiting | Accepted |
| ADR-005 | API prefixed with `/v1/`, additive-only forever | Accepted |
| ADR-006 | Inline gzipped profile blob in D1, not R2 | Accepted |
| ADR-007 | Strict free-tier budget for v1 | Accepted |
| ADR-008 | Skip Phase 0; ship full backend directly | Accepted |
| ADR-009 | No comments in v1 | Accepted |
| ADR-010 | Hand-rolled Steam OpenID 2.0 verification on Workers | Accepted |
| ADR-011 | Async safeStorage; refuse to persist on Linux without secret store | Accepted |
| ADR-012 | Pre-seed featured profiles before launch | Accepted |
| ADR-013 | D1 free-tier hard-cliff is a real risk; alert at 70% usage | Accepted |
| ADR-014 | Account deletion: hard-delete user, soft-delete profiles | Accepted |
| ADR-015 | Shared types via Zod schemas package | Accepted |
| ADR-016 | Owner-only PATCH for title + description on profiles | Accepted |
| ADR-017 | Coalesced view counts + paced revalidation cron (Phase 1.5) | Accepted |
| ADR-018 | This fork points at the upstream Worker and its wave 3 features stay dormant | Accepted |
