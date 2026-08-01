import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ImageOff, Minus, Plus, RotateCcw, X } from 'lucide-react';
import { Modal } from './Modal';
import {
  PORTRAIT_STATUS_LABEL_KEYS,
  portraitVariantDisplay,
  portraitVariantLabelKey,
  type PortraitFamilyView,
  type PortraitVariantView,
} from '../../lib/portraitFamilyView';

/**
 * The expanded portrait family: one large, full-colour, zoomable preview plus
 * the sibling variants of the same family.
 *
 * Three rules this surface exists to keep, all of them from #10 and #1:
 *
 * 1. **Full colour, always.** The remembered "better portrait editor" is this
 *    view at full colour; `opacity-30` plus a hover scrim is what prevented it.
 *    Nothing here dims art to indicate state. State is words.
 * 2. **Hover and keyboard focus are equal.** A sibling previews on focus
 *    exactly as it does on hover, so the comparison is reachable without a
 *    mouse (#10 Part 2 items 2, 3, 10).
 * 3. **Previewing is not selecting.** Moving across siblings changes what is
 *    shown and nothing else. Selecting one is a click or Enter, and only then
 *    does the per-variant action appear. A sibling never silently becomes the
 *    family image.
 *
 * It is driven entirely by `PortraitFamilyView`, so it reads no store and knows
 * nothing about installing or staging: the Locker and Foundry each pass their
 * own actions in through `actions`.
 */

const ZOOM_STEPS = [1, 1.5, 2, 3, 4] as const;

interface PortraitFamilyPreviewProps {
  family: PortraitFamilyView | null;
  onClose: () => void;
  /** Variant to open on. Defaults to the family's base member. */
  initialVariantPath?: string;
  /** Per-variant actions for the *selected* variant (never the hovered one). */
  actions?: (variant: PortraitVariantView) => ReactNode;
  /** Family-wide footer, e.g. the shared Sources & winner summary. */
  footer?: ReactNode;
}

export default function PortraitFamilyPreview({
  family,
  onClose,
  initialVariantPath,
  actions,
  footer,
}: PortraitFamilyPreviewProps) {
  const { t } = useTranslation();
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  // What the large frame shows right now. Hover/focus moves this without
  // moving the selection, which is what keeps previewing free of consequence.
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0);
  const [showStock, setShowStock] = useState(false);

  const variantLabel = useCallback(
    (variant: PortraitVariantView) => {
      const key = portraitVariantLabelKey(variant.key);
      return portraitVariantDisplay(key ? t(key) : variant.key, variant);
    },
    [t],
  );

  // Re-anchor whenever a different family (or a different entry point into the
  // same family) opens. Adjusted during render rather than in an effect so the
  // first paint is already on the right variant: an effect would flash the
  // previous family's art for one commit.
  const [anchor, setAnchor] = useState<string | null>(null);
  const opening = family ? initialVariantPath ?? family.base.path : null;
  const openKey = family ? `${family.key}\n${opening}` : null;
  if (openKey !== anchor) {
    setAnchor(openKey);
    setSelectedPath(opening);
    setPreviewPath(opening);
    setZoom(0);
    setShowStock(false);
  }

  const selected = useMemo(
    () => family?.variants.find((variant) => variant.path === selectedPath) ?? family?.base ?? null,
    [family, selectedPath],
  );
  const shown = useMemo(
    () => family?.variants.find((variant) => variant.path === previewPath) ?? selected,
    [family, previewPath, selected],
  );

  // Left/right walk the family without needing to tab through it, which is the
  // fastest way to compare stock against installed on a keyboard.
  const step = useCallback(
    (delta: number) => {
      if (!family || !shown) return;
      const index = family.variants.findIndex((variant) => variant.path === shown.path);
      const next = family.variants[(index + delta + family.variants.length) % family.variants.length];
      setSelectedPath(next.path);
      setPreviewPath(next.path);
    },
    [family, shown],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        step(1);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        step(-1);
      } else if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        setZoom((level) => Math.min(ZOOM_STEPS.length - 1, level + 1));
      } else if (event.key === '-') {
        event.preventDefault();
        setZoom((level) => Math.max(0, level - 1));
      } else if (event.key === '0') {
        event.preventDefault();
        setZoom(0);
      }
    },
    [step],
  );

  if (!family || !shown || !selected) {
    return <Modal open={false} onClose={onClose} size="none"><span /></Modal>;
  }

  // The honest three-way answer. `currentImage` is null exactly when something
  // installed wins the path and this surface could not decode its art, and that
  // is the case the matrix caught being papered over with the stock image.
  const overriddenWithoutArt = shown.currentImage === null && shown.stockImage !== null;
  const display = showStock || overriddenWithoutArt ? shown.stockImage : shown.currentImage;
  const canCompare = Boolean(shown.stockImage) && Boolean(shown.currentImage) && shown.status !== 'stock';
  const scale = ZOOM_STEPS[zoom];

  return (
    <Modal
      open
      onClose={onClose}
      size="none"
      labelledBy="portrait-family-preview-title"
      panelClassName="max-w-4xl flex flex-col max-h-[92vh]"
      backdropClassName="bg-black/80"
    >
      <div className="flex min-h-0 flex-col" onKeyDown={onKeyDown}>
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h2 id="portrait-family-preview-title" className="truncate text-sm font-semibold text-text-primary">
              {family.heroName
                ? t('portrait.family.title', { hero: family.heroName, variant: variantLabel(shown) })
                : variantLabel(shown)}
            </h2>
            <p className="truncate text-xs text-text-secondary" title={shown.path}>
              {shown.path}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <ZoomButtons zoom={zoom} onZoom={setZoom} />
            <button
              type="button"
              onClick={onClose}
              aria-label={t('common.actions.close')}
              className="rounded-sm p-1 text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* The large frame. Full colour, never dimmed; zoom pans inside its own
            scroll container so the dialog itself never grows. */}
        <div className="relative flex min-h-[300px] flex-1 items-center justify-center overflow-auto scrollbar-glass bg-bg-tertiary p-6">
          {display ? (
            <img
              src={display}
              alt={`${family.heroName ?? ''} ${variantLabel(shown)}`.trim()}
              draggable={false}
              style={{ height: `calc(52vh * ${scale})` }}
              className="w-auto max-w-none object-contain"
            />
          ) : (
            <ImageOff size={40} className="text-text-secondary/40" />
          )}
          <span className="pointer-events-none absolute left-3 top-3 rounded-sm bg-black/60 px-2 py-1 text-[11px] text-white/85">
            {showStock || overriddenWithoutArt
              ? t('portrait.family.showingStock')
              : t('portrait.family.showingCurrent')}
          </span>
        </div>

        <div className="space-y-3 overflow-y-auto scrollbar-glass border-t border-border px-4 py-3">
          {/* Status in words, never colour alone (#10 Part 2 item 4). */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full border border-border/70 px-2 py-0.5 text-text-primary">
              {t(PORTRAIT_STATUS_LABEL_KEYS[shown.status])}
            </span>
            {shown.winner && (
              <span className="min-w-0 truncate text-text-secondary">
                {t('portrait.family.winnerRow', {
                  variant: variantLabel(shown),
                  name: shown.winner.name,
                })}
              </span>
            )}
            {shown.width && shown.height && (
              <span className="tabular-nums text-text-secondary">
                {shown.width} x {shown.height}
              </span>
            )}
            {canCompare && (
              <button
                type="button"
                onClick={() => setShowStock((stock) => !stock)}
                aria-pressed={showStock}
                className="rounded-sm border border-border px-2 py-0.5 text-text-secondary transition-colors hover:text-text-primary cursor-pointer"
              >
                {showStock ? t('portrait.family.showCurrent') : t('portrait.family.showStock')}
              </button>
            )}
          </div>

          {overriddenWithoutArt && (
            <p className="rounded-sm border border-amber-400/40 bg-amber-400/10 px-2.5 py-1.5 text-[11px] leading-snug text-amber-200">
              {t('portrait.family.overriddenWithoutArt', { name: shown.winner?.name ?? '' })}
            </p>
          )}

          <div>
            <p className="mb-1.5 text-[11px] uppercase tracking-wide text-text-secondary">
              {t('portrait.family.variants')}
            </p>
            {/* Every sibling is an ordinary tab stop: focus previews it exactly
                as hover does, so the comparison needs no mouse. */}
            <div className="flex flex-wrap gap-2">
              {family.variants.map((variant) => {
                const isSelected = variant.path === selected.path;
                const thumb = variant.currentImage ?? variant.stockImage;
                return (
                  <button
                    key={variant.path}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => {
                      setSelectedPath(variant.path);
                      setPreviewPath(variant.path);
                    }}
                    onMouseEnter={() => setPreviewPath(variant.path)}
                    onMouseLeave={() => setPreviewPath(selected.path)}
                    onFocus={() => setPreviewPath(variant.path)}
                    onBlur={() => setPreviewPath(selected.path)}
                    title={t('portrait.family.selectVariant', { variant: variantLabel(variant) })}
                    className={`flex w-[92px] flex-col gap-1 rounded-sm border p-1 text-left transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                      isSelected ? 'border-accent bg-accent/10' : 'border-border hover:border-accent/50'
                    }`}
                  >
                    <span className="flex h-[68px] items-center justify-center overflow-hidden rounded-sm bg-bg-tertiary">
                      {thumb ? (
                        // No opacity ramp: an unselected sibling is shown at
                        // full colour so it can actually be compared.
                        <img src={thumb} alt="" className="max-h-full max-w-full object-contain" />
                      ) : (
                        <ImageOff size={16} className="text-text-secondary/40" />
                      )}
                    </span>
                    <span className="truncate text-[10px] text-text-primary">{variantLabel(variant)}</span>
                    <span className="truncate text-[10px] text-text-secondary">
                      {t(PORTRAIT_STATUS_LABEL_KEYS[variant.status])}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-[11px] text-text-secondary">{t('portrait.family.keyboardHint')}</p>
          </div>

          {actions && <div className="flex flex-wrap items-center gap-2">{actions(selected)}</div>}
          {footer}
        </div>
      </div>
    </Modal>
  );
}

function ZoomButtons({ zoom, onZoom }: { zoom: number; onZoom: (level: number) => void }) {
  const { t } = useTranslation();
  return (
    <span className="flex items-center gap-0.5 rounded-sm border border-border px-1 py-0.5">
      <button
        type="button"
        onClick={() => onZoom(Math.max(0, zoom - 1))}
        disabled={zoom === 0}
        aria-label={t('portrait.family.zoomOut')}
        className="rounded-sm p-1 text-text-secondary transition-colors hover:text-text-primary disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
      >
        <Minus size={14} />
      </button>
      <span className="min-w-[3ch] text-center text-[11px] tabular-nums text-text-secondary">
        {ZOOM_STEPS[zoom]}x
      </span>
      <button
        type="button"
        onClick={() => onZoom(Math.min(ZOOM_STEPS.length - 1, zoom + 1))}
        disabled={zoom === ZOOM_STEPS.length - 1}
        aria-label={t('portrait.family.zoomIn')}
        className="rounded-sm p-1 text-text-secondary transition-colors hover:text-text-primary disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
      >
        <Plus size={14} />
      </button>
      <button
        type="button"
        onClick={() => onZoom(0)}
        disabled={zoom === 0}
        aria-label={t('portrait.family.zoomReset')}
        className="rounded-sm p-1 text-text-secondary transition-colors hover:text-text-primary disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
      >
        <RotateCcw size={13} />
      </button>
    </span>
  );
}
