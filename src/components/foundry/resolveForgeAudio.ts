/**
 * Return the file path that the sound forge should hand to the engine.
 *
 * Imported files are stable user-selected paths. Stock clips are different:
 * they are cached under the installed game's build fingerprint, so a game
 * update can invalidate a path held by the editor. Resolve those again at the
 * last responsible moment, immediately before building the VPK.
 */
export async function resolveForgeAudioPath({
    audioPath,
    usingOriginal,
    targetClip,
    resolveOriginal,
}: {
    audioPath: string;
    usingOriginal: boolean;
    targetClip?: string;
    resolveOriginal: (clip: string) => Promise<string | null>;
}): Promise<string | null> {
    if (!usingOriginal) return audioPath;
    if (!targetClip) return null;
    return resolveOriginal(targetClip);
}
