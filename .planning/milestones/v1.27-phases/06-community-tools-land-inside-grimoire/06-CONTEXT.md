# Phase 6: Community Tools Land Inside Grimoire - Context

**Gathered:** 2026-08-07
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase turns the in-app browser's destination list from a hardcoded array into a maintained catalog, and lets one specific catalog entry (Pimp My Hideout, a client-side VPK builder) hand its output to Grimoire instead of the system Downloads folder.

In scope:

- REQ-browser-tool-catalog: `SHORTCUTS` in `src/pages/Browser.tsx` becomes a catalog with a declared `kind` per entry; every existing entry is reviewed once and kept, corrected, or removed
- REQ-browser-produced-file-handoff: a client-side-built file from a catalog `tool` destination reaches Grimoire's mod library with pre-write disclosure and refusal of anything `checkVpkFile` cannot identify as a VPK
- REQ-browser-navigation-gaps: the existing back/forward/reload/home/address-bar surface stays deliberately bounded; no tabs, zoom, find-in-page, or extensions

Not in scope: a general download manager, a second crosshair-generator entry (Grimoire ships its own Crosshair Designer), or widening the guest webview's privileges in any way.

</domain>

<decisions>
## Implementation Decisions

**Standing instruction for every decision below:** optimize for the least code that still fully satisfies the requirement, and prefer the cheap side of the upstream boundary (fork-only files) over touching a shared-and-modified file, because upstream (`Slush97/grimoire`) may build something similar and every edit to a shared file is paid for again at the next absorption.

### File destination: install path, not Foundry

- **D-01:** A browser-produced VPK enters through the existing install path — the same path `importCustomModSource` (`electron/main/ipc/mods.ts`) already uses for drag-drop and custom import — and is treated as a third-party mod, not a Foundry authored edit. — **Reversibility:** costly — **rationale:** re-routing later into Foundry's reviewed write set means widening the shared `FoundryForgeEdit` union (`src/types/foundry.ts`) to a kind with no `entryPath`/`precedence`, and reworking `foundryForge.ts`'s collision-review model, which is built around edits Grimoire itself authors, not an opaque already-built VPK it received.
- **D-02:** Undo and ownership follow the install path's existing story exactly: disable or delete like any other third-party mod. No Foundry "My changes" entry, no forge/reforge record, no entry in the Foundry build tray.
- **D-03:** `resolveInstallableVpk` (`electron/main/services/extract.ts`) is the identity gate reused here, the same one bare `.vpk` drag-drop and direct downloads already go through. No new validation logic is written.

### Catalog shape and entry review

- **D-04:** Each `SHORTCUTS` entry gains a `kind` field: `'mod-host' | 'reference' | 'tool' | 'community-feed'`. The existing `nsfw` flag stays as-is, unchanged in shape. Download-capture logic (D-10) keys off `kind === 'tool'`, not a URL match.
- **D-05:** Recommended default `kind` for the current 9 entries plus the new one, pending the live per-URL review the requirement itself calls for:
  - GameBanana → `mod-host`
  - Deadlock Forge, Deadlock Wiki, deadlock-api, Deadlock.io, Deadlocker → `reference`
  - r/DeadlockTheGame, Deadlock Daily (memes) → `community-feed`
  - Goonlock (18+) → `community-feed`, `nsfw: true` (unchanged)
  - Pimp My Hideout (new) → `tool`
- **D-06:** No crosshair-generator entry is added to the catalog. Grimoire ships its own Crosshair Designer, and the requirement itself frames a second answer to the same question as a UX cost, not a feature.
- **D-07:** The actual "load each entry once, keep/correct/remove, record the result" pass — including checking `deadlocked.wiki` against the `deadlock.wiki` domain search results actually return — is execution work for this phase, not a decision made in this discussion. Nothing here should be read as asserting those URLs are already verified correct.

### Pre-write disclosure and refusal

- **D-08:** The pre-write prompt reuses `useConfirm` (`src/components/common/confirmContext.ts`), the shared confirm hook the UI-consistency pass already standardized on. No bespoke modal.
- **D-09:** The disclosure names the detected file kind (from `checkVpkFile`) and the exact destination in one sentence — "added to your mod library as `<name>`" — matching the Foundry tray's existing "this will write X" phrasing. No manual save-path choice is offered; where the file goes is decided, not asked, consistent with D-01/D-02.
- **D-10:** A downloaded file `checkVpkFile` cannot identify as a VPK is refused before any confirm step, with a stated reason in the same voice as `vpk.ts`'s existing rejection messages (e.g., naming the real detected type). No retry mechanism is built — the source page's own build button can be clicked again.

### Capture trust boundary

- **D-11:** Download capture (intercepting `will-download` to save into a Grimoire-controlled path instead of `shell.openExternal`) applies only when the current destination's catalog `kind` is `'tool'`. Every other destination, and any URL typed into the address bar, keeps today's behavior unchanged: `preventDefault` + `openExternalSafe`.
- **D-12:** This mirrors the existing permission-floor philosophy in `browserContentFilter.ts` — a blanket deny by default because there is no UI to evaluate an ad hoc prompt from an arbitrary page — except here the "grant" is pre-decided by a catalog entry the app itself declared as a tool, not requested at runtime by page content.
- **D-13:** The mechanism to research and confirm in planning: on `will-download`, call the `DownloadItem`'s `setSavePath()` to a Grimoire-controlled temp path and let Chromium's download manager write the bytes, rather than trying to read the file out of the guest's JS context. If this holds up under research, it means the guest needs no preload, no Node, and no privilege change to make this work — Constraint 4 (webview hardening unchanged) holds by construction rather than by a new guard. This is a strong recommendation from codebase scouting, not a locked fact — the planner/researcher should verify it against Electron's actual `will-download`/`DownloadItem` behavior for a `download`-attribute click on a `blob:` URL before committing to it.

### Claude's Discretion

- Exact IPC channel/event shape for round-tripping the pending-download disclosure from main process to renderer and back (main cannot show `useConfirm`'s UI itself).
- Whether the new catalog lives as a plain array-with-kind in `Browser.tsx` (current shape, extended) or moves to its own fork-only module — lean toward the smallest diff that satisfies D-04 unless the file grows unwieldy.
- Copy/wording for the disclosure and refusal messages (all i18n keys per house style).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### This phase's requirements and open decision

- `.planning/REQUIREMENTS.md` — REQ-browser-tool-catalog, REQ-browser-produced-file-handoff, REQ-browser-navigation-gaps, in full
- `.planning/ROADMAP.md` §"Phase 6: Community Tools Land Inside Grimoire" — goal, success criteria, and the open-decision note this discussion resolved (D-01/D-02)

### Upstream cost awareness

- `docs/upstream-boundary-map.md` — which of the files this phase touches are fork-only (free at merge) versus shared-and-modified (paid for again at absorption); `electron/main/index.ts`, `electron/main/ipc/mods.ts`, `electron/main/services/extract.ts`, `electron/main/services/vpk.ts` are shared, `src/pages/Browser.tsx`, `electron/main/services/browserContentFilter.ts`, `electron/main/services/foundryForge.ts`, `src/lib/browserImportHandoff.ts` are fork-only
- `docs/fork-divergence-policy.md` — upstream-first, fork-selective; build additively in new files; aim a change at the cheap side before writing it

### Existing install and identity-gate pattern (D-01/D-02/D-03)

- `electron/main/ipc/mods.ts` — `importCustomModSource`, the existing custom-import/drag-drop entry point this phase reuses as the destination
- `electron/main/services/extract.ts` — `resolveInstallableVpk`, the single identity-gate entry point for "a bare file rather than an archive listing"
- `electron/main/services/vpk.ts` — `checkVpkFile` and its rejection-message pattern, used for both the identity gate and the refusal copy (D-10)
- `electron/main/services/foundryForge.ts` — `reviewFoundryForge`/`FoundryForgeEdit`, read to understand why this contract does not fit a foreign pre-built VPK (grounds D-01)

### Browser page and hardening (D-04 through D-13)

- `src/pages/Browser.tsx` — the `SHORTCUTS` array and its current shape, to be replaced by the catalog
- `src/lib/browserImportHandoff.ts` — the existing item-page handoff pattern (`getGameBananaImportHandoff`) to follow: an explicit-action handoff, never a silent download
- `electron/main/index.ts` — `will-attach-webview` (the hardening this phase must not weaken) and `guest.session.on('will-download')` (the one handler this phase changes)
- `electron/main/services/browserContentFilter.ts` — `attachBrowserFilter`'s permission floor, the precedent D-12 mirrors
- `src/components/common/confirmContext.ts` — `useConfirm`, reused per D-08

### House rules that bind this phase

- `CLAUDE.md` — no em-dashes; every visible string is an i18n key; two-process security (main owns file I/O, renderer never gets raw file access)
- `docs/ui-conventions.md` — tokens not raw values, shared components not ad-hoc markup

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `importCustomModSource` (`electron/main/ipc/mods.ts:1260`): already accepts a bare local VPK path, a display name, and an nsfw flag, and allocates a slot via `allocateEnabledVpkPath`. This is the destination D-01 routes into.
- `resolveInstallableVpk` (`electron/main/services/extract.ts:373`): the identity gate already shared by drag-drop, custom import, and direct `.vpk` download. Reused as-is for the browser-produced file.
- `checkVpkFile` (`electron/main/services/vpk.ts:168`): reads magic bytes from a file path and returns a typed rejection with a human label — the basis for both D-03's gate and D-10's refusal copy.
- `useConfirm` (`src/components/common/confirmContext.ts`): the shared confirm hook from the UI-consistency pass, reused per D-08 instead of a new modal.
- `getGameBananaImportHandoff` (`src/lib/browserImportHandoff.ts`): the precedent for "the browser hands something to Grimoire, but only on an explicit user action" — same spirit as D-09's disclosure step.

### Established Patterns

- `SHORTCUTS` in `Browser.tsx` is currently `{ label, url, nsfw? }[]`, rendered as a button row and filtered by `settings.browseNsfwContentMode`. D-04 extends this shape rather than replacing the rendering approach.
- `will-attach-webview` in `electron/main/index.ts` is the single authority for guest hardening: strips preload, forces `nodeIntegration`/`contextIsolation`, pins the partition, rejects non-http(s) `src`. Nothing in this phase's plan should need to touch this function; D-13's approach specifically avoids needing to.
- `attachBrowserFilter` in `browserContentFilter.ts` denies every permission request except fullscreen by default, because there is no UI to evaluate an ad hoc prompt — the precedent D-11/D-12 extend rather than contradict.

### Integration Points

- `guest.session.on('will-download', ...)` in `electron/main/index.ts:402` is the one handler this phase changes. Today it unconditionally `preventDefault()`s and calls `openExternalSafe`. D-11 makes that conditional on the current destination's catalog `kind`.
- `src/pages/Browser.tsx` is where the destination list renders and where the existing `handoff` banner pattern (GameBanana item-page handoff) already shows the shape a new tool-produced-file banner should follow.

</code_context>

<specifics>
## Specific Ideas

- The user's framing for this whole discussion: decide the most optimal, least-effort, most-comprehensive answer for each area directly rather than iterating question by question, and keep in mind that upstream might build something similar — so every recommendation above was chosen to minimize new shared-file surface and reuse what already exists (`importCustomModSource`, `resolveInstallableVpk`, `checkVpkFile`, `useConfirm`) rather than inventing new mechanism.
- D-13's mechanism (letting Chromium's own download manager write the bytes via `DownloadItem.setSavePath()`, rather than trying to pull bytes out of the guest's JS) is offered as the strongest lead against the roadmap's stated "genuinely unsolved" question — the planner should verify it, not assume it is already proven here.

</specifics>

<deferred>
## Deferred Ideas

- **A crosshair-generator catalog entry.** Explicitly declined (D-06): Grimoire's own Crosshair Designer already answers this need, and a second answer to the same question is the UX cost the requirement warns about, not a feature to add.
- **A general download manager or file-picker for browser-produced files.** Out of scope by design (D-09): the destination is decided by the app, not chosen by the user per download.

### Reviewed Todos (not folded)

None — `todo.match-phase 6` returned zero matches.

</deferred>

---

*Phase: 6-Community Tools Land Inside Grimoire*
*Context gathered: 2026-08-07*
