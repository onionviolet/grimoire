import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ExternalLink, RefreshCw, Search, SlidersHorizontal } from 'lucide-react';
import { Badge, Button, Card } from '../components/common/ui';
import { PageHeader, PageLayout } from '../components/common/PageComponents';
import { Input, Select } from '../components/common/forms';
import { getConfigKeyIndex, getPerformanceConfigStatus } from '../lib/api';
import type { ConfigKeyDefinition, PerformanceConfigStatus } from '../types/electron';

type Filter = 'all' | 'changed' | 'conflicted' | 'gameinfo';

function originLabel(origin: string, t: (key: string) => string) {
  return t(`config.origins.${origin}`);
}

export default function Config() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [keys, setKeys] = useState<ConfigKeyDefinition[]>([]);
  const [status, setStatus] = useState<PerformanceConfigStatus | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [index, nextStatus] = await Promise.all([getConfigKeyIndex(), getPerformanceConfigStatus()]);
      setKeys(index);
      setStatus(nextStatus);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const visible = useMemo(() => keys.filter((definition) => {
    const state = status?.convarStates?.[definition.key];
    const conflict = status?.autoexecConflicts?.[definition.key];
    const changed = !!state && state.value !== null && state.value !== state.gameDefault;
    const matchingText = `${definition.key} ${definition.label} ${definition.description}`.toLowerCase()
      .includes(query.trim().toLowerCase());
    return matchingText
      && (filter !== 'changed' || changed)
      && (filter !== 'conflicted' || !!conflict)
      && (filter !== 'gameinfo' || definition.file === 'gameinfo.gi');
  }), [filter, keys, query, status]);

  return (
    <PageLayout maxWidth="7xl">
      <PageHeader
        title={t('config.title')}
        description={t('config.description')}
        stats={t('config.count', { count: visible.length })}
        action={<Button variant="secondary" size="sm" icon={RefreshCw} onClick={() => void refresh()} disabled={loading}>{t('common.actions.refresh')}</Button>}
      />

      <Card className="p-4 border-accent/25 bg-accent/5">
        <div className="flex gap-3 items-start">
          <SlidersHorizontal className="w-5 h-5 mt-0.5 text-accent shrink-0" />
          <p className="text-sm text-text-secondary">{t('config.precedence')}</p>
        </div>
      </Card>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-60">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('config.search')} className="pl-9" />
        </div>
        <Select value={filter} onChange={(event) => setFilter(event.target.value as Filter)} aria-label={t('config.filter')}>
          <option value="all">{t('config.filters.all')}</option>
          <option value="changed">{t('config.filters.changed')}</option>
          <option value="conflicted">{t('config.filters.conflicted')}</option>
          <option value="gameinfo">{t('config.filters.gameinfo')}</option>
        </Select>
      </div>

      {error && <Card className="p-4 text-state-danger">{t('config.error')}: {error}</Card>}
      {!loading && !error && visible.length === 0 && <Card className="p-8 text-center text-text-secondary">{t('config.empty')}</Card>}
      <div className="space-y-3">
        {visible.map((definition) => {
          const state = status?.convarStates?.[definition.key];
          const conflict = status?.autoexecConflicts?.[definition.key];
          const resolved = state?.resolvedValue ?? definition.gameDefault ?? t('config.unknown');
          return <Card key={definition.key} className="p-4">
            <div className="flex flex-wrap gap-4 justify-between items-start">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-medium text-text-primary">{definition.label}</h2>
                  <Badge>{definition.file}</Badge>
                  {state && <Badge>{originLabel(state.origin, t)}</Badge>}
                  {conflict && <Badge variant="warning">{t('config.overridden')}</Badge>}
                </div>
                <code className="block mt-1 text-xs text-text-tertiary break-all">{definition.key}</code>
                <p className="mt-2 text-sm text-text-secondary">{definition.description}</p>
              </div>
              <Button variant="secondary" size="sm" icon={ExternalLink} onClick={() => navigate('/settings')}>
                {t('config.openEditor')}
              </Button>
            </div>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div><span className="text-text-tertiary">{t('config.resolved')}</span><strong className="block text-text-primary break-all">{resolved}</strong></div>
              <div><span className="text-text-tertiary">{t('config.stock')}</span><strong className="block text-text-primary break-all">{state?.gameDefault ?? t('config.unknown')}</strong></div>
              <div><span className="text-text-tertiary">{t('config.written')}</span><strong className="block text-text-primary break-all">{state?.value ?? t('config.notSet')}</strong></div>
            </div>
            {conflict && <div className="mt-3 flex gap-2 text-sm text-state-warning"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{t('config.conflictDetail', { value: conflict.value, line: conflict.line })}</div>}
          </Card>;
        })}
      </div>
    </PageLayout>
  );
}
