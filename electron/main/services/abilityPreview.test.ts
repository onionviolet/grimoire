import { describe, expect, it, vi } from 'vitest';
vi.mock('./foundryCatalog', () => ({ getHeroSounds: vi.fn(), ensureVoiceclip: vi.fn(), foundryBuildFingerprintKey: vi.fn().mockResolvedValue('42-123-456') }));
vi.mock('./assetInspection', () => ({ inspectionCache: vi.fn(), retainInspectionCache: vi.fn(() => () => {}), pruneInspectionCaches: vi.fn() }));
vi.mock('./modMerger', () => ({ runVpkmerge: vi.fn(), runVpkmergeStdout: vi.fn() }));
vi.mock('./deadlock', () => ({ getCitadelPath: vi.fn() }));
vi.mock('./heroPoseModels', () => ({ exportHeroAbilityPose: vi.fn() }));
vi.mock('./heroSounds', () => ({ previewAppliedHeroSound: vi.fn() }));
vi.mock('./heroColors', () => ({ getActiveHeroColor: vi.fn() }));
const { resolveAbilityClip } = await import('./abilityPreview');
const clip = (name: string, durationSeconds = 1) => ({ name, durationSeconds, frameCount: 30, fps: 30, looping: false, default: false });
describe('ability clip joins', () => {
  it('accepts a single animated authored cast with the complete slot token', () => {
    expect(resolveAbilityClip([clip('astro_ability_gravity_lasso_cast')], 'lasso', ['barrel', 'lasso'])).toBe('astro_ability_gravity_lasso_cast');
  });
  it('rejects shared ability tokens, multiple cast phases and substring collisions', () => {
    expect(resolveAbilityClip([clip('yamato_ability_slash')], 'slash', ['slash', 'slash'])).toBeNull();
    expect(resolveAbilityClip([clip('hero_ability_lasso_cast'), clip('hero_ability_lasso_end')], 'lasso', ['lasso'])).toBeNull();
    expect(resolveAbilityClip([clip('hero_ability_lassoball')], 'lasso', ['lasso'])).toBeNull();
  });
  it('does not replace missing casts with idles or static clips', () => {
    expect(resolveAbilityClip([clip('hero_lasso_idle'), clip('hero_ability_lasso', 0)], 'lasso', ['lasso'])).toBeNull();
  });
});
