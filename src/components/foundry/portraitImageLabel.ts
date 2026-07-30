/**
 * The portrait staging cache is content-addressed. Keep the stored hash as a
 * useful fallback when an older cache entry has no recorded original filename.
 */
export function portraitImageLabel(path: string, label: string | null | undefined): string {
  const recorded = label?.trim();
  if (recorded) return recorded;
  const base = path.split(/[\\/]/).pop() || path;
  return base.replace(/\.png$/i, '') || path;
}
