# Fork maintenance policy

This is an independent product fork. `main` is the integration branch and the
authoritative source for releases; work does not need to be shaped around an
upstream pull request.

## Upstream intake

- Fetch `upstream/main` regularly and merge or selectively adopt changes that
  improve this fork. Do not let divergence alone block local work.
- Record fork-specific decisions in this repository. Upstream-facing branches
  are optional interoperability artifacts, not the delivery path.
- Keep the fork's public remote (`origin`) current after verification.

## Attribution

Independence is not anonymity: this fork ships upstream's work, upstream's
Ko-fi jar, and upstream's Discord, so every surface that carries one has to say
whose it is. The pass that established this is issue #20; the inventory lives
in [third-party-notices.md](./third-party-notices.md).

- The GitHub repo description names the original project and its author, and
  disclaims affiliation. Keep it that way when editing repo settings, since it
  is the one attribution surface that lives outside the tree and so is invisible
  to review.
- The README states the fork relationship near the top; Settings has an About
  block, and the welcome modal says it on first run.
- Support and donation copy names the beneficiary. The Ko-fi link pays Slush97
  and must never be labelled as the fork's own.
- Credit strings belong in `src/locales/en/translation.json` so they translate.
  When the meaning of one changes, delete the key and add a new one rather than
  rewording in place, or stale translations keep displaying the old claim.

### Support destination (D-03)

The fork's support destination is GitHub Issues at
`https://github.com/onionviolet/grimoire/issues`, chosen because it already
existed and works, and no fork-owned chat channel exists.

Three call sites moved to it: the update modal footer, the Settings "found a
bug or have a feature request" row, and the Settings generated diagnostic
report's action row.

Four surfaces are deliberately left upstream-owned, each for its own reason:

- The About Grimoire attribution block (`SupportSection.tsx`): it is
  attribution and already names upstream.
- The Ko-fi label: the Standing Policy on third-party notices requires the
  beneficiary to stay named as upstream.
- The Discord Rich Presence buttons in `electron/main/services/discordRpc.ts`:
  they are promotional attribution shown to third parties on the user's own
  Discord profile, already labelled as upstream's, and are not a help flow the
  app initiates for its own user.
- The README credit line: credit framing, not a support funnel.

These four are a conscious exclusion, not an oversight.
`src/components/supportDestinations.test.ts` is the guard that enforces both
halves of this decision: it fails if a support-context surface still points at
upstream's Discord, and it fails just as loudly if an attribution surface's
upstream mention is stripped. Anyone changing any of these six surfaces should
find that test, not a surprise.

## Branch hygiene

- Integrate completed work into `main` promptly.
- Delete local and fork-remote feature branches once their commits are in
  `main`; retain a branch only for active work, an external review, or a linked
  worktree.
- Do not keep duplicate "-upstream" branches after the fork has an equivalent
  implementation in `main`.

## Releases

Use the [release maintenance workflow](release-maintenance.md) to merge
upstream fixes, validate and package a version, retain a rollback artifact, and
archive older local builds. GitHub Releases remain the permanent archive; the
local `release/` folder is only a short-term build cache.

## Engine policy

The sibling `../vpkmerge` checkout is also a fork dependency. Its `main` carries
the engine behavior this app relies on, including catalog extensions and the
YCoCg texture-write fix. During development, Grimoire auto-detects a sibling
release build. For a packaged fork build, run:

```powershell
cd ../vpkmerge
cargo +stable-x86_64-pc-windows-msvc build --release -p vpkmerge-cli
cd ../grimoire
pnpm use-local-vpkmerge
pnpm package:win
```

### Engine build policy (D-02)

As of this phase (2026-08-06) the fork engine reaches a packaged build by
building `onionviolet/vpkmerge` from a pinned commit SHA in the release
workflow (`.github/workflows/release.yml`). That is the supported path: the
workflow checks out the pinned SHA, runs `cargo build`, and bundles the
result via `pnpm use-local-vpkmerge` before packaging.

The stock `v0.19.0` download that `scripts/fetch-vpkmerge.mjs` performs on
`pnpm install` is the dev-machine bootstrap only, and is expected to stay
that way; it is not the packaged release's engine source. Promoting a
published, checksum-pinned `onionviolet/vpkmerge` release into that script's
`ASSETS` table remains an open option nobody has taken, not silently dropped
and not silently done. `scripts/check-release-engine-pin.mjs` is the guard
that keeps the pinned-SHA build-from-source path honest: it fails a push if
the workflow's checkout ref loosens off a full commit SHA.
