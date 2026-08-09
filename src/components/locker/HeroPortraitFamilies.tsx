import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Images, Loader2, Wand2 } from 'lucide-react';
import AssetSourcesPanel from '../foundry/AssetSourcesPanel';
import PortraitFamilyCard from '../common/PortraitFamilyCard';
import PortraitFamilyPreview from '../common/PortraitFamilyPreview';
import { useAssetSourceInspection } from '../foundry/assetSourceInspection';
import { foundryInspectAssetSources } from '../../lib/api';
import {
  buildPortraitFamilyViews,
  normalizePortraitPath,
  portraitClaimsFromInspection,
  portraitVariantDisplay,
  portraitVariantLabelKey,
  type PortraitCandidateInput,
  type PortraitFamilyView,
  type PortraitVariantView,
} from '../../lib/portraitFamilyView';
import type { CustomCardSlot, HeroPortrait } from '../../types/portrait';
import type { Mod } from '../../types/mod';

/**
 * The Locker's portrait family browser.
 *
 * Before this the Locker had no concept of a portrait family, so it had no
 * stock state and no empty state: only "some installed card art" and "none"
 * (2026-07-30 matrix, finding 2). Wraith's actual current portrait appeared
 * nowhere on the surface except incidentally, as a faded placeholder inside the
 * upload slots.
 *
 * Two boundaries this deliberately keeps:
 *
 * - **It does not copy the game catalog** (#10 Part 2 item 7). The base-game
 *   family comes from `getCustomCardSlots`, which is one hero's card art and
 *   already loaded for the uploader. Browsing every uninstalled source asset,
 *   or authoring a crop against one, routes to Foundry.
 * - **It owns installed state only.** Enable/disable and winner come from the
 *   shared claims inspection and the mod store; nothing here stages or crops.
 *   Per A2d-lane, teaching this surface about authoring is what would close the
 *   door back to the hard split.
 */

interface HeroPortraitFamiliesProps {
  heroName: string;
  /** The base game's family for this hero, from `getCustomCardSlots`. */
  slots: readonly CustomCardSlot[];
  /** Decoded art the user's installed mods ship for this hero. */
  portraits: readonly HeroPortrait[];
  mods: readonly Mod[];
  loading?: boolean;
  /** A catalog read that did not complete, with the raw diagnostic string.
   *  Distinct from `none`: that says the read finished and found nothing. */
  error?: string | null;
  /** Re-run the same load the surface mounted with, after a failed read. */
  onRetry?: () => void;
  /** Open the per-variant upload for this slot: the Locker's crop target. */
  onReplaceVariant?: (slot: CustomCardSlot) => void;
}

export default function HeroPortraitFamilies({
  heroName,
  slots,
  portraits,
  mods,
  loading = false,
  error = null,
  onRetry,
  onReplaceVariant,
}: HeroPortraitFamiliesProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState<{ familyKey: string; variantPath?: string } | null>(null);

  // `HeroPortrait.modFileName` and `Mod.metaKey` are the same folder-relative
  // identity; the claims inspection speaks mod ids. One join, here, so the rest
  // of the surface only ever sees one key.
  const modByMetaKey = useMemo(() => new Map(mods.map((mod) => [mod.metaKey, mod])), [mods]);
  const fileNameByModId = useMemo(() => new Map(mods.map((mod) => [mod.id, mod.metaKey])), [mods]);

  const paths = useMemo(
    () => [...new Set(slots.map((slot) => normalizePortraitPath(slot.entry)))].sort(),
    [slots],
  );
  const inspection = useAssetSourceInspection(paths, paths.length > 0, foundryInspectAssetSources);

  const candidates = useMemo<PortraitCandidateInput[]>(
    () =>
      portraits
        .map((portrait) => {
          const modId = modByMetaKey.get(portrait.modFileName)?.id;
          return modId ? { sourceKey: modId, variant: portrait.variant, image: portrait.dataUrl } : null;
        })
        .filter((candidate): candidate is PortraitCandidateInput => candidate !== null),
    [portraits, modByMetaKey],
  );

  const families = useMemo(
    () =>
      buildPortraitFamilyViews({
        heroName,
        slots: slots.map((slot) => ({
          path: slot.entry,
          variant: slot.variant,
          width: slot.width,
          height: slot.height,
          stockImage: slot.baseDataUrl,
        })),
        candidates,
        ...portraitClaimsFromInspection(inspection.result, (modId) => fileNameByModId.get(modId)),
      }),
    [heroName, slots, candidates, inspection.result, fileNameByModId],
  );

  const openFamily = useMemo(
    () => families.find((family) => family.key === open?.familyKey) ?? null,
    [families, open],
  );

  const slotByPath = useMemo(
    () => new Map(slots.map((slot) => [normalizePortraitPath(slot.entry), slot])),
    [slots],
  );

  /**
   * The Locker -> Foundry half of the shared shell. Foundry resolves the hero
   * through the portrait identity map, so linking by display name survives
   * every alias the codenames disagree on (Abrams/atlas, Grey Talon/archer,
   * Paige/bookworm): see `heroPortraitIdentity.ts`.
   */
  const createInFoundry = useCallback(
    (family: PortraitFamilyView) => {
      const query = new URLSearchParams({
        hero: heroName,
        section: 'portraits',
        family: family.key,
      });
      navigate(`/foundry?${query.toString()}`);
    },
    [heroName, navigate],
  );

  const variantLabel = useCallback(
    (variant: PortraitVariantView) => {
      const key = portraitVariantLabelKey(variant.key);
      return portraitVariantDisplay(key ? t(key) : variant.key, variant);
    },
    [t],
  );

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-xs text-text-secondary">
        <Loader2 className="h-4 w-4 animate-spin" /> {t('portrait.family.loading')}
      </div>
    );
  }

  // A read that did not complete is its own state, never "no assets": the
  // surface stays visible and names what is missing, why, and the way out
  // instead of blanking out or printing a bare error string.
  if (error) {
    return (
      <div className="rounded-[10px] border border-border/70 bg-bg-sunken/55 p-3">
        <p className="flex items-center gap-2 text-xs font-semibold text-state-danger">
          <AlertCircle className="h-3.5 w-3.5" />
          {t('portrait.family.failedTitle')}
        </p>
        <p className="mt-1 text-[11px] leading-snug text-text-secondary">
          {t('portrait.family.failedBody', { hero: heroName })}
        </p>
        <p className="mt-1 text-[11px] leading-snug text-text-secondary/70">{error}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 inline-flex cursor-pointer items-center rounded-md border border-border/60 px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-white/20 hover:text-text-primary"
          >
            {t('common.actions.retry')}
          </button>
        )}
      </div>
    );
  }

  // The Locker's first real empty state. It names the reason (this hero has no
  // base-game portrait family Grimoire can read) rather than reading as "you
  // have no mods", which is a different fact entirely.
  if (families.length === 0) {
    return (
      <div className="rounded-[10px] border border-border/70 bg-bg-sunken/55 p-3">
        <p className="flex items-center gap-2 text-xs font-semibold text-text-primary">
          <Images className="h-3.5 w-3.5 text-accent" />
          {t('portrait.family.noneTitle')}
        </p>
        <p className="mt-1 text-[11px] leading-snug text-text-secondary">
          {t('portrait.family.noneBody', { hero: heroName })}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-semibold text-text-primary">{t('portrait.family.browserTitle')}</p>
        <p className="text-[11px] text-text-secondary">
          {t('portrait.family.browserCount', { count: families.length })}
        </p>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5">
        {families.map((family) => (
          <PortraitFamilyCard
            key={family.key}
            family={family}
            onOpen={() => setOpen({ familyKey: family.key })}
          />
        ))}
      </div>

      <PortraitFamilyPreview
        family={openFamily}
        initialVariantPath={open?.variantPath}
        onClose={() => setOpen(null)}
        actions={(variant) => {
          const slot = slotByPath.get(variant.path);
          return (
            <>
              {slot && onReplaceVariant && (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(null);
                    onReplaceVariant(slot);
                  }}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground transition-colors hover:bg-accent-hover"
                >
                  {t('portrait.family.replaceVariant', { variant: variantLabel(variant) })}
                </button>
              )}
              {openFamily && (
                <button
                  type="button"
                  onClick={() => createInFoundry(openFamily)}
                  title={t('portrait.family.createInFoundryHint')}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/20"
                >
                  <Wand2 className="h-3.5 w-3.5" />
                  {t('portrait.family.createInFoundry')}
                </button>
              )}
            </>
          );
        }}
        footer={
          openFamily && (
            <details className="rounded-sm border border-border/60 px-2 py-1.5">
              <summary className="cursor-pointer text-[11px] text-text-secondary hover:text-text-primary">
                {t('portrait.family.sourcesTitle')}
              </summary>
              {/* The Stage 2 summary, reused rather than reimplemented per
                  surface (#10 Part 2 item 5). The inspection is handed in, so
                  opening the disclosure never starts a second VPK scan. */}
              <AssetSourcesPanel
                paths={openFamily.variants.map((variant) => variant.path)}
                pathLabels={Object.fromEntries(
                  openFamily.variants.map((variant) => [variant.path, variantLabel(variant)]),
                )}
                inspection={inspection.result}
                inspectionLoading={inspection.loading}
                inspectionError={inspection.error}
                onRefreshInspection={inspection.refresh}
              />
            </details>
          )
        }
      />
    </div>
  );
}
