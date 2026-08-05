# Codebase Concerns

<!-- refreshed: 2026-08-05 -->

**Analysis Date:** 2026-08-05

## Tech Debt

**Large Generated Files:**
- Issue: `electron/main/services/performanceConfigData.ts` is 5,569 lines — a generated bundle of all upstream performance preset data
- Files: `electron/main/services/performanceConfigData.ts`
- Impact: Large file size increases bundle and makes navigation difficult, though it is intended to be generated
- Fix approach: Keep as-is; it regenerates via `pnpm perf:presets`. Document the regeneration process clearly.

**Oversized Service Modules:**
- Issue: Multiple service files exceed 1,400 lines, making them difficult to maintain and test
- Files: 
  - `electron/main/services/modMerger.ts` (1,594 lines)
  - `electron/main/services/download.ts` (1,529 lines)
  - `electron/main/services/archiveCrc.ts` (1,494 lines)
  - `electron/main/services/mods.ts` (1,458 lines)
  - `electron/main/services/performanceConfig.ts` (1,421 lines)
  - `electron/main/services/gamebanana.ts` (1,255 lines)
  - `electron/main/services/stats.ts` (1,237 lines)
  - `electron/main/services/vpk.ts` (1,220 lines)
- Impact: Difficult code review, harder to isolate bugs, increased cognitive load when touching these modules
- Fix approach: Consider splitting into focused sub-modules (e.g., mod operations into enable/disable/merge concerns). Low priority.

**Type Safety With `any` and `unknown`:**
- Issue: 2,353 occurrences of `any`/`unknown`/@ts-ignore across 133 service files
- Files: All electron main services
- Impact: Reduces TypeScript's ability to catch bugs at compile time; scattered throughout codebase
- Fix approach: Incremental migration to typed patterns. Focus on public API boundaries first.

**Normalize Path Calls Scattered:**
- Issue: Path normalization happens in multiple places (download.ts:112, security.ts:72, multiple VPK handlers)
- Files: `electron/main/services/download.ts`, `electron/main/services/security.ts`, `electron/main/services/vpk.ts`
- Impact: Inconsistent behavior, harder to maintain, potential for edge cases in specific contexts
- Fix approach: Extract path normalization into a shared utility with exhaustive test coverage

---

## Known Bugs

**Asset Sources Panel Missing Case Normalization:**
- Symptoms: Asset source winner line silently fails to render for paths containing uppercase letters
- Files: `src/components/foundry/AssetSourcesPanel.tsx:41`
- Trigger: Request inspection of a path with uppercase characters; the source key is lowercased at `services/foundryAssetSources.ts:40` but the panel normalizes without `.toLowerCase()`
- Current impact: Latent bug. Today's catalog paths are lowercase, so not visibly broken. Will surface when uppercase paths appear.
- Fix: Append `.toLowerCase()` to the normalization chain at line 41.

**Staged Sound Preflight Not Running:**
- Symptoms: Staged sound edit can contain unreadable VPKs or conflicts that would normally block the action
- Files: `src/components/foundry/SoundBrowse.tsx:1043`
- Trigger: Stage a sound edit from an unreadable VPK or into a collision scenario without running the preflight
- Context: Fixed on 2026-07-28 (`SoundBrowse.tsx:1043` now runs `foundryInspectSoundConflicts`), but document notes this as the "only live correctness gap" that required a preflight fix
- Current status: **FIXED** as of recent commit; was the highest-priority bug on the board.

---

## Security Considerations

**URL Validation Framework Present but Limited:**
- Risk: Security utilities in `electron/main/services/security.ts` provide baseline checks (HTTPS, domain allowlist) but don't cover all attack vectors
- Files: `electron/main/services/security.ts` (validateDownloadUrl, validateApiUrl, validateFilePath, validateFileSize)
- Current mitigation: 
  - Download URLs validated against hardcoded GameBanana domain list
  - Path traversal detection checks for `..` and null bytes
  - File size validation to detect incomplete downloads
- Recommendations: 
  - Expand `validateFilePath` to catch Windows reserved names and other dangerous patterns
  - Add rate-limit bypass detection for repeated failed auth attempts
  - Consider adding cryptographic signature validation for critical downloads

**Main Process Secret Storage:**
- Risk: Session tokens and API keys are stored in main-process memory; if renderer is compromised, it still cannot read them
- Files: `electron/main/services/socialAuth.ts:96`, `electron/main/services/social.ts:130`, `src/types/social.ts:13`
- Current mitigation: Token invariant is enforced — `SocialSessionStatus` carries no token field; `preload/index.ts` exposes no token accessor. Session bearer attached at `services/social.ts:130` only.
- Recommendations: Continue enforcing token invariant. Never expose tokens to renderer. Add token rotation/refresh strategy for long-lived sessions.

**Download Validation Chain:**
- Risk: Archive extraction could be exploited if malformed archives aren't handled correctly
- Files: `electron/main/services/extract.ts`, `electron/main/services/download.ts`
- Current mitigation: Extract runs in isolated temp directory; suspicious files are scanned (`extract.ts:scanSuspiciousFiles`)
- Recommendations: Add deeper binary inspection (magic bytes), verify extracted VPK structure before integration, add canary files to detect partial extractions

---

## Performance Bottlenecks

**VPK Parsing on Every Browse:**
- Problem: Hero portrait and sound loading may re-parse VPK indices even when cached
- Files: `electron/main/services/vpk.ts`, `electron/main/services/heroPortraits.ts`, `electron/main/services/heroSounds.ts`
- Cause: Cache invalidation strategy unclear; multiple sequential file reads on large mod collections
- Improvement path: Validate cache invalidation strategy and consider pre-computing hero/sound mappings at sync time

**Network Rate Limiting Implementation:**
- Problem: Rate limiter is not thread-safe (though JavaScript is single-threaded, this is fragile)
- Files: `electron/main/services/rateLimiter.ts`
- Cause: Shared rate limiter instances for GameBanana (10 req/sec), Stats API (5 req/sec), Steam (1 req/sec), Social (5 req/sec) use simple token bucket without locks
- Impact: In an async-heavy environment, overlapping awaits could exceed intended rates during burst scenarios
- Improvement path: Add a queue-based rate limiter with strict request ordering; or document why current implementation is safe for the actual workload

**Mod Merge Analysis is Sync-Only:**
- Problem: `analyzeMerge` in `modMerger.ts:517` reads all VPK directories synchronously during analysis
- Files: `electron/main/services/modMerger.ts:517`
- Cause: Merge analysis must read multiple VPKs to compute collisions and owners
- Impact: Large mod collections can cause UI stutter during merge review
- Improvement path: Async VPK parsing with progress reporting; cache analysis results per mod set

---

## Fragile Areas

**Rigged Hero Preview Path:**
- Files: `electron/main/services/heroPoseModels.ts`, `src/lib/source2Preview/`, `src/lib/useClothSim.ts`
- Why fragile: Two parallel export paths (static `--pose` bake vs. rigged no-pose sibling). Feature is measured but not shipped; NPR shell behavior under animation untested. Cloth simulation is complex with multiple fallback cases.
- Safe modification: Do not delete the rigged path without deciding explicitly. Changes to cloth math must be validated per pilot hero. Keep both export paths working.
- Test coverage: Rigged path tested via `useClothSim.test.ts`, `clothMath.test.ts`, `feModel.test.ts`; NPR material behavior incomplete

**Complex Mod Merge Resolution:**
- Files: `electron/main/services/modMerger.ts`, merge conflict table in `docs/merge-plan-upstream-2026-08.md`
- Why fragile: Recent upstream merge (2026-08-05) involved 8 conflicted files requiring careful hand-resolution. Three were "hard" rewrites of UI pages (`Installed.tsx`, `PerformanceConfigCard.tsx`, `Locker.tsx`). A future upstream merge will collide on the same files.
- Safe modification: Before any upstream merge, read the conflict table and resolution notes. `Installed.tsx` may require re-applying behavior on top of upstream's menu refactor. `Locker.tsx` carries heavy Foundry edits; upstream adds small additive changes (GlobalModPicker, z-index fix).
- Test coverage: Merge tested post-resolution via full gate set (typecheck, lint, tests); no specific merge regression tests

**Chat Wheel VPK Round-Trip:**
- Files: `electron/main/services/chatWheel.ts`, `src/types/chatWheel.d.ts`, test at `chatWheel.test.ts`
- Why fragile: Chat Wheel is experimental; validation is tested but VPK read/write cycle is not. Experimental gate enforced on sidebar but not on route itself (Route.tsx has no gating).
- Safe modification: Test both `chat-wheel:read` and `chat-wheel:starter` VPK operations; extend experimental gate to route before shipping
- Test coverage: Validation covered; YAML round-trip partially tested; VPK integration untested

**VFX Preview Fallback Detection:**
- Files: `src/components/locker/HeroColorPicker.tsx:291`
- Why fragile: Used to detect "no preview texture" via substring match on engine's error string (`'particle-only'`). Now improved to return `Promise<string | null>` with proper error classification in `heroColors.ts`.
- Safe modification: If engine error messages change, update `heroColors.ts:previewHeroColor` classification logic. Do not revert to substring matching.
- Test coverage: Fixed 2026-07-28; now covered by `heroColors.previewHeroColor.test.ts`

---

## Missing Critical Features

**Foundry Edit Serialization Limited:**
- Problem: `FoundryForgeEdit` type admits only `sound` and `texture`; recolor and model edits have no serializer and cannot enter a combined build
- Blocks: Recolor changes cannot be exported/installed as a single VPK alongside sound swaps
- Workaround: Recolor changes must be exported/installed separately or not at all

**Performance ConVar Sub-Items Incomplete:**
- Problem: Per-control reset, value-state badge, out-of-range warning, and pending-vs-applied summary all missing
- Files: `src/components/performance/PerformanceConfigCard.tsx`
- Blocks: Users cannot easily discover why a ConVar behaves unexpectedly, cannot safely experiment
- Status: Feature-status.md lists as "experimental"; follow `performance-convars-followup-plan.md` Phase A before public release

**Social Phase 1.5 Incomplete:**
- Problem: Revalidation cron, mods-available badge, owner-only view stats, admin analytics all absent
- Files: `electron/main/ipc/social.ts`, `src/pages/Discover.tsx`, `src/components/social/`
- Blocks: Profile discovery lacks completeness indicators
- Status: Confirmed gaps per audit; phase 1.5 is on backlog

---

## Test Coverage Gaps

**Audio Conversion Missing Test:**
- What's not tested: FFmpeg transcoding from non-MP3 formats (WAV, OGG, FLAC, M4A, AAC, Opus) to MP3
- Files: `electron/main/services/audioConversion.ts`
- Risk: FFmpeg binary missing at runtime (user reinstall needed), broken transcoding arguments, temporary file cleanup failures all undetected
- Priority: Medium — audio conversion affects Foundry sound input; should be tested before shipping

**Chat Wheel VPK Operations Untested:**
- What's not tested: `chat-wheel:read` and `chat-wheel:starter` VPK round-trip (read VPK, parse YAML, validate, write back)
- Files: `electron/main/services/chatWheel.ts`
- Risk: YAML corruption on write, silent parse failures, invalid VPK output
- Priority: Medium — experimental feature; must be tested before moving out of experimental gate

**Foundry Combined Output Regression:**
- What's not tested: Build cancellation, installed-state regression after a staged edit is discarded, stale-review rejection when edit request changes
- Files: `src/components/foundry/FoundryBuildTray.tsx`, `electron/main/services/foundryForge.ts`
- Risk: User discards edit but mod remains installed in half-built state, or a tampered confirmation produces an inconsistent write set
- Priority: High — this is the core Foundry feature; regression would be visible immediately but hard to debug

**Locker Hero Card Apply Missing Source Loss Test:**
- What's not tested: Card apply when the source file referenced in `missingSourceFileNames` has vanished
- Files: `src/components/locker/HeroCardPicker.tsx:153`, `electron/main/services/heroCards.ts:389`
- Risk: Card silently fails to apply; fixed 2026-07-28 to report via actionError
- Priority: Low — fixed; the new `locker.cards.missingSources` key needs coverage going forward

**Merge Analysis Edge Cases:**
- What's not tested: Unreadable VPK behavior in collision detection, mixed enabled/disabled source ordering, imprint metadata exclusion from collision counts
- Files: `electron/main/services/modMerger.ts:517`
- Risk: Silent misalignment between UI report and actual merge behavior
- Priority: Medium — merge is a critical operation; edge cases should be captured

---

## Scaling Limits

**Catalog Sync Performance at Scale:**
- Current capacity: Tested with GameBanana's full catalog (100K+ mods); FTS5 search remains fast
- Limit: Very large mod collections (100+) with complex merge scenarios may stall UI during analysis
- Scaling path: Implement async merge analysis with progress reporting; consider off-main-thread VPK parsing

**Database WAL Mode Contention:**
- Current capacity: Two SQLite databases (mods-cache.db, stats.db) in WAL mode; write contention possible during sync + UI query
- Limit: Concurrent sync + user stats update could cause read timeouts
- Scaling path: Separate read/write connections; implement connection pooling

---

## Dependencies at Risk

**FFmpeg Static Binary:**
- Risk: `ffmpeg-static` npm package bundles pre-built binaries; asar-unpacking is required (`electron-builder.yml:41`)
- Impact: If binary becomes unavailable for a platform, Grimoire cannot ship audio transcoding for that platform
- Migration plan: Monitor FFmpeg licensing; consider shipping source + on-demand build; or vendor binaries directly

**GameBanana API Stability:**
- Risk: GameBanana API is third-party; no SLA, changes can break mod browsing
- Impact: Rate limiter, schema parsing, file URL construction all depend on GB's exact behavior
- Migration plan: Implement robust fallback when GB is down (cached catalog, graceful degradation); add API contract tests

**upstream/main Merge Burden:**
- Risk: 10 upstream commits with 74 files changed; frequent merges will create conflict debt
- Impact: Our fork (1.26.20) is ahead of upstream (1.26.0) by 225 commits; divergence grows with each merge
- Migration plan: Quarterly sync cadence; maintain a conflict table per merge; consolidate divergent branches after each merge (as planned in Phase C of merge-plan)

---

## Dependencies Shipping Untested Code Paths

**Audio Transcoding Chain:**
- Dependency: `ffmpeg-static` binary
- Untested: WAV, OGG, FLAC, M4A, AAC, Opus input to MP3 conversion
- Risk: Corrupt output, silent failures, platform-specific behavior
- Recommendation: Add `audioConversion.test.ts` before shipping non-MP3 support publicly

---

## Design Anti-Patterns

### Rate Limiter Not Respecting Strict Bounds

**What happens:** `rateLimiter.ts` uses a token bucket that allows momentary spikes above the configured rate due to async scheduling
**Why it's wrong:** Burst can exceed `burstSize` if multiple requests are queued during refill; no strict ordering guarantee
**Do this instead:** Switch to a queue-based limiter where requests are enqueued and processed in order with strict time gaps. See `rateLimiter.ts` for where to apply.

### Path Normalization Duplicated Across Services

**What happens:** Download, VPK parsing, and security validation each normalize paths differently
**Why it's wrong:** Edge cases (double slashes, mixed separators) may bypass validation in one service but not another
**Do this instead:** Create `electron/main/services/pathUtils.ts` with a single `normalizePath()` function; use everywhere. Add comprehensive test for Windows/Linux edge cases.

---

## Documentation Drift

**Profile Spec Marketing Issue:**
- Problem: `docs/profile-spec.md:3` claims cross-manager interop; `CLAUDE.md` forbids claiming compatibility with other mod managers
- Files: `docs/profile-spec.md`, `CLAUDE.md`
- Status: Noted in audit; correction needed

**Chat Wheel Experimental Gate Incomplete:**
- Problem: Route itself has no experimental gate, only sidebar entry has it (`Sidebar.tsx:514`)
- Files: `src/pages/Foundry.tsx` (or equivalent Chat Wheel route), `src/Sidebar.tsx:514`
- Status: Need to extend gate to the route before shipping

---

## Risk Summary

| Area | Severity | Impact | Fix Effort |
|------|----------|--------|-----------|
| Asset sources case normalization | Low | Silent render failure in edge case | Trivial (1 line) |
| Staged sound preflight | Low | **FIXED** 2026-07-28 | — |
| Audio transcoding untested | Medium | Non-MP3 input reliability | Small (add test) |
| Chat Wheel VPK round-trip untested | Medium | Experimental feature fragility | Small (add test) |
| Foundry build regression untested | High | Core feature stability | Medium (add test suite) |
| Mod merge complexity | Medium | Future upstream merges difficult | Medium (conflict table maintenance) |
| Type safety with `any` | Medium | Long-term maintainability | Large (incremental) |
| Oversized service modules | Medium | Code review and bug isolation | Large (refactor, phased) |

---

*Concerns audit: 2026-08-05*
