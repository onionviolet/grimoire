# Phase 8: Release Engineering - Context

**Gathered:** 2026-08-10
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped; release scope pre-approved by the repository owner)

<domain>
## Phase Boundary

Ship v1.27.1 as a GitHub Release on `onionviolet/grimoire`: CHANGELOG entry,
tag `v1.27.1` matching `package.json` 1.27.1, push `main` and the tag to
`origin`, let `release.yml` build the Windows installer, SHA256 checksums, and
attestations, and confirm the GitHub Release exists with notes from the
changelog. Upstream stays read-only; the tag push must not reference upstream
objects.

</domain>

<decisions>
## Implementation Decisions

### the agent's Discretion
The v1.27 archive tag stays local (never pushed; release.yml fires on any `v*`
tag and would have pre-released the pre-absorb tree). The release tag v1.27.1
is pushed only to `origin`. Release notes come from `CHANGELOG.md` via
`scripts/release-notes.mjs`; the draft flag is false for tag pushes.

</decisions>

<code_context>
## Existing Code Insights

- `scripts/verify-release-version.mjs` enforces tag == package.json version.
- `.github/workflows/release.yml` builds win installer, writes
  `SHA256SUMS-win.txt`, attests provenance, and creates the Release via
  softprops/action-gh-release with `body_path: release-notes.md`.
- `.husky/pre-push` gates: i18n, manifest, encoding, refs, engine-pin.

</code_context>

<specifics>
## Specific Ideas

- CHANGELOG entry `## [1.27.1] - 2026-08-10` (fork release, no bare upstream PR numbers)
- Tag `v1.27.1` annotated; push `main` then the tag to origin
- Confirm the workflow run completes and the Release is published; capture the URL

</specifics>

<deferred>
## Deferred Ideas

- Post-release packaged-windows smoke (IG-23 engine row) remains deferred per
  the standing position.

</deferred>
