// Split from oledMode.ts deliberately: that module is imported by the main
// process (no DOM lib in tsconfig.node), so the document-touching half lives
// in this renderer-only file.
export function applyOledMode(enabled: boolean | null | undefined): void {
  const root = document.documentElement;
  if (enabled) {
    root.dataset.oled = 'true';
  } else {
    delete root.dataset.oled;
  }
}
