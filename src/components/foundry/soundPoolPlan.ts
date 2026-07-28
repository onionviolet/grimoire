/**
 * Pure planning for the Sound Forge pool editor.  Keeping this separate from
 * React means the exact write set is testable and the main process receives a
 * boring, explicit list of clip -> MP3 assignments.
 */
export type SoundPoolMode = 'replace-all' | 'selected-targets' | 'n-to-n' | 'seeded-library';

export interface PoolAudio {
    path: string;
    name: string;
}

export interface SoundPoolAssignment {
    clipPath: string;
    audioPath: string;
}

/** A stable PRNG so a recorded seed produces the same library shuffle later. */
export function seededShuffle<T>(values: readonly T[], seed: number): T[] {
    const out = [...values];
    let state = (Math.trunc(seed) || 1) >>> 0;
    const next = () => {
        state ^= state << 13;
        state ^= state >>> 17;
        state ^= state << 5;
        return (state >>> 0) / 0x1_0000_0000;
    };
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

/**
 * Resolve a mode into the exact VPK entries to mint.  N-to-N deliberately
 * requires one audio per selected target; every other mode cycles its chosen
 * library, preserving randomizer-pool cardinality rather than collapsing it.
 */
export function planSoundPool(
    mode: SoundPoolMode,
    sourceClips: readonly string[],
    selected: ReadonlySet<string>,
    library: readonly PoolAudio[],
    seed = 1
): SoundPoolAssignment[] {
    const targets = mode === 'replace-all' ? [...sourceClips] : sourceClips.filter((clip) => selected.has(clip));
    if (!targets.length || !library.length) return [];
    const audio = mode === 'seeded-library' ? seededShuffle(library, seed) : [...library];
    if (mode === 'n-to-n' && audio.length !== targets.length) return [];
    return targets.map((clipPath, index) => ({ clipPath, audioPath: audio[index % audio.length].path }));
}
