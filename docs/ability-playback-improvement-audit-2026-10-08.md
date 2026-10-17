# Ability playback improvement audit

Reviewed: 2026-10-08. Scope: character models, ability animation, sound and cast
effects. This is a recommendation, not an accepted implementation plan or a
change to the current milestone. Remaining feature ownership stays in
[BACKLOG B-04](../.planning/BACKLOG.md#b-04-animation-retarget-and-exact-cast-particle-event-joins).

## Verified source findings

The checkout remains on `codex/finish-requested-features`, with HEAD `2aa5aef8`
and existing uncommitted audition changes. This review inspected those changes
without editing implementation files.

| Code | Finding | Evidence |
|---|---|---|
| F1 | Ability lookup matches whole clip-name tokens only when one match exists. Manual selection is available, but every ability still has `particlePath: null` and every prepared playback has `effect: null`. | `electron/main/services/abilityPreview.ts:18`, `:43`, `:98` |
| F2 | Playback advances the animation mixer using a capped frame delta and starts a separate HTML audio element. There is no shared playhead, decoded-audio readiness gate or cast-event schedule. A second audio element supplies standalone controls. Timing drift under a renderer stall is a source-derived risk, not a reproduced runtime failure. | `src/components/locker/AbilityPreview.tsx:20`, `:135` |
| F3 | Ability playback uses a separate Canvas with simple lights and a raw GLTF scene. The hero viewer has environment lighting, Source 2 material handling and NPR passes. Ability playback does not reuse those passes. | `src/components/locker/AbilityPreview.tsx:129`; `src/components/locker/HeroPoseViewer.tsx:1277` |
| F4 | Existing sprite interpretation handles attachments and some authored operators, but skips rope/model/light renderer families. Audition UI tests mock GLTF loading to return null, so those tests do not exercise actual animation or audio timing. | `src/components/locker/ParticleEffect.tsx:1`, `:126`; `src/components/locker/AbilityPreview.test.tsx:9` |

The local binary's `model --help` and `model clips --help` expose clip discovery
and export but no documented event-export command. The app's `ModelClipInfo`
contains duration and frame metadata, not events. This does not prove that the
binary cannot decode underlying event data.

## Recommended order

| Code | Improvement | Observable acceptance | Relative effort |
|---|---|---|---|
| A1 | Give animation and sound one playback controller. Decode required assets before starting; add a scrubber, playback speed and an explicit finished state. Preserve independent sound pitch tuning. Treat pause, seek, replay and close as operations on the same playhead. | Pausing freezes the model and audio; resuming restores their offsets; replay starts once from zero; renderer stalls do not silently slow only the animation; close stops every playback source. | Medium: renderer state and audio lifecycle work. |
| A2 | Share the existing hero rendering passes with ability playback. Keep the selected outfit, lighting, materials and camera framing consistent when switching from idle to a cast. Retain manual clip selection for unresolved cases. | The same stock/applied model has consistent appearance in idle and cast views; returning to idle does not lose its source or camera state. | Medium: extract reusable scene pieces, avoiding growth in the large hero viewer. |
| A3 | Inspect actual Deadlock clip and hero data for authored sound/particle events and the slot-to-clip association. Where available, export an event sidecar containing time, resource, operation, target and attachment. Keep evidence and game fingerprints with the mapping. | One real ability has an auditable slot, clip and event chain. Unknown associations remain explicitly unresolved. Event fields are checked against captured resource data, not only invented fixtures. | Uncertain: requires a bounded real-asset investigation; an exporter extension may be needed. |
| A4 | Attach one supported cast effect to the animated model and drive its start/stop from that event schedule. Begin with a sprite-only effect whose authored references and attachments resolve. Make replay reset particle state and random seed; seeking needs deterministic resimulation. | The effect appears at the correct bone/attachment at its authored time, follows the moving model, and resets on replay. Unsupported operators are disclosed; it is still a preview until compared with the game. | Largest part: event scheduling, particle lifecycle and attachment integration. |
| A5 | Compare one complete cast with the real game and a packaged build, then extend coverage by supported effect class. Record which parts are source-derived, approximate or unavailable. | Stock and applied sources survive replay, source switching and reopening; a game comparison checks onset, attachment and finish; the packaged app loads its model/audio/effect URLs. | Bounded pilot first; roster-wide work depends on its results. |

Start with A1 and A2, which improve the existing audition without depending on
new event extraction. A3 is the decision point before promising full cast VFX.
Holliday's lasso clip exists in current mocked exporter tests, but that alone
does not make it a verified pilot. Choose the first real cast after checking
its event and renderer requirements. Rope-heavy or model-spawning effects cost
more than a supported sprite effect.

Custom animation retargeting remains later work: it addresses a different need
from playing the hero's own existing clips and adds skeleton compatibility and
authoring work.

## Reference comparison

Keep Three.js and the current exporter as the incumbent. Three.js supports
sampling a mixer at an explicit time, and Web Audio supports scheduled starts
and buffer offsets, which provide the mechanisms for A1:
[AnimationMixer](https://threejs.org/docs/pages/AnimationMixer.html) and
[Web Audio start](https://www.w3.org/TR/webaudio/#dom-audiobuffersourcenode-start).
Integration is still required; these APIs do not establish game event timing.

Adapt the event schema and sampling approach from Source 2 Viewer as a research
reference. Its inspected revision is `f19322f829a27adfe8e1ca29b8410cf8aab0f3b6`:
[NmClipEvent](https://github.com/ValveResourceFormat/ValveResourceFormat/blob/f19322f829a27adfe8e1ca29b8410cf8aab0f3b6/ValveResourceFormat/Resource/ResourceTypes/ModelAnimation2/NmClipEvent.cs)
reads normalized event times, sound events and particle attachment fields;
[AnimationPlayer.Events](https://github.com/ValveResourceFormat/ValveResourceFormat/blob/f19322f829a27adfe8e1ca29b8410cf8aab0f3b6/Renderer/Renderer/AnimationPlayer.Events.cs)
samples crossed events, prewarms sound and handles interruption.
Those mechanisms are demonstrated in its source. Their coverage of this
Deadlock install's ability slots is untested. Its .NET/OpenGL renderer would
add substantial integration and maintenance cost as a replacement, so the
recommended disposition is to adapt the relevant mechanism rather than migrate
the preview. No external code was copied and no dependency was added.

## Review limits

Checks performed: current source and planning-owner reads, targeted test-source
inspection, local CLI help inspection, and primary documentation/source review.
No tests, real-asset exports, dev-app auditions or in-game comparisons were run.
Only this report was added; existing dirty files were preserved. No commit,
push, release, installation or GitHub mutation was performed.
