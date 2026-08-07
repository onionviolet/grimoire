---
phase: 01-verified-against-the-game
verified: 2026-08-06T19:35:00Z
status: passed
score: 8/8 must-haves verified
behavior_unverified: 0
overrides_applied: 1
overrides:
  - must_have: "ROADMAP Phase 1 Success Criterion 1: 'A VPK forged from one staged sound edit and one staged texture edit holds both entry paths with bytes matching their staged sources; cancelling the native save dialog instead leaves the mod library and the staged edits exactly as they were.'"
    reason: >
      IG-01 and IG-02 remain `blocked`, not `pass`, and cannot be settled in this
      environment: IG-01 needs the fork's locally-built vpkmerge engine (the bundled
      release binary rejects texture replacement without the YCoCg icon fix), and IG-02
      needs a main-process hook to cancel dialog.showSaveDialog that no CDP-driven script
      can reach; faking the cancellation was rejected as dishonest evidence (T-01-26).
      Presented with the choice of accepting this as deferred, fixing it now, or routing
      it to /gsd-plan-phase --gaps, the user chose to accept it as outstanding by explicit
      decision (D-24). ROADMAP.md Success Criterion 1, REQUIREMENTS.md's
      REQ-ingame-verification-sweep bullet, and 01-CONTEXT.md were all amended consistently
      to record that acceptance rather than silently treating "blocked for a good reason"
      as "met." The verdicts correctly stay `blocked`, not `deferred`: D-22 makes `deferred`
      legal only on an engine-tier row, and IG-01/IG-02 are app-tier rows with a runner
      that could settle them once the two missing pieces exist, confirmed directly against
      scripts/check-verification-record.mjs's Rule 10 (`deferred-on-app-row`).
    accepted_by: "onionviolet"
    accepted_at: "2026-08-06T19:26:35-05:00"
re_verification:
  previous_status: gaps_found
  previous_score: "6/8"
  gaps_closed:
    - "ROADMAP Phase 1 Success Criterion 1 undemonstrated (IG-01/IG-02 blocked) -- now an explicit, consistently-documented D-24 acceptance rather than an implicit gap"
    - "REQUIREMENTS.md documentation staleness -- REQ-performance-convar-safer-experimentation and REQ-rigged-preview-release-gate bullets both amended to match what the phase actually delivered"
  gaps_remaining: []
  regressions: []
---

# Phase 1: Verified Against The Game Verification Report

**Phase Goal:** Every path that has only ever been proven by a unit test is proven against the running app, driven end to end over CDP, and the lanes that shipped without any rendering check get one.
**Verified:** 2026-08-06T19:35:00Z
**Status:** passed
**Re-verification:** Yes -- after gap closure (commit `356811b`)

## What changed since the first pass

Confirmed via `git show 356811b --stat`: only `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, and `.planning/phases/01-verified-against-the-game/01-CONTEXT.md` were touched. Nothing in `src/`, `electron/`, `scripts/`, or `docs/ingame-verification-record.md` changed (confirmed: the record's last commit is still `65d925e`, from before my first pass). Every code-level truth verified in the first pass therefore stands unchanged; this pass re-confirms them and re-examines the two closed gaps plus the coordinator's specific claims.

## Re-verification of Gap 1 (the functional gap)

**Claim:** the user was offered accept/fix/route-to-gaps, chose accept, and that is recorded as D-24, amending 01-CONTEXT.md, ROADMAP.md Success Criterion 1, and REQUIREMENTS.md's REQ-ingame-verification-sweep bullet.

Checked directly, not taken on trust:

- `git show 356811b` confirms the diff touches exactly those three files, with the exact text quoted in the coordinator's message present verbatim in each.
- `.planning/phases/01-verified-against-the-game/01-CONTEXT.md` line 67 adds a D-24 decision recording the acceptance, naming both blockers (missing local vpkmerge engine, no dialog-cancel hook) and stating the verdict stays `blocked` rather than becoming `deferred`.
- `.planning/ROADMAP.md` Success Criterion 1 now carries an inline amendment stating both halves remain `blocked` and that the project accepts that for this phase "rather than claiming the criterion met."
- `.planning/REQUIREMENTS.md`'s REQ-ingame-verification-sweep bullet carries a second amendment paragraph, dated 2026-08-06 (D-24), naming the same two rows and reasons.
- `docs/ingame-verification-record.md` IG-01 and IG-02 rows were re-read directly: both still carry Verdict `blocked` with their original Root cause text unchanged, confirming the record itself was not touched (matches the commit's file list).

**On the specific judgment to scrutinise -- keeping `blocked` rather than `deferred`:** checked against `scripts/check-verification-record.mjs` directly. Rule 10 in the source reads:

```
if (verdict === 'deferred') {
  if (tier !== 'engine') {
    problems.push({ code: 'deferred-on-app-row', ... 'deferred is only legal on an engine-tier row' });
  }
  ...
}
```

IG-01 and IG-02 are both `Tier: app` (confirmed by reading their rows in `docs/ingame-verification-record.md`). Had they been changed to `deferred`, `node scripts/check-verification-record.mjs --strict` would fail on `deferred-on-app-row` for both. Ran it directly: it exits 0 with both rows still `blocked`. The coordinator's reading is correct: `deferred` was never a legal option for these two rows under the guard's own rules, and `blocked` ("someone still owes it") is the accurate word given a runner exists that could settle them if the two missing pieces (a locally-built vpkmerge engine, a main-process dialog-cancel hook) existed. I do not think the acceptance should have been expressed differently. The three-document amendment (CONTEXT decision, ROADMAP criterion, REQUIREMENTS bullet) is the correct shape for an accepted-but-still-open item: it is distinguishable in the text itself from both a fabricated pass and a silently-ignored gap.

This is the escalation-gate pattern working as intended: the first pass surfaced an undemonstrated fact, the user was given real options, chose one, and the choice is now legible from three independent documents rather than inferred. I am treating Success Criterion 1 as **passed by explicit, disclosed override** (recorded in this file's frontmatter), not as silently satisfied.

**One documentation nit found while re-checking, not present in my first pass because 01-CONTEXT.md was unchanged then:** the new decision was labelled `D-24`, but 01-CONTEXT.md already had an unrelated `D-24` two lines below it ("The runner is not wired into CI"). `01-CONTEXT.md` now has two entries both reading `**D-24:**` (lines 67 and 68 by direct grep). This is cosmetic -- it does not affect the guard, the record, or any test -- but a future reader citing "D-24" cannot tell which decision is meant without opening the file. Worth a follow-up rename (the new entry to `D-26`, since `D-25` is already taken) whenever this file is next touched; not blocking.

## Re-verification of Gap 2 (the documentation gap)

Checked `git show 356811b` diff directly against both requirement bullets:

- **REQ-performance-convar-safer-experimentation** now carries an amendment: "the app-side half shipped in Phase 1 ... structurally complete and data-outstanding." Confirmed accurate against the tree: `engineDefault` is wired through all four declaration points (re-confirmed by grep in this pass, unchanged from the first), and the 16 CV rows in `docs/ingame-verification-record.md` all still carry `deferred` with a reason (confirmed by direct count: `grep -c '| deferred |'` returns 18, matching CV-01..16 plus IG-21/IG-22).
- **REQ-rigged-preview-release-gate**'s amendment removes the now-false "no fps number exists and none can be produced headlessly" claim and states the measured values and machine inline. Cross-checked against `docs/ingame-verification-record.md`'s RP-03 row and `src/components/locker/HeroPoseViewer.tsx`'s `rigged: true` comment (both unchanged since my first pass, both already confirmed accurate): the values match exactly (static/rigged wall medians both 8.30ms, GPU timer 1.67ms/1.79ms, +0.12ms delta, RX 7900 XTX / Windows 11 Enterprise 10.0.26220).

Both stale bullets are now accurate. Gap 2 is closed.

**On the traceability table still reading "Pending":** confirmed the table (`.planning/REQUIREMENTS.md` lines 152-155) is unchanged, all four Phase 1 rows still say "Pending." The coordinator's explanation is that `gsd_run query phase.complete` (or equivalent) owns that write and deliberately cannot run while a verification report shows gaps, so it runs immediately after a passing verification rather than before. I agree with this ordering: flipping a traceability table to "done" before the phase's own verifier has signed off would be the same premature-green-gate failure mode this phase exists to prevent, just moved one level up the document stack. I am not treating "Pending" as a defect. If this verification report lands as `passed`, the table updating right after is the correct sequence, not a gap to flag now.

## Re-confirmation of the `gigawatt_prisoner` finding

Re-checked directly against `src/lib/heroCodenames.ts` line 103:

```
{ displayName: 'Seven', panorama: 'gigawatt', sound: 'gigawatt', particle: 'gigawatt', bodyModel: 'gigawatt_prisoner', background: null },
```

And the file's own header comment (line 19): `` `bodyModel` | the `<x>.vmdl_c` basename under `models/heroes*` | Seven is `gigawatt_prisoner`, not `gigawatt` ``.

This confirms the first-pass finding without qualification: `gigawatt_prisoner` is Seven's **`bodyModel` codename**, the literal `.vmdl_c` basename Grimoire's own hero-codename table uses to address Seven's base rigged model. It is not a skin, not a mod, and not something that can be "0 installed" the way a cosmetic mod can. The RP-03 measurement's own "measurement conditions" caveat ("the subject was the vanilla Seven rig, not the `gigawatt_prisoner` skin") uses "skin" loosely to mean "no third-party reskin mod," but the codename itself was never in question and correctly identifies Seven. The finding was not mistaken; it stands. The orchestrator's relay to the user (that this changed how the RP-03 evidence should be characterised, i.e. correctly rather than as a deviation) was accurate.

## Fresh Truth Table

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | ROADMAP SC1 (as amended by D-24): the two undemonstrated facts are explicitly, consistently accepted as outstanding rather than silently claimed complete | PASSED (override, see frontmatter) | Verified across three documents plus the guard's own Rule 10 behavior, all consistent |
| 2 | ROADMAP SC2: merged VPK winner bytes match the reviewed winner | VERIFIED (unchanged) | IG-06 = pass, byte comparison confirmed in first pass, record file unchanged since |
| 3 | ROADMAP SC3: audition byte parity across the mod-kind/scope matrix | VERIFIED (unchanged, disclosed caveat on IG-07's methodology stands) | IG-07..20 = pass, record file unchanged since first pass |
| 4 | ROADMAP SC4: RP-03 measured, machine named, decision applied to the release flag | VERIFIED (unchanged) | Re-confirmed `rigged: true` in `HeroPoseViewer.tsx`, values match REQUIREMENTS.md's new amendment text exactly |
| 5 | ROADMAP SC5: six render lanes plus Chat Wheel round trip each get a real check | VERIFIED (unchanged) | Full suite re-run this pass: 148 files / 1595 tests pass |
| 6 | ROADMAP SC6: `--strict` exits 0, 23 app rows settled, 18 engine rows deferred with reasons | VERIFIED (re-run) | `node scripts/check-verification-record.mjs --strict` exits 0 this pass: 41 rows, 0 blank, 16 pass / 7 blocked / 18 deferred |
| 7 | `engineDefault` wiring end to end, one computation path | VERIFIED (unchanged) | Re-confirmed by grep; `performanceConfig.test.ts` re-run: 139/139 pass |
| 8 | REQUIREMENTS.md text and traceability reflect what the phase delivered | VERIFIED | Both stale bullets fixed and cross-checked against the tree; traceability table's remaining "Pending" status is a deliberate, correctly-ordered gate (phase.complete runs after a passing verification), not a defect |

**Score:** 8/8 truths verified (1 by explicit, disclosed override; 7 directly)

## Full Gate Re-run (this pass, not trusted from the coordinator's message)

| Check | Result |
|---|---|
| `pnpm exec vitest run` | 148 files / 1595 tests pass |
| `pnpm exec tsc -b` | exit 0 |
| `pnpm lint` | exit 0 |
| `pnpm encoding:check` | 606 files clean |
| `node scripts/check-verification-record.mjs --strict` | exit 0, 41 rows / 0 blank / 16 pass / 7 blocked / 18 deferred |
| `git status --short` (src/electron/scripts/docs) | no changes outside `.planning/` since first pass |

All match the coordinator's stated current state exactly; none of it was taken on trust without independently re-running it.

## Remaining Open Items (informational, not gaps)

These do not block phase completion; they are the genuinely-owed follow-up work the record itself names, unchanged from the first pass:

- IG-01, IG-02: accepted as outstanding by D-24 (see above). Owed: a locally-built vpkmerge engine and a main-process dialog-cancel test hook.
- IG-04, IG-05, IG-13, RP-01, RP-02: still `blocked` for their own stated, legitimate reasons (safety judgment against mutating a shared production install, no suitable third-party fixture, no scene-graph debug hook). None of these back a ROADMAP Success Criterion the way IG-01/IG-02 did, so they were correctly left as ordinary disclosed gaps rather than needing their own D-24-style acceptance.
- CV-01..16, IG-21, IG-22: `deferred`, per D-19/D-25, requiring a real Deadlock console session and a live match respectively.
- Minor: `01-CONTEXT.md` now has two decisions both labelled `D-24` (see above). Cosmetic; worth a rename next time the file is touched.
- The mod-ID collision threat flag from 01-08 (`generateModId = md5(metaKey)`, path-derived not content-derived) remains open, accurately disclosed, and out of this phase's scope.

## Verdict

Both gaps from the first pass are closed, correctly and consistently, and I independently re-verified every claim in the coordinator's message against the tree rather than accepting it. The phase goal is achieved: every path that had only unit-test coverage is now proven against the running app or has its remaining exposure explicitly, consistently documented as an accepted decision rather than an implicit one. Status: **passed**.

---

*Verified: 2026-08-06T19:35:00Z*
*Verifier: Claude (gsd-verifier)*
