import { useTranslation } from 'react-i18next';
import { ImageOff } from 'lucide-react';
import {
  PORTRAIT_STATUS_LABEL_KEYS,
  portraitVariantDisplay,
  portraitVariantLabelKey,
  type PortraitFamilyView,
  type PortraitVariantView,
} from '../../lib/portraitFamilyView';

/**
 * One portrait family as a browsable card: the art the game will actually draw,
 * the family's state in words, and the variants a change here would cover.
 *
 * Presentational and view-model-only, so the Locker and Foundry show the same
 * card rather than each deriving one (#10 Part 2 item 9). Two behaviours are
 * load-bearing rather than cosmetic:
 *
 * - The thumbnail prefers `currentImage`. When something installed wins the
 *   path and this surface could not decode its art, the card falls back to the
 *   stock image *and says so*, because drawing stock art unqualified is exactly
 *   the disagreement the 2026-07-30 matrix caught between the two surfaces.
 * - The winner line names the variant it won. Two mods winning different
 *   variants of one family is normal; two bare `winner` badges read as a
 *   contradiction.
 */

const STATUS_CHIP_CLASS: Readonly<Record<string, string>> = {
  stock: 'border-border/70 text-text-secondary',
  installed: 'border-accent/50 bg-accent/10 text-accent',
  disabled: 'border-border/70 text-text-secondary',
  conflict: 'border-amber-400/50 bg-amber-400/10 text-amber-200',
  unknown: 'border-border/70 text-text-secondary',
};

interface PortraitFamilyCardProps {
  family: PortraitFamilyView;
  /** Show the hero name on the card. A hero-pinned surface says it once in its
   *  own chrome, so repeating it per card is noise. */
  showHero?: boolean;
  onOpen: () => void;
  /** Accessible name for the card button. */
  openLabel?: string;
}

export default function PortraitFamilyCard({
  family,
  showHero = false,
  onOpen,
  openLabel,
}: PortraitFamilyCardProps) {
  const { t } = useTranslation();
  const variantLabel = (variant: Pick<PortraitVariantView, 'key' | 'distinguisher'>) => {
    const labelKey = portraitVariantLabelKey(variant.key);
    return portraitVariantDisplay(labelKey ? t(labelKey) : variant.key, variant);
  };

  const base = family.base;
  const overriddenWithoutArt = base.currentImage === null && base.stockImage !== null;
  const thumb = base.currentImage ?? base.stockImage;
  const statusLabel = t(PORTRAIT_STATUS_LABEL_KEYS[family.status]);
  const label =
    openLabel ??
    t('portrait.family.expand', {
      hero: family.heroName ?? '',
      variant: variantLabel(base),
    });

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={label}
      title={label}
      className="group flex cursor-pointer flex-col overflow-hidden rounded-[10px] border border-border bg-bg-secondary/70 text-left backdrop-blur-sm transition-colors hover:border-accent/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {/* Full colour at rest. Nothing here dims the art to signal state; the
          chip below carries it (#1, and #10 Part 2 item 4). */}
      <span className="flex aspect-square w-full items-center justify-center overflow-hidden bg-bg-tertiary">
        {thumb ? (
          <img
            src={thumb}
            alt=""
            loading="lazy"
            className="h-full w-full object-contain transition-transform group-hover:scale-[1.03]"
          />
        ) : (
          <ImageOff size={26} className="text-text-secondary/40" />
        )}
      </span>
      <span className="flex flex-col gap-1 p-2">
        {showHero && family.heroName && (
          <span className="truncate text-sm text-text-primary">{family.heroName}</span>
        )}
        <span className="truncate text-xs text-text-secondary">{variantLabel(base)}</span>

        <span
          className={`w-fit rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${
            STATUS_CHIP_CLASS[family.status] ?? STATUS_CHIP_CLASS.unknown
          }`}
        >
          {statusLabel}
        </span>

        {overriddenWithoutArt && (
          <span className="text-[10px] leading-snug text-amber-200">
            {t('portrait.family.thumbIsStock')}
          </span>
        )}

        {/* One row per won path. The variant is part of the sentence, so two
            winners in one family read as two facts and not as a contradiction. */}
        {family.winners.slice(0, 3).map((win) => (
          <span key={win.variant.path} className="truncate text-[10px] text-text-secondary">
            {t('portrait.family.winnerRow', {
              variant: variantLabel(win.variant),
              name: win.source.name,
            })}
          </span>
        ))}
        {family.winners.length > 3 && (
          <span className="text-[10px] text-text-secondary">
            {t('portrait.family.moreWinners', { count: family.winners.length - 3 })}
          </span>
        )}

        <span className="flex flex-wrap gap-1 pt-0.5">
          {family.variants.slice(0, 4).map((variant) => (
            <span
              key={variant.path}
              className="rounded-sm border border-border/70 bg-bg-tertiary px-1 py-0.5 text-[10px] text-text-secondary"
            >
              {variantLabel(variant)}
            </span>
          ))}
          {family.variants.length > 4 && (
            <span
              className="rounded-sm border border-border/70 bg-bg-tertiary px-1 py-0.5 text-[10px] text-text-secondary"
              title={family.variants
                .slice(4)
                .map((variant) => variantLabel(variant))
                .join(', ')}
            >
              +{family.variants.length - 4}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}
