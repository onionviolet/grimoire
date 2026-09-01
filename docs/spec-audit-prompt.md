# Spec audit prompt

A reusable prompt for auditing whether Grimoire's documented features are
actually implemented, and implemented **to spec**. Paste the block below into a
fresh Claude Code session in this repo.

Why this exists: on 2026-07-28 three separate "missing feature" conclusions were
drawn from stale doc headers, and all three were wrong — the features shipped.
The audit's job is to make the code, not the prose, the source of truth.

---

## The prompt

> You are auditing the Grimoire repo (Electron + React mod manager for Deadlock).
> Your job is to determine, for each documented feature claim, whether it is
> **implemented**, **partially implemented**, or **missing**, and where the
> implementation **deviates from its written spec**.
>
> ### Hard rules
>
> 1. **A doc status header is not evidence.** Headers in `docs/` are known to be
>    stale in both directions: features marked "design (not yet built)" have
>    shipped, and features described as built have unbuilt parts. Verify every
>    claim against code you have read. Cite `file:line` for every verdict.
> 2. **Trace the whole chain before calling something missing.** A renderer
>    feature in this app is only real if it exists at every layer:
>    `electron/main/services/*` → `electron/main/ipc/*` → `electron/preload/index.ts`
>    → `src/types/electron.ts` → `src/lib/api.ts` → the component that renders it.
>    Report the exact layer where a chain breaks.
> 3. **Grep for the shared component, not the page.** Foundry and Locker surfaces
>    compose heavily. A feature can be absent from `GlobalSoundBrowse.tsx` and
>    still ship, because the row component it renders (`SoundRow` in
>    `SoundBrowse.tsx`) provides it. Before concluding a page lacks something,
>    read the components it renders.
> 4. **"Exists" is not "to spec."** For each shipped feature, diff the behaviour
>    against the design doc and list deviations explicitly, marking each as
>    *intentional improvement*, *unresolved gap*, or *undocumented drift*.
> 5. **Do not fix anything.** This is a read-only audit. Propose fixes; do not
>    apply them.
>
> ### What to audit
>
> Work through these, in this order. For each, the doc is the spec and the named
> code is the starting point, not the boundary.
>
> **A. Foundry asset-source inspection** — spec:
> `docs/feature-status.md` sections 2 and 3a. The core claim: for an exact
> normalized VPK entry path, the user can see every installed or disabled mod
> that writes that path, with provenance, priority, and the expected load-order
> winner, discovered by VPK entry-path inspection and never by mod metadata or
> hero-name guessing. Verify specifically:
> - Global sounds: does a row in the Global sound browser show every mod that
>   modifies that exact sound file, under that specific sound?
> - Hero sounds, textures, item/ability icons, portrait families: same question.
> - Are disabled contenders shown? Third-party (non-Grimoire) VPKs? Is an
>   unreadable VPK reported as uncertainty rather than silently dropped?
> - Which of the specified *actions* exist (audition, open in Installed,
>   enable/disable via the mod store, add to shuffle pool, create replacement)
>   versus inspect-only?
> - Start at `services/foundryAssetSources.ts`, `components/foundry/AssetSourcesPanel.tsx`,
>   and every component that mounts it.
>
> **B. Foundry combined output** — spec: `docs/feature-status.md` slice F. Do the
> live sound and visual authoring flows feed one reviewed write set in the build
> tray, and does a confirmed build produce one named VPK with collision winners
> shown? Check whether `soundStagedEdit.ts` / `visualEdits.ts` serializers are
> actually invoked by a live forge path or only by tests.
>
> **C. Locker hero card apply** — spec: `docs/locker-hero-card-apply.md`
> (including its "As built" deviations section). Verify apply, swap, revert,
> custom uploads, the missing-source warning path, the empty-set teardown, and
> that the managed VPK is hidden from Installed, Conflicts, profiles, and
> portable-profile export.
>
> **D. Ability VFX recolor** — spec: `docs/ability-vfx-recolor.md`. Which heroes
> have pinned recipes in `heroColors.ts`, and does each have a matching engine
> recipe? Does the Locker picker's live preview path handle a hero with no
> `preview_texture`?
>
> **E. Merge composition** — spec: `docs/vpk-composition-roadmap.md`. Milestone 1
> is claimed complete: confirm `analyze-merge` exists, is read-only, and
> distinguishes an unreadable VPK from an empty one. Confirm milestones 2-5 are
> genuinely absent (no half-wired recipe schema or path policy).
>
> **F. Chat Wheel** — spec: `docs/chat-wheel.md`. Round-trip: open a ChatLane VPK,
> edit as YAML, validate, install. Are the validation and round-trip tests real,
> and is the experimental gate still enforced?
>
> **G. 3D preview fidelity** — spec: `docs/3d-preview-fidelity-plan.md`. Which
> phases have landed? Confirm specifically whether the export path still always
> passes `--pose` (which would mean no rig, gating phases 4-7).
>
> **H. Performance config** — spec: `docs/performance-config-integration.md` and
> `docs/performance-convars-followup-plan.md`. Phase 1 vs Phase 2; which Phase A
> follow-up controls exist.
>
> **I. Social** — spec: `docs/social-architecture.md` phased roadmap. Which Phase
> 1 items shipped in `Discover.tsx` / `ipc/social.ts`; confirm the session token
> never reaches the renderer.
>
> **J. Overflow, deadworks, profiles** — spot-check that
> `docs/multi-folder-addon-overflow.md` W1-W10, `docs/deadworks-servers.md`, and
> `docs/profile-spec.md` still describe current behaviour.
>
> ### Output format
>
> One table, then details. The table:
>
> | Area | Claim | Verdict | Evidence | Deviation from spec |
> | --- | --- | --- | --- | --- |
>
> `Verdict` is one of: `SHIPPED`, `PARTIAL`, `MISSING`, `STALE-DOC` (code is
> ahead of the doc), `DOC-AHEAD` (doc claims more than the code does).
> `Evidence` is `file:line` references only — no prose assertions.
>
> After the table, for every `PARTIAL` / `MISSING` / `DOC-AHEAD` row, give the
> smallest concrete next step and the layer it belongs to.
>
> Finally, list every `docs/*.md` whose status header should change, with the
> exact replacement text.
>
> ### Verification you must actually run
>
> - `pnpm exec vitest run` (note which of the audited areas have real coverage
>   versus none)
> - `pnpm typecheck` and `pnpm lint`
> - `pnpm exec vitest run <file>` for each area-specific test file you cite
>
> Report failures verbatim. Do not report an area as verified on the strength of
> a test that does not exist.

---

## Scoping notes for whoever runs it

- Sections A-C are the highest value; if the audit must be split, run A-C first.
- The audit is read-only by design. Feed its output into
  [.planning/BACKLOG.md](../.planning/BACKLOG.md) and promote that
  document's `[doc]` tags to `[verified]`.
- Re-run after any release that touches Foundry or the Locker.
