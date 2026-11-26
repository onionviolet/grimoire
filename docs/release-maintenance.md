# Release maintenance and artifact retention

This is the operator checklist for a fork release. It keeps the release path
repeatable while preserving a usable rollback path.

## Retention policy

- **GitHub Releases are the permanent archive.** Do not delete a published
  release just to reduce local disk use; old installers are the supported
  rollback path.
- The APT repository is intentionally **latest-only**. Its publish job removes
  the previous `.deb`; this is expected. Older Linux packages remain on GitHub
  Releases.
- In the local `release/` directory, keep the current version and the previous
  version readily available. Move anything older into
  `release/archive-<version>/` (for example, `release/archive-1.24.0/`). The
  directory is local build output and is not committed.
- Never overwrite an existing version's installers. A corrected build must use
  a new version number so users can identify exactly what they installed.

## Cut a release

1. Start with a clean working tree and update the fork from its original:

   ```powershell
   git fetch upstream
   git merge upstream/main
   ```

   Resolve any conflicts deliberately. Regenerate the locale manifest if a
   translation conflict occurs:

   ```powershell
   pnpm i18n:manifest
   ```

2. Update `package.json` and `CHANGELOG.md` for the target version. Commit the
   feature work and the upstream merge before building.
   Preview the GitHub release body with `node scripts/release-notes.mjs <version>`.
   The script writes `release-notes.md` from the matching changelog section.
   Use [project state](../.planning/STATE.md) for the active candidate and its
   internal release record.

3. Validate the exact release commit:

   ```powershell
   pnpm typecheck
   pnpm lint
   pnpm test
   ```

4. If the fork requires the sibling `vpkmerge` build, rebuild it and select it
   before packaging:

   ```powershell
   cd ../vpkmerge
   cargo +stable-x86_64-pc-windows-msvc build --release -p vpkmerge-cli
   cd ../grimoire
   pnpm use-local-vpkmerge
   ```

5. Produce the Windows artifacts. The social URL is required so the packaged
   app cannot accidentally point to a development service:

   ```powershell
   $env:GRIMOIRE_FORK_BUILD = '1'
   $env:GRIMOIRE_SOCIAL_BASE_URL = 'https://grimoire-social.slusheliott.workers.dev'
   pnpm package:win
   ```

   Expected outputs are `release/Grimoire-Setup-<version>.exe`,
   `release/Grimoire-Portable-<version>.exe`, and the installer blockmap.

6. The GitHub workflow builds Windows x64, Linux x64 and macOS arm64 when
   a `v<version>` tag is pushed. Use a branch ref for a manual build-only run.
   Each platform runs the packaged smoke before attestation and uploads the
   distributables, update manifests and checksums to the run. The workflow checks
   out the pinned `onionviolet/vpkmerge`
   revision, builds it, and copies that engine into the app before packaging.
   This is required for Foundry's global-sound catalog and safe icon replacement.
   Advance the pinned revision in `.github/workflows/release.yml` deliberately,
   after validating the engine change locally.

   The matrix can build without publisher credentials. For a Developer ID signed
   and notarized macOS package, enable signing in the build configuration and
   configure the certificate and notarization credentials the workflow reads:

   - `MACOS_CERTIFICATE` â€” base64-encoded Developer ID Application `.p12`;
   - `MACOS_CERTIFICATE_PASSWORD`;
   - `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID` for
     notarization.

   The macOS build is arm64-only because the bundled `vpkmerge` engine does not
   yet ship a darwin-x64 binary. The workflow publishes both a DMG and ZIP with `latest-mac.yml`. The app
   can check for updates, and macOS users install them manually under the
   current updater policy.

7. Verify the artifacts before publishing:

   ```powershell
   Get-FileHash release/Grimoire-Setup-<version>.exe -Algorithm SHA256
   Get-FileHash release/Grimoire-Portable-<version>.exe -Algorithm SHA256
   ```

   Run `pnpm smoke:packaged` after local packaging too. It launches an isolated
   profile and exercises SQLite through the packaged Electron runtime. A Windows
   checkout used for Vitest can still hold a Node build of `better-sqlite3` even
   when the packager reports that native dependency installation completed.

   Smoke-test the portable build with an existing profile: launch it, open the
   Locker (including Global), Browse, and Foundry. In Foundry, open **Global
   sounds** and confirm its catalog loads, then replace one ordinary icon and
   one YCoCg icon. Record the app version and the vpkmerge version shown in
   Settings (the pinned fork build currently reports `vpkmerge 0.30.1
   (c34fadf)`). Install the setup executable only when its upgrade path also
   needs testing.

8. Validate the candidate commit with a branch-dispatch build-only run before
   pushing the immutable version tag. Tag pushes trigger the publishing run,
   which creates the GitHub Release and uploads the platform assets, checksums,
   and generated release notes. Recheck the upstream stable version before
   tagging when the fork candidate is one patch above it.

   ```powershell
   git push origin main
   git tag v<version>
   git push origin v<version>
   ```

## Archive local artifacts after publishing

Only archive artifacts after the new release has been verified on GitHub.
Review the exact filenames first, then move them; do not use a broad wildcard
that could catch the current build.

```powershell
New-Item -ItemType Directory -Force release/archive-1.24.0
Move-Item -LiteralPath release/Grimoire-Setup-1.24.0.exe -Destination release/archive-1.24.0/
Move-Item -LiteralPath release/Grimoire-Portable-1.24.0.exe -Destination release/archive-1.24.0/
Move-Item -LiteralPath release/Grimoire-Setup-1.24.0.exe.blockmap -Destination release/archive-1.24.0/
```

Before deleting a local archive, confirm that the matching GitHub Release has
the artifacts and checksum, and retain at least the previous release locally.

## Useful release records

For each published release, record in the GitHub release notes or release issue:

- version, tag, commit SHA, and build date;
- upstream commits merged since the previous release;
- SHA-256 for each downloadable artifact;
- tested operating systems and upgrade path;
- known limitations and rollback version.

This makes bug reports actionable and avoids reconstructing release provenance
from local build folders later.
