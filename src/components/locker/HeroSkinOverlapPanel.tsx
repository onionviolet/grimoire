import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Layers, Loader2 } from 'lucide-react';
import { getConflicts } from '../../lib/api';
import AssetSourcesPanel from '../foundry/AssetSourcesPanel';
import type { Mod } from '../../types/mod';

interface HeroSkinOverlapPanelProps {
  /** This hero's skin mods. Only the enabled ones can contest anything. */
  mods: Mod[];
}

/**
 * Which exact entries this hero's stacked skins fight over.
 *
 * `SkinLoadOrderStrip` already says *that* two skins are stacked; this says
 * *which files* the stack actually disagrees about, and `AssetSourcesPanel`
 * then reports who owns them. Those two answers belonged next to each other and
 * lived on different pages: the second one was only reachable from Conflicts.
 *
 * The paths come from the conflict scan's real normalized entry lists, never
 * from a mod's label or hero tag: exact entry paths are the ownership key.
 *
 * On demand, because the scan re-parses every enabled VPK.
 */
export default function HeroSkinOverlapPanel({ mods }: HeroSkinOverlapPanelProps) {
  const { t } = useTranslation();
  const [paths, setPaths] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enabledIds = useMemo(
    () => new Set(mods.filter((mod) => mod.enabled).map((mod) => mod.id)),
    [mods]
  );

  const scan = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const conflicts = await getConflicts();
      // Any file conflict with at least one of this hero's enabled skins on it.
      // The partner does not have to be another skin for this hero: a global mod
      // overwriting the hero's model is exactly what the user wants told.
      const contested = conflicts
        .filter(
          (conflict) =>
            conflict.conflictType === 'file' &&
            (enabledIds.has(conflict.modA) || enabledIds.has(conflict.modB))
        )
        .flatMap((conflict) => conflict.files ?? []);
      setPaths([...new Set(contested)].sort());
    } catch (cause) {
      setPaths(null);
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, [enabledIds]);

  // Nothing can be contested by a single enabled skin, so the panel self-hides
  // the same way the load-order strip does.
  if (enabledIds.size < 2) return null;

  return (
    <div className="rounded-md border border-border bg-bg-secondary/70 p-3 backdrop-blur-sm">
      <div className="mb-1.5 flex items-center gap-2">
        <Layers className="h-3.5 w-3.5 text-accent" />
        <h4 className="text-xs font-semibold text-text-primary">
          {t('locker.overlap.title')}
        </h4>
      </div>
      <p className="text-[11px] text-text-secondary">
        {t('locker.overlap.intro', { count: enabledIds.size })}
      </p>
      <button
        type="button"
        onClick={() => void scan()}
        disabled={loading}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-sm border border-border px-2 py-1 text-[11px] text-text-secondary transition-colors hover:text-text-primary disabled:opacity-60 cursor-pointer"
      >
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
        {paths ? t('locker.overlap.rescan') : t('locker.overlap.scan')}
      </button>
      {error && <p className="mt-1 text-[10px] text-state-danger">{error}</p>}
      {paths && paths.length === 0 && (
        <p className="mt-1.5 text-[11px] text-text-secondary/70">{t('locker.overlap.none')}</p>
      )}
      {paths && paths.length > 0 && (
        <div className="mt-1.5">
          <p className="text-[11px] text-text-secondary">
            {t('locker.overlap.found', { count: paths.length })}
          </p>
          <ul className="mt-1 space-y-0.5 text-[10px] text-text-secondary/80">
            {paths.map((path) => (
              <li key={path} className="truncate" title={path}>
                {path}
              </li>
            ))}
          </ul>
          <AssetSourcesPanel paths={paths} />
        </div>
      )}
    </div>
  );
}
