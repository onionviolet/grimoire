# Context (DOC intel)

Running notes from DOC-classified sources, keyed by topic, with source
attribution. Two DOCs fall inside detected cross-reference cycles and were held
out of synthesis: `docs/audit-2026-07-28-verdicts.md` (manifest precedence bump
to 2, verified ground truth on what is implemented) and
`docs/rigged-preview-spike.md`. See `.planning/INGEST-CONFLICTS.md`.

---

## Topic: GameBanana API surface for Deadlock
- source: docs/gamebanana_api_reference.md
- Game ID `20948`. Two distinct API systems exist: Core (legacy) at `https://api.gamebanana.com` and REST (modern) at `https://gamebanana.com/apiv11`. Modern integrations should use the REST API for data retrieval (browsing, searching, downloading) and reserve the Core API for schema introspection and auxiliary metadata.
- Critical implementation notes called out by the source: the API frequently returns empty responses (0 bytes) instead of JSON errors, so validating the response body before parsing is mandatory; list endpoints (Search, Subfeed) return sparse data and important flags like `_bIsNsfw` are often missing from lists and only appear in Detail requests; native category endpoints often fail for Deadlock, so category data must be extracted from individual mod records; Deadlock content is split between `Mod` (visuals) and `Sound` (audio) and both must be queried to get all content.
- Verified item type counts from scanning all 1,579 submissions: Mod 728, Sound 717, Request 98, Question 22, Tool 4, Thread 3, Tutorial 2, Script 2, Concept 1, Spray 1, Wip 1. Filtering to actual content (Mod + Sound + Tool + Script + Spray) yields 1,452 items.
- Key endpoints: `GET /Game/20948/Subfeed` (params `_nPage`, `_nPerpage` default 15 with 50 recommended max, `_csvProperties`) for the global feed of new submissions; `GET /Util/Search/Results` (params `_sSearchString`, `_idGameRow` = 20948, `_sModelName`, pagination) for search.

## Topic: GameBanana category taxonomy for Deadlock
- source: docs/gamebanana_categories_reference.md
- Game ID `20948`, last verified 2024-12-31, 1,579 items scanned. GameBanana uses a flat category system for Deadlock with no sub-categories or hierarchical structures.
- Explicit caution from the source: there are NO hero-specific categories. Categories like "Abrams Skins" or "Yamato Mods" do not exist; all hero content is dumped into generic buckets such as Skins (33295) or Model Replacement (33154). To filter by hero you must use the Search API with the hero name, or client-side tag/title parsing after fetching.
- Category types are keyed off the parent submission type: `ModCategory` (`/mods/cats/{id}`), `SoundCategory` (`/sounds/cats/{id}`), `ToolCategory` (`/tools/cats/{id}`), `TutorialCategory` (`/tuts/cats/{id}`).
- Representative ModCategory ids and counts: 33295 Skins (454, primary hero skins), 33154 Model Replacement (95, full model swaps), 31713 HUD (98, UI/reticles/crosshairs/health bars), 31710 Other/Misc (71), 3366 Other/Misc (57, legacy shared across games), 3807 Skins (41, secondary legacy/shared).

## Topic: deadlock-api.com stats reference
- source: docs/DEADLOCK_STATS_API.md
- Reference for the deadlock-api.com HTTP API covering authentication, rate limits, and endpoints for players, MMR, match history, hero stats, and Steam profiles. Classified DOC by manifest; the classifier noted the content signals (endpoint tables, rate limits) would otherwise read as SPEC, and the manifest was treated as authoritative.
- Consumed by the stats system described in `docs/deadlock-api-architecture.md` (see `constraints.md`): the `stats.ts` API client in the Electron main process, persisting into `stats.db`.

## Topic: particle FX feasibility for the Locker 3D hero preview
- source: docs/3d-preview-effects-feasibility.md
- Dated 2026-06-16. Renderer locked to three.js + R3F with three.quarks for live simulation; flipbook sprite-sheets and pre-baked WebM as fallbacks. Grounded in a 9,714-effect inventory (every hero particle `.vpcf_c` in the pak, decoded with 0 errors) plus ~30 direct KV3 decodes and three adversarial verification passes.
- Executive finding: the effects axis is feasible, but smaller and more plumbing-dependent than the raw numbers suggest. Of 9,714 effects, 49% (4,759) are "drawable-only" (Sprites + Trails + Ropes, no models/lights/screen ops) and 39% (3,818) are pure sprite-only; that band is the live-renderable core. Only 6.8% (659) touch RenderModels and are hard pre-bake. A long tail of ~97 exotic-class instances is a rounding error to skip or stub. ~87% of the operator instances in the ambient set map to three.quarks built-ins or trivial custom behaviors, so the operator surface is not a blocker.
- The two real gates are not renderer classes or operators. (1) Child-system walking: the current morphic pipeline does not resolve `m_Children`, and the marquee effects are parent shells that delegate all visible particles to children. (2) Control-point feeds: most "ambient" effects `PositionLock` to non-CP0 control points (the hand, the candle, the baton) that nothing drives on a static model, so they spawn at the model root rather than where they belong.
- Adversarial passes demolished the assumption that Valve authored these to preview standalone: 141/141 ambient-named effects carry a `preview` config, so it has zero discriminating power, and only ~43% carry actual drivers. Honest headline recorded by the source: ambient FX is a curated ~13-hero / ~32-effect feature, not an auto-discovered 2,147-effect one, and exactly two effects render correctly standalone today (`wraith_ambient_hand_energy` and `familiar_ambient_body`). Everything else needs child-walking or manual CP injection in sprint 1, not Phase 2.
- Disposition split: live via three.quarks ~49% drawable-only; flipbook fallback for projected decals and light-heavy effects; pre-bake WebM for the ~6.8% RenderModels/Blobs/LightBeam/StatusEffect band and any cast with a T4 child; infeasible/skip for ~46 instances (ScreenShake is camera-only, most StatusEffectCitadel).
- Renderer-class tiers grounded by decoding a representative `.vpcf_c` each, with no hidden GPU-only or mesh-particle killer found mis-tiered as live. Notable per-class blockers: `C_OP_RenderSprites` (5094 instances) is the T1 happy path with no blocker; `C_OP_RenderTrails` (1046) and `C_OP_RenderRopes` (2526) are T2 live but need driven endpoints, and Ropes collapse to a zero-length ribbon if undriven; `C_OP_RenderProjected` (380) needs a target surface and projector, so ship flipbook first; `C_OP_RenderStandardLight` (361) and `C_OP_RenderOmni2Light` (23) are constrained by a light budget and collide with the Locker's IBL/tonemap rig.
