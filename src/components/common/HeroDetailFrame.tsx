import { useState, type ReactNode } from 'react';
import { ArrowLeft, type LucideIcon } from 'lucide-react';
import { getHeroNamePath } from '../../lib/lockerUtils';
import { useHeroRenderFallback } from '../../lib/heroRenderFallback';

/**
 * The chrome shared by every hero-detail surface: the full-bleed render
 * backdrop, the feathered frosted-glass stack, the left rail (back, hero name
 * art, section nav) and the content pane.
 *
 * Locker and Foundry rendered two copies of this and the copies drifted, with
 * Foundry ending up visibly the worse of the two (one blur layer instead of
 * three, a render fallback with no icon step). This owns the better version of
 * both so the drift cannot happen again.
 *
 * The frame is deliberately ignorant of both domains: no mod types, no stores,
 * no Foundry types. Everything page-specific arrives through slots.
 */

export interface HeroDetailSection<Id extends string = string> {
  id: Id;
  label: string;
  icon: LucideIcon;
  /** Trailing count. `null`/omitted renders no count at all. */
  count?: number | null;
  disabled?: boolean;
  /** Explain a disabled section without relying on a muted color alone. */
  disabledReason?: string;
}

interface HeroDetailFrameProps<Id extends string> {
  /** The same navigation mechanics serve distinct product moments. */
  surface?: 'locker' | 'foundry';
  heroName: string;
  /**
   * Custom backdrop image that replaces the render chain entirely (Locker's
   * per-skin backdrop, issue #208). Cover-fitted rather than right-anchored,
   * because it was authored as a backdrop and not as a cutout.
   */
  backdropImage?: string;
  /** Third fallback step for the render chain. Omit to skip straight to text. */
  heroIconUrl?: string;
  /** Suppress the hero name art (issue #208: the backdrop already shows it). */
  hideHeroName?: boolean;
  backLabel: string;
  onBack: () => void;
  /** Accessible name for the section `<nav>`. */
  navLabel: string;
  sections: ReadonlyArray<HeroDetailSection<Id>>;
  activeSection: Id;
  onSectionChange: (id: Id) => void;
  /** Rail row rendered to the right of the back button (e.g. favorite). */
  backRowExtra?: ReactNode;
  /** Rail content between the back row and the hero name (e.g. Foundry link). */
  railTop?: ReactNode;
  /** Rail content below the nav (load-order strip, build-tray toggle). */
  railExtra?: ReactNode;
  /** Absolutely positioned controls in the top-right corner. */
  topRight?: ReactNode;
  /**
   * `capped` keeps the hero visible to the right of the content (Locker, where
   * the backdrop is the subject). `fluid` lets the content take the remaining
   * width (Foundry, whose tray docks beside it).
   */
  contentWidth?: 'capped' | 'fluid';
  /** The active section's content. */
  children: ReactNode;
  /** Siblings after the content pane: docked panels, floating panels, modals. */
  after?: ReactNode;
}

export default function HeroDetailFrame<Id extends string>({
  surface,
  heroName,
  backdropImage,
  heroIconUrl,
  hideHeroName = false,
  backLabel,
  onBack,
  navLabel,
  sections,
  activeSection,
  onSectionChange,
  backRowExtra,
  railTop,
  railExtra,
  topRight,
  contentWidth = 'capped',
  children,
  after,
}: HeroDetailFrameProps<Id>) {
  const [nameFailed, setNameFailed] = useState(false);
  const { src: renderSrc, onError: handleRenderError } = useHeroRenderFallback(
    heroName,
    heroIconUrl
  );
  const backdropSrc = backdropImage ?? renderSrc;

  return (
    <div className="relative flex h-full flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
      {/* Hero backdrop, full-bleed behind every panel so it can bleed through
          the frosted-glass rail + selection column. The image is sized to the
          window height with natural aspect ratio (h-full w-auto) so wider
          viewports don't force object-cover to scale it up and chop the
          head/feet off. Anchored to the right edge; whatever space is left to
          the left of the image shows the solid bg-primary, which the frosted
          overlay reads as a dark frosted panel: same look as if the portrait
          extended that far. */}
      <div className="hidden lg:block absolute inset-0 bg-bg-primary animate-hero-zoom-in overflow-hidden">
        {backdropSrc ? (
          <img
            src={backdropSrc}
            alt={heroName}
            className={
              backdropImage
                ? 'absolute inset-0 h-full w-full object-cover'
                : 'absolute top-0 right-0 h-full w-auto max-w-none'
            }
            onError={backdropImage ? undefined : handleRenderError}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-text-secondary text-2xl">
            {heroName}
          </div>
        )}
        {/* Bottom gradient for depth. */}
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/50 to-transparent" />
      </div>

      {topRight && (
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2">{topRight}</div>
      )}

      {/* Progressive frosted-glass background — every layer (including the
          base heavy blur) is masked with a long, smooth taper so nothing has
          a hard right edge. Stacking blurs compounds: a region under all
          three layers is much more blurred than one under only the lightest.
          So as the lighter layers fade out first, the effective blur softens
          from "very heavy" through "medium" to "nothing" without ever
          dropping off a cliff. The container is intentionally much wider
          than the panels it backs (rail + selection is ~640/710px; container
          scales with the viewport) so the gradient has runway to feather all
          the way to clear without swallowing more of the portrait as the
          desktop window narrows. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 z-[5] hidden w-[clamp(680px,56vw,1160px)] lg:block"
      >
        <div
          className="absolute inset-0"
          style={{
            backdropFilter: 'blur(48px) saturate(135%)',
            WebkitBackdropFilter: 'blur(48px) saturate(135%)',
            WebkitMaskImage: 'linear-gradient(to right, black 0%, black 42%, transparent 94%)',
            maskImage: 'linear-gradient(to right, black 0%, black 42%, transparent 94%)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            WebkitMaskImage: 'linear-gradient(to right, black 0%, black 32%, transparent 78%)',
            maskImage: 'linear-gradient(to right, black 0%, black 32%, transparent 78%)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            WebkitMaskImage: 'linear-gradient(to right, black 0%, black 26%, transparent 60%)',
            maskImage: 'linear-gradient(to right, black 0%, black 26%, transparent 60%)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to right, var(--color-bg-secondary) 0%, rgba(26,26,26,0.95) 40%, rgba(26,26,26,0.75) 58%, rgba(26,26,26,0.4) 74%, rgba(26,26,26,0.15) 87%, transparent 97%)',
          }}
        />
      </div>

      {/* Left rail: hero identity + section nav. Solid bg below lg; transparent
          on lg so the feathered glass shows through. */}
      <div className={`relative z-10 flex w-full flex-shrink-0 flex-col gap-4 bg-bg-secondary p-4 animate-slide-in-left lg:w-[300px] lg:gap-6 lg:overflow-y-auto lg:scrollbar-glass lg:bg-transparent lg:p-6 xl:w-[340px] ${
        surface === 'foundry' ? 'lg:bg-accent/[0.025]' : ''
      }`}>
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex w-fit items-center gap-2 rounded-sm text-sm text-text-secondary transition-colors hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            {backLabel}
          </button>
          {backRowExtra}
        </div>

        {railTop}

        {hideHeroName ? null : nameFailed ? (
          <h2 className="text-2xl font-bold text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]">
            {heroName}
          </h2>
        ) : (
          <img
            src={getHeroNamePath(heroName)}
            alt={heroName}
            className="h-8 w-auto self-start object-contain"
            onError={() => setNameFailed(true)}
          />
        )}

        <nav aria-label={navLabel} className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:flex lg:flex-col">
          {sections.map(({ id, label, icon: Icon, count, disabled, disabledReason }) => {
            const isActive = activeSection === id;
            return (
              <button
                key={id}
                type="button"
                disabled={disabled}
                title={disabled ? disabledReason : undefined}
                aria-label={disabled && disabledReason ? `${label}: ${disabledReason}` : undefined}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onSectionChange(id)}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                  disabled
                    ? 'cursor-default border-transparent opacity-40'
                    : isActive
                      ? 'border-accent/60 bg-accent/15 cursor-pointer focus-visible:ring-2 focus-visible:ring-accent'
                      : 'border-transparent hover:bg-white/10 cursor-pointer focus-visible:ring-2 focus-visible:ring-accent'
                }`}
              >
                <Icon className="h-4 w-4 flex-shrink-0 text-white/80" />
                <span className="flex-1 truncate text-sm font-medium text-white">
                  {label}{disabled && disabledReason ? ` — ${disabledReason}` : ''}
                </span>
                {count !== null && count !== undefined && (
                  <span className="text-xs text-white/50">{count}</span>
                )}
              </button>
            );
          })}
        </nav>

        {railExtra}
      </div>

      {/* Content pane: the active section. */}
      <div
        className={`relative z-10 min-h-0 w-full flex-1 overflow-visible bg-bg-primary lg:overflow-y-auto lg:scrollbar-glass lg:bg-transparent ${
          contentWidth === 'capped' ? 'lg:flex-none lg:w-[480px] xl:w-[540px]' : ''
        }`}
      >
        <div className="space-y-4 p-6">{children}</div>
      </div>

      {after}
    </div>
  );
}
