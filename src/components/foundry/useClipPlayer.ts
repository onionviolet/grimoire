import { useCallback, useEffect, useRef, useState } from 'react';
import { foundryVoiceclip } from '../../lib/api';
import { useAppStore } from '../../stores/appStore';

/** Audition state of one sound row. */
export type RowState = 'idle' | 'loading' | 'playing';

/** The minimal shape the player needs: an identity key + the clip path(s).
 *  HeroSound, VoiceLine and GlobalSound all satisfy it. */
export interface PlayableClip {
    event: string;
    vsnd: string[];
}

export interface ClipPlayer {
    toggle: (clip: PlayableClip) => void;
    stateFor: (event: string) => RowState;
}

/**
 * One shared <audio> element across the whole tab: at most one clip plays at a
 * time, and each clip's MP3 (a data URL from the main process) is cached so a
 * replay is instant. Auditions the first clip of a randomizer pool. Routes
 * through the global preview-audio controller (the sidebar volume widget) like
 * AudioPreviewPlayer does: it flips `previewAudioPlaying` so the sidebar control
 * surfaces, and tracks the shared `soundVolume`. Returns per-row state + toggle.
 *
 * Lives in its own module (not beside the Sound tab it grew up in) because both
 * the hero and global sound browsers use it, and react-refresh requires a
 * component file to export only components.
 */
export function useClipPlayer(): ClipPlayer {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const srcCache = useRef<Map<string, string | null>>(new Map());
    const [playing, setPlaying] = useState<string | null>(null);
    const [loadingKey, setLoadingKey] = useState<string | null>(null);
    const soundVolume = useAppStore((s) => s.soundVolume);
    const setPreviewAudioPlaying = useAppStore((s) => s.setPreviewAudioPlaying);

    // Keep the live element in sync with the sidebar's preview-volume slider.
    useEffect(() => {
        if (audioRef.current) audioRef.current.volume = soundVolume;
    }, [soundVolume]);

    // Stop the shared element + clear the sidebar widget when the tab unmounts.
    useEffect(
        () => () => {
            audioRef.current?.pause();
            audioRef.current = null;
            setPreviewAudioPlaying(false);
        },
        [setPreviewAudioPlaying]
    );

    const toggle = useCallback(
        async (clip: PlayableClip) => {
            const key = clip.event;
            const path = clip.vsnd[0];
            if (!path) return; // event with no own clips (inherited): not auditionable
            const audio = (audioRef.current ??= new Audio());

            if (playing === key) {
                audio.pause();
                setPlaying(null);
                setPreviewAudioPlaying(false);
                return;
            }
            audio.pause();

            let src = srcCache.current.get(path);
            if (src === undefined) {
                setLoadingKey(key);
                src = await foundryVoiceclip(path).catch(() => null);
                srcCache.current.set(path, src);
                setLoadingKey((k) => (k === key ? null : k));
            }
            if (!src) return; // not auditionable (missing entry / unsupported codec)

            audio.src = src;
            audio.volume = soundVolume;
            audio.onended = () => {
                setPlaying((p) => (p === key ? null : p));
                setPreviewAudioPlaying(false);
            };
            try {
                await audio.play();
                setPlaying(key);
                setPreviewAudioPlaying(true);
            } catch {
                setPlaying(null);
                setPreviewAudioPlaying(false);
            }
        },
        [playing, soundVolume, setPreviewAudioPlaying]
    );

    const stateFor = useCallback(
        (key: string): RowState =>
            loadingKey === key ? 'loading' : playing === key ? 'playing' : 'idle',
        [loadingKey, playing]
    );

    return { toggle, stateFor };
}
