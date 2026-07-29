/**
 * Rigged-preview clip selection, replayed against clip lists captured verbatim
 * from the shipped Deadlock pak (`vpkmerge model clips --json`, 2026-07-28) for
 * the three spike pilots: Holliday (`astro`), Paige (`bookworm`), and Seven
 * (`gigawatt_prisoner`). See docs/rigged-preview-spike.md.
 *
 * What this pins: the rigged export must land on a LOOPING IDLE for each pilot,
 * never on an ability/attack/death clip, and must return null (so the caller
 * falls back to the static posed preview) when a model carries no animated clip.
 * The fixtures are trimmed to the highest-ranked rows plus the traps that must
 * lose, because the real lists run 4 to 260 rows.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('electron', () => ({
    app: { getPath: () => '/tmp/grimoire-test' },
    protocol: { handle: () => { } },
    net: { fetch: async () => new Response(null) },
}));

import { chooseRiggedClip, type ModelClipInfo } from './heroPoseModels';

function clip(
    name: string,
    frameCount: number,
    fps: number,
    durationSeconds: number,
    looping: boolean,
    isDefault = false
): ModelClipInfo {
    return { name, frameCount, fps, durationSeconds, looping, default: isDefault };
}

/** Holliday. Real list is 260 rows / 249 animated; these are the top-ranked rows
 *  plus the ability + rope traps that must not win. */
const ASTRO: ModelClipInfo[] = [
    clip('bindpose', 1, 30, 0, false),
    clip('RopeClimb_Idle', 65, 30, 2.1333334, false),
    clip('astro_ability_gravity_lasso_cast', 31, 40, 0.75, false),
    clip('ability_swap_to_shotgun', 26, 30, 0.8333333, false),
    clip('lasso_stand_idle', 65, 30, 1.6, true),
    clip('item_stand_idle', 81, 30, 2.6666667, true),
    clip('primary_stand_idle', 81, 30, 2.6666667, true),
    clip('primary_crouch_idle', 81, 30, 2.6666667, true),
];

/** Paige. This is the COMPLETE real list (4 rows). Note `ui_pose` is a
 *  non-looping 41-frame clip that must lose to the looping idle. */
const BOOKWORM: ModelClipInfo[] = [
    clip('bindpose', 1, 30, 0, false),
    clip('out_of_combat_stand_idle', 41, 30, 1.3333334, true),
    clip('respawn_countdown_idle', 41, 30, 1.3333334, true),
    clip('ui_pose', 41, 30, 1.3333334, false),
];

/** Seven. Real list is 230 rows / 222 animated; top-ranked rows plus the death
 *  and crouch-stun traps. */
const GIGAWATT: ModelClipInfo[] = [
    clip('bindpose', 1, 30, 0, true),
    clip('death_static_2', 42, 24, 1.7083334, false),
    clip('death_running_1', 35, 20, 1.7, false),
    clip('crouching_stunned', 31, 30, 1.0, false),
    clip('grenade_idle', 79, 30, 2.6, true),
    clip('primary_idle', 79, 30, 3.25, true),
    clip('primary_crouch_idle', 120, 30, 3.9666667, true),
    clip('primary_stand_idle', 79, 30, 3.25, true),
];

describe('chooseRiggedClip', () => {
    it('picks the standing looping idle for each spike pilot', () => {
        expect(chooseRiggedClip(ASTRO)?.name).toBe('primary_stand_idle');
        expect(chooseRiggedClip(BOOKWORM)?.name).toBe('out_of_combat_stand_idle');
        expect(chooseRiggedClip(GIGAWATT)?.name).toBe('primary_stand_idle');
    });

    it('never selects an ability, attack, or death clip', () => {
        for (const clips of [ASTRO, BOOKWORM, GIGAWATT]) {
            const name = chooseRiggedClip(clips)?.name ?? '';
            expect(name).not.toMatch(/ability|attack|cast|death|dash|jump|reload|run|turn|walk/);
        }
    });

    it('prefers a looping idle over a same-length non-looping ui_pose', () => {
        // Paige's `ui_pose` is exactly as long as the idle and is the clip the
        // STATIC path bakes; the rigged path must still take the looping one so
        // the turntable does not hitch at the loop point.
        expect(chooseRiggedClip(BOOKWORM)?.looping).toBe(true);
    });

    it('prefers a standing idle over a crouching one of equal length', () => {
        expect(chooseRiggedClip(ASTRO)?.name).not.toContain('crouch');
        expect(chooseRiggedClip(GIGAWATT)?.name).not.toContain('crouch');
    });

    it('returns null when a model carries no animated clip, so the caller falls back', () => {
        // A single-frame bindpose is what a genuinely clipless model reports.
        // Null here is what makes runRiggedHeroExportForSources report hasModel
        // false and the viewer drop to the static posed preview.
        expect(chooseRiggedClip([clip('bindpose', 1, 30, 0, false)])).toBeNull();
        expect(chooseRiggedClip([])).toBeNull();
    });

    it('ignores zero-length and unnamed rows', () => {
        expect(
            chooseRiggedClip([clip('', 40, 30, 1.3, true), clip('idle_broken', 40, 30, 0, true)])
        ).toBeNull();
    });
});
