# Browser destination catalog: reachability review

This is the dated, per-entry record REQ-browser-tool-catalog and ROADMAP
phase 6 success criterion 1 ask for: every entry in
`BROWSER_DESTINATIONS` (`src/lib/browserCatalog.ts`) loaded once, what came
back written down, and each entry kept, corrected, or removed on that
evidence.

**Produced by:** `GRIMOIRE_CHECK_DESTINATIONS=1 pnpm exec vitest run src/lib/browserCatalog.reachability.test.ts`, `src/lib/browserCatalog.reachability.test.ts` (imports `BROWSER_DESTINATIONS` directly, so this file and the app can never disagree about which destinations exist).

**Date probed:** 2026-08-07.

**These are third party sites.** Grimoire links to them from the in-app
browser's shortcut row; it does not host, endorse, vet, or vouch for any of
them, and none of them is affiliated with Grimoire. A "keep" verdict below
means the site loaded and looked like what its label claims, not that
Grimoire stands behind its content.

## Reachability table

| Label | Declared kind | Requested URL | Status | Final URL | Page title | Host changed | Proposed verdict |
|---|---|---|---|---|---|---|---|
| GameBanana | mod-host | https://gamebanana.com/games/20948 | 200 | https://gamebanana.com/games/20948 | not captured in the first 8 KB (see note) | false | keep |
| Deadlock Forge | reference | https://deadlockforge.net/ | 200 | https://deadlockforge.net/ | Deadlock Forge | false | keep |
| Deadlock Wiki | reference | https://deadlocked.wiki/ | 200 (also observed: 410, see below) | https://deadlocked.wiki/ (also observed: redirects off-host, see below) | Loading... (also observed: none, see below) | false (also observed: true, see below) | needs a human call |
| deadlock-api | reference | https://deadlock-api.com/ | 200 | https://deadlock-api.com/ | Deadlock Stats Tracker: Win Rates, Ranks and Leaderboards | false | keep |
| Deadlock.io | reference | https://deadlock.io/ | 200 | https://deadlock.io/ | Deadlock Game: heroes, items, mechanics and patches - Deadlock.io | false | keep |
| Deadlocker | reference | https://www.deadlocker.gg/ | 200 | https://www.deadlocker.gg/ | Deadlocker | false | keep |
| r/DeadlockTheGame | community-feed | https://www.reddit.com/r/DeadlockTheGame/ | 200 | https://www.reddit.com/r/DeadlockTheGame/ | Reddit (see note) | false | keep |
| Deadlock Daily (memes) | community-feed | https://www.deadlockdaily.com/ | 200 | https://www.deadlockdaily.com/ | Deadlock Memes and ESports - Deadlock Daily | false | keep |
| Goonlock (18+) | community-feed, nsfw | https://goonlock.com/ | 200 | https://goonlock.com/ | Goonlock (dot) Goonlock | false | keep |
| Pimp My Hideout | tool | https://xkitkatcat.github.io/pimpmyhideout/ | 200 | https://xkitkatcat.github.io/pimpmyhideout/ | Pimp My Hideout! | false | keep |

Notes on individual rows:

- **GameBanana:** the reachability suite's title extraction is bounded to the
  first 8 KB of the response body by design (so a slow or huge page never
  costs more than a small bounded read). GameBanana's `<title>` tag sits at
  roughly byte 27,000 in this page, past that budget, so the automated probe
  honestly records no title. A separate unbounded fetch during this review
  confirmed the real title: "Deadlock Mods, Tutorials and Community" (site
  name "DL Hub"). Status, final URL, and host all match the label, so this is
  a probe-budget artifact, not a content problem.
- **r/DeadlockTheGame:** Reddit serves a generic "Reddit" title (rather than
  the subreddit's own title) to requests without a browser-like session,
  which is expected Reddit behavior for a bare `fetch`, not a sign the page is
  wrong. The final URL resolves to the exact subreddit path requested, which
  is the stronger signal here.

## deadlocked.wiki against deadlock.wiki

REQ-browser-tool-catalog specifically calls out checking `deadlocked.wiki`
(the catalog's current entry) against `deadlock.wiki` (the domain search
results actually return). Both were probed with the same suite, outside the
catalog's own ten-entry loop, and the check was repeated by hand several
additional times because the first result was inconsistent with the rest.

**`deadlock.wiki`** resolved the same way every time: HTTP 200, final URL
`https://deadlock.wiki/`, and a real MediaWiki page titled "The Deadlock
Wiki" (`client-nojs` skin markup, `data-theme`, the standard MediaWiki head).
Consistent across four separate probes.

**`deadlocked.wiki`** did not resolve the same way twice:

- Three of four probes: HTTP 200, final URL `https://deadlocked.wiki/`
  (host unchanged), but the body is not the site's real content, it is a
  client-side JavaScript redirect shell: `<title>Loading...</title>` followed
  by `window.location.replace('https://deadlocked.wiki/?ch=1&js=<JWT-shaped
  token>...')`. A plain `fetch` (no JS execution, exactly what a
  reachability probe or a bookmark link does) never gets past this shell.
- One of four probes: HTTP 410, redirected to
  `http://ww80.deadlocked.wiki/?subid1=<uuid>` — a numbered `ww`-subdomain
  with a `subid1` tracking parameter, a pattern characteristic of
  domain-parking ad networks, not a modding wiki.

Both behaviors were observed from the same requesting environment, run
minutes apart, with no code change between them. This looks like a domain
sitting behind either an anti-bot JS challenge, a parking/ad-monetization
proxy, or both, rather than a plain, reliable MediaWiki like `deadlock.wiki`.

**This entry needs a human call** (see the section below): the evidence
favors correcting the catalog's `Deadlock Wiki` entry from
`https://deadlocked.wiki/` to `https://deadlock.wiki/`, but the reviewer
should independently confirm `deadlock.wiki` is the actively maintained
community wiki (not just the domain that resolves cleanly) before approving
the change, since a probe can distinguish "resolves reliably" from "is the
wiki the community actually uses."

## D-06: no crosshair generator entry

Decision (from `06-CONTEXT.md`): no crosshair-generator destination is added
to this catalog, and none is present in `BROWSER_DESTINATIONS` as reviewed
here. Reason: Grimoire ships its own Crosshair Designer (`src/pages/
Crosshair.tsx`), and a second answer to the same question inside the browser
catalog is the UX cost REQ-browser-tool-catalog itself warns about, not a
feature to add. This review confirms the omission is the intended state, not
something left out by oversight.

## Entries needing a human call

| Entry | Question a human needs to answer |
|---|---|
| Deadlock Wiki (currently `https://deadlocked.wiki/`) | Should this entry be corrected to `https://deadlock.wiki/`, the host that resolved reliably to a real MediaWiki titled "The Deadlock Wiki" across every probe, given `deadlocked.wiki` served a JS-redirect challenge shell on three probes and an HTTP 410 to a parking-network-shaped host on the fourth? Is `deadlock.wiki` in fact the wiki the Deadlock modding community actually uses, or does `deadlocked.wiki`'s challenge page lead somewhere legitimate that this probe simply cannot see past? |

## Applied

Pending Task 2's decision. This section will record what changed in
`src/lib/browserCatalog.ts` and on what date, once the verdicts above are
approved.
