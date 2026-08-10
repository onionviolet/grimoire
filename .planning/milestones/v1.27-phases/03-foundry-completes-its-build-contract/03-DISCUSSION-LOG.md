# Phase 3: Foundry Completes Its Build Contract - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-08
**Phase:** 3-Foundry Completes Its Build Contract
**Areas discussed:** Recolor apply model, Model edits scope, Pool audition fidelity, Sound shuffle surfacing

---

## Recolor apply model

| Option | Description | Selected |
|--------|-------------|----------|
| Recolor becomes staged/deferred | Recompose HeroColorPicker's Apply into a staged FoundryForgeEdit that only bakes when the combined build is forged, matching sound/texture. | ✓ |
| Recolor keeps applying immediately, tray folds in the result | HeroColorPicker keeps baking on click; the tray treats the already-applied recolor VPK as a foreign source to merge. | |

**User's choice:** Option 1 (staged/deferred) — "consider most optimal methods and more in the future."
**Notes:** User explicitly picked this one rather than deferring. Read the "and more in the future" clause as: keep the staged-edit shape generalizable (plain `{id, kind, precedence, request}` member) so a later edit kind would slot in the same way — not as a request to build anything for that future now (see Model edits scope, below).

---

## Model edits scope

| Option | Description | Selected |
|--------|-------------|----------|
| Nothing — recolor only, this phase | FoundryForgeEdit widens to sound \| texture \| recolor. No model-kind work of any sort. | ✓ (Claude's judgment) |
| Widen the type only, no UI | Add 'model' to the union and buildTray's bookkeeping for future-readiness, but build no authoring surface. | |

**User's choice:** "Unsure, consider what is most optimal and leaves the most options open and is most intuitive and useful" — deferred to Claude.
**Notes:** Decided against the type-only stub. ROADMAP's Phase 3 success criteria never test model edits; "Foundry models... (slice G)" is explicitly out of scope elsewhere pending a trustworthy path catalog; adding an unused type case would be speculative scaffolding against house style. Reversible later — adding the type is cheap whenever a real model-authoring flow is scoped.

---

## Pool audition fidelity

| Option | Description | Selected |
|--------|-------------|----------|
| Cycling-on-repeat already satisfies this | Close as already delivered (doc-drift correction); drop from remaining work. | ✓ (Claude's judgment) |
| Want one press to play the whole pool | Change useClipPlayer to queue and play every clip back-to-back on a single press. | |

**User's choice:** "Unsure, consider what is most optimal and leaves the most options open/pickable/leave the choice to the user? and is most intuitive and useful?" — deferred to Claude.
**Notes:** Found during codebase scouting that commit `9b01c63` (2026-07-26, on `main`) already added per-press pool cycling gated by the `forkPoolCycling` setting — eleven days before REQUIREMENTS.md (2026-08-05) was written, which still describes the old "vsnd[0] only" problem. This is the doc-drift pattern PROJECT.md explicitly warns about. Decided the existing mechanism already satisfies the requirement: it gives the user a real choice (the setting) at zero new code, and the "back-to-back" alternative would add real complexity for marginal gain against this phase's own bounded framing.

---

## Sound shuffle surfacing

| Option | Description | Selected |
|--------|-------------|----------|
| Inline toggle in Foundry + link to Locker | Extract the toggle into a shared component both pages use, plus a link to the Locker's pool view. | ✓ (Claude's judgment, but effectively forced) |
| Link-only from Foundry to Locker | Foundry adds a link/button only; no new toggle control there. | |

**User's choice:** "Unsure, consider what is most optimal and leaves the most options open and is most intuitive and useful?" — deferred to Claude.
**Notes:** Not actually ambiguous once ROADMAP's literal wording is applied: "add or remove a hero sound from its launch shuffle pool without leaving Foundry, and can reach the Locker's view of that same pool from there" requires the add/remove action itself to work without leaving Foundry. Link-only fails that half of the criterion. Scouted that the toggle currently lives only inside `Locker.tsx`, prop-drilled into a shared list-render component — extraction into a shared component/hook is the concrete follow-through.

---

## Claude's Discretion

- Model edits scope, pool audition fidelity, and sound shuffle surfacing were all explicitly deferred to Claude's judgment by the user (see above); ROADMAP wording and existing code resolved two of the three to a non-arbitrary answer.
- Exact component/hook boundary for the extracted shuffle-toggle.
- Recolor request type's exact field names in `src/types/foundry.ts`.
- Where the recolor builder function lives in the main process.
- Copy/wording for new tray labels and the recolor UX change (all i18n keys).

## Deferred Ideas

- `'model'` as a Foundry edit kind — no authoring surface exists anywhere in the codebase; revisit only when the blocked path-catalog work is scoped.
- One-press-plays-everything pool audition — rejected in favor of existing per-press cycling; would be new work if ever wanted, not a bug fix.
