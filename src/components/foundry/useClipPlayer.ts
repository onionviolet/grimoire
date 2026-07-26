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

/**
 * Normalize a stored pool cursor to a valid index into a pool of `poolLength`
 * clips. Exported (and separated from the hook) so the wrap arithmetic is unit
 * testable in this repo's node test environment, which has no DOM to render a
 * hook into.
 *
 * The modulo is not decoration: a cursor persists under the event key while the
 * user filters and re-renders, and voice-line vs gameplay rows can carry the
 * same event name with different pool depths, so a cursor left over from a
 * longer pool must not index past the end.
 */
export function poolCursor(stored: number | undefined, poolLength: number): number {
    if (poolLength <= 0) return 0;
    const n = Math.trunc(stored ?? 0);
    // Guard negatives too: JS `%` keeps the sign of the dividend.
    return ((n % poolLength) + poolLength) % poolLength;
}

/** The cursor after auditioning `current`, wrapping at the end of the pool. */
export function advancePoolCursor(current: number, poolLength: number): number {
    if (poolLength <= 1) return 0;
    return (poolCursor(current, poolLength) + 1) % poolLength;
}

export interface ClipPlayer {
    toggle: (clip: PlayableClip) => void;
    stateFor: (event: string) => RowState;
    /** 0-based index of the pool clip this row will audition next, for display.
     *  Always 0 for single-clip rows. */
    poolIndexFor: (event: string) => number;
}

/**
 * One shared <audio> element across the whole tab: at most one clip plays at a
 * time, and each clip's MP3 (a data URL from the main process) is cached so a
 * replay is instant. Routes through the global preview-audio controller (the
 * sidebar volume widget) like AudioPreviewPlayer does: it flips
 * `previewAudioPlaying` so the sidebar control surfaces, and tracks the shared
 * `soundVolume`. Returns per-row state + toggle.
 *
 * **Randomizer pools cycle.** Many events play a random clip from a pool rather
 * than one fixed sound (35% of the indexed global events, up to 58 clips deep),
 * so auditioning only `vsnd[0]` misrepresents most of what the event sounds
 * like in game. Each press of play advances a per-event cursor and wraps, so
 * pressing repeatedly walks the whole pool. The swap path is unaffected either
 * way: it runs `--pool all` and overrides every clip.
 *
 * Lives in its own module (not beside the Sound tab it grew up in) because both
 * the hero and global sound browsers use it, and react-refresh requires a
 * component file to export only components.
 */
export function useClipPlayer(): ClipPlayer {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const srcCache = useRef<Map<string, string | null>>(new Map());
    // Per-event pool cursor. State, not a ref, because the row label renders it.
    const [poolIndex, setPoolIndex] = useState<Record<string, number>>({});
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
            if (clip.vsnd.length === 0) return; // inherited-only event: not auditionable
            // Play the clip the cursor points at, then advance it so the next
            // press walks the pool. Modulo guards a cursor left over from a
            // longer pool under the same event key.
            const cursor = poolCursor(poolIndex[key], clip.vsnd.length);
            const path = clip.vsnd[cursor];
            if (!path) return;
            const audio = (audioRef.current ??= new Audio());

            if (playing === key) {
                audio.pause();
                setPlaying(null);
                setPreviewAudioPlaying(false);
                return;
            }
            audio.pause();
            if (clip.vsnd.length > 1) {
                setPoolIndex((m) => ({ ...m, [key]: advancePoolCursor(cursor, clip.vsnd.length) }));
            }

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
        [playing, poolIndex, soundVolume, setPreviewAudioPlaying]
    );

    const stateFor = useCallback(
        (key: string): RowState =>
            loadingKey === key ? 'loading' : playing === key ? 'playing' : 'idle',
        [loadingKey, playing]
    );

    const poolIndexFor = useCallback((key: string): number => poolIndex[key] ?? 0, [poolIndex]);

    return { toggle, stateFor, poolIndexFor };
}
