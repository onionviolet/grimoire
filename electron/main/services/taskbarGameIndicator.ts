import { nativeImage, type BrowserWindow } from 'electron';
import { loadSettings } from './settings';

let window: BrowserWindow | null = null;
let running = false;
let revision = 0;
let stopped = false;
let shown = false;

// An opaque white play glyph with a dark outline remains visible over any icon.
// createFromBitmap avoids SVG decoding differences in packaged Electron builds.
function playBadge() {
    const size = 16;
    const pixels = Buffer.alloc(size * size * 4);
    for (let y = 1; y < 15; y++) {
        for (let x = 3; x <= 13 - Math.abs(y - 7.5); x++) {
            const offset = (y * size + x) * 4;
            const border = x === 3 || x + 1 > 13 - Math.abs(y - 7.5) || y === 1 || y === 14;
            pixels.fill(border ? 24 : 255, offset, offset + 3);
            pixels[offset + 3] = 255;
        }
    }
    return nativeImage.createFromBitmap(pixels, { width: size, height: size });
}

function render(): void {
    if (process.platform !== 'win32' || !window || window.isDestroyed()) return;
    const next = !stopped && loadSettings().taskbarGameIndicatorEnabled === true && running;
    if (shown === next) return;
    window.setOverlayIcon(next ? playBadge() : null, next ? 'Deadlock' : '');
    shown = next;
}

/** Capture before awaiting a probe, so disable/stop/quit invalidates old results. */
export function taskbarGameStatusRevision(): number {
    return revision;
}

/** Reuse the sidebar's existing game-status request, without another poller. */
export function updateTaskbarGameStatus(target: BrowserWindow | null, value: boolean, observedRevision: number): void {
    if (stopped || observedRevision !== revision) return;
    if (target !== window) {
        window = target;
        shown = false;
    }
    running = value;
    render();
}

export function syncTaskbarGameIndicatorWithSettings(): void {
    revision++;
    render();
}

export function clearTaskbarGameStatus(): void {
    revision++;
    running = false;
    render();
}

export function destroyTaskbarGameIndicator(): void {
    stopped = true;
    clearTaskbarGameStatus();
    window = null;
}
