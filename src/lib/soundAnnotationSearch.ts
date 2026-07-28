import type { SoundAnnotation } from '../types/foundry';

export type SoundSearchMatch = 'catalog' | 'annotation' | null;

/** Keep catalog identity and personal notes as distinct, inspectable search surfaces. */
export function matchSoundWithAnnotation(
    catalogValues: Array<string | null | undefined>,
    annotation: SoundAnnotation | undefined,
    query: string
): SoundSearchMatch {
    const q = query.trim().toLocaleLowerCase();
    if (!q) return 'catalog';
    const has = (values: Array<string | null | undefined>) => values.some((value) => value?.toLocaleLowerCase().includes(q));
    if (has(catalogValues)) return 'catalog';
    return has([annotation?.name, annotation?.note, ...(annotation?.tags ?? []).map((tag) => `#${tag}`)]) ? 'annotation' : null;
}

export function isAnnotated(annotation: SoundAnnotation | undefined): boolean {
    return !!annotation && !!(annotation.name || annotation.note || annotation.tags.length);
}
