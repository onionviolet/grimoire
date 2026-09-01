# Backlog

Cross-milestone register of work that is real, scoped, and **not** in the
current milestone. One line per item, each with the evidence that it is still
open as of the date in the header.

**Reconciled:** 2026-09-01, by reading the code rather than the docs.

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

## Open

### B-01. Foundry model edits have no forge serializer
`FoundryForgeEdit` admits `sound`, `texture`, and `recolor`
(`src/types/foundry.ts:423`). A model edit cannot enter a combined build, and
the tray refuses it explicitly rather than dropping it silently. Blocked in
practice on B-02, since there is no model surface to stage from.
**Size:** medium. **Blocked on:** B-02.

### B-02. Foundry models, VFX, and broad thumbnail browsing (slice G)
No usable model export/viewer entry point. Thumbnail browsing is deliberately
limited to ability icons, item icons, and hero images. Blocked on a trustworthy
path catalog; the old Phase 2 dependency is satisfied.
**Size:** large. **Blocked on:** a path catalog worth trusting.

### B-03. Advanced merge composition
Review and reviewed source order shipped. Merge recipes, editable
include/exclude path policy, merge-content presets, and rebuild diffs are
absent (`MergeRecipe` appears nowhere in the tree). A reviewed order still
cannot be applied to a selection containing a merged mod, because flattening
contributes leaves the review never showed.
**Size:** large. **Note:** assessed 2026-07-28 as the lowest-value item on the
board: pure groundwork, no standalone user benefit, nothing breaks without it.
Do not start unless the merge-recipe UI is actually wanted.

### B-04. Animation retarget and in-preview ability VFX
Material/lighting parity, NPR, cloth, and the rigged export path have landed.
Retarget and in-preview VFX have not.
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

## Deferred by decision

**Verification debt stays deferred** (decided 2026-09-01). The three open
`unrun-verify` entries in `.planning/WINDOWS.md` need a real Deadlock install
or a Windows machine, and none of them gate a release. They are tracked there,
not here, and not on the roadmap.
