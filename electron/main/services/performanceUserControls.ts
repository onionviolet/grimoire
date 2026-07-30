/**
 * Fork-owned reversible user controls, deliberately outside the generated
 * preset data.
 *
 * These lived inside `performanceConfigData.ts` until they were destroyed by a
 * routine `pnpm perf:presets`: that file is emitted wholesale by
 * `scripts/gen-performance-presets.mjs`, which knows nothing about fork
 * additions, so regenerating silently deleted both lists and broke the build.
 * The same edit also meant `--check` could never report in sync, because the
 * checked-in file always carried lines the generator does not produce.
 *
 * Hence a separate module: this is maintained application surface, not preset
 * data, and it must survive a regeneration. Anything added here should be
 * something a *user* toggles, not something a preset author chose.
 *
 * The distinction from a preset opt-in matters, and it is why several of these
 * keys are on `exclude.keys` in the pin manifest rather than `optIn.keys`. An
 * opt-in is binary: take the preset author's value, or leave the convar
 * unwritten. A control here is a real setting with both values available and a
 * per-value origin badge, so a user can set the opposite of what the author
 * chose. Where the fork owns a key here, routing it through the opt-in panel
 * as well would give one convar two surfaces and take away the "off" half.
 */

/** Boolean HUD toggles. `on`/`off` are the literal convar values to write, and
 *  `gameDefault: null` means stock gameinfo.gi does not set the key at all, so
 *  "off" is a written value rather than a removal. */
export const HUD_CONVARS = [
    { key: 'citadel_unit_status_use_new', on: 'true', off: 'false', gameDefault: null },
    { key: 'citadel_unit_status_use_v2', on: 'true', off: 'false', gameDefault: null },
    { key: 'citadel_unit_status_single_bar_mode', on: 'true', off: 'false', gameDefault: null },
    { key: 'citadel_unit_status_use_v2_for_nonplayers', on: 'true', off: 'false', gameDefault: null },
    { key: 'citadel_unit_status_allies_see_thru_walls', on: 'true', off: 'false', gameDefault: null },
    { key: 'citadel_hud_objective_health_enabled', on: '2', off: '0', gameDefault: null },
    { key: 'citadel_damage_offscreen_indicator_disabled', on: 'false', off: 'true', gameDefault: null },
    { key: 'citadel_damage_text_show_effectiveness', on: '1', off: '0', gameDefault: null },
] as const;

/** Numeric controls, clamped to `min`/`max` on write. `gameDefault` is the
 *  stock value, used to render the origin badge as game-default rather than
 *  user-override when the two agree. */
export const ADVANCED_GAMEINFO_CONVARS = [
    { key: 'citadel_unit_status_allies_see_thru_walls_max_distance', min: 0, max: 200, step: 5, gameDefault: 40 },
    { key: 'citadel_minimap_unit_click_radius', min: 400, max: 1200, step: 25, gameDefault: 800 },
    { key: 'citadel_minimap_player_width', min: 4, max: 12, step: 0.5, gameDefault: 8 },
    { key: 'citadel_minimap_local_player_width', min: 6, max: 16, step: 0.5, gameDefault: 12 },
    { key: 'citadel_minimap_max_icon_shrink', min: 0.4, max: 1, step: 0.05, gameDefault: 0.8 },
    { key: 'citadel_minimap_overlap_scan_distance', min: 0, max: 40, step: 1, gameDefault: 20 },
    { key: 'citadel_minimap_zip_line_thickness', min: 1, max: 8, step: 0.5, gameDefault: 6 },
    { key: 'minimap_update_rate_hz', min: 5, max: 60, step: 5, gameDefault: 5 },
] as const;
