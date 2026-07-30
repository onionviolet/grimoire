import { useEffect, useState } from 'react';

/**
 * Tracks the OS "reduce motion" accessibility preference, live.
 *
 * The stylesheet already honors this for CSS animation (see the
 * `prefers-reduced-motion` block in index.css), but anything driven from JS has
 * to ask for itself: a three.js turntable or a parallax transform never touches
 * a CSS animation, so it would keep moving for a user who asked it not to.
 *
 * Lived inside Browse.tsx until the 3D pose viewer needed the same answer.
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return prefersReducedMotion;
}
