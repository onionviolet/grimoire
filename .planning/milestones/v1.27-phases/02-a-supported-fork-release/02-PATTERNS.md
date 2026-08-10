# Phase 2: A Supported Fork Release - Pattern Map

**Mapped:** 2026-08-07
**Files analyzed:** 10 (5 modified, 1 new render test, 3 doc-only edits, 1 doc retirement)
**Analogs found:** 10 / 10 (all in-repo; social-service repointing is explicitly out of scope per D-01)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `scripts/fetch-vpkmerge.mjs` (doc comment + policy note edit only, per D-02) | utility (build tooling) | file I/O (download+verify) | itself (`docs/fork-maintenance.md:65-67`, `.planning/PROJECT.md` Standing Policy) | exact — no code-shape change, only comment/doc reconciliation |
| `src/components/UpdateModal.tsx` (lines 228-244) | component | request-response (static link) | `src/components/settings/sections/SupportSection.tsx:155-184` | exact — same "support link" role in the same codebase |
| `src/components/settings/sections/SupportSection.tsx` (lines 155-184, 194-298) | component | request-response (static link + text) | itself, lines 96-150 (the correct "About" attribution block already in the same file) | exact — internal precedent, same file |
| `src/pages/ChatWheel.tsx` (add experimental-off guard) | component (page) | request-response (route render) | `src/pages/Browser.tsx:149-162` | exact — RESEARCH.md-identified precedent |
| `src/pages/ChatWheel.test.tsx` (new) | test | request-response (render test) | `src/components/common/HeroSelect.test.tsx` | role-match — closest existing jsdom render-test in repo; no `Browser.test.tsx` exists yet |
| `docs/fork-maintenance.md` (lines 65-67) | config/docs | — | itself | exact — update in place to reflect D-02 decision |
| `docs/profile-spec.md` (lines 3, 5, 15) | config/docs | — | `src/locales/en/translation.json:2812` (in-app copy already correctly worded) | exact — reuse the already-correct disclaimer wording |
| `docs/merge-plan-upstream-2026-08.md` (delete after Phase B/C land) | config/docs | — | itself, lines 3, 458 (self-documents its own retirement condition) | exact |
| `.claude/worktrees/agent-a4ad3a26969f16ebb` (confirm inactive, then remove) | — (git worktree, not source) | event-driven (git operation) | `docs/merge-plan-upstream-2026-08.md` §6 rule 1, §8 lines 434-449 (stop-and-ask gates already written) | exact — plan doc already specifies the procedure |
| Local branches (11 delete, 1 merge) | — (git operation) | batch | `docs/merge-plan-upstream-2026-08.md` (full branch inventory + conflict file list already reproduced this session) | exact |

## Pattern Assignments

### `src/components/UpdateModal.tsx` (component, request-response)

**Analog:** `src/components/settings/sections/SupportSection.tsx` (same file family; also its own current code is the thing being changed)

**Current state to replace** (`src/components/UpdateModal.tsx:228-240`):
```tsx
<div className="flex items-center justify-between gap-3 p-6 border-t border-white/10">
    <a
        href="https://discord.gg/KgYGHEMq2P"
        target="_blank"
        rel="noreferrer noopener"
        title={t('settings.support.joinDiscordTitle')}
        className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium border border-brand-discord/40 bg-brand-discord/10 text-text-primary hover:bg-brand-discord/20 hover:border-brand-discord/60 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-discord/60 whitespace-nowrap"
    >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="w-4 h-4 fill-current">...</svg>
        {t('settings.support.joinDiscord')}
    </a>
    <div className="flex items-center gap-3">
        <Button onClick={onClose} variant="secondary">{t('common.actions.close')}</Button>
        ...
    </div>
</div>
```

**Target pattern — copy the fork-owned GitHub Issues button shape** from `SupportSection.tsx:163-172` (already correct in that file):
```tsx
<a
    href={`${FORK_REPO}/issues`}
    target="_blank"
    rel="noreferrer noopener"
    title={t('settings.support.githubIssuesTitle')}
    className="inline-flex items-center justify-center gap-2 rounded-sm px-4 py-2 text-sm font-medium border border-border bg-bg-tertiary/40 text-text-primary hover:bg-bg-tertiary/70 hover:border-text-secondary/60 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-text-secondary/60 whitespace-nowrap"
>
    <Github className="w-4 h-4" aria-hidden="true" />
    <Tx k="settings.support.githubIssues" fallback="GitHub Issues" />
</a>
```
`FORK_REPO` is currently a local `const` inside `SupportSection.tsx:17` (`'https://github.com/onionviolet/grimoire'`) — either hoist it to a shared constant/module (e.g. alongside other app constants) or duplicate the literal locally in `UpdateModal.tsx`; there is no existing shared-constants module for this value in the repo, so this is the one small judgment call for the plan to make explicit.

**i18n note:** per `CLAUDE.md`'s i18n rule and `docs/fork-maintenance.md:30-32`, if `joinDiscordTitle`/`joinDiscord` keys are dropped from this surface (not reused for a new meaning), do not reword them in place — either delete the usage here (keys may still be used elsewhere, e.g. `SupportSection.tsx`'s attribution-adjacent context) or add new keys (`settings.support.githubIssuesTitle`, `settings.support.githubIssues` already exist and can be reused verbatim, same as `SupportSection.tsx` does).

---

### `src/components/settings/sections/SupportSection.tsx` (component, request-response)

**Analog:** itself — lines 96-150 (the "About Grimoire" attribution block) is the in-file model for "this stays upstream-labelled," while lines 163-172 (GitHub Issues button) is the in-file model for "this is fork-owned and correct as-is."

**Constants already correctly split** (`SupportSection.tsx:14-18`):
```tsx
const UPSTREAM_REPO = 'https://github.com/Slush97/grimoire';
const UPSTREAM_SITE = 'https://grimoiremods.com';
const DISCORD_INVITE = 'https://discord.gg/KgYGHEMq2P';
const FORK_REPO = 'https://github.com/onionviolet/grimoire';
const FORK_LICENSE = 'https://github.com/onionviolet/grimoire/blob/main/LICENSE';
```
Keep `DISCORD_INVITE` defined (still used by the RPC/attribution surfaces this phase leaves untouched per D-03/A2) but remove its two support-context usages inside this file.

**Block 1 to fix — lines 155-184** (the "Found a bug" row with two side-by-side buttons). Delete the second `<a href={DISCORD_INVITE}>` block at lines 173-182, and reword the paragraph at lines 156-161 to drop the Discord disclaimer sentence since there is no longer a Discord button beside it:
```tsx
// Before (155-184) — two buttons, GitHub Issues (correct) + Discord (must remove)
<div className="flex flex-col sm:flex-row gap-2">
    <a href={`${FORK_REPO}/issues`} ...>...</a>
    <a href={DISCORD_INVITE} ...>...</a>  {/* DELETE */}
</div>
```
Keep the GitHub Issues `<a>` exactly as-is (lines 163-172) — it is already the correct target pattern for `UpdateModal.tsx` above.

**Block 2 to fix — lines 194-298** (bug-report generator). Two sub-edits:
1. Line 197 help text: `"paste it into Discord or a GitHub issue"` → reword to name only GitHub (e.g. "paste it into a GitHub issue"). This is a copy edit against an existing `Tx` key (`settings.support.bugReportDescription`) — per the i18n rule, add a new key/fallback rather than editing the string in place if any translations exist for it.
2. Lines 280-289: delete the `<a href={DISCORD_INVITE}>` "Open Discord" button from the generated-report action row (keep the "Open GitHub issue" `<a>` at lines 290-298 and the "Copy report" `Button` at 269-279 untouched).

**Explicitly untouched in this file:** lines 96-150 (About block, all four links), and `DISCORD_INVITE`'s declaration itself (it may still be referenced elsewhere, e.g. if the RPC/README surfaces import from this module — verify no import elsewhere before deleting the constant; if unused elsewhere, removing the now-dead constant is fine).

---

### `src/pages/ChatWheel.tsx` (component/page, request-response)

**Analog:** `src/pages/Browser.tsx:149-162` (RESEARCH.md-identified precedent; do not gate in `App.tsx`)

**Imports needed** (mirror `Browser.tsx:13-19`, only the relevant subset):
```tsx
import { EmptyState } from '../components/common/PageComponents';
// Globe icon already used by Browser.tsx; ChatWheel already imports from 'lucide-react' at line 3 — add whatever icon fits (e.g. Sparkles, already imported at line 3, or a dedicated icon)
```
`ChatWheel.tsx` already has `const { t } = useTranslation();`-equivalent via `Tx` (line 8 imports `Tx` already) and needs access to `settings` from `useAppStore` — check whether `ChatWheel.tsx` already destructures `settings`; if not, add it alongside the existing `loadMods` selector at line 29 (`const loadMods = useAppStore((state) => state.loadMods);`), e.g. `const settings = useAppStore((state) => state.settings);`.

**Core pattern to copy verbatim, swap flag + copy keys** (`Browser.tsx:149-162`):
```tsx
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
For `ChatWheel.tsx`: guard on `settings?.experimentalChatWheel` (matches `Sidebar.tsx:516`'s existing flag name exactly — no new setting to add), new `Tx` keys e.g. `chatWheel.disabled.title` / `chatWheel.disabled.description`, and place the guard as an early return before the component's existing data-loading effects/JSX (same position `Browser.tsx` uses it — after hooks, before the main render, per React's rules-of-hooks: all hooks must still run unconditionally above the guard).

**Where this sits in the file:** `ChatWheel.tsx` currently declares its hooks (state, refs, `useAppStore` selector) at lines 14-39 before any JSX; the guard should be inserted after all hook declarations/effects and before the component's `return (...)` for its normal UI, exactly mirroring `Browser.tsx`'s structure (hooks first, guard, then full UI).

---

### `src/pages/ChatWheel.test.tsx` (new test, render/unit)

**Analog:** `src/components/common/HeroSelect.test.tsx` (closest existing jsdom render-test pattern in the repo; no `Browser.test.tsx` currently exists to copy directly, so this is a role-match, not an exact match)

**jsdom pragma + environment setup** (`HeroSelect.test.tsx:1-9`):
```tsx
// @vitest-environment jsdom

import { act, useEffect, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HeroSelect } from './HeroSelect';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;
```

**Structure to replicate:** a `describe` block using `createRoot`/`act` to mount the real `ChatWheel` component (not a harness wrapper, since the thing under test is the guard itself) with a mocked `useAppStore` (likely via `vi.mock('../stores/appStore', ...)` returning `{ settings: { experimentalChatWheel: false } }` for the off-case and `true` for the on-case), then assert on rendered text (e.g. query for the `EmptyState` title text) rather than snapshotting. Follow `HeroSelect.test.tsx`'s `beforeEach`/`afterEach` root mount/unmount discipline (visible further in that file beyond the excerpt above) to avoid test-to-test DOM leakage.

**Two cases to cover** (per RESEARCH.md's Phase Requirements → Test Map row): `experimentalChatWheel: false` renders the disabled `EmptyState` (assert the disabled-state text is present, the real chat-wheel controls are not); `experimentalChatWheel: true` renders the normal page (assert the disabled-state text is absent).

---

### `scripts/fetch-vpkmerge.mjs` (utility, file I/O) — comment/doc-only per D-02

**Analog:** itself, plus `docs/fork-maintenance.md:65-67`

**Existing sha256-pin-and-verify pattern to leave untouched** (`scripts/fetch-vpkmerge.mjs:19-25, 38-52, 124-130` — already the correct shape, per RESEARCH.md's own recommendation not to build a new release pipeline):
```js
const VPKMERGE_VERSION = 'v0.19.0';
const ASSETS = {
    'linux-x64':  { name: 'vpkmerge-linux-x86_64',      sha256: 'fc33ee3ea6ea551fb5866e0077effb725da16e935eab07c1a2a407f10028a92c' },
    'darwin-arm64': { name: 'vpkmerge-macos-aarch64',    sha256: '418f650dd6afff9228d8fa9c289bb1a4a01488191bb54636b69aaca0c4f8be28' },
    'win32-x64':  { name: 'vpkmerge-windows-x86_64.exe', sha256: '7c85e2e5830621e4a6cd4dea848cb23b57fa0272b87e044e59a571424e9d52d0' },
};
```
```js
async function sha256File(path) {
    const hash = createHash('sha256');
    hash.update(await readFile(path));
    return hash.digest('hex');
}
```
```js
const actual = await sha256File(tempPath);
if (actual !== asset.sha256) {
    throw new Error(
        `sha256 mismatch for ${asset.name}: expected ${asset.sha256}, got ${actual}. Refusing to install possibly tampered binary.`
    );
}
```

**What actually changes (per D-02):** the file header comment (lines 1-9, currently says "Fetch the vpkmerge CLI binary... from github.com/Slush97/vpkmerge releases") should be updated to state plainly that this remains the stock upstream binary by design (dev-machine fallback only), that the packaged release pipeline gets the fork engine a different way (`.github/workflows/release.yml`'s pinned-SHA build-from-source, `scripts/use-local-vpkmerge.mjs`), and that promoting an `onionviolet/vpkmerge`-hosted checksum-pinned release into this table remains future work, not started this phase — matching `docs/fork-maintenance.md:65-67`'s existing wording, which also needs no code change, only confirmation it still describes reality accurately (it does).

---

### `docs/fork-maintenance.md` (docs)

**Analog:** itself, lines 50-67 (Engine policy section) — the wording here is already accurate; this phase's job is to make `fetch-vpkmerge.mjs`'s header comment agree with it, and optionally add one sentence explicitly stating the phase-2 decision (D-02: keep build-from-pinned-SHA, do not cut a `vpkmerge` release this phase) so a future reader doesn't re-litigate the question RESEARCH.md's Open Question 1 already raised and this phase already answered.

---

### `docs/profile-spec.md` (docs)

**Analog:** `src/locales/en/translation.json:2812` — already-correct in-app disclaimer, to be used as the wording model:
```json
"This format is Grimoire-only and not compatible with other mod managers."
```

**Three lines to reword** (`docs/profile-spec.md:3, 5, 15`):
```
Line 3:  "A portable JSON format for sharing mod loadouts between mod managers."
Line 5:  "...but the schema is intentionally game and manager agnostic."
Line 15: "1. Round-trip a user's mod loadout ... between machines and between mod managers."
```
Reword to describe the format as Grimoire-only today (matching `CLAUDE.md`'s "Portable profile format is Grimoire-only. Don't claim compatibility with other mod managers in copy.") while preserving the legitimate design-extensibility claim (schema *could* support other tools/games structurally, without claiming *current* interoperability) — e.g. line 3 → "A portable JSON format for sharing Deadlock mod loadouts within Grimoire," line 5 → "...the schema is designed to be extensible to other games, but this format is Grimoire-only today," line 15 → "between machines" (drop "and between mod managers"). Also scan the rest of `docs/profile-spec.md` for any further "interoperability"/"agnostic" phrasing the three quoted lines don't already cover, per RESEARCH.md's instruction.

---

### `docs/merge-plan-upstream-2026-08.md` (docs, retirement) + branch/worktree operations

**Analog:** itself — the doc already specifies its own retirement condition (line 3: "Delete it once Phase C is done and pushed"; line 458) and its own stop-and-ask gates (§6 rule 1, §8 lines 434-449).

**Sequence to follow (git operations, no source-file pattern needed — this is process, not code):**
1. Confirm-first checkpoint (per D-04): verify `.claude/worktrees/agent-a4ad3a26969f16ebb` (checked out on `structural-refactor-7`) is inactive before touching that branch. `docs/merge-plan-upstream-2026-08.md` §6 rule 1 already states this exact gate.
2. Merge `structural-refactor-7` into `main` (Phase B) — 5 commits, 10 known-conflicting files reproduced this session (`heroPoseModels.ts`, `GlobalSoundBrowse.tsx`, `assetClaims.test.ts` [add/add], `assetClaims.ts` [add/add — requires human resolution, not auto-merge], `globalSoundSections.ts`, `heroPortraitIdentity.ts`, `soundInventory.ts`, `en/translation.json`, `manifest.json`, `Foundry.tsx`).
3. Verify nothing broke: `pnpm typecheck && pnpm lint && pnpm test` (per RESEARCH.md's phase-gate sampling rate).
4. Remove now-unnecessary worktrees (`.claude/worktrees/agent-a4ad3a26969f16ebb`, `C:/Users/wayba/dev/grimoire-alias-sweep`, `C:/Users/wayba/dev/grimoire-merge`) before deleting their branches — `git worktree remove` must precede `git branch -d`.
5. Delete the 11 fully-merged branches (`git branch -d`, lowercase — refuses non-fast-forward deletes, per RESEARCH.md's Known Threat Patterns table) plus their `origin` remotes where noted (`codex/foundry-build-diff`, `codex/foundry-source-panels`, `foundry-forge-and-spec-audit`, `portrait-alias-sweep`).
6. Delete `docs/merge-plan-upstream-2026-08.md` once `git branch --no-merged main` returns empty.

**Verification commands (shell, not Vitest):**
```
git branch --no-merged main            # expect empty
test ! -f docs/merge-plan-upstream-2026-08.md
```

## Shared Patterns

### Support-link classification (attribution vs. support destination)
**Source:** `docs/fork-maintenance.md:15-32`, `src/components/settings/sections/SupportSection.tsx:10-18, 96-150`
**Apply to:** `UpdateModal.tsx`, `SupportSection.tsx`
The line already drawn in this codebase: an **attribution** surface (About block, README, Ko-fi label, Discord RPC buttons) stays upstream-labelled and untouched. A **support/bug-report** surface (a button offered as "here's where to get help/file a bug") must point only at `FORK_REPO/issues`. `DISCORD_INVITE` is not blanket-protected the way Ko-fi is — only its *support-context* uses (UpdateModal footer, SupportSection's bug-report row and generated-report action row) move; its attribution-context uses elsewhere (`discordRpc.ts` RPC buttons, README) are explicitly out of scope for this phase.

### i18n key hygiene on removal/reword
**Source:** `docs/fork-maintenance.md:30-32`, `CLAUDE.md` i18n Gates section
**Apply to:** Any `Tx`/`t()` key touched in `UpdateModal.tsx`, `SupportSection.tsx`, `docs/profile-spec.md`-adjacent in-app strings
Deleting a key's usage and not reusing it for a new meaning is correct if a Discord button is removed outright. If any string is reworded rather than removed, delete the old key and add a new one — never edit the string in place — to avoid stale translations continuing to show the old claim. Run `pnpm i18n:check` after any catalog change.

### sha256-pin-and-verify (build tooling)
**Source:** `scripts/fetch-vpkmerge.mjs:38-52, 124-130`
**Apply to:** No file in this phase's actual scope changes shape here (D-02 keeps build-from-source), but this is the pattern any future `onionviolet/vpkmerge` release-promotion work must reuse exactly — sha256 values must be independently computed from the downloaded artifact, never copy-pasted from an untrusted release-page description.

### Experimental-page self-gating
**Source:** `src/pages/Browser.tsx:149-162`
**Apply to:** `src/pages/ChatWheel.tsx`
Every experimental page in this codebase gates itself with an early-return `EmptyState`, keyed off `settings?.experimental<Name>` read from `useAppStore`. `App.tsx`'s route table and `Sidebar.tsx`'s nav-item filtering are separate, already-correct concerns and must not be touched for this fix (`App.tsx:98`'s unconditional `<Route path="chat-wheel" element={<ChatWheel />} />` stays as-is; the gate belongs entirely inside `ChatWheel.tsx`).

## No Analog Found

None. Every file this phase's locked-decision scope touches has a clear, cited in-repo analog. (Files that would need cross-repo analogs — forking `grimoire-social`, cutting a `vpkmerge` release, repointing `ci.yml`/`release.yml`/`check-sibling-repos.mjs` to `onionviolet/grimoire-social` — are explicitly out of scope per D-01/D-02 and are not classified here.)

## Metadata

**Analog search scope:** `src/components/`, `src/pages/`, `scripts/`, `docs/`, `.github/workflows/` (read-only, no changes made outside PATTERNS.md)
**Files scanned:** `scripts/fetch-vpkmerge.mjs`, `src/components/UpdateModal.tsx`, `src/components/settings/sections/SupportSection.tsx`, `src/pages/ChatWheel.tsx`, `src/pages/Browser.tsx`, `src/App.tsx`, `src/components/Sidebar.tsx`, `src/components/common/HeroSelect.test.tsx`, `docs/fork-maintenance.md`, `docs/profile-spec.md`, `src/locales/en/translation.json` (line 2812 only), `docs/merge-plan-upstream-2026-08.md` (via RESEARCH.md quotes)
**Pattern extraction date:** 2026-08-07
