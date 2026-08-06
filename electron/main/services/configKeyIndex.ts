/**
 * The one catalogue of ConVars Grimoire manages in gameinfo.gi.
 *
 * Presets are generated data and the user controls are maintained data, but a
 * reader must not need to know which one introduced a key.  This index joins
 * them without making a new writer: it is descriptive data for status and for
 * the future Config workspace.
 */
import { PRESETS, getPreset } from './performanceConfigData';
import { ADVANCED_GAMEINFO_CONVARS, HUD_CONVARS } from './performanceUserControls';

export type ConfigKeyType = 'boolean' | 'enum' | 'numeric' | 'string';
export type ConfigKeySurface = 'performance-preset' | 'game-configuration';

export interface ConfigKeyDefinition {
    key: string;
    /** The file containing the setting. Kept explicit for cross-file readers. */
    file: 'gameinfo.gi';
    type: ConfigKeyType;
    /** Values a bounded control accepts; omitted when the engine owns the domain. */
    allowedValues?: readonly string[];
    min?: number;
    max?: number;
    step?: number;
    /** A safe human fallback until the Config UI supplies localized copy. */
    label: string;
    description: string;
    /** Existing surfaces that can write this key. */
    surfaces: readonly ConfigKeySurface[];
    /** Stock value where Grimoire knows one; null means the engine default. */
    gameDefault: string | null;
    /** What the console reports the engine itself uses; null when no reading
     *  exists yet. */
    engineDefault: string | null;
}

const humanize = (key: string) => key.replace(/[_.]+/g, ' ');
const presetValues = new Map<string, Set<string>>();
for (const family of PRESETS) {
    const preset = getPreset(family.id);
    for (const [key, value] of [...preset.convars, ...preset.optIn.map(({ key, value }) => [key, value] as const)]) {
        const values = presetValues.get(key) ?? new Set<string>();
        values.add(value);
        presetValues.set(key, values);
    }
}

const userDefinitions: ConfigKeyDefinition[] = [
    ...HUD_CONVARS.map((control) => ({
        key: control.key,
        file: 'gameinfo.gi' as const,
        type: 'boolean' as const,
        allowedValues: [control.on, control.off],
        label: humanize(control.key),
        description: 'A Game Configuration HUD control.',
        surfaces: ['game-configuration'] as const,
        gameDefault: control.gameDefault === null ? null : String(control.gameDefault),
        engineDefault: control.engineDefault === null ? null : String(control.engineDefault),
    })),
    ...ADVANCED_GAMEINFO_CONVARS.map((control) => ({
        key: control.key,
        file: 'gameinfo.gi' as const,
        type: control.key === 'citadel_hud_objective_health_enabled' ? 'enum' as const : 'numeric' as const,
        ...(control.key === 'citadel_hud_objective_health_enabled'
            ? { allowedValues: ['0', '1', '2'] }
            : { min: control.min, max: control.max, step: control.step }),
        label: humanize(control.key),
        description: 'A Game Configuration advanced control.',
        surfaces: ['game-configuration'] as const,
        gameDefault: control.gameDefault === null ? null : String(control.gameDefault),
        engineDefault: control.engineDefault === null ? null : String(control.engineDefault),
    })),
];

const byKey = new Map(userDefinitions.map((definition) => [definition.key, definition]));
for (const [key, values] of presetValues) {
    const existing = byKey.get(key);
    if (existing) {
        byKey.set(key, {
            ...existing,
            surfaces: [...existing.surfaces, 'performance-preset'],
        });
        continue;
    }
    const allowedValues = [...values];
    const booleanValues = allowedValues.every((value) => /^(?:true|false|0|1)$/i.test(value));
    byKey.set(key, {
        key,
        file: 'gameinfo.gi',
        type: booleanValues ? 'boolean' : 'string',
        label: humanize(key),
        description: 'A value managed by a performance preset.',
        surfaces: ['performance-preset'],
        gameDefault: null,
        engineDefault: null,
    });
}

/** Stable ordering makes status output and future filters deterministic. */
export const CONFIG_KEY_INDEX: readonly ConfigKeyDefinition[] = [...byKey.values()]
    .sort((left, right) => left.key.localeCompare(right.key));
export const CONFIG_KEY_BY_NAME: ReadonlyMap<string, ConfigKeyDefinition> = new Map(
    CONFIG_KEY_INDEX.map((definition) => [definition.key, definition])
);
/** Keys with a direct Game Configuration writer, as distinct from preset-only keys. */
export const USER_CONTROL_KEYS: ReadonlySet<string> = new Set(userDefinitions.map(({ key }) => key));
