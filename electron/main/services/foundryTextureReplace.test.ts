import { describe, expect, it } from 'vitest';
import { hasVerifiedYcocgIconSupport, validateTextureReplacement } from './foundryTextureReplace';

describe('Foundry texture replacement safety', () => {
    it('only trusts a dev sibling fork or an explicitly marked packaged engine', () => {
        expect(hasVerifiedYcocgIconSupport({
            binaryPath: 'C:\\repo\\vpkmerge\\target\\release\\vpkmerge.exe',
            appPath: 'C:\\repo\\grimoire', packaged: false, markerExists: false,
        })).toBe(true);
        expect(hasVerifiedYcocgIconSupport({
            binaryPath: 'C:\\app\\resources\\vpkmerge\\vpkmerge.exe',
            appPath: 'C:\\app', packaged: true, markerExists: false,
        })).toBe(false);
        expect(hasVerifiedYcocgIconSupport({
            binaryPath: 'C:\\app\\resources\\vpkmerge\\vpkmerge.exe',
            appPath: 'C:\\app', packaged: true, markerExists: true,
        })).toBe(true);
    });

    it('rejects non-texture entries and non-PNG paths before spawning the engine', () => {
        expect(() => validateTextureReplacement('../bad.vtex_c', 'missing.png')).toThrow('compiled texture');
        expect(() => validateTextureReplacement('panorama/a.vtex_c', 'missing.jpg')).toThrow('PNG files');
    });
});
