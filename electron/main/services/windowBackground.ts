import { BrowserWindow } from 'electron';
import { loadSettings } from './settings';
import { windowBackgroundColor } from '../../../src/lib/oledMode';

/**
 * Repaint every window's native background to match the saved OLED setting.
 * Called after any settings save, like syncForgeBridgeWithSettings; new
 * windows get the color at construction via windowBackgroundColor.
 */
export function syncWindowBackgroundWithSettings(): void {
    const color = windowBackgroundColor(loadSettings().oledMode);
    for (const window of BrowserWindow.getAllWindows()) {
        window.setBackgroundColor(color);
    }
}
