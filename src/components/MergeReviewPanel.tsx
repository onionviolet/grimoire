import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ChevronDown, ChevronUp, Loader2, RotateCcw } from 'lucide-react';
import { analyzeMerge } from '../lib/api';
import type { MergeAnalysisResult, MergeCollisionCategory } from '../types/mod';

const CATEGORY_ORDER: MergeCollisionCategory[] = [
  'models',
  'materials',
  'particles',
  'sounds',
  'ui',
  'maps',
  'other',
];

/** How many paths a category shows before it collapses behind a "show all". */
const PATHS_SHOWN = 8;

interface Props {
  /** Winner-first source order to analyze. */
  order: string[];
  /** True once the user has reordered, so the analysis must honour `order`
   *  literally instead of re-deriving it from pak priority. */
  respectOrder: boolean;
  /** Omitted to render the review read-only, which is what the paths that keep
   *  their existing ordering semantics (legacy merge, add-sources) pass. */
  onReorder?: (order: string[]) => void;
  onResetOrder?: () => void;
  /** Set when reordering is deliberately unavailable, with the reason shown. */
  reorderBlockedReason?: string | null;
}

/**
 * Read-only merge preflight, rendered before a merge is confirmed: which exact
 * paths two or more sources both write, grouped by what kind of content they
 * are, and who actually wins each one.
 *
 * Ownership is keyed on normalized VPK entry paths throughout. Nothing here
 * writes, installs, or reorders anything on disk; the composition order it
 * edits is a property of the merge about to be built, and never touches the
 * installed load order.
 */
export default function MergeReviewPanel({
  order,
  respectOrder,
  onReorder,
  onResetOrder,
  reorderBlockedReason,
}: Props) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [attempt, setAttempt] = useState(0);
  // The result is tagged with the request that produced it, so loading and
  // staleness are derived rather than pushed by a synchronous setState in the
  // effect. Only the async callbacks set state.
  const [data, setData] = useState<{
    key: string;
    result: MergeAnalysisResult | null;
    error: string | null;
  } | null>(null);

  const orderKey = order.join(',');
  const requestKey = `${orderKey}|${respectOrder}|${attempt}`;
  useEffect(() => {
    let cancelled = false;
    analyzeMerge(orderKey.split(','), respectOrder)
      .then((result) => {
        if (!cancelled) setData({ key: requestKey, result, error: null });
      })
      .catch((cause) => {
        if (!cancelled) {
          setData({
            key: requestKey,
            result: null,
            error: cause instanceof Error ? cause.message : String(cause),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [orderKey, respectOrder, requestKey]);

  const ready = data?.key === requestKey ? data : null;
  const analysis = ready?.result ?? null;
  const error = ready?.error ?? null;
  const loading = !ready;

  // The wire order is vpkmerge argv order (last input wins). Reverse it so the
  // list reads top-down as strongest first, matching the load-order list.
  const winnerFirst = useMemo(() => (analysis ? [...analysis.sources].reverse() : []), [analysis]);
  const nameOf = useMemo(() => {
    const names = new Map(analysis?.sources.map((source) => [source.modId, source.name]) ?? []);
    return (modId: string) => names.get(modId) ?? modId;
  }, [analysis]);

  const grouped = useMemo(() => {
    const byCategory = new Map<MergeCollisionCategory, MergeAnalysisResult['collisions']>();
    for (const collision of analysis?.collisions ?? []) {
      byCategory.set(collision.category, [...(byCategory.get(collision.category) ?? []), collision]);
    }
    return CATEGORY_ORDER.flatMap((category) => {
      const rows = byCategory.get(category);
      return rows?.length ? [{ category, rows }] : [];
    });
  }, [analysis]);

  const canReorder = !!onReorder && !reorderBlockedReason && (analysis?.unreadableModIds.length ?? 0) === 0;
  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (!onReorder || target < 0 || target >= winnerFirst.length) return;
    const next = winnerFirst.map((source) => source.modId);
    [next[index], next[target]] = [next[target], next[index]];
    onReorder(next);
  };

  const blockedReason = reorderBlockedReason
    ?? ((analysis?.unreadableModIds.length ?? 0) > 0 ? t('mergeMods.review.reorderBlocked') : null);

  return (
    <div className="rounded-lg border border-border bg-bg-tertiary/40 p-3 space-y-3">
      <div className="text-xs uppercase tracking-wide text-text-secondary">
        {t('mergeMods.review.title')}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <Loader2 className="w-4 h-4 animate-spin" />
          {t('mergeMods.review.loading')}
        </div>
      )}

      {!loading && error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-sm text-red-200">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-state-danger" />
          <div className="min-w-0">
            <div className="font-medium">{t('mergeMods.review.errorTitle')}</div>
            <div className="break-words">{error}</div>
            <button
              type="button"
              onClick={() => setAttempt((value) => value + 1)}
              className="mt-1 underline cursor-pointer"
            >
              {t('mergeMods.review.retry')}
            </button>
          </div>
        </div>
      )}

      {!loading && !error && analysis && (
        <>
          {analysis.unreadableModIds.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 text-xs text-text-secondary">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-400" />
              <div>
                {t('mergeMods.review.unreadable', { count: analysis.unreadableModIds.length })}
                <div className="text-text-primary">
                  {analysis.unreadableModIds.map(nameOf).join(', ')}
                </div>
              </div>
            </div>
          )}

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <div className="text-xs uppercase tracking-wide text-text-secondary">
                {t('mergeMods.review.orderTitle')}
              </div>
              {onResetOrder && respectOrder && (
                <button
                  type="button"
                  onClick={onResetOrder}
                  className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  {t('mergeMods.review.resetOrder')}
                </button>
              )}
            </div>
            <p className="mb-1.5 text-xs text-text-secondary">{t('mergeMods.review.orderHint')}</p>
            {blockedReason && onReorder && (
              <p className="mb-1.5 text-xs text-amber-300">{blockedReason}</p>
            )}
            <ul className="space-y-1">
              {winnerFirst.map((source, index) => (
                <li
                  key={source.modId}
                  className="flex items-center gap-2 rounded bg-bg-tertiary/60 px-2 py-1.5 text-sm"
                >
                  <span className="w-5 text-right font-mono text-[11px] tabular-nums text-text-secondary">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-text-primary" title={source.name}>
                    {source.name}
                  </span>
                  <span className="shrink-0 text-[10px] uppercase tracking-wide text-text-secondary/80">
                    {source.entryCount === null
                      ? t('mergeMods.review.sourceUnreadable')
                      : t('mergeMods.review.sourceEntries', { count: source.entryCount })}
                  </span>
                  {onReorder && (
                    <span className="flex shrink-0 gap-0.5">
                      <button
                        type="button"
                        disabled={!canReorder || index === 0}
                        onClick={() => move(index, -1)}
                        aria-label={t('mergeMods.review.moveUp')}
                        title={blockedReason ?? t('mergeMods.review.moveUp')}
                        className="rounded border border-border p-1 text-text-secondary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-30 cursor-pointer"
                      >
                        <ChevronUp className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        disabled={!canReorder || index === winnerFirst.length - 1}
                        onClick={() => move(index, 1)}
                        aria-label={t('mergeMods.review.moveDown')}
                        title={blockedReason ?? t('mergeMods.review.moveDown')}
                        className="rounded border border-border p-1 text-text-secondary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-30 cursor-pointer"
                      >
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {respectOrder && onReorder && (
              <p className="mt-1.5 text-xs text-accent">{t('mergeMods.review.reorderedNotice')}</p>
            )}
          </div>

          <div>
            <div className="mb-1.5 text-xs uppercase tracking-wide text-text-secondary">
              {t('mergeMods.review.collisionCount', { count: analysis.collisions.length })}
            </div>
            {analysis.collisions.length === 0 ? (
              <p className="text-sm text-text-secondary">{t('mergeMods.review.noCollisions')}</p>
            ) : (
              <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {grouped.map(({ category, rows }) => {
                  const showAll = expanded[category];
                  const shown = showAll ? rows : rows.slice(0, PATHS_SHOWN);
                  return (
                    <div key={category} className="rounded border border-border/60 p-2">
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="text-text-primary">
                          {t(`mergeMods.review.category.${category}`)}
                        </span>
                        <span className="text-text-secondary">{rows.length}</span>
                      </div>
                      <ul className="space-y-0.5 text-[11px]">
                        {shown.map((collision) => (
                          <li key={collision.path} className="min-w-0">
                            <div className="truncate font-mono text-text-secondary" title={collision.path}>
                              {collision.path}
                            </div>
                            <div className="truncate text-text-primary" title={nameOf(collision.winnerModId)}>
                              {t('mergeMods.review.winner', { name: nameOf(collision.winnerModId) })}
                              <span className="text-text-secondary">
                                {' '}
                                ({collision.sourceModIds.length})
                              </span>
                            </div>
                          </li>
                        ))}
                      </ul>
                      {rows.length > PATHS_SHOWN && (
                        <button
                          type="button"
                          onClick={() => setExpanded((current) => ({ ...current, [category]: !showAll }))}
                          className="mt-1 text-[11px] text-text-secondary hover:text-text-primary cursor-pointer"
                        >
                          {showAll
                            ? t('mergeMods.review.showFewer')
                            : t('mergeMods.review.showAll', { count: rows.length })}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {analysis.warnings.map((warning) => (
            <p key={warning} className="text-xs text-amber-300">{warning}</p>
          ))}
        </>
      )}
    </div>
  );
}
