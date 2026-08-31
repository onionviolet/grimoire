// This module is imported by the main process, whose tsconfig has no DOM lib,
// so it must stay document-free; the DOM half of the OLED toggle lives in
// applyOledMode.ts.

/** The app's base background (--color-bg-primary in index.css), painted under
 *  the glow in preview tiles and behind the native window. */
export const BACKGROUND_BASE = '#0f0f0f';

/** Native window background (pre-paint flash, resize gutters) matching the
 *  painted canvas: true black in OLED mode, the app base color otherwise. */
export function windowBackgroundColor(enabled: boolean | null | undefined): string {
  return enabled ? '#000000' : BACKGROUND_BASE;
}
