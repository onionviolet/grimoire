import { describe, expect, it } from 'vitest';
import { CONFIG_KEY_BY_NAME, CONFIG_KEY_INDEX, USER_CONTROL_KEYS } from './configKeyIndex';
import { PRESETS, getPreset } from './performanceConfigData';

describe('CONFIG_KEY_INDEX', () => {
    it('contains every preset and opt-in ConVar exactly once', () => {
        const presetKeys = new Set(PRESETS.flatMap((family) => {
            const preset = getPreset(family.id);
            return [
                ...preset.convars.map(([key]) => key),
                ...preset.optIn.map(({ key }) => key),
            ];
        }));
        expect(new Set(CONFIG_KEY_INDEX.map(({ key }) => key)).size).toBe(CONFIG_KEY_INDEX.length);
        for (const key of presetKeys) expect(CONFIG_KEY_BY_NAME.has(key)).toBe(true);
    });

    it('retains typed metadata and the existing writer for user controls', () => {
        const numeric = CONFIG_KEY_BY_NAME.get('minimap_update_rate_hz')!;
        expect(numeric).toMatchObject({ type: 'numeric', min: 5, max: 60, step: 5 });
        expect(numeric.surfaces).toContain('game-configuration');
        expect(USER_CONTROL_KEYS.has(numeric.key)).toBe(true);
    });
});
