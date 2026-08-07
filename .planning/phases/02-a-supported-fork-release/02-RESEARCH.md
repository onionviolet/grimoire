# Phase 2: A Supported Fork Release - Research

**Researched:** 2026-08-07
**Domain:** Fork release engineering (5 largely independent, mechanical sub-problems: engine pinning, support-link surgery, git branch consolidation, social service disposition, experimental-gate/doc-drift cleanup)
**Confidence:** HIGH

## Summary

This phase has no CONTEXT.md — no `/gsd-discuss-phase` was run — so this research doubles as the decision surface the planner (and, before that, the user) needs. Unlike most phases, almost everything here is answerable by reading this repository directly rather than researching an external library: there are no new frameworks, no new npm packages, and no unfamiliar patterns. The work is git surgery, workflow-file edits, link/copy edits, and one small routing gate.

The single biggest finding: **the packaged Windows release pipeline (`.github/workflows/release.yml`) already ships the correct fork engine.** It checks out `onionviolet/vpkmerge` at a pinned commit SHA, builds it from source, and runs `pnpm use-local-vpkmerge` before packaging — which writes both a `.local-build` marker and a `.ycocg-icon-safe` marker into `resources/vpkmerge/` before `electron-builder` packages that directory. `docs/release-maintenance.md:102-103` documents that the resulting Settings card already reports `vpkmerge 0.19.0 (798f3a7)`. **The gap is not the release artifact — it's that `scripts/fetch-vpkmerge.mjs` (the `postinstall` script, i.e. what a plain `pnpm install` fetches) still pulls the stock, pre-YCoCg-fix `Slush97/vpkmerge` `v0.19.0` release**, and `onionviolet/vpkmerge` has **zero published GitHub Releases** (verified via `gh api repos/onionviolet/vpkmerge/releases` → `[]`), so there is nothing to checksum-pin `fetch-vpkmerge.mjs` against without a new external action (cutting an actual Release on that repo). This is the one item in this phase that may require action outside this repository's boundary; see Open Questions.

Three of the five requirements (support destination, branch consolidation, experimental-gate/doc-drift) are small, well-scoped, mechanical fixes with exact file:line targets already found. The social-service requirement is a genuine three-way decision (fork-and-deploy / upstream-PR / stay-dormant) that the client code has, encouragingly, already been built to tolerate gracefully regardless of which way it goes.

**Primary recommendation:** Treat this phase as five independent lanes that can be planned (and largely executed) in parallel, gated by one explicit decision each for support-destination wording, branch-deletion authorization, and social-service disposition — none of which this research can make on the user's behalf.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REQ-packaged-fork-engine | Checksum-pinned `onionviolet/vpkmerge` release promoted in `scripts/fetch-vpkmerge.mjs` and `.github/workflows/release.yml`; packaged Windows build reports engine version in Settings; DXT5-YCoCg icon replacement produces correct colours in game | See "Requirement 1" below — current state, YCoCg detection mechanism, what's actually missing, and the open decision between building-from-pinned-SHA (already working) vs. publishing an actual checksummed Release on `onionviolet/vpkmerge` (no release exists today) |
| REQ-fork-support-destination | No fork-owned surface sends a user to the upstream project's support channel; attribution and Ko-fi stay upstream-labelled | See "Requirement 2" — full enumeration of every Discord/support touchpoint this session found, classified must-fix vs. keep-as-attribution, with exact file:line targets |
| REQ-upstream-merge-aug-2026 | Fold `structural-refactor-7`'s unmerged work into `main`, delete fully-merged branches, retire the temporary merge-plan doc | See "Requirement 3" — live-verified branch inventory (ahead/behind counts), reproduced 10-file conflict set for Phase B, worktrees to remove first, and the discrepancy between this session's numbers and the plan doc's stale ones |
| REQ-social-service-disposition | Decide which Worker a shipped installer points at; make the client honest about it; sequence migration 0005 before any new Worker deploy | See "Requirement 4" — current baked URL, sibling repo/remote state, migration 0005 contents, confirmation that the "check that will never run" concern is already client-side handled, and the three-way disposition decision this research cannot make |
| REQ-experimental-gate-and-doc-drift | Chat Wheel route reachable with its setting off; `docs/profile-spec.md` claims cross-manager portability, which `CLAUDE.md` forbids | See "Requirement 5" — exact route gap in `App.tsx`, the already-correct Sidebar gate, the in-repo `Browser.tsx` pattern to reuse, and all three `docs/profile-spec.md` lines that need rewording (requirement text names only one) |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Engine version pinning/reporting | Main process (Node) | Renderer (Settings display) | `vpkmergeBinaryPath()`/`foundry:engineInfo` IPC handler resolves and runs the binary in main; `ForkBuildCard`/`EngineSwitcher` in the renderer only displays what main reports |
| Support-link destinations | Renderer (React components) | i18n catalog | Pure static content/links in `SupportSection.tsx`, `UpdateModal.tsx`; no IPC or main-process involvement |
| Git branch consolidation | Outside the app (git/CI) | — | Not application code at all; operates on the repository itself and `.github/workflows/release.yml`'s checkout refs |
| Social service base URL | Build tooling (Vite define) | Main process (runtime read) | `electron.vite.config.ts` bakes `GRIMOIRE_SOCIAL_BASE_URL` at build time; `electron/main/services/social.ts:40-41` reads `process.env.GRIMOIRE_SOCIAL_BASE_URL` at runtime inside the packaged main bundle |
| Social availability/view-count UI | Renderer | — | `ModsAvailableBadge.tsx`, `SocialProfileHeader.tsx` already branch on field-presence; no main-process change needed for the "don't advertise a check" half of the requirement |
| Experimental route gating | Renderer (page component) | Renderer (Sidebar) | Established pattern is a per-page guard (`Browser.tsx:149`), not an App.tsx route-level gate; Sidebar gating (`Sidebar.tsx:516`) is a separate, already-correct concern |
| Doc-drift correction | Docs (`docs/*.md`) | — | Pure prose; `docs/profile-spec.md` has no runtime counterpart to change |

## Standard Stack

No new libraries, frameworks, or external services are introduced by this phase. Every sub-problem is solved with the existing stack (Electron/Node, GitHub Actions, git, React/i18next, markdown docs). There is nothing to install.

**Installation:** N/A — no new packages this phase.

## Package Legitimacy Audit

**Not applicable.** This phase introduces no new npm/pip/cargo dependencies. It touches an *existing* external binary dependency (`onionviolet/vpkmerge`, a Rust CLI already vendored via `scripts/fetch-vpkmerge.mjs` and already checked out by name+pinned-SHA in `.github/workflows/release.yml:53-58`), but does not add a new package to any `package.json`/`Cargo.toml`. No `npm view`/`package-legitimacy check` gate applies.

## Requirement 1 — REQ-packaged-fork-engine

### Current state (verified this session)

- `scripts/fetch-vpkmerge.mjs:19` pins `const VPKMERGE_VERSION = 'v0.19.0';` and downloads from `https://github.com/Slush97/vpkmerge/releases/download/...` (line 35) — the **stock, upstream** repo, predating the YCoCg fix. `[VERIFIED: scripts/fetch-vpkmerge.mjs:19-25]`
- `.github/workflows/release.yml:53-58` already checks out the **fork** repo instead: `repository: onionviolet/vpkmerge`, `ref: 798f3a7d28f3ef314d8f6ebf51ced0d9fe049445` (a pinned commit SHA, not a tag/release). `[VERIFIED: .github/workflows/release.yml:53-58]`
- `.github/workflows/release.yml:89-95` builds that checkout with `cargo build --locked --release -p vpkmerge-cli`, then runs `pnpm use-local-vpkmerge` **before** `electron-vite build && electron-builder --win` (lines 89-133). `[VERIFIED: .github/workflows/release.yml:89-133]`
- `scripts/use-local-vpkmerge.mjs:76-83` writes two marker files beside the copied binary: `.local-build` and `.ycocg-icon-safe`. `[VERIFIED: scripts/use-local-vpkmerge.mjs:76-83]`
- `electron/main/services/foundryTextureReplace.ts:42-56` (`assertYcocgIconSupport`) **refuses texture replacement outright** in a packaged build unless the `.ycocg-icon-safe` marker sits next to the running binary — it does not silently corrupt, it throws `'Texture replacement requires the forked vpkmerge engine with the YCoCg icon fix...'`. `[VERIFIED: electron/main/services/foundryTextureReplace.ts:42-57]`
- Consequently, **a release built by the current `.github/workflows/release.yml` already carries the correct engine and the correct marker**, and `docs/release-maintenance.md:99-104` documents the operator smoke-testing this exact path, recording that Settings reports `vpkmerge 0.19.0 (798f3a7)`. `[VERIFIED: docs/release-maintenance.md:98-104]`
- `onionviolet/vpkmerge` has **0 GitHub Releases** as of this session (`gh api repos/onionviolet/vpkmerge/releases` → `[]`). `[VERIFIED: gh api, this session]` Its default branch HEAD is `798f3a7` — the exact SHA `release.yml` pins — and that commit's ancestry includes `c626ce0`, "put a build id in --version so local engines are identifiable," which is what makes `vpkmerge --version` print the `(798f3a7)` suffix Settings displays. `[VERIFIED: gh api repos/onionviolet/vpkmerge/commits, this session]`
- Settings already surfaces this via `foundry:engineInfo` (`electron/main/ipc/foundry.ts:412-441`), which runs the *resolved* binary's `--version` rather than re-deriving a path, specifically so the reported version can never diverge from the one that actually built a mod. The renderer side is `ForkBuildCard.tsx`'s `EngineSwitcher`, which already renders `info?.version`, the resolved `path`, and whether it is `bundled` vs. a user-chosen override. `[VERIFIED: electron/main/ipc/foundry.ts:405-441; src/components/settings/ForkBuildCard.tsx:70-160]`

The `EngineInfo` shape consumed by that card:
```ts
// src/types/foundry.ts:440-445
export interface EngineInfo {
    path: string | null;
    version: string | null;
    bundled: boolean;
    error: string | null;
}
```
`[VERIFIED: src/types/foundry.ts:440-445]`

### YCoCg detection mechanism

There is **no runtime feature probe** against the vpkmerge binary itself (the code comment says so explicitly: "There is no safe runtime feature probe in that release"). Instead, `hasVerifiedYcocgIconSupport()` (`electron/main/services/foundryTextureReplace.ts:25-40`) trusts one of two things: (a) in dev, that the resolved binary path lives under a sibling `../vpkmerge/target` build, or (b) in a packaged build, that the `.ycocg-icon-safe` marker file exists next to the binary. This marker is a **packaging attestation**, not a binary inspection — `fetch-vpkmerge.mjs` explicitly deletes it (`fetch-vpkmerge.mjs:115,136`) any time it (re-)installs the stock binary, so a stale marker can never survive a plain `pnpm install`. `[VERIFIED: electron/main/services/foundryTextureReplace.ts:20-40; scripts/fetch-vpkmerge.mjs:114-136]`

### What is actually missing for this requirement

1. **`scripts/fetch-vpkmerge.mjs` still bootstraps the stock engine.** This affects local dev machines that run plain `pnpm install` without also running `pnpm use-local-vpkmerge` (which itself requires a sibling `../vpkmerge` checkout — confirmed **absent** on this machine: `ls C:/Users/wayba/dev/vpkmerge` → no such directory). It does **not** affect the CI-built release artifact, which overwrites whatever `fetch-vpkmerge.mjs` fetched.
2. **There is no independently checksummed, downloadable `onionviolet/vpkmerge` release asset.** `fetch-vpkmerge.mjs`'s existing pattern (a `VPKMERGE_VERSION` tag + a `sha256` per platform in a static `ASSETS` table, downloaded and hash-verified before use — see lines 19-25, 114-118, 124-130) is exactly the shape a "checksum-pinned release" implies, but it requires a *published Release* to point at, and `onionviolet/vpkmerge` doesn't have one.
3. `docs/fork-maintenance.md:65-67` and `.planning/PROJECT.md` Standing Policy ("Fork maintenance") already state the intended end state in policy form: *"The stock `v0.19.0` download remains a fallback only until the fork publishes a versioned, checksum-pinned release. Promote that release in `scripts/fetch-vpkmerge.mjs` rather than silently tracking a moving binary."* `[VERIFIED: docs/fork-maintenance.md:65-67]`

### Open decision this research cannot make

**Whether to (A) publish an actual GitHub Release on `onionviolet/vpkmerge`** with per-platform binaries + sha256 checksums (mirrors `fetch-vpkmerge.mjs`'s existing pattern exactly; lets `release.yml` drop its Rust toolchain setup and `cargo build` steps in favor of a simple download+verify, matching how the stock engine is already fetched) — this is a one-time action against a *different* GitHub repository the same user (`onionviolet`) owns, and is not something this session can do without write access confirmation and a build matrix (win32 is buildable locally; linux-x64/darwin-arm64 need either cross-compilation or a CI workflow in the `vpkmerge` repo itself) — **or (B) leave `release.yml`'s existing build-from-pinned-SHA approach as the release engine path** (already reproducible, already verified working per `docs/release-maintenance.md`), and treat `fetch-vpkmerge.mjs`'s job as strictly "give local dev machines *a* working binary, stock is fine for everything except texture-icon replacement," documenting rather than eliminating that gap.

Recommendation: **(B) is achievable entirely within this repo and should be the default plan** unless the user explicitly wants to invest in cutting `onionviolet/vpkmerge` releases. If (B), the remaining concrete work is: update `fetch-vpkmerge.mjs`'s header comment and `docs/fork-maintenance.md`/`third-party-notices.md` to stop describing the "checksum-pinned release" as pending work if it isn't going to happen, OR keep the aspiration documented and explicitly descope it from this phase's Definition-of-Done with a written rationale. Either way, do not claim SC1 is fully met by (B) alone without addressing this gap explicitly, since the requirement's literal text calls for `scripts/fetch-vpkmerge.mjs` to change.

### Verification note (engine-tier, cannot be automated)

SC1's second half — "replacing both a normal icon and a DXT5-YCoCg icon through it produces correct colours in game" — **requires a packaged build and a running Deadlock session.** This is exactly the class of check `docs/ingame-verification-record.md` exists for (see IG-01, currently `blocked` per Phase 1's D-26 decision, for the closest existing analog: it needs precisely "the fork's locally-built vpkmerge engine" to unblock). No CDP-driven script can assert in-game pixel color. Flag this for a human/game-session verification row rather than an automated task.

## Requirement 2 — REQ-fork-support-destination

### Every fork-owned surface carrying a Discord/support link (enumerated this session)

| Location | What it does today | Verdict |
|---|---|---|
| `src/components/UpdateModal.tsx:229-240` | Bare "Join Discord" button (`href="https://discord.gg/KgYGHEMq2P"`) next to "Close" in the update-available modal, with **no fork-owned alternative offered in this component at all** | **Must fix.** No GitHub Issues link exists here as a counterweight; a fork user hitting an update problem is offered only upstream's Discord. `[VERIFIED: src/components/UpdateModal.tsx:228-244]` |
| `src/components/settings/sections/SupportSection.tsx:155-184` | "Found a bug or have a feature request?" copy, followed by two buttons side-by-side: GitHub Issues → `FORK_REPO/issues` (fork-owned, correct) and "Join Discord" → `DISCORD_INVITE` (upstream) | **Must fix the Discord half.** The GitHub Issues button is already correct and should be kept as-is. The copy at line 159 *does* disclaim "not a fork channel," but the button is still positioned as a parallel support option for bug/feature-request traffic. `[VERIFIED: src/components/settings/sections/SupportSection.tsx:155-184]` |
| `src/components/settings/sections/SupportSection.tsx:194-199, 280-289` | Bug-report generator's help text literally says *"paste it into Discord or a GitHub issue"*, and the generated-report action row offers an "Open Discord" button alongside "Open GitHub issue" | **Must fix.** This actively instructs users to paste a diagnostic bug report — containing fork-specific behavior upstream cannot reproduce or support — into upstream's community. `[VERIFIED: src/components/settings/sections/SupportSection.tsx:194-199, 280-298]` |
| `src/components/settings/sections/SupportSection.tsx:96-150` ("About Grimoire") | Attribution block: fork disclaimer paragraph, links to `UPSTREAM_REPO`, `UPSTREAM_SITE`, `FORK_REPO`, `FORK_LICENSE` | **Keep as-is.** This is attribution, not support-seeking; already correctly labeled and already links the fork repo too. |
| `src/components/KofiSupportButton.tsx`, `src/components/performance/PerformanceConfigCard.tsx:39-50` | "Buy Slush97 a coffee" / "Support Sqooky" Ko-fi buttons | **Keep as-is** — explicitly required to stay pointed upstream per `docs/third-party-notices.md:17-19` and `.planning/PROJECT.md` Standing Policy. `[VERIFIED: src/components/KofiSupportButton.tsx:20-46; docs/third-party-notices.md:17-19]` |
| `electron/main/services/discordRpc.ts:37-44` (`BUTTONS`) | Discord Rich Presence card buttons: `{ label: 'Grimoire by Slush97', url: 'https://grimoiremods.com' }`, `{ label: 'Grimoire Discord', url: 'https://discord.gg/KgYGHEMq2P' }`, shown on the user's own Discord profile to *their friends*, not as an in-app "get help" flow | **Borderline — flag for explicit decision, lean keep.** The in-code comment already states these are deliberately upstream-attributed and publicly labeled ("Both destinations are the upstream project's, not the fork's... the labels name whose they are"). This is promotional attribution visible to third parties, not a user seeking support being routed to a channel that can't help them. `[VERIFIED: electron/main/services/discordRpc.ts:37-44]` |
| `README.md:16` | "please show its creator some love on GitHub, grimoiremods.com, or Discord" | **Keep** — credit-framing, not a support funnel. |

### The distinguishing rule (already established in this codebase, worth reusing verbatim)

`docs/fork-maintenance.md:15-20` (Attribution section) already draws exactly the line this requirement needs: keep upstream's Ko-fi and upstream's presence *labeled honestly as upstream's*, while every fork-owned surface's actual support/bug-report flow must be fork-owned. `.planning/PROJECT.md`'s Standing Policy row for "Third-party notices" states *"The Ko-fi link and the Discord invite belong to the upstream project, not this fork, and their labels must stay explicit about that"* — read together with REQUIREMENTS.md's explicit carve-out ("**Attribution and the Ko-fi label** stay as the third-party-notices ADR requires... they belong to upstream"), the coherent reading is: **the Discord invite is not blanket-protected the way Ko-fi is.** Where it functions as pure credit (About block, README, RPC card), it stays. Where it functions as a support/bug-report destination (UpdateModal, the SupportSection buttons beside "GitHub Issues" and beside the bug-report generator), it must move to a fork-owned destination or be removed. This is an interpretation, not a locked decision — flag it for the plan to state explicitly rather than assume.

### Fork's own support destination

No fork-owned Discord or other chat channel exists anywhere in the codebase or docs found this session. `FORK_REPO/issues` (`https://github.com/onionviolet/grimoire/issues`) is **already wired and working** as a GitHub Issues destination in `SupportSection.tsx` (`FORK_REPO` constant, line 17; used at lines 164, 291). The mechanically simplest, lowest-risk resolution — and the one this research recommends absent a stated preference — is: **standardize on `FORK_REPO/issues` everywhere a support destination is needed**, removing (not relabeling) the Discord buttons from `UpdateModal.tsx` and from the bug-report-adjacent spots in `SupportSection.tsx`, while leaving the "About Grimoire" attribution block, Ko-fi, and (pending the decision above) `discordRpc.ts` untouched.

### Translation-key note

`joinDiscordTitle`'s existing fallback string ("Join the original Grimoire Discord, run by Slush97", `src/locales/en/translation.json:1293`) already correctly labels the destination even in the surfaces flagged above — the requirement's complaint is about *placement/function* (offering it as a support venue), not about *mislabeling*. Per `CLAUDE.md`'s i18n rules, deleting a key's usage and not reusing it for a new meaning is the correct pattern if these buttons are removed outright; if any Discord mention is reworded rather than removed, delete the old key and add a new one rather than editing the string in place (stale translations would otherwise keep showing the old claim).

## Requirement 3 — REQ-upstream-merge-aug-2026

### Branch inventory (verified live this session, not from the doc)

`git branch -vv` plus `git rev-list --left-right --count main...<branch>` for every local branch (left = commits in `main` not in the branch = "behind"; right = commits in the branch not in `main` = "ahead"):

| Branch | Ahead of `main` | Behind `main` | Disposition |
|---|---|---|---|
| `structural-refactor-7` | **5** | 95 | **Holds unmerged work.** Only branch in this state. |
| `chore/agent-dev-tooling` | 0 | 193 | Fully merged — delete |
| `codex/chat-wheel-tab` | 0 | 321 | Fully merged — delete |
| `codex/foundry-build-diff` | 0 | 88 | Fully merged — delete (local + `origin`) |
| `codex/foundry-source-panels` | 0 | 236 | Fully merged — delete (local + `origin`) |
| `dev-slot-seeding` | 0 | 69 | Fully merged — delete (already folded into `main`; no fast-forward needed anymore) |
| `fix/sound-taxonomy-and-claims-index` | 0 | 93 | Fully merged — delete |
| `foundry-forge-and-spec-audit` | 0 | 229 | Fully merged — delete (local + `origin`) |
| `merge/upstream-1.26` | 0 | 154 | Fully merged — delete |
| `merge/upstream-2026-08` | 0 | 58 | Fully merged — delete (checked out in worktree `C:/Users/wayba/dev/grimoire-merge`; remove worktree first) |
| `portrait-alias-sweep` | 0 | 116 | Fully merged — delete (local + `origin` + worktree `C:/Users/wayba/dev/grimoire-alias-sweep`) |
| `worktree-agent-a4ad3a26969f16ebb` | 0 | 146 | Fully merged — delete |

`[VERIFIED: git rev-list --left-right --count main...<branch>, run this session for all 12 branches]`

**Discrepancy with REQUIREMENTS.md/ROADMAP.md text:** those docs describe `structural-refactor-7` as "5 ahead and 38 behind." This session measures **5 ahead, 95 behind** against the current `main` (`96dd7bc`, itself 58 commits ahead of `origin/main` — i.e. unpushed). The ahead-count (5) matches exactly and is what matters for "holds unmerged work"; the behind-count has simply grown because `main` advanced (Phase 1's 8 plans landed) since the plan doc's figures were measured on 2026-08-05. Not a blocker, but the planner should not be surprised if `docs/merge-plan-upstream-2026-08.md`'s numeric table looks stale — the branch *dispositions* it lists are still accurate (re-verified below), only the raw counts moved.

### `structural-refactor-7`'s 5 unmerged commits (verified)

```
227dbc9 fix(foundry): preserve Global inventory links after consolidation
4e82d2e refactor(foundry): require browse hero context
675a41c refactor(sounds): one vocabulary, and every answer carries its reason
eb2ff8c refactor(claims): derive path ownership once, for both surfaces
260bb0d refactor(identity): fold four hero name tables into one
```
`[VERIFIED: git log main..structural-refactor-7 --oneline]` — matches `docs/merge-plan-upstream-2026-08.md:346-351` exactly.

A trial merge (`git merge-tree --write-tree main structural-refactor-7`) run this session reproduces **exactly the 10 conflicted files the plan doc lists** (`heroPoseModels.ts`, `GlobalSoundBrowse.tsx`, `assetClaims.test.ts` [add/add], `assetClaims.ts` [add/add], `globalSoundSections.ts`, `heroPortraitIdentity.ts`, `soundInventory.ts`, `en/translation.json`, `manifest.json`, `Foundry.tsx`), including the two `add/add` conflicts on `assetClaims.ts` the doc flags as a design collision requiring a human call, not an auto-merge. `[VERIFIED: git merge-tree --write-tree main structural-refactor-7, run this session]` **The plan document's Phase B mechanics are still accurate as of this session** — only its stated ahead/behind counts are stale.

### `docs/merge-plan-upstream-2026-08.md` status

The file is **currently modified in the working tree** (`git status --short` → `M docs/merge-plan-upstream-2026-08.md`), with one uncommitted diff already present: it adds a `GRIMOIRE_SOCIAL_BASE_URL=https://example.invalid pnpm build` step plus a stop-and-ask rule #9 about never putting a real social URL in a verification build. `[VERIFIED: git diff docs/merge-plan-upstream-2026-08.md, run this session]` This uncommitted edit should be reconciled (committed or discarded deliberately) before this phase's branch work begins, since "the working tree must be clean" is the plan's own Phase 0 precondition (`docs/merge-plan-upstream-2026-08.md:101`).

Phase A (the upstream merge itself) is **already done**: `main` contains merge commit `2924011` ("merge: upstream catch-up..."), matching REQUIREMENTS.md's "Delivered" table entry for `REQ-upstream-merge-aug-2026 (Phase A)`. Phase B (`structural-refactor-7`) and Phase C (branch deletion) are **not done** — this phase's actual remaining work.

### Worktrees currently attached (must be removed before deleting their branches)

```
C:/Users/wayba/dev/grimoire                                            [main]            <- primary
C:/Users/wayba/dev/grimoire/.claude/worktrees/agent-a4ad3a26969f16ebb   [structural-refactor-7]
C:/Users/wayba/dev/grimoire-alias-sweep                                [portrait-alias-sweep]
C:/Users/wayba/dev/grimoire-merge                                      [merge/upstream-2026-08]
```
`[VERIFIED: git worktree list, run this session]`

### Success Criterion 3, exactly how to verify it

*"`git branch` shows no branch holding unmerged work, the fully merged branches are gone, and the temporary merge plan document has been retired."*

- "No branch holding unmerged work": `git branch --no-merged main` must return empty. Today it returns `structural-refactor-7` only — confirmed this session.
- "Fully merged branches are gone": after Phase B lands and Phase C runs, `git branch -a` should list only `main` (and `structural-refactor-7` only if the phase author consciously decides to keep it open past this phase — but the requirement text implies it should be folded in, not just evaluated).
- "The temporary merge plan document has been retired": `docs/merge-plan-upstream-2026-08.md` deleted, per its own line 3 ("Delete it once Phase C is done and pushed") and line 458.

**Stop-and-ask gates already written into the plan doc** (`docs/merge-plan-upstream-2026-08.md` §8, lines 434-449) should be honored by the plan rather than re-derived: confirm `structural-refactor-7`'s worktree agent has finished before merging it (rule 1 under §6), resolve the `assetClaims.ts` add/add collision by human decision (not automatic pick), and treat `git push origin --delete` as requiring explicit confirmation.

## Requirement 4 — REQ-social-service-disposition

### What a shipped installer points at today

`.github/workflows/release.yml:119` bakes `GRIMOIRE_SOCIAL_BASE_URL: https://grimoire-social.slusheliott.workers.dev` — **the upstream (Slush97-owned) production Worker** — into every packaged Windows build. `[VERIFIED: .github/workflows/release.yml:115-119]` This is consistent with the already-recorded decision in `.planning/PROJECT.md`/STATE.md: *"2026-07-29: This fork relies on the upstream social deployment... revisit in Phase 2."* `ci.yml:126` bakes a separate, non-production stub (`https://grimoire-social.ci.workers.dev`) for CI builds only. `[VERIFIED: .github/workflows/ci.yml:115-126]`

`electron/main/services/social.ts:36-41` reads this at runtime from `process.env.GRIMOIRE_SOCIAL_BASE_URL` (injected via `electron.vite.config.ts`'s `define`), falling back to `http://localhost:8787` if unset — the value is baked at build time, not user-configurable in a shipped build. `[VERIFIED: electron/main/services/social.ts:36-41]`

### The sibling repo, its remote, and the three unpushed commits

`../grimoire-social` **exists on disk** (`C:/Users/wayba/dev/grimoire-social`) and its only git remote is `origin -> https://github.com/Slush97/grimoire-social.git` — there is no `onionviolet/grimoire-social` fork yet. `[VERIFIED: git remote -v inside ../grimoire-social, run this session]` Three commits sit ahead of `origin/main` with a clean working tree:

```
13a5695 fix(profiles): never fail a detail read when no execution context exists
754efe7 feat(social): add revalidation cron, coalesced view counts, availability wire fields
5f870bd chore(types): add mod-availability and owner view-count wire fields
```
`[VERIFIED: git log origin/main..HEAD --oneline inside ../grimoire-social, run this session]`

### `ci.yml`'s hardcoded checkout, and `check-sibling-repos.mjs`

Both `.github/workflows/ci.yml:30` and `.github/workflows/release.yml:56` and `scripts/check-sibling-repos.mjs:27` (`repo: 'https://github.com/Slush97/grimoire-social.git'`) hardcode `Slush97/grimoire-social` as the sibling to check out/clone. If the disposition decision is "fork to onionviolet," **all three** need repointing, not just the two workflow files the requirement text names. `[VERIFIED: .github/workflows/ci.yml:27-30; .github/workflows/release.yml:42-47; scripts/check-sibling-repos.mjs:19-27]`

### Migration 0005 and the ordering constraint

```sql
-- migrations/0005_revalidation_and_views.sql (grimoire-social), lines 7-15
ALTER TABLE published_profiles ADD COLUMN mods_available INTEGER;
ALTER TABLE published_profiles ADD COLUMN mods_revalidated_at INTEGER;
ALTER TABLE published_profiles ADD COLUMN unavailable_mod_ids TEXT;
ALTER TABLE published_profiles ADD COLUMN view_count INTEGER NOT NULL DEFAULT 0;
```
`[VERIFIED: C:/Users/wayba/dev/grimoire-social/migrations/0005_revalidation_and_views.sql:7-15]` The requirement's warning — "the profile routes select its columns" and will 500 without it — is a direct consequence: any Worker code from commit `754efe7`/`5f870bd` (which is what would be deployed if this fork forks-and-deploys) selects these columns, so deploying that code against a D1 database that has not run migration 0005 breaks every profile-detail read. This must be sequenced: **migration applied to the target D1 database before the new Worker code is deployed to it**, not the other way around, and not simultaneously without a transactional guarantee (D1 migrations and Worker deploys are two separate, non-atomic operations).

### The "check that will never run against it" concern is already handled client-side, correctly

This was expected to need a fix; it does not. `src/components/social/availability.ts:44-53` (`resolveModsAvailability`) and `src/types/social.ts:1-30` already distinguish **absent** (the deployed service doesn't send the field at all — today's actual state against the upstream Worker) from **null** (the service tracks it but hasn't checked yet) from a real count. `ModsAvailableBadge.tsx:47` (`if (availability.kind === 'unsupported') return null;`) already renders nothing rather than a permanent "not checked yet" badge when the field is absent — the exact failure mode the requirement warns about is already prevented, with an explicit code comment stating why (`availability.ts:22-24`, `ModsAvailableBadge.tsx:27-30`). The owner-only view count (`SocialProfileHeader.tsx:373`, gated on `viewCount !== undefined`) follows the identical pattern. `[VERIFIED: src/components/social/availability.ts:19-53; src/components/social/ModsAvailableBadge.tsx:16-47; src/components/social/SocialProfileHeader.tsx:209-380]`

**Implication for the plan:** no client-side code change is required for "no surface advertises a check that will never run against it" *regardless* of which disposition is chosen — the code was deliberately built to degrade correctly either way (per `docs/remaining-work-phases.md:390-397`, this was a conscious 2026-07-29 design decision, not an oversight later noticed). Verify this is still true rather than re-solving it; a regression test asserting `resolveModsAvailability({ mod_count: 3 })` (no `mods_available` key) → `{ kind: 'unsupported' }` would be cheap insurance if one doesn't already exist (`src/components/social/availability.test.ts` exists — check its coverage before assuming a gap).

### The `tsc -b --force` vs `pnpm typecheck` divergence — confirmed real

`pnpm typecheck` runs `tsc -b` (`package.json` scripts.typecheck). Both the on-disk `docs/remaining-work-phases.md:407-410` and this phase's own Notes describe the same mechanism: TypeScript project references cache incremental build info, so a local `pnpm typecheck` that already succeeded once can report clean without re-resolving `@grimoire/social-types` from the sibling workspace link, while CI (which has no cache and checks out the *actual* `Slush97/grimoire-social` fresh every run) would fail on any drift between the local sibling and what's really on `origin/main` upstream. The documented verification recipe — temporarily revert/stash the sibling file(s) in question and run `pnpm exec tsc -b --force` — is correct and should be the phase's actual verification step for anything touching this boundary, not `pnpm typecheck` alone.

### Two client-side items gated on the disposition decision

1. **GameBanana mod titles instead of raw IDs.** `src/components/social/ModsAvailableBadge.tsx:66` currently builds the tooltip as `` `GameBanana: ${unavailableModIds.map((id) => `#${id}`).join(', ')}` `` — confirmed still numeric-only. `[VERIFIED: src/components/social/ModsAvailableBadge.tsx:64-67]` Low priority per the requirement text ("only matter once a service is chosen"); only worth doing if the disposition makes `unavailable_mod_ids` populate in practice.
2. **TOS gate drift — confirmed and precisely located.** Design doc says "first login": `docs/social-architecture.md:256` ("Add a one-paragraph TOS at first login..."), `:422` ("TOS modal at first login"). Code fires it at first **publish**, not login, and persists acceptance in `localStorage` (per-machine, clearable): `src/components/social/PublishDialog.tsx:14` (`TOS_STORAGE_KEY = 'grimoire-social-tos-accepted-v1'`), `:23-33` (`hasAcceptedTos`/`markTosAccepted` against `localStorage`), `:219-235` (gate UI shown inline in the publish dialog). `[VERIFIED: docs/social-architecture.md:256,422; src/components/social/PublishDialog.tsx:14,23-33,219-235]` The requirement is explicit that this is a decision (move the gate to first-login, or correct the design doc to say "first publish") — not a bug an implementer should silently pick a side on.

### Open decision this research cannot make

Fork-and-deploy to `onionviolet/grimoire-social` (repoint 3 remotes/checkouts, push 3 pending commits, apply migration 0005, deploy Worker, rebake `GRIMOIRE_SOCIAL_BASE_URL`) vs. upstream-PR the cron+counter work vs. stay dormant and make the installer's URL choice and the "wave 3 features are inert" state an explicit, documented fact rather than an implicit one. All three are legitimate; none is free. Recommend surfacing this as the first thing `/gsd-discuss-phase` (if run before planning) or the plan's own decision log resolves, since it gates whether any Cloudflare/Worker-side work belongs in this phase's task list at all.

## Requirement 5 — REQ-experimental-gate-and-doc-drift

### Chat Wheel route gap — confirmed exactly as described

`src/App.tsx:98` mounts the route unconditionally:
```tsx
<Route path="chat-wheel" element={<ChatWheel />} />
```
`[VERIFIED: src/App.tsx:81-101, quoted line 98]` — no guard, no redirect, nothing.

The **sidebar** entry, by contrast, is correctly gated:
```ts
// src/components/Sidebar.tsx:516
if (item.experimental === 'chatWheel') return settings?.experimentalChatWheel;
```
`[VERIFIED: src/components/Sidebar.tsx:503-519]`

`src/pages/ChatWheel.tsx` contains **zero references** to `experimentalChatWheel` or `settings` (confirmed via grep this session) — the page component itself never checks the flag, so navigating directly to `#/chat-wheel` (URL bar, a stale bookmark, any deep link) reaches the full page regardless of the setting.

### The established, in-repo fix pattern (reuse, don't invent)

`src/pages/Browser.tsx:149-162` is the existing precedent for exactly this situation — a page-level early-return that renders an `EmptyState` when its own experimental flag is off, in the page component itself rather than in `App.tsx`'s route table:
```tsx
// src/pages/Browser.tsx:149-162
if (!settings?.experimentalBrowser) {
    return (
        <EmptyState
            icon={Globe}
            title={<Tx k="browser.disabled.title" fallback="Browser is off" />}
            description={
                <Tx
                    k="browser.disabled.description"
                    fallback="Enable the in-app browser in Settings to use this page."
                />
            }
        />
    );
}
```
`[VERIFIED: src/pages/Browser.tsx:149-162]` **Recommendation: mirror this exact pattern in `ChatWheel.tsx`**, gating on `settings?.experimentalChatWheel`, rather than adding conditional logic to `App.tsx`'s route table (which has no precedent for it and would diverge from how every other experimental page in this codebase already self-gates).

### `docs/profile-spec.md` doc-drift — confirmed, three instances (requirement text names only one)

```
docs/profile-spec.md:3   "A portable JSON format for sharing mod loadouts between mod managers."
docs/profile-spec.md:5   "...but the schema is intentionally game and manager agnostic."
docs/profile-spec.md:15  "1. Round-trip a user's mod loadout ... between machines and between mod managers."
```
`[VERIFIED: docs/profile-spec.md:3,5,15]` This directly contradicts `CLAUDE.md:203`: *"Portable profile format is Grimoire-only. Don't claim compatibility with other mod managers in copy."* `[VERIFIED: CLAUDE.md, "Portable profile format is Grimoire-only" line]`

The in-app UI copy is **already correct** and should be used as the model for the doc fix: `src/locales/en/translation.json:2812` reads *"This format is Grimoire-only and not compatible with other mod managers."* `[VERIFIED: src/locales/en/translation.json:2812]` `docs/audit-2026-07-28-verdicts.md:341` and `.planning/codebase/CONCERNS.md:258` both independently already flag this exact same doc line as the one remaining copy issue on an otherwise "SHIPPED" feature — this is a known, narrowly-scoped fix, not new territory.

No other "between mod managers" / "manager-agnostic" / "interoperability" claims were found in any other shipped doc, README, or in-app string this session (checked via repo-wide grep across `*.md`, `*.ts`, `*.tsx`, `*.json`). The fix is confined to `docs/profile-spec.md`'s three lines (reword to describe the format's *design* as schema-extensible for other tools without claiming *current* cross-manager compatibility, matching the in-app disclaimer's honesty) plus a scan of the rest of that same file for any similarly-worded passage the three quoted lines don't already cover.

## Common Pitfalls

### Pitfall 1: Assuming REQ-packaged-fork-engine is unstarted work
**What goes wrong:** Planning a full engine-pinning implementation from scratch (new IPC handler, new Settings card, new download logic) that already exists.
**Why it happens:** The requirement's phrasing ("A checksum-pinned release is promoted... a packaged Windows build reports that engine version in Settings") reads like nothing has been built, but `EngineInfo`/`ForkBuildCard`/`use-local-vpkmerge.mjs`/the release.yml pinned checkout are all already in place and already working per `docs/release-maintenance.md`'s own documented smoke test.
**How to avoid:** Scope tasks to the two real gaps: (1) decide+possibly-execute the fetch-vpkmerge.mjs/onionviolet-release question, (2) the in-game color verification, which is an evidence-gathering task, not a code task.
**Warning signs:** A task that says "build an engine version reporter" or "add a Settings card for the engine" — both exist.

### Pitfall 2: Stripping every Discord reference as "support destination" cleanup
**What goes wrong:** Overcorrecting and removing the attribution-context Discord mentions (About block, README, RPC card), which the Standing Policy in `.planning/PROJECT.md` explicitly protects, alongside the genuine support-context ones.
**Why it happens:** A surface-level grep for `discord.gg` returns both kinds without distinguishing function.
**How to avoid:** Use the table in Requirement 2 above — six Discord touchpoints were enumerated and classified this session; only three are "must fix."
**Warning signs:** A diff that removes `UPSTREAM_REPO`/`UPSTREAM_SITE` links or the "About Grimoire" block, or that deletes `discordRpc.ts`'s `BUTTONS` array without an explicit decision to do so.

### Pitfall 3: Treating `docs/merge-plan-upstream-2026-08.md`'s stated ahead/behind numbers as current
**What goes wrong:** A plan step that says "confirm `structural-refactor-7` is 5 ahead, 38 behind" will fail its own check, since it's now 95 behind, and an executor might (wrongly) treat that as "something changed, stop and ask" per the doc's own rule 1.
**Why it happens:** The doc was measured 2026-08-05; Phase 1 landed 8 more plans onto `main` since.
**How to avoid:** Re-verify live with `git rev-list --left-right --count main...structural-refactor-7` before trusting the doc's numbers; only the *ahead* count (5, unchanged) and the conflict file list (10 files, reproduced identically this session) matter for correctness — the *behind* count is cosmetic.
**Warning signs:** A verification task written as an exact-number assertion against the doc's table rather than a live re-measurement.

### Pitfall 4: Fixing the social "advertises a check that will never run" concern with new code
**What goes wrong:** Writing new gating logic for `ModsAvailableBadge`/view-count display that duplicates what `resolveModsAvailability` and the `viewCount !== undefined` check already do correctly.
**Why it happens:** The requirement text describes this as an outstanding problem; it reads as unsolved.
**How to avoid:** Verify existing behavior with a test (or read `availability.test.ts`) before writing new code; this half of the requirement may already be satisfied.
**Warning signs:** A task titled "hide the availability badge when the service doesn't support it" — it's already hidden.

### Pitfall 5: Gating Chat Wheel's route in `App.tsx` instead of the page component
**What goes wrong:** Introducing a new, one-off gating mechanism (conditional `<Route>` element, or a wrapper/HOC) that no other experimental page in this codebase uses.
**Why it happens:** `App.tsx` is the obvious place to look when the bug report says "the route is reachable."
**How to avoid:** Follow `Browser.tsx:149-162`'s exact precedent — gate inside `ChatWheel.tsx` itself.
**Warning signs:** A diff touching `App.tsx`'s `<Route>` list for this fix.

## Code Examples

### The existing "checksum-pinned release" pattern, for reuse if Option A (publish a vpkmerge release) is chosen
```js
// scripts/fetch-vpkmerge.mjs:19-25 (current, stock-pointed — the shape to replicate against a new tag/owner)
const VPKMERGE_VERSION = 'v0.19.0';
const ASSETS = {
    'linux-x64':  { name: 'vpkmerge-linux-x86_64',      sha256: 'fc33ee3ea6ea551fb5866e0077effb725da16e935eab07c1a2a407f10028a92c' },
    'darwin-arm64': { name: 'vpkmerge-macos-aarch64',    sha256: '418f650dd6afff9228d8fa9c289bb1a4a01488191bb54636b69aaca0c4f8be28' },
    'win32-x64':  { name: 'vpkmerge-windows-x86_64.exe', sha256: '7c85e2e5830621e4a6cd4dea848cb23b57fa0272b87e044e59a571424e9d52d0' },
};
```
`[VERIFIED: scripts/fetch-vpkmerge.mjs:19-25]` — the file already hash-verifies every download (`fileExistsWithHash`, `sha256File`, lines 38-52) and refuses to install on a mismatch (lines 126-130). If `onionviolet/vpkmerge` ever gets a Release, only `VPKMERGE_VERSION`, `downloadUrl`'s owner segment (line 35: `https://github.com/Slush97/vpkmerge/releases/...` → `onionviolet`), and the three `sha256` values need to change.

### The existing experimental-page gate pattern to copy into `ChatWheel.tsx`
```tsx
// src/pages/Browser.tsx:149-162 — copy this shape, swap the flag and copy keys
if (!settings?.experimentalBrowser) {
    return (
        <EmptyState
            icon={Globe}
            title={<Tx k="browser.disabled.title" fallback="Browser is off" />}
            description={<Tx k="browser.disabled.description" fallback="Enable the in-app browser in Settings to use this page." />}
        />
    );
}
```
`[VERIFIED: src/pages/Browser.tsx:149-162]`

## Runtime State Inventory

This phase includes rename/consolidation-adjacent work (branch deletion, a social service repoint) even though it isn't a classic rename phase, so this inventory is included.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `../grimoire-social`'s D1 database (production, at `grimoire-social.slusheliott.workers.dev`) does not have migration 0005 applied (unverifiable from this repo — the Worker is upstream-owned and not reachable from here). If disposition = fork-and-deploy, a **fresh** D1 database under the new deployment needs 0005 applied before the Worker that selects those columns deploys. If disposition = stay dormant, no data migration needed. | Decision-gated; see Requirement 4 |
| Live service config | The production `GRIMOIRE_SOCIAL_BASE_URL` baked into `release.yml` is the one config value this phase most directly controls | Code edit to `.github/workflows/release.yml:119` once disposition is decided |
| OS-registered state | None found. This phase does not touch OS-level registrations (no Task Scheduler, pm2, launchd, systemd surfaces are in scope). | None |
| Secrets/env vars | `GRIMOIRE_SOCIAL_BASE_URL` (build-time, not a secret — a public Worker URL); no SOPS/keychain keys are renamed or touched by this phase | None beyond the URL value itself |
| Build artifacts | `resources/vpkmerge/*` (gitignored, fetched/copied at install or packaging time) will differ in provenance depending on the fetch-vpkmerge.mjs decision, but nothing stale is checked into git | None — already gitignored, regenerated per build |

**Git branches are the closest analog to "OS-registered state" here** and are fully covered in Requirement 3 above (11 branches to delete, 1 to merge, with worktrees to remove first).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Publishing a checksum-pinned `onionviolet/vpkmerge` GitHub Release (Option A) is out of this phase's default scope absent explicit user direction, because it requires action against a sibling repository and a cross-platform build matrix this session cannot verify is wanted. | Req 1, Open decision | If the user actually wants Option A, the plan under-scopes and ships a phase that doesn't fully satisfy the requirement's literal text. |
| A2 | `electron/main/services/discordRpc.ts`'s Rich Presence buttons are attribution, not a "support destination," and should be left untouched by this phase. | Req 2, borderline row | If the user considers RPC buttons a support-adjacent surface, the plan under-fixes; low severity since the code comment already documents correct upstream labeling there. |
| A3 | `FORK_REPO/issues` (GitHub Issues on `onionviolet/grimoire`) is the intended fork support destination, absent any stated alternative (no fork Discord/forum exists anywhere in the repo or docs found this session). | Req 2, recommendation | If the user actually wants a different destination (a new Discord, a forum, email), the plan wires the wrong link everywhere. |
| A4 | The three unpushed `../grimoire-social` commits are safe to push to a new `onionviolet/grimoire-social` fork remote without further review, if that disposition is chosen. | Req 4 | Low risk — commits are already reviewed/merged locally (clean working tree, coherent commit messages) but were never code-reviewed by anyone at Slush97's project; if the disposition is "offer upstream as a PR" instead, this assumption doesn't apply and no fork/push happens. |

**If this table is empty:** N/A — see above; four items need explicit confirmation.

## Open Questions

1. **fetch-vpkmerge.mjs / onionviolet/vpkmerge release strategy (Req 1)**
   - What we know: CI/release builds already work correctly via pinned-SHA source builds; no GitHub Release exists on `onionviolet/vpkmerge` to point a checksum-pinned downloader at.
   - What's unclear: whether the user wants to invest in cutting an actual Release (needs a build matrix or manual per-platform builds) versus accepting the current build-from-source approach as sufficient and scoping `fetch-vpkmerge.mjs` changes down to documentation/comment fixes only.
   - Recommendation: default to the lower-scope option (document current behavior, keep build-from-source) and let the plan or a discuss-phase step surface the higher-scope option as a choice rather than assume it.

2. **Support destination exact form (Req 2)**
   - What we know: `FORK_REPO/issues` already exists and works; no fork Discord/chat exists.
   - What's unclear: whether "decide the fork's support destination" implies creating something new (a Discord server, a Discussions board) versus just consolidating onto what already exists.
   - Recommendation: consolidate onto GitHub Issues (zero new infrastructure) unless the user states otherwise.

3. **Discord Rich Presence buttons (Req 2)**
   - What we know: labeled correctly today, visible to third parties on the user's Discord profile, not literally a "get help" flow initiated by the app for its own user.
   - What's unclear: whether the phase author considers this in-scope for "no fork-owned surface sends a user to the upstream project's support channel."
   - Recommendation: leave untouched; flag explicitly in the plan so it's a conscious inclusion decision, not a silent omission.

4. **Social service disposition (Req 4)** — the core three-way decision (fork-and-deploy / upstream-PR / stay-dormant). This is the single largest open decision in the phase and should be resolved before task-level planning for Req 4 begins.

5. **structural-refactor-7's worktree agent status (Req 3)**
   - What we know: the branch is checked out in `.claude/worktrees/agent-a4ad3a26969f16ebb`, and `docs/merge-plan-upstream-2026-08.md` explicitly says "STOP. Confirm with the repo owner before starting this phase... If an agent is still working there, merging it now will fight that agent."
   - What's unclear: whether that worktree is still active or abandoned (this research did not attempt to determine agent liveness — out of scope for a research pass, and possibly stale/safe to assume abandoned given Phase 1 has since completed and STATE.md shows no reference to an active agent there).
   - Recommendation: the plan's first task for Req 3 should confirm this worktree is inactive before merging.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `gh` CLI (GitHub) | Verifying `onionviolet/vpkmerge` releases/commits, and any release-cutting work | ✓ | — (used successfully this session) | — |
| Sibling `../vpkmerge` checkout | `pnpm use-local-vpkmerge` for local dev builds | ✗ (confirmed absent: `C:/Users/wayba/dev/vpkmerge` does not exist) | — | CI does its own checkout+build; not needed for the release pipeline itself, only for a developer wanting to build vpkmerge locally |
| Sibling `../grimoire-social` checkout | typecheck/build resolving `@grimoire/social-types`; migration file access | ✓ (present at `C:/Users/wayba/dev/grimoire-social`, clean tree, 3 unpushed commits) | — | `scripts/check-sibling-repos.mjs` already fails loudly if absent |
| Rust toolchain (`cargo`, `stable-x86_64-pc-windows-msvc`) | Only needed if building `vpkmerge` locally (Option B path doesn't require this on a dev machine that just uses the stock/downloaded binary) | Not verified this session (no `cargo build` was attempted) | — | Not required for this phase's planning/execution unless the plan chooses to build vpkmerge locally |
| A packaged Windows build + running Deadlock | SC1's in-game color verification | ✗ (not available in this research session) | — | Must go to a human/game-session verification record, not an automated task |

**Missing dependencies with no fallback:**
- A running Deadlock session for the in-game YCoCg color check (SC1). No automated substitute exists; route to `docs/ingame-verification-record.md`-style tracking.

**Missing dependencies with fallback:**
- Sibling `../vpkmerge` checkout — only needed for local engine builds, not for the release pipeline itself or for most of this phase's other tasks.

## Validation Architecture

`.planning/config.json` has no `workflow.nyquist_validation` key (absent = enabled), so this section is included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.9 (`vitest run` / `vitest`), config in `vitest.config.ts` |
| Config file | `vitest.config.ts` (existing, no changes needed) |
| Quick run command | `pnpm exec vitest run <path-to-file>` |
| Full suite command | `pnpm test` (`vitest run`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-packaged-fork-engine | Settings reports engine version/path/bundled correctly for both bundled and override cases | unit (existing coverage likely, verify) | `pnpm exec vitest run electron/main/services/foundryTextureReplace.test.ts` | ✅ (`foundryTextureReplace.test.ts` already tests `hasVerifiedYcocgIconSupport`) |
| REQ-packaged-fork-engine | Actual in-game color correctness | manual-only (engine-tier) | N/A | ❌ — needs a `docs/ingame-verification-record.md`-style row, not a Vitest file |
| REQ-fork-support-destination | No `discord.gg/KgYGHEMq2P` string remains in `UpdateModal.tsx` or the bug-report action row of `SupportSection.tsx` | unit/smoke (new) | `pnpm exec vitest run src/components/settings/sections/SupportSection.test.tsx` (new file) or a repo-wide grep assertion script | ❌ — Wave 0 gap |
| REQ-upstream-merge-aug-2026 | `git branch --no-merged main` is empty; `docs/merge-plan-upstream-2026-08.md` does not exist | manual/scripted shell check, not Vitest | `git branch --no-merged main` (expect empty) `&&` `test ! -f docs/merge-plan-upstream-2026-08.md` | N/A — shell-verifiable, no test file needed |
| REQ-social-service-disposition | `resolveModsAvailability`/view-count already correctly hide unsupported checks | unit (existing) | `pnpm exec vitest run src/components/social/availability.test.ts` | ✅ — verify coverage is adequate before assuming a gap |
| REQ-experimental-gate-and-doc-drift | `#/chat-wheel` renders a disabled state when `experimentalChatWheel` is false | render/unit (new) | `pnpm exec vitest run src/pages/ChatWheel.test.tsx` (new file, jsdom pragma per Phase 1's `D-01`/`D-03` precedent) | ❌ — Wave 0 gap |
| REQ-experimental-gate-and-doc-drift | `docs/profile-spec.md` no longer claims cross-manager compatibility | manual/grep-scripted | `grep -n "between mod managers\|manager agnostic" docs/profile-spec.md` (expect no match) | N/A — shell-verifiable |

### Sampling Rate
- **Per task commit:** the specific new/changed test file via `pnpm exec vitest run <file>`
- **Per wave merge:** `pnpm test` (full suite) plus `pnpm typecheck` — and for anything touching the `grimoire-social` sibling boundary, additionally `pnpm exec tsc -b --force` after a temporary local revert of the sibling change under test, per the documented divergence in Requirement 4
- **Phase gate:** full suite green (`pnpm typecheck && pnpm lint && pnpm test`), plus the shell-verifiable checks above for branches and doc drift, before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] A render test for `ChatWheel.tsx`'s new experimental-off state, following the `Browser.tsx`/`HeroSelect.test.tsx` jsdom pattern already established in Phase 1 (D-01 through D-04 in `.planning/phases/01-verified-against-the-game/01-CONTEXT.md`)
- [ ] A smoke/unit test (or a scripted grep gate) asserting no fork-owned support surface links `discord.gg/KgYGHEMq2P` outside the allow-listed attribution surfaces
- [ ] No new test framework or config needed — existing Vitest setup covers everything this phase can meaningfully unit-test; the git-branch and doc-drift checks are better served by plain shell assertions than by Vitest files

*(Framework install: none needed — Vitest 4.1.9 already present and configured.)*

## Security Domain

`.planning/config.json` has no `security_enforcement` key (absent = enabled), so this section is included. This phase is low security-surface (no new auth, no new data storage, no new network endpoints introduced by grimoire itself), but two items are worth naming.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | This phase does not touch Steam OpenID or session handling |
| V3 Session Management | No | Social session token handling (`safeStorage`, main-process-only) is untouched by this phase |
| V4 Access Control | Marginal | The `.ycocg-icon-safe` marker + `.local-build` marker in `foundryTextureReplace.ts` are a capability-attestation mechanism, not a security boundary per se, but worth treating with the same "don't accept an unverified assertion" discipline: any future change to `hasVerifiedYcocgIconSupport()` should not weaken it to trust an unverifiable path |
| V5 Input Validation | No new surface | No new user input is accepted by this phase (branch names, URLs, and markdown are developer-controlled, not end-user input) |
| V6 Cryptography | Marginal | `fetch-vpkmerge.mjs`'s sha256 verification of downloaded binaries (`createHash('sha256')`, `sha256File`, lines 38-52) is the one crypto-adjacent mechanism this phase's Req 1 decision touches — if a new release/tag is promoted, its sha256 values MUST be independently computed from the actual downloaded artifact, never copy-pasted from an untrusted source (e.g. a GitHub Release page description) |

### Known Threat Patterns for this phase's surface

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A malicious or compromised `onionviolet/vpkmerge` release/binary being trusted without verification | Tampering | `fetch-vpkmerge.mjs`'s existing sha256-pin-and-verify pattern (lines 38-52, 124-130) already does this correctly; reuse it exactly if a new release is promoted — do not skip the hash check "just this once" |
| Supply-chain risk from GitHub Actions checking out a third-party repo (`onionviolet/vpkmerge`, `Slush97/grimoire-social`) by branch/tag rather than pinned SHA | Tampering | `release.yml` already pins `vpkmerge` by full commit SHA (good practice); `ci.yml`/`release.yml`'s `grimoire-social` checkout is pinned by `ref: main` (a moving branch, not a SHA) — outside this phase's stated scope, but worth flagging as a pre-existing supply-chain soft spot if the social disposition changes the trust boundary (e.g., if `onionviolet` doesn't control `Slush97/grimoire-social`, a malicious push to that branch is fetched into every CI/release run unpinned) |
| Deleting a git branch that turns out to hold unmerged work, losing history | Repudiation/DoS-of-work | `git branch -d` (lowercase) — not `-D` — refuses to delete an unmerged branch; the existing merge-plan doc already enforces this discipline (§7) and this research reproduces its 10-conflict-file list independently, confirming the doc's branch classifications are still trustworthy |

## Sources

### Primary (HIGH confidence — read directly this session)
- Repository source, read via `Read`/`Grep`/`Bash` this session: `scripts/fetch-vpkmerge.mjs`, `scripts/use-local-vpkmerge.mjs`, `electron/main/services/foundryTextureReplace.ts`, `electron/main/ipc/foundry.ts`, `src/components/settings/ForkBuildCard.tsx`, `src/types/foundry.ts`, `.github/workflows/release.yml`, `.github/workflows/ci.yml`, `docs/fork-maintenance.md`, `docs/release-maintenance.md`, `docs/merge-plan-upstream-2026-08.md`, `src/components/UpdateModal.tsx`, `src/components/settings/sections/SupportSection.tsx`, `electron/main/services/discordRpc.ts`, `docs/third-party-notices.md`, `README.md`, `electron/main/services/social.ts`, `src/components/social/availability.ts`, `src/components/social/ModsAvailableBadge.tsx`, `src/types/social.ts`, `src/components/social/PublishDialog.tsx`, `docs/social-architecture.md`, `docs/remaining-work-phases.md`, `scripts/check-sibling-repos.mjs`, `src/App.tsx`, `src/components/Sidebar.tsx`, `src/components/settings/sections/ExperimentalSection.tsx`, `src/pages/Browser.tsx`, `docs/profile-spec.md`, `CLAUDE.md`, `src/locales/en/translation.json`, `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/phases/01-verified-against-the-game/01-CONTEXT.md`, `docs/ingame-verification-record.md`, `../grimoire-social/migrations/0005_revalidation_and_views.sql`
- Live git/gh state, captured this session: `git branch -vv`, `git branch --merged/--no-merged main`, `git rev-list --left-right --count` for all 12 branches, `git worktree list`, `git merge-tree --write-tree main structural-refactor-7`, `git log main..structural-refactor-7`, `gh api repos/onionviolet/vpkmerge`, `gh api repos/onionviolet/vpkmerge/releases`, `gh api repos/onionviolet/vpkmerge/commits`, `git log`/`git status`/`git remote -v` inside `../grimoire-social`

### Secondary (MEDIUM confidence)
- None used — this phase required no external documentation lookups; every question was answerable from the repository and live git/GitHub state.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: N/A — no new stack introduced
- Architecture (engine pinning, support links, branch state, social disposition, experimental gate): HIGH — every claim traced to a specific file:line read this session, cross-checked against docs where they exist
- Pitfalls: HIGH — each pitfall is grounded in a specific discrepancy found between the requirement's literal phrasing and the actual current state of the code

**Research date:** 2026-08-07
**Valid until:** Git branch state (Req 3) and the `main`-vs-`origin/main` divergence are the most time-sensitive facts here and can go stale within days of further commits; re-run the branch/worktree verification commands immediately before executing that requirement's tasks rather than trusting this document's numbers. Everything else (code structure, existing patterns, doc drift locations) is stable for the life of this phase (no fixed expiry needed — re-verify only if the codebase changes materially between research and execution).
