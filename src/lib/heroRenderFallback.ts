import { useCallback, useState } from 'react';
import { getHeroRenderPath, getHeroWikiUrl } from './lockerUtils';

/**
 * The hero render fallback chain, in Locker's four-step form: bundled hero
 * render, wiki render, caller-supplied icon, give up (the caller draws text
 * instead). Shared so the grids and the detail views degrade identically.
 *
 * Lives outside `HeroDetailFrame` only because a component module that also
 * exports a hook breaks fast refresh.
 */
export function useHeroRenderFallback(heroName: string, iconUrl?: string) {
  const [step, setStep] = useState(0);

  const src =
    step === 0
      ? getHeroRenderPath(heroName)
      : step === 1
        ? getHeroWikiUrl(heroName)
        : step === 2
          ? (iconUrl ?? '')
          : '';

  const onError = useCallback(() => {
    setStep((current) => {
      if (current === 0) return 1;
      if (current === 1 && iconUrl) return 2;
      return 3;
    });
  }, [iconUrl]);

  return { src, onError };
}
