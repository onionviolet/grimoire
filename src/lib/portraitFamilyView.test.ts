import { describe, expect, it } from 'vitest';
import {
  buildPortraitFamilyViews,
  normalizePortraitVariant,
  portraitClaimsFromInspection,
  portraitVariantDisplay,
  portraitVariantLabelKey,
  type PortraitFamilyViewInput,
} from './portraitFamilyView';

const MINA = 'panorama/images/heroes/vampirebat';

/** The base-game card family for Mina, spelled the way `getCustomCardSlots`
 *  spells it (manifest variants, absolute-ish entry paths, stock art). */
function minaSlots(): PortraitFamilyViewInput['slots'] {
  return [
    { path: `${MINA}_psd.vtex_c`, variant: 'other', stockImage: 'stock:base', width: 512, height: 512 },
    { path: `${MINA}_card_psd.vtex_c`, variant: 'card', stockImage: 'stock:card', width: 1024, height: 1024 },
    { path: `${MINA}_card_critical_psd.vtex_c`, variant: 'card_critical', stockImage: 'stock:critical' },
    { path: `${MINA}_card_gloat_psd.vtex_c`, variant: 'card_gloat', stockImage: 'stock:gloat' },
    { path: `${MINA}_mm_psd.vtex_c`, variant: 'minimap', stockImage: 'stock:mm' },
    { path: `${MINA}_sm_psd.vtex_c`, variant: 'small', stockImage: 'stock:sm' },
    { path: `${MINA}_vertical_psd.vtex_c`, variant: 'vertical', stockImage: 'stock:vertical' },
  ];
}

const LUCY = {
  sourceKey: 'pak27_dir.vpk',
  modId: 'mod-lucy',
  name: 'Lucy Cyberpunk Edgerunners as Mina',
  fileName: 'pak27_dir.vpk',
  enabled: true,
  priority: 27,
};

const CRYING = {
  sourceKey: 'pak12_dir.vpk',
  modId: 'mod-crying',
  name: 'Crying Girlfriend Mina',
  fileName: 'pak12_dir.vpk',
  enabled: true,
  priority: 12,
};

describe('normalizePortraitVariant', () => {
  it('collapses the manifest and catalog spellings of one variant', () => {
    expect(normalizePortraitVariant('mm')).toBe('minimap');
    expect(normalizePortraitVariant('minimap')).toBe('minimap');
    expect(normalizePortraitVariant('sm')).toBe('small');
    expect(normalizePortraitVariant('low_hp')).toBe('card_critical');
    expect(normalizePortraitVariant('CARD-GLOAT')).toBe('card_gloat');
  });

  it('keeps an unrecognized token rather than inventing a name for it', () => {
    expect(normalizePortraitVariant('banner')).toBe('banner');
    expect(portraitVariantLabelKey('banner')).toBeNull();
    expect(portraitVariantLabelKey('card')).toBe('portrait.variants.card');
  });
});

describe('buildPortraitFamilyViews', () => {
  it('groups one hero into one family, ordered with the hero card first', () => {
    const [family] = buildPortraitFamilyViews({ heroName: 'Mina', slots: minaSlots() });
    expect(family.key).toBe(MINA);
    expect(family.variants).toHaveLength(7);
    expect(family.variants.map((variant) => variant.key)).toEqual([
      'card',
      'base',
      'vertical',
      'card_critical',
      'card_gloat',
      'minimap',
      'small',
    ]);
    expect(family.base.key).toBe('card');
  });

  it('reports an uninspected family as unknown, never as stock', () => {
    const [family] = buildPortraitFamilyViews({ heroName: 'Mina', slots: minaSlots() });
    expect(family.status).toBe('unknown');
    expect(family.base.status).toBe('unknown');
    // The point of the distinction: an uninspected path has no current art to
    // claim, so a surface must not present the stock image as what the game
    // draws. It still gets the stock image to show, labelled as stock.
    expect(family.base.stockImage).toBe('stock:card');
    expect(family.base.currentImage).toBe('stock:card');
  });

  it('reports stock once the paths have been inspected and nothing claims them', () => {
    const slots = minaSlots();
    const [family] = buildPortraitFamilyViews({
      heroName: 'Mina',
      slots,
      winners: Object.fromEntries(slots.map((slot) => [slot.path, null])),
    });
    expect(family.status).toBe('stock');
    expect(family.variants.every((variant) => variant.status === 'stock')).toBe(true);
  });

  /**
   * The 2026-07-30 matrix, cell "installed": Foundry rendered Mina's stock card
   * while the Locker reported `Lucy Cyberpunk Edgerunners as Mina` winning the
   * very same `vampirebat_card_psd.vtex_c`. One view model, one answer.
   */
  it('never presents stock art as current when a mod wins the path', () => {
    const slots = minaSlots();
    const cardPath = `${MINA}_card_psd.vtex_c`;
    const [family] = buildPortraitFamilyViews({
      heroName: 'Mina',
      slots,
      sources: [LUCY],
      winners: { [cardPath]: LUCY.sourceKey },
      claims: { [cardPath]: [LUCY.sourceKey] },
    });
    const card = family.variants.find((variant) => variant.key === 'card');
    expect(card?.status).toBe('installed');
    expect(card?.winner?.name).toBe('Lucy Cyberpunk Edgerunners as Mina');
    expect(card?.stockImage).toBe('stock:card');
    // Foundry has no decoded art for the winner, so `currentImage` is null.
    // Null is the whole fix: the surface must say "overridden", not draw stock.
    expect(card?.currentImage).toBeNull();
  });

  it('uses the winner art when the surface decoded it', () => {
    const cardPath = `${MINA}_card_psd.vtex_c`;
    const [family] = buildPortraitFamilyViews({
      heroName: 'Mina',
      slots: minaSlots(),
      sources: [LUCY],
      candidates: [{ sourceKey: LUCY.sourceKey, variant: 'card', image: 'lucy:card' }],
      winners: { [cardPath]: LUCY.sourceKey },
      claims: { [cardPath]: [LUCY.sourceKey] },
    });
    const card = family.variants.find((variant) => variant.key === 'card');
    expect(card?.currentImage).toBe('lucy:card');
    expect(card?.stockImage).toBe('stock:card');
  });

  it('matches a decoded candidate across the two variant spellings', () => {
    const mmPath = `${MINA}_mm_psd.vtex_c`;
    const [family] = buildPortraitFamilyViews({
      heroName: 'Mina',
      slots: minaSlots(),
      sources: [LUCY],
      // The Locker decodes installed art under the compiled `mm` token while
      // the base slot calls it `minimap`. Normalization is what joins them.
      candidates: [{ sourceKey: LUCY.sourceKey, variant: 'mm', image: 'lucy:mm' }],
      winners: { [mmPath]: LUCY.sourceKey },
      claims: { [mmPath]: [LUCY.sourceKey] },
    });
    expect(family.variants.find((variant) => variant.key === 'minimap')?.currentImage).toBe('lucy:mm');
  });

  /**
   * The matrix's third finding: two mods both badged `winner` in one flat list.
   * Both were true per path, and the badge did not carry the path.
   */
  it('carries the won path on every winner, so two winners never read as a contradiction', () => {
    const criticalPath = `${MINA}_card_critical_psd.vtex_c`;
    const others = minaSlots()
      .map((slot) => slot.path)
      .filter((path) => path !== criticalPath);
    const [family] = buildPortraitFamilyViews({
      heroName: 'Mina',
      slots: minaSlots(),
      sources: [CRYING, LUCY],
      winners: {
        [criticalPath]: CRYING.sourceKey,
        ...Object.fromEntries(others.map((path) => [path, LUCY.sourceKey])),
      },
      claims: {
        [criticalPath]: [CRYING.sourceKey],
        ...Object.fromEntries(others.map((path) => [path, [LUCY.sourceKey]])),
      },
    });
    expect(family.winners).toHaveLength(7);
    const byVariant = new Map(family.winners.map((win) => [win.variant.key, win.source.name]));
    expect(byVariant.get('card_critical')).toBe('Crying Girlfriend Mina');
    expect(byVariant.get('card')).toBe('Lucy Cyberpunk Edgerunners as Mina');
    // Both mods appear once each, under the paths they actually won.
    expect(new Set(family.winners.map((win) => win.source.sourceKey)).size).toBe(2);
  });

  /**
   * The matrix's fourth finding: `pak12` above, `Crying Girlfriend Mina` below,
   * one scroll apart on one screen. A source has one name here.
   */
  it('names a source once, and keeps the file name as a separate field', () => {
    const cardPath = `${MINA}_card_psd.vtex_c`;
    const [family] = buildPortraitFamilyViews({
      heroName: 'Mina',
      slots: minaSlots(),
      sources: [CRYING],
      winners: { [cardPath]: CRYING.sourceKey },
      claims: { [cardPath]: [CRYING.sourceKey] },
    });
    expect(family.sources.map((source) => source.name)).toEqual(['Crying Girlfriend Mina']);
    expect(family.sources[0].fileName).toBe('pak12_dir.vpk');
  });

  it('reports a disabled-only claim as disabled, not as stock', () => {
    const cardPath = `${MINA}_card_psd.vtex_c`;
    const [family] = buildPortraitFamilyViews({
      heroName: 'Mina',
      slots: minaSlots(),
      sources: [{ ...LUCY, enabled: false }],
      winners: { [cardPath]: null },
      claims: { [cardPath]: [LUCY.sourceKey] },
    });
    const card = family.variants.find((variant) => variant.key === 'card');
    expect(card?.status).toBe('disabled');
    // Disabled means the game draws stock, so the stock image is the current one.
    expect(card?.currentImage).toBe('stock:card');
  });

  it('reports two enabled claimants on one path as a conflict', () => {
    const cardPath = `${MINA}_card_psd.vtex_c`;
    const [family] = buildPortraitFamilyViews({
      heroName: 'Mina',
      slots: minaSlots(),
      sources: [CRYING, LUCY],
      winners: { [cardPath]: CRYING.sourceKey },
      claims: { [cardPath]: [CRYING.sourceKey, LUCY.sourceKey] },
    });
    const card = family.variants.find((variant) => variant.key === 'card');
    expect(card?.status).toBe('conflict');
    expect(card?.claimants.map((claimant) => claimant.name)).toEqual([
      'Crying Girlfriend Mina',
      'Lucy Cyberpunk Edgerunners as Mina',
    ]);
    // The family reports the worst member's state so one card can say it once.
    expect(family.status).toBe('conflict');
  });

  it('resolves the hero from a panorama codename and reports every alias', () => {
    const [family] = buildPortraitFamilyViews({
      slots: [{ path: 'panorama/images/heroes/atlas_card_psd.vtex_c', hero: 'atlas' }],
    });
    expect(family.heroName).toBe('Abrams');
    expect(family.aliases).toEqual(['atlas', 'bull']);
  });

  it('keeps a legacy panorama codename in the same hero', () => {
    const [family] = buildPortraitFamilyViews({
      slots: [{ path: 'panorama/images/heroes/archer_card_psd.vtex_c', hero: 'archer' }],
    });
    expect(family.heroName).toBe('Grey Talon');
    expect(family.aliases).toEqual(['orion', 'archer']);
  });

  it('leaves an unknown codename unresolved rather than printing it as a hero', () => {
    const [family] = buildPortraitFamilyViews({
      slots: [{ path: 'panorama/images/heroes/genericperson_card_psd.vtex_c', hero: 'genericperson' }],
    });
    expect(family.heroName).toBe('genericperson');
    expect(family.aliases).toEqual(['genericperson']);
  });

  it('splits distinct families of the same hero', () => {
    const views = buildPortraitFamilyViews({
      heroName: 'Mina',
      slots: [
        { path: `${MINA}_card_psd.vtex_c` },
        { path: `${MINA}_vertical_psd.vtex_c` },
        { path: 'panorama/images/hero_backgrounds/vampirebat_bg_psd.vtex_c' },
      ],
    });
    expect(views).toHaveLength(2);
    expect(views.map((view) => view.variants.length)).toEqual([2, 1]);
  });

  it('round-trips the caller variant spelling for an apply call', () => {
    const [family] = buildPortraitFamilyViews({ heroName: 'Mina', slots: minaSlots() });
    const minimap = family.variants.find((variant) => variant.key === 'minimap');
    expect(minimap?.sourceVariant).toBe('minimap');
    expect(minimap?.path).toBe(`${MINA}_mm_psd.vtex_c`);
  });
});

describe('portraitClaimsFromInspection', () => {
  const cardPath = `${MINA}_card_psd.vtex_c`;
  const criticalPath = `${MINA}_card_critical_psd.vtex_c`;
  const inspection = {
    winners: { [cardPath]: 'mod-lucy', [criticalPath]: 'mod-crying' },
    sources: [
      {
        modId: 'mod-lucy',
        modName: 'Lucy Cyberpunk Edgerunners as Mina',
        enabled: true,
        priority: 27,
        provenance: 'Downloaded',
        entries: [cardPath, criticalPath],
      },
      {
        modId: 'mod-crying',
        modName: 'Crying Girlfriend Mina',
        enabled: true,
        priority: 12,
        provenance: 'Third-party',
        entries: [criticalPath],
      },
    ],
  };

  it('feeds a family view straight from one inspection', () => {
    const [family] = buildPortraitFamilyViews({
      heroName: 'Mina',
      slots: minaSlots(),
      ...portraitClaimsFromInspection(inspection, (modId) =>
        modId === 'mod-lucy' ? 'pak27_dir.vpk' : 'pak12_dir.vpk',
      ),
    });
    const card = family.variants.find((variant) => variant.key === 'card');
    const critical = family.variants.find((variant) => variant.key === 'card_critical');
    expect(card?.status).toBe('installed');
    expect(card?.winner?.name).toBe('Lucy Cyberpunk Edgerunners as Mina');
    // Two enabled mods claim the low-health card, so it is a conflict and the
    // family reports it even though the card itself is a clean single winner.
    expect(critical?.status).toBe('conflict');
    expect(family.status).toBe('conflict');
    expect(family.sources[0].fileName).toBe('pak12_dir.vpk');
  });

  it('leaves uninspected members of the family unknown', () => {
    const [family] = buildPortraitFamilyViews({
      heroName: 'Mina',
      slots: minaSlots(),
      ...portraitClaimsFromInspection(inspection),
    });
    expect(family.variants.find((variant) => variant.key === 'vertical')?.status).toBe('unknown');
  });

  it('normalizes claim paths so a backslash entry still matches its slot', () => {
    const claims = portraitClaimsFromInspection({
      winners: { 'PANORAMA\\images\\heroes\\vampirebat_card_psd.vtex_c': 'mod-lucy' },
      sources: [
        {
          modId: 'mod-lucy',
          modName: 'Lucy Cyberpunk Edgerunners as Mina',
          enabled: true,
          priority: 27,
          provenance: 'Downloaded',
          entries: ['PANORAMA\\images\\heroes\\vampirebat_card_psd.vtex_c'],
        },
      ],
    });
    const [family] = buildPortraitFamilyViews({ heroName: 'Mina', slots: minaSlots(), ...claims });
    expect(family.variants.find((variant) => variant.key === 'card')?.status).toBe('installed');
  });

  it('returns an empty input when nothing has been inspected yet', () => {
    expect(portraitClaimsFromInspection(null)).toEqual({});
  });
});

describe('duplicate variant names inside one family', () => {
  it('distinguishes two entries that normalize to the same variant', () => {
    const [family] = buildPortraitFamilyViews({
      heroName: 'Mina',
      slots: [
        { path: `${MINA}_card_psd.vtex_c` },
        { path: `${MINA}_sm_psd.vtex_c` },
        // The compiled catalog really ships a second entry that reads as the
        // same variant. Both are separate ownership keys, so both must show.
        { path: `${MINA}_sm_png.vtex_c` },
      ],
    });
    const smalls = family.variants.filter((variant) => variant.key === 'small');
    expect(smalls).toHaveLength(2);
    expect(smalls.map((variant) => variant.distinguisher)).toEqual([
      'vampirebat_sm_png',
      'vampirebat_sm_psd',
    ]);
    expect(portraitVariantDisplay('Compact portrait', smalls[0])).toBe(
      'Compact portrait (vampirebat_sm_png)',
    );
  });

  it('leaves an unambiguous variant name alone', () => {
    const [family] = buildPortraitFamilyViews({ heroName: 'Mina', slots: minaSlots() });
    expect(family.variants.every((variant) => variant.distinguisher === null)).toBe(true);
    expect(portraitVariantDisplay('Hero card', family.base)).toBe('Hero card');
  });
});
