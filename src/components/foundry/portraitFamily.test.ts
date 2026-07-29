import { describe, expect, it, vi } from 'vitest';
import {
  cropToTargetRect,
  groupPortraitFamilies,
  planPortraitFamilyEdits,
  portraitFamilyCoverageGap,
  portraitFamilyVariants,
  portraitVariantKey,
  portraitVariantLabelKey,
  stagePortraitFamily,
} from './portraitFamily';
import { visualAssetInspectionPaths } from './visualEdits';
import type { FoundryAssetSource, FoundryAssetSourcesInspection, TextureEntry } from '../../types/foundry';

const entry = (path: string, label: string): TextureEntry => ({
  path,
  category: 'hero-image',
  hero: 'mina',
  label,
});

// One real-shaped portrait family plus an unrelated hero asset that must never
// be pulled in (the preflight would not have warned about it).
const catalog: TextureEntry[] = [
  entry('panorama/images/heroes/mina_card.png', 'Mina'),
  entry('panorama/images/heroes/mina_card_low_hp.png', 'Mina low HP'),
  entry('panorama/images/heroes/mina_card_gloat.png', 'Mina gloat'),
  entry('panorama/images/heroes/mina_minimap.png', 'Mina minimap'),
  entry('panorama/images/heroes/mina_ability.png', 'Mina ability'),
];
const anchor = catalog[0];

const source = (overrides: Partial<FoundryAssetSource> = {}): FoundryAssetSource => ({
  modId: 'mod', modName: 'Some mod', enabled: true, priority: 1, provenance: 'Downloaded',
  entries: [], wins: [], managed: false, auditionable: [], ...overrides,
});

const inspection = (overrides: Partial<FoundryAssetSourcesInspection> = {}): FoundryAssetSourcesInspection => ({
  paths: [], sources: [], winners: {}, unreadableMods: [], ...overrides,
});

describe('portraitFamilyVariants', () => {
  it('shows exactly the family the staging preflight inspects, anchor first', () => {
    const variants = portraitFamilyVariants(anchor, catalog);

    // Membership is the preflight's, not a re-guess from labels or hero names.
    expect(new Set(variants.map((v) => v.path))).toEqual(new Set(visualAssetInspectionPaths(anchor, catalog)));
    expect(variants[0].path).toBe(anchor.path);
    expect(variants.map((v) => v.key)).toEqual(['card', 'card_low_hp', 'card_gloat', 'minimap']);
    expect(variants.some((v) => v.path.endsWith('mina_ability.png'))).toBe(false);
  });

  it('treats a non-portrait entry as a family of one', () => {
    const icon: TextureEntry = { path: 'panorama/images/icons/rescue_beam.png', category: 'ability-icon', hero: null, label: 'Rescue beam' };
    expect(portraitFamilyVariants(icon, [icon])).toEqual([
      { item: icon, path: icon.path, key: 'base', anchor: true },
    ]);
  });

  it('names known state suffixes and leaves unknown ones raw', () => {
    expect(portraitVariantKey('panorama/images/heroes/mina.png')).toBe('base');
    expect(portraitVariantKey('panorama/images/heroes/mina_low-hp.png')).toBe('low_hp');
    expect(portraitVariantLabelKey('gloat')).toBe('portraitEditor.variants.gloat');
    expect(portraitVariantLabelKey('card_low_hp')).toBeNull();
  });
});

describe('groupPortraitFamilies', () => {
  it('folds the catalog into one group per family with preflight-identical membership', () => {
    const groups = groupPortraitFamilies(catalog);

    // mina_card* and mina_minimap share the `mina` stem; mina_ability is its own
    // family of one (it is hero-image art, just not a state variant).
    expect(groups.map((group) => group.key)).toEqual([
      'panorama/images/heroes/mina',
      'panorama/images/heroes/mina_ability',
    ]);
    const family = groups[0];
    expect(new Set(family.variants.map((v) => v.path))).toEqual(
      new Set(visualAssetInspectionPaths(family.base, catalog)),
    );
    expect(family.hero).toBe('mina');
    expect(groups[1].variants).toHaveLength(1);
  });

  it('anchors on the most recognizable state and falls back to catalog order', () => {
    // No unsuffixed member here, so `card` wins over low_hp/gloat/minimap.
    expect(groupPortraitFamilies(catalog)[0].base.path).toBe('panorama/images/heroes/mina_card.png');

    const unsuffixed = [entry('panorama/images/heroes/mina.png', 'Mina'), ...catalog];
    expect(groupPortraitFamilies(unsuffixed)[0].base.path).toBe('panorama/images/heroes/mina.png');

    const oddOnly = [
      entry('panorama/images/heroes/mina_gloat.png', 'Mina gloat'),
      entry('panorama/images/heroes/mina_low_hp.png', 'Mina low HP'),
    ];
    expect(groupPortraitFamilies(oddOnly)[0].base.path).toBe('panorama/images/heroes/mina_gloat.png');
  });

  it('groups the live pak naming: format token, stacked states, hash-suffixed duplicates', () => {
    // Real entry shapes from an installed pak (astro == Holliday).
    const live = [
      entry('panorama/images/heroes/astro_card_critical_psd.vtex_c', 'card critical'),
      entry('panorama/images/heroes/astro_card_gloat_psd.vtex_c', 'card gloat'),
      entry('panorama/images/heroes/astro_card_psd.vtex_c', 'card'),
      entry('panorama/images/heroes/astro_mm_psd.vtex_c', 'mm'),
      entry('panorama/images/heroes/astro_sm_psd.vtex_c', 'sm'),
      entry('panorama/images/heroes/astro_sm_psd_e2407af5.vtex_c', 'sm'),
      entry('panorama/images/heroes/astro_vertical_psd.vtex_c', 'vertical'),
      // Different directories stay different families even for the same hero.
      entry('panorama/images/heroes/backgrounds/astro_bg_psd.vtex_c', 'bg'),
      entry('panorama/images/heroes/guns/astro_gun_psd.vtex_c', 'gun'),
    ];
    const groups = groupPortraitFamilies(live);

    expect(groups.map((group) => group.key)).toEqual([
      'panorama/images/heroes/astro',
      'panorama/images/heroes/backgrounds/astro_bg',
      'panorama/images/heroes/guns/astro_gun',
    ]);
    const family = groups[0];
    expect(family.base.path).toBe('panorama/images/heroes/astro_card_psd.vtex_c');
    expect(family.variants).toHaveLength(7);
    expect(new Set(family.variants.map((v) => v.key))).toEqual(
      new Set(['card', 'card_critical', 'card_gloat', 'mm', 'sm', 'vertical']),
    );
    expect(portraitVariantKey('panorama/images/heroes/astro_sm_psd_e2407af5.vtex_c')).toBe('sm');
    expect(portraitVariantLabelKey('card_critical')).toBe('portraitEditor.variants.card_critical');
  });

  it('ignores non hero-image categories entirely', () => {
    const icon: TextureEntry = { path: 'panorama/images/icons/rescue_beam.png', category: 'ability-icon', hero: null, label: 'Rescue beam' };
    expect(groupPortraitFamilies([icon])).toEqual([]);
  });
});

describe('cropToTargetRect', () => {
  it('maps the crop onto the source pixels and bakes at the template dimensions', () => {
    // Middle half of a 2000x1000 source, targeting a 512x512 template.
    expect(cropToTargetRect({ sx: 0.25, sy: 0, sw: 0.5, sh: 1 }, { width: 2000, height: 1000 }, { width: 512, height: 512 }))
      .toEqual({ sx: 500, sy: 0, sw: 1000, sh: 1000, width: 512, height: 512 });
  });

  it('bakes at the template size even when it is nothing like the source size', () => {
    const rect = cropToTargetRect({ sx: 0, sy: 0, sw: 1, sh: 1 }, { width: 64, height: 64 }, { width: 1024, height: 576 });
    expect({ width: rect.width, height: rect.height }).toEqual({ width: 1024, height: 576 });
  });

  it('never reads outside the source', () => {
    const rect = cropToTargetRect({ sx: 0.9, sy: 0.9, sw: 0.5, sh: 0.5 }, { width: 100, height: 100 }, { width: 256, height: 256 });
    expect(rect.sx + rect.sw).toBeLessThanOrEqual(100);
    expect(rect.sy + rect.sh).toBeLessThanOrEqual(100);
  });
});

describe('planPortraitFamilyEdits', () => {
  const variants = portraitFamilyVariants(anchor, catalog);

  it('applies one family image across every variant', () => {
    const plan = planPortraitFamilyEdits(variants, 'C:/bakes/family.png');
    expect(plan).toHaveLength(variants.length);
    expect(new Set(plan.map((p) => p.imagePath))).toEqual(new Set(['C:/bakes/family.png']));
    expect(new Set(plan.map((p) => p.origin))).toEqual(new Set(['family']));
  });

  it('lets a per-variant override win over the family image', () => {
    const plan = planPortraitFamilyEdits(variants, 'C:/bakes/family.png', {
      'panorama/images/heroes/mina_minimap.png': 'C:/bakes/minimap.png',
    });
    const minimap = plan.find((p) => p.variant.key === 'minimap');
    expect(minimap).toMatchObject({ imagePath: 'C:/bakes/minimap.png', origin: 'override' });
    expect(plan.filter((p) => p.origin === 'family')).toHaveLength(variants.length - 1);
  });

  it('reports the variants a selection would leave untouched', () => {
    expect(portraitFamilyCoverageGap(variants, null, {
      'panorama/images/heroes/mina_card.png': 'C:/bakes/card.png',
    })).toEqual([
      'panorama/images/heroes/mina_card_low_hp.png',
      'panorama/images/heroes/mina_card_gloat.png',
      'panorama/images/heroes/mina_minimap.png',
    ]);
    expect(portraitFamilyCoverageGap(variants, 'C:/bakes/family.png')).toEqual([]);
  });
});

describe('stagePortraitFamily', () => {
  const variants = portraitFamilyVariants(anchor, catalog);
  const base = {
    variants,
    catalog,
    unreadableMessage: 'unreadable VPK sources',
    coverageMessage: 'some variants would be left untouched',
    name: () => 'Mina portrait',
  };

  it('stages one edit per variant from a single family image', async () => {
    const inspect = vi.fn().mockResolvedValue(inspection());
    const staged = await stagePortraitFamily({
      ...base, familyImagePath: 'C:/bakes/family.png', inspect, confirm: () => true,
    });

    expect(staged?.map((edit) => edit.affectedFiles[0])).toEqual(variants.map((v) => v.path));
    expect(new Set(staged?.map((edit) => edit.source.imagePath))).toEqual(new Set(['C:/bakes/family.png']));
    // The whole family inspects one identical path set, so it is inspected once.
    expect(inspect).toHaveBeenCalledTimes(1);
  });

  it('stages the per-variant override for that variant and the family image elsewhere', async () => {
    const staged = await stagePortraitFamily({
      ...base,
      familyImagePath: 'C:/bakes/family.png',
      overrides: { 'panorama/images/heroes/mina_card_gloat.png': 'C:/bakes/gloat.png' },
      inspect: async () => inspection(),
      confirm: () => true,
    });

    const byPath = new Map(staged?.map((edit) => [edit.affectedFiles[0], edit.source.imagePath]));
    expect(byPath.get('panorama/images/heroes/mina_card_gloat.png')).toBe('C:/bakes/gloat.png');
    expect(byPath.get('panorama/images/heroes/mina_card.png')).toBe('C:/bakes/family.png');
  });

  it('refuses to stage a narrower set than the preflight warned about', async () => {
    await expect(stagePortraitFamily({
      ...base,
      familyImagePath: null,
      overrides: { 'panorama/images/heroes/mina_card.png': 'C:/bakes/card.png' },
      inspect: async () => inspection(),
      confirm: () => true,
    })).rejects.toThrow('some variants would be left untouched');
  });

  it('goes through the unchanged staging contract: an unreadable VPK blocks it', async () => {
    await expect(stagePortraitFamily({
      ...base,
      familyImagePath: 'C:/bakes/family.png',
      inspect: async () => inspection({ unreadableMods: [{ modId: 'x', modName: 'Opaque', enabled: true }] }),
      confirm: () => true,
    })).rejects.toThrow('unreadable VPK sources');
  });

  it('asks for the enabled-owner acknowledgement once and stages nothing if declined', async () => {
    const confirm = vi.fn().mockReturnValue(false);
    const staged = await stagePortraitFamily({
      ...base,
      familyImagePath: 'C:/bakes/family.png',
      inspect: async () => inspection({ sources: [source({ modName: 'Enabled skin' })] }),
      confirm,
    });

    expect(staged).toBeNull();
    expect(confirm).toHaveBeenCalledTimes(1);
  });
});
