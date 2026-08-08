# Browser scope boundary

This is the record REQ-browser-navigation-gaps asks for: what the in-app
browser (`src/pages/Browser.tsx`, plus the guest hardening in
`electron/main/services/webviewHardening.ts`) deliberately is and is not.
The governing intent is a shortcut to the handful of sites that matter while
modding, not a general purpose browser. A reader who wonders why a control is
missing should find a decision here, not conclude the app forgot.

## Controls that exist

| Control | What it's for |
|---|---|
| Back | Steps the guest's own navigation history backward, via `<webview>.goBack()`. |
| Forward | Steps the guest's own navigation history forward, via `<webview>.goForward()`. |
| Reload / Stop | One button that reloads the current page while idle and cancels an in-flight load while loading, mirroring what the load state actually allows. |
| Home | Navigates to `HOME_DESTINATION_URL`, the catalog's named Home destination (see below), not whatever happens to load first. |
| Address bar | Accepts a typed URL or bare host, normalizes it to `https://` when no scheme is given, and refuses anything that isn't `http(s)` before it ever reaches the guest. |
| Open externally | Hands the current URL to the user's real, unsandboxed browser via `window.open`, for anything the in-app guest's deliberately narrow feature set can't do. |
| Destination catalog | The kind-grouped shortcut rows (Mod hosts, Tools, Reference, Community) sourced from `BROWSER_DESTINATIONS`, the curated list of sites this page exists to shortcut to. |

## Controls that deliberately do not exist

| Control | Reason |
|---|---|
| Tabs | The guest is a single `<webview>` with a single pinned session partition. Multiple tabs would multiply the surface `will-attach-webview` has to harden for no benefit to a shortcut page; "open externally" is the escape hatch for anyone who wants a real multi-tab session. |
| Find in page | Not one of the handful of workflows this page exists for (follow a shortcut, download a tool's output, hand a GameBanana link back to Grimoire). A user who needs it can open externally. |
| Zoom | Same reasoning as find in page: a real browser feature this page doesn't try to reproduce, deliberately, rather than by omission. |
| Extension surface | The guest has no preload and no extension host; `hardenGuestWebPreferences` strips exactly this kind of privilege on every attach, unconditionally. Adding an extension surface would mean building a second, less-audited runtime inside the app. |
| History panel beyond the guest's own back/forward stack | Grimoire does not own or persist a navigation history separate from what the guest's own `canGoBack()`/`canGoForward()` already report. A history panel would imply Grimoire is tracking browsing activity it in fact never records. |
| Download manager | Phase 6 added download capture for exactly one declared tool-kind destination (`kind: 'tool'`, currently Pimp My Hideout): a download from that destination is either handed to the mod library after an explicit confirmation, or (for every other destination, and for the tool destination when refused) handed to the system browser. There is nothing in between for a user to manage, so there is no manager surface. What makes that true rather than aspirational: the disclosure is owned by the app shell, not by the Browser page, so leaving the page does not lose it, and a temp file that never reaches an answer is deleted at the next launch (see "Disclosure lifetime and temp file retention" below). Building a manager surface would still imply a queue, history, or pause/resume capability that does not exist and was never built for this page. |

## Disclosure lifetime and temp file retention

Where the tool-download disclosure subscription lives, what the
browser-downloads temp directory's retention rule is, and the one window
that is deliberately not covered.

**Subscription location.** The tool-download disclosure subscriber
(`src/lib/useBrowserToolDownloadHandoff.tsx`) is called once from
`src/components/Layout.tsx`, not from `Browser.tsx`. It outlives the page
that started it, the same reason the one-click install handler is app
scoped: a third-party tool can take real seconds to build a file, and the
user has the least reason to sit still on the page while it happens. A
route change away from `/browser`, or a route change back, does not tear
the subscription down and re-establish it; the confirm dialog, the danger
tone refusal banner (fed from `src/stores/browserToolDownloadStore.ts`
rather than page-local state), and the toasts all reach the user for the
whole renderer document's lifetime, not only while `/browser` is mounted.

**Retention rule.** A captured temp file is retained only for as long as
its id is in the in-memory pending map, and that map never survives the
process. Every regular file present in the browser-downloads directory at
process start is therefore orphaned by construction, so the startup sweep
(`sweepToolDownloadTempRoot`, called from `electron/main/index.ts` inside
`app.whenReady()`) deletes all of them. There is deliberately no age
threshold and no size cap: an age threshold would only delay a deletion
that is already provably safe (the sweep runs before any window has loaded
a renderer, so no capture can be in flight), and the directory holds at
most one live file at a time by the single-pending invariant.

**Safety rule.** The sweep never deletes a path the live pending map
reports; it reads only the direct entries of the directory and deletes
only entries that are plain files, so a subdirectory or a symbolic link is
skipped and never followed; it never recurses; and every deletion path is
built from the entry's own name, never from a guest-supplied filename.

**The one uncovered window.** A terminal status pushed while no renderer
document exists at all (a renderer crash, a forced quit, or a restart) has
no subscriber to reach, because the subscriber's lifetime is the renderer
document's lifetime. This is deliberate rather than an oversight: the
pending map is in-memory only, so after a restart there is nothing to
replay, and persisting a pending disclosure across sessions to ask the
user about a file they may no longer connect to anything they did would
contradict the decision that where a captured file goes is decided, not
asked. The answer for this window is the startup sweep, not a persisted
replay: the orphaned temp file is deleted at the next launch and the
system is left exactly as if the capture had never happened. Nothing
reaches the mod library without an answered confirm, so a lost disclosure
in this window costs a temp file and never a silent install.

## Home

`HOME_DESTINATION_URL` (`src/lib/browserCatalog.ts`) resolves to the
catalog's **GameBanana** entry, looked up by its `label` through
`resolveHomeDestinationUrl(BROWSER_DESTINATIONS)` rather than by array
position. GameBanana is the mod host every other destination on this page
ultimately points back toward (via the existing import-handoff flow), so it
is the natural default landing page. The lookup runs eagerly at module import
time and throws if no entry named `GameBanana` exists, so a future catalog
edit that removes or renames it fails loudly at startup instead of silently
sending Home to whatever entry happens to sit first in the array.

## Review cadence

This document and `docs/browser-destinations.md` are the two records for
this surface: this one for the control set, that one for the destination
catalog's own per-entry reachability review. A change to either the control
set or the destination list updates the matching document in the same
commit, so neither record can drift silently out of date with the code it
describes. The same applies to a change to the disclosure's lifetime or to
the browser-downloads directory's retention rule: it updates this document
in the same commit, exactly as a change to the control set or the
destination list does.
