import { describe, expect, it, vi } from 'vitest';
import { resolveForgeAudioPath } from './resolveForgeAudio';

describe('resolveForgeAudioPath', () => {
    it('keeps a user-imported MP3 at its chosen path', async () => {
        const resolveOriginal = vi.fn();
        await expect(
            resolveForgeAudioPath({
                audioPath: 'C:/music/custom.mp3',
                usingOriginal: false,
                targetClip: 'sounds/hero/clip.vsnd',
                resolveOriginal,
            })
        ).resolves.toBe('C:/music/custom.mp3');
        expect(resolveOriginal).not.toHaveBeenCalled();
    });

    it('resolves a stock donor again immediately before forge', async () => {
        const resolveOriginal = vi.fn().mockResolvedValue('C:/cache/new-build/clip.mp3');
        await expect(
            resolveForgeAudioPath({
                audioPath: 'C:/cache/old-build/clip.mp3',
                usingOriginal: true,
                targetClip: 'sounds/hero/clip.vsnd',
                resolveOriginal,
            })
        ).resolves.toBe('C:/cache/new-build/clip.mp3');
        expect(resolveOriginal).toHaveBeenCalledWith('sounds/hero/clip.vsnd');
    });

    it('fails safely when the stock donor can no longer be extracted', async () => {
        await expect(
            resolveForgeAudioPath({
                audioPath: 'C:/cache/old-build/clip.mp3',
                usingOriginal: true,
                targetClip: 'sounds/hero/clip.vsnd',
                resolveOriginal: vi.fn().mockResolvedValue(null),
            })
        ).resolves.toBeNull();
    });

    it('does not forge a stock donor when no target clip was selected', async () => {
        const resolveOriginal = vi.fn();
        await expect(
            resolveForgeAudioPath({
                audioPath: 'C:/cache/old-build/clip.mp3',
                usingOriginal: true,
                resolveOriginal,
            })
        ).resolves.toBeNull();
        expect(resolveOriginal).not.toHaveBeenCalled();
    });

    it('surfaces a re-extraction error instead of falling back to a stale cache path', async () => {
        const resolveOriginal = vi.fn().mockRejectedValue(new Error('Deadlock files changed'));
        await expect(
            resolveForgeAudioPath({
                audioPath: 'C:/cache/old-build/clip.mp3',
                usingOriginal: true,
                targetClip: 'sounds/hero/clip.vsnd',
                resolveOriginal,
            })
        ).rejects.toThrow('Deadlock files changed');
    });
});
