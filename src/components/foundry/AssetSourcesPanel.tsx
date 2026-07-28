import { useState } from 'react';
import { AlertTriangle, Loader2, Search } from 'lucide-react';
import { foundryInspectAssetSources } from '../../lib/api';
import type { FoundryAssetSourcesInspection } from '../../types/foundry';

/** On-demand to keep catalog grids inexpensive: a VPK-directory scan occurs
 * only for the card a player explicitly asks to inspect. */
export default function AssetSourcesPanel({ paths }: { paths: string[] }) {
  const [result, setResult] = useState<FoundryAssetSourcesInspection | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inspect = async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(await foundryInspectAssetSources(paths));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-1 border-t border-border/60 pt-1.5">
      <button
        type="button"
        onClick={() => void inspect()}
        disabled={loading}
        className="flex w-full items-center justify-center gap-1 rounded-sm px-1.5 py-1 text-[11px] text-text-secondary hover:bg-bg-tertiary hover:text-text-primary disabled:opacity-60"
        title="Inspect installed VPKs that write this exact asset path"
      >
        {loading ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
        Existing sources
      </button>
      {error && <p className="mt-1 text-[10px] text-danger">{error}</p>}
      {result && (
        <div className="mt-1 space-y-1 text-[10px] text-text-secondary">
          {paths.map((path) => {
            const normalized = path.replace(/\\/g, '/').replace(/^\/+/, '');
            const winner = result.winners[normalized];
            const name = winner ? result.sources.find((source) => source.modId === winner)?.modName ?? winner : null;
            return name ? <p key={path} className="truncate" title={path}>Current winner: {name}</p> : null;
          })}
          {result.sources.length === 0 ? (
            <p>No installed VPK writes this path.</p>
          ) : result.sources.map((source) => (
            <div key={source.modId} className="rounded-sm bg-bg-tertiary px-1.5 py-1">
              <div className="flex gap-1">
                <span className={source.enabled ? 'text-accent' : 'text-text-secondary'}>{source.enabled ? 'Enabled' : 'Disabled'}</span>
                <span className="truncate text-text-primary" title={source.modName}>{source.modName}</span>
              </div>
              <p>{source.provenance} · priority {source.priority}{source.wins.length ? ' · winner' : ''}</p>
              <p className="truncate" title={source.entries.join(', ')}>{source.entries.join(', ')}</p>
            </div>
          ))}
          {result.unreadableMods.length > 0 && (
            <p className="flex gap-1 text-accent"><AlertTriangle size={11} />{result.unreadableMods.length} VPK{result.unreadableMods.length === 1 ? '' : 's'} unreadable; results may be incomplete.</p>
          )}
        </div>
      )}
    </div>
  );
}
