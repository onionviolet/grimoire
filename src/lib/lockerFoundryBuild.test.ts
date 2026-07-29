import { describe, expect, it } from 'vitest';
import { isLockerManagedMod } from './lockerUtils';
import type { Mod } from '../types/mod';

function mod(overrides: Partial<Mod>): Mod {
  return {
    id: 'mod-1',
    name: 'Something',
    fileName: 'pak02_dir.vpk',
    path: 'C:/game/addons/pak02_dir.vpk',
    metaKey: 'pak02_dir.vpk',
    enabled: true,
    priority: 2,
    size: 10,
    installedAt: '2026-07-01T00:00:00.000Z',
    sourceSection: 'Mod',
    ...overrides,
  } as Mod;
}

/**
 * An installed Foundry build carries a hero tag so Foundry can shelve it, which
 * is exactly the shape the Locker otherwise reads as "manage this as a skin".
 * It is not one: a build can be a portrait, an icon, a sound, or all three, so
 * an active-skin card, a load-order slot, a shuffle-pool entry and a 3D preview
 * source would all be claims it cannot honour.
 */
describe('isLockerManagedMod and installed Foundry builds', () => {
    it('keeps a hero-tagged build out of the hero skins pile', () => {
        expect(isLockerManagedMod(mod({
            lockerHero: 'Abrams',
            foundryBuild: {
                writeSet: ['panorama/images/heroes/bull.png'],
                parts: [{ kind: 'texture', title: 'Portrait', entries: ['panorama/images/heroes/bull.png'], heroName: 'Abrams' }],
            },
        }))).toBe(false);
    });

    it('still manages an ordinary hero-tagged mod as a skin', () => {
        expect(isLockerManagedMod(mod({ lockerHero: 'Abrams' }))).toBe(true);
    });
});
