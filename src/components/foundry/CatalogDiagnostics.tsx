import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { foundryCatalogDiagnostics, foundryRebuildCatalog } from '../../lib/api';
import type { CatalogDiagnostics as Diagnostics } from '../../types/foundry';
import { formatAbsoluteDate } from '../../lib/dates';

/**
 * Why this catalog looks the way it does.
 *
 * "The portraits disappeared" is unanswerable from an empty grid: the cause
 * could be an unset game path, a pak that moved, a thumbnail cache belonging to
 * an older build, or an engine that will not run, and the UI reported none of
 * them. This says which pak is indexed, from when, how many entries the engine
 * found, and offers a rebuild, so the next report is one screenshot.
 *
 * Mounted by empty and error states only, and it fetches on mount, so a healthy
 * browse never pays for the stat and the engine call.
 */
export default function CatalogDiagnostics() {
  const { t } = useTranslation();
  const [data, setData] = useState<Diagnostics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rebuilding, setRebuilding] = useState(false);

  const load = useCallback(async (rebuild: boolean) => {
    setError(null);
    try {
      setData(rebuild ? await foundryRebuildCatalog() : await foundryCatalogDiagnostics());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  const rebuild = async () => {
    setRebuilding(true);
    try {
      await load(true);
    } finally {
      setRebuilding(false);
    }
  };

  return (
    <details className="mt-4 w-full max-w-xl rounded-lg border border-border/70 bg-bg-secondary/50 text-left">
      <summary className="cursor-pointer px-3 py-2 text-xs text-text-secondary hover:text-text-primary">
        {t('foundry.diagnostics.summary', 'Where this catalog comes from')}
      </summary>
      <div className="space-y-1.5 border-t border-border/50 px-3 py-2 text-[11px] text-text-secondary">
        {!data && !error ? (
          <p className="flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" />
            {t('foundry.diagnostics.reading', 'Reading the catalog...')}
          </p>
        ) : error ? (
          <p className="flex items-start gap-1.5 text-state-danger">
            <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
            <span>{error}</span>
          </p>
        ) : data ? (
          <>
            <p className="break-all">
              {t('foundry.diagnostics.pak', 'Indexing {{path}}', { path: data.pakPath })}
            </p>
            <p>
              {data.pakModifiedIso
                ? t('foundry.diagnostics.built', 'Game files last changed {{when}}', {
                    when: formatAbsoluteDate(data.pakModifiedIso),
                  })
                : t('foundry.diagnostics.builtUnknown', 'Game file timestamp unavailable')}
            </p>
            {data.indexedTextures !== null && (
              <p className="tabular-nums">
                {t('foundry.diagnostics.indexed', '{{textures}} textures and {{voicelines}} voice lines indexed', {
                  textures: data.indexedTextures,
                  voicelines: data.indexedVoicelines ?? 0,
                })}
              </p>
            )}
            {data.cachedCategories.length > 0 ? (
              <p className="tabular-nums">
                {t('foundry.diagnostics.cached', 'Decoded thumbnails: {{summary}}', {
                  summary: data.cachedCategories
                    .map((entry) => `${entry.category} ${entry.thumbnails}`)
                    .join(', '),
                })}
              </p>
            ) : (
              <p>
                {t('foundry.diagnostics.noThumbs', 'No decoded thumbnails cached for this game build yet.')}
              </p>
            )}
            {/* A catalog error is the answer, not a failure of this panel: it is
                the difference between "nothing matched" and "nothing was read". */}
            {data.error && (
              <p className="flex items-start gap-1.5 text-state-danger">
                <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
                <span>{data.error}</span>
              </p>
            )}
          </>
        ) : null}
        <button
          type="button"
          onClick={() => void rebuild()}
          disabled={rebuilding}
          className="mt-1 inline-flex items-center gap-1.5 rounded-sm border border-border px-2 py-1 text-[11px] text-text-primary transition-colors hover:border-accent/50 disabled:opacity-50 cursor-pointer"
        >
          {rebuilding ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          {t('foundry.diagnostics.rebuild', 'Rebuild the catalog cache')}
        </button>
      </div>
    </details>
  );
}
