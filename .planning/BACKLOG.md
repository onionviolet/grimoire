# Backlog

Cross-milestone register of work that is real, scoped, and **not** in the
current milestone. One line per item, each with the evidence that it is still
open as of the date in the header.

**Reconciled:** 2026-09-01, by reading the code rather than the docs.

**Updated 2026-10-03:** B-02 inspection and B-03 local merge recipes are
implemented in source. B-01 and B-04 retain their engine-dependent authoring
and event-playback boundaries. B-08 and B-09 hold the remaining setup-recovery
and application-update work. Other entries retain their reconciliation dates.

## Where things live

Every open item in this repository belongs to exactly one register. If you find
the same item in two places, the other copy is stale and should be deleted, not
updated.

| Register | Holds | File |
|---|---|---|
| Roadmap | phases of the **current** milestone | `.planning/ROADMAP.md` |
| Requirements | what the current milestone must make true | `.planning/REQUIREMENTS.md` |
| Broken windows | known defects and unrun verification | `.planning/WINDOWS.md` |
| Backlog | future work, not scheduled | this file |
| Milestones | shipped history | `.planning/MILESTONES.md` |
| Retrospective | lessons, per milestone | `.planning/RETROSPECTIVE.md` |
| Feature status | user-facing inventory of what exists | `docs/feature-status.md` |

`docs/remaining-work-phases.md` was a fourth planning register and is retired:
see `docs/archive/remaining-work-phases.md`.

## Closed by the truth pass (2026-09-01)

These were listed as open in `docs/feature-status.md` and
`docs/remaining-work-phases.md` on 2026-07-28. All of them shipped during v1.27
and v1.27.1, and the docs were never trued up. Recorded here so the same items
are not re-planned a third time.

| Was | Now | Evidence |
|---|---|---|
| No fps measurement for the rigged preview | Measured; flag ships true | `HeroPoseViewer.tsx:124` (`rigged: true`), RP-03 in the verification record |
| Updater never prunes its download cache | Bounded sweep at startup | `services/updaterCache.ts`, called from `services/updater.ts:114` |
| Lane A impostors detected but surfaced nowhere | Banner with repair action | `components/VpkImpostorBanner.tsx` |
| `dmmMigration.ts` adopts files ungated | Gated on the same identity check | `services/dmmMigration.ts:493` (`checkVpkFile`) |
| `audioConversion.ts` has no test | Covered | `services/audioConversion.test.ts` |
| Build tray copy contradicts audio transcoding | Stale copy removed | no MP3-only string remains in `FoundryBuildTray.tsx` |
| Recolor edits cannot enter a combined build | Recolor is a forge kind | `src/types/foundry.ts:425` |
| ConVar defaults unverified against the game | `engineDefault` beside `gameDefault`, 16 reading rows filled | `services/performanceConfig.ts`, verification record |
| Foundry/asset verification never run | 42 rows, 0 blank, strict gate green | `node scripts/check-verification-record.mjs --strict` |
| Upstream Discord invite in the updater modal | Support destination decided and applied | no Discord link in `UpdateModal.tsx`; `docs/fork-maintenance.md` |
| Social 1.5 unrunnable | Resolved as a disposition, not a gap | ADR-018: wave 3 is permanently dormant against the upstream Worker |

## Delivered in source 2026-10-03 (not released)

### B-02. Foundry models, VFX, and broad thumbnail browsing (slice G)
Models provides exact base paths, static GLB preview and export. Assets now
searches all indexed textures/materials/particles and offers on-demand texture,
material and authored particle inspection. Sprite playback is experimental,
approximate and explicit about unsupported classes. Inspection does not author assets; the compiled model replacement contract
is recorded under B-01. Evidence and limits:
`docs/parallel-feature-followup-2026-10-03.md`.

### B-03. Reviewed merge recipes and path policy
Saved local recipes now retain winner-first source identities, strict mode,
exact-path/folder include and exclude rules, and an output CRC/size baseline.
Loading a recipe compares added, removed and changed output paths. The review
flattens nested selections to the same leaves the builder uses; physical-byte
review tokens reject drift before installation. Filtered builds are bounded to
256 MiB with CRC checks. Rebuilds preserve local policy and composition order.
Portable source share codes and the v1 imprint do not carry local recipes.
Evidence: `docs/setup-evidence-and-auditions-2026-10-03.md`.

## Open

### B-01. General model authoring
Compiled model VPK bundles now have an exact-path dependency contract, source
review token, preview and serializer in the shared forge tray. This closes the
missing serializer for compiled replacements. Editing arbitrary GLBs, rebuilding
skeletons and authoring new dependency graphs remain outside this slice.
Evidence: `docs/implementation-hardening-2026-10-03.md`.
**Size:** large. **Needs:** an engine-backed authoring contract beyond compiled bundles.

### B-04. Animation retarget and exact cast-particle event joins
Material/lighting parity, NPR, cloth, and the rigged export path have landed.
Experimental stock/applied clip/audio auditions, explicit manual clip selection,
shared timeline pause/seek/speed/replay, common hero materials and native ambient
sprite previews now exist. Exact-entry exports can inspect bounded authored
animation events without claiming a slot, sound or particle association.
Retarget, verified cast-particle event joins and a real-game cast pilot remain open.
Approximate sprite playback does not establish engine timing or full operator
fidelity. Unknown hero/ability joins remain unavailable.
Evidence: `docs/ability-playback-implementation-2026-10-09.md`. Packaged playback
verification is pending because the test launch stalled in macOS Keychain access.
**Size:** large.

### B-05. TOS gate placement is an unresolved decision
`components/social/PublishDialog.tsx:14` fires the gate at first publish and
stores acceptance in `localStorage`; the design doc puts it at first login.
This is a decision, not a defect. Either move the gate or correct the doc.
**Size:** small, once decided. **Needs:** a human decision, not an agent's.

### B-06. Locker overflow renderer polish (W11)
`docs/multi-folder-addon-overflow.md` marks it optional. Do it only if a
user-visible problem appears.
**Size:** small. **Trigger:** a real report.

### B-07. Fork-owned grimoire-social, or upstream the wave 3 work
The fork points at the upstream Worker, so the revalidation cron and view
counter are dormant and three commits in `../grimoire-social` are unpublished
local work. Activating means forking the sibling repo to `onionviolet`
(remote, `ci.yml` checkout, baked `GRIMOIRE_SOCIAL_BASE_URL`, deploy with
migration 0005) or offering the cron and counter upstream as a pull request.
Recorded as a disposition in ADR-018; listed here because reversing it is
real work.
**Size:** medium. **Note:** the local gate cannot catch sibling-repo breaks;
`pnpm typecheck` resolves the sibling from disk while CI checks it out fresh.

### B-08. Complete setup profiles and Locker recovery
Manual mapping now re-reviews a selected local replacement and binds its exact
bytes to one apply operation; it does not rewrite the saved profile. User-mod
byte retention, rolling restore history and interrupted rollback are implemented.
Reserved Locker artifacts and their owning selections remain outside profile
snapshots. Complete setup capture needs an explicit multi-owner restore contract
before those artifacts can safely join profile recovery.
**Size:** medium to large. **Evidence:** current `profileRecovery.ts` and
`docs/setup-evidence-and-auditions-2026-10-03.md`.

### B-09. Verified publisher identity and application rollback
Stable/preview selection, startup-check opt-in and optional Windows certificate
hooks now exist in source. A hook does not establish a signed release. Trusted
publisher credentials and signed artifact verification still need real CI evidence.
Last-known-good installer retention and rollback across app-data migrations remain
unimplemented; archive-cache cleanup is not application rollback. macOS remains
manual-update-only under the current ad-hoc-signing contract.
**Size:** medium to large. **Needs:** publisher credentials and a platform-specific
installer plus app-data rollback contract. Fork issue 29 remains partly open.

## Deferred by decision

**Verification debt stays deferred** (decided 2026-09-01). The three open
`unrun-verify` entries in `.planning/WINDOWS.md` need a real Deadlock install
or a Windows machine, and none of them gate a release. They are tracked there,
not here, and not on the roadmap.
