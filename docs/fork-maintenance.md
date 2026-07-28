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

The stock `v0.19.0` download remains a fallback only until the fork publishes a
versioned, checksum-pinned release. Promote that release in
`scripts/fetch-vpkmerge.mjs` rather than silently tracking a moving binary.
