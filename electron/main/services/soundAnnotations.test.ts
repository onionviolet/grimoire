import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const harness = { userData: '' };

vi.mock('electron', () => ({ app: { getPath: () => harness.userData } }));

import {
    exportSoundAnnotations,
    importSoundAnnotations,
    listSoundAnnotations,
    saveSoundAnnotation,
    soundAnnotationKey,
} from './soundAnnotations';

describe('sound annotations', () => {
    beforeEach(() => {
        harness.userData = mkdtempSync(join(tmpdir(), 'grimoire-sound-annotations-'));
    });

    afterEach(() => {
        rmSync(harness.userData, { recursive: true, force: true });
    });

    it('normalizes names and notes while preserving the stable key', () => {
        const key = soundAnnotationKey('UI.Click', 'sounds/ui/click.vsnd_c');

        expect(saveSoundAnnotation(key, { name: '  Menu click  ', note: '  Short and sharp  ' })).toEqual({
            key,
            annotation: {
                name: 'Menu click',
                note: 'Short and sharp',
                updatedAt: expect.any(String),
            },
        });
        expect(listSoundAnnotations()).toHaveLength(1);
        expect(exportSoundAnnotations()).toContain('UI.Click');
    });

    it('merges imported entries and ignores malformed entry values', () => {
        const firstKey = soundAnnotationKey('UI.Click', 'sounds/ui/click.vsnd_c');
        const secondKey = soundAnnotationKey('Music.RoundStart', 'sounds/music/start.vsnd_c');
        saveSoundAnnotation(firstKey, { name: 'Old', note: '' });

        const result = importSoundAnnotations(JSON.stringify({
            version: 1,
            entries: {
                [firstKey]: { name: 'New', note: 'Updated', updatedAt: 'not-a-date' },
                [secondKey]: { name: 'Round start', note: null },
                bad: { name: 'Should not load' },
                ignored: null,
            },
        }));

        expect(result).toHaveLength(2);
        expect(result.find((entry) => entry.key === firstKey)?.annotation.name).toBe('New');
        expect(result.find((entry) => entry.key === secondKey)?.annotation.name).toBe('Round start');
        expect(result.find((entry) => entry.key === firstKey)?.annotation.updatedAt).toBe('1970-01-01T00:00:00.000Z');
    });

    it('deletes an annotation when both fields are empty', () => {
        const key = soundAnnotationKey('UI.Click', 'sounds/ui/click.vsnd_c');
        saveSoundAnnotation(key, { name: 'Menu click', note: 'Keep' });

        expect(saveSoundAnnotation(key, { name: '  ', note: '\n' })).toBeNull();
        expect(listSoundAnnotations()).toEqual([]);
    });

    it('rejects malformed JSON, unsupported shapes, invalid keys, and oversized files', () => {
        expect(() => importSoundAnnotations('{')).toThrow('not valid JSON');
        expect(() => importSoundAnnotations('null')).toThrow('Unsupported');
        expect(() => importSoundAnnotations(JSON.stringify({ version: 1, entries: [] }))).toThrow('Unsupported');
        expect(() => saveSoundAnnotation('not-a-stable-key', { name: 'Nope', note: '' })).toThrow('Invalid');
        const key = soundAnnotationKey('UI.Click', 'sounds/ui/click.vsnd_c');
        const oversized = JSON.stringify({ version: 1, entries: { [key]: { note: 'x'.repeat(2 * 1024 * 1024) } } });
        expect(() => importSoundAnnotations(oversized)).toThrow('too large');
    });

    it('writes atomically to the user data directory', () => {
        const key = soundAnnotationKey('UI.Click', 'sounds/ui/click.vsnd_c');
        saveSoundAnnotation(key, { name: 'Menu click', note: '' });
        const file = readFileSync(join(harness.userData, 'foundry-sound-annotations.json'), 'utf8');
        expect(JSON.parse(file).version).toBe(1);
    });
});
