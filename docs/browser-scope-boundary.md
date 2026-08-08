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
| Download manager | Phase 6 added download capture for exactly one declared tool-kind destination (`kind: 'tool'`, currently Pimp My Hideout): a download from that destination is either handed to the mod library after an explicit confirmation, or (for every other destination, and for the tool destination when refused) handed to the system browser. There is nothing in between for a user to manage, so there is no manager surface. Building one would imply a queue, history, or pause/resume capability that does not exist and was never built for this page. |

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
describes.
