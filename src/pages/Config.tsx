import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Save, Search, SlidersHorizontal, FileJson } from 'lucide-react';
import { Badge, Button, Card } from '../components/common/ui';
import { PageHeader, PageLayout, LoadingState } from '../components/common/PageComponents';
import { Input, Select, Textarea } from '../components/common/forms';
import { useConfirm } from '../components/common/confirmContext';
import ConfigValueEditor from '../components/config/ConfigValueEditor';
import ConfigBundleDialog from '../components/config/ConfigBundleDialog';
import { applyConfigWorkspace, getConfigWorkspace } from '../lib/api';
import { useAppStore } from '../stores/appStore';
import { useConfigDraftStore } from '../stores/configDraftStore';
import type { ConfigBundle } from '../types/configWorkspace';

type Filter = 'all' | 'changed' | 'conflicted' | 'gameinfo' | 'unknown';

export default function Config() {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const { snapshot, values, commands, launchOptions, accept, setValues, setCommands, setLaunchOptions } = useConfigDraftStore();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [bundleOpen, setBundleOpen] = useState(false);
  const refresh = useCallback(async (discard = true) => {
    setLoading(true); setError(null); setSaved(false);
    try { accept(await getConfigWorkspace(), discard); } catch (failure) { setError(String(failure)); } finally { setLoading(false); }
  }, [accept]);
  useEffect(() => { void refresh(false); }, [refresh]);
  const commandsChanged = commands !== (snapshot?.autoexecCommands.join('\n') ?? '');
  const launchChanged = launchOptions !== (snapshot?.launchOptions ?? '');
  const dirty = Object.keys(values).length > 0 || commandsChanged || launchChanged;
  const stageValue = (key: string, value: string) => {
    setSaved(false);
    setValues(current => {
      const next = { ...current };
      if (value === snapshot?.performance.convarStates?.[key]?.value) delete next[key];
      else next[key] = value;
      return next;
    });
  };
  const visible = useMemo(() => (snapshot?.definitions ?? []).filter(definition => {
    return definition.key.replace(/[_.]+/g, ' ').includes(query.trim().toLowerCase()) || definition.key.includes(query.trim().toLowerCase());
  }).filter(definition => {
    const state = snapshot?.performance.convarStates?.[definition.key];
    const baseline = state?.gameDefault ?? state?.engineDefault;
    const changed = !!state && baseline != null && state.resolvedValue !== baseline;
    return filter !== 'unknown' && (filter !== 'changed' || changed) && (filter !== 'conflicted' || !!state?.autoexec);
  }), [snapshot, filter, query]);
  const unknown = (snapshot?.unknown ?? []).filter(entry => `${entry.key} ${entry.value}`.toLowerCase().includes(query.trim().toLowerCase())
    && (filter === 'all' || filter === 'unknown' || (filter === 'gameinfo' && entry.file === 'gameinfo.gi')));
  const pages = Math.max(1, Math.ceil(visible.length / 40));
  const currentPage = Math.min(page, pages - 1);
  const stageBundle = (bundle: ConfigBundle) => {
    setValues(Object.fromEntries(Object.entries(bundle.gameinfo).filter(([key, value]) => value !== snapshot?.performance.convarStates?.[key]?.value)));
    setCommands(bundle.autoexecCommands.join('\n')); setLaunchOptions(bundle.launchOptions); setSaved(false);
  };
  const save = async () => {
    if (!snapshot || busy || !dirty) return;
    setBusy(true); setError(null); setSaved(false);
    try {
      const items = Object.entries(values).map(([key, value]) => `${key}: ${snapshot.performance.convarStates?.[key]?.value ?? t('config.notSet')} → ${value}`);
      if (commandsChanged) {
        const previous = snapshot.autoexecCommands;
        const next = commands.split('\n').map(line => line.trim()).filter(Boolean);
        previous.filter(line => !next.includes(line)).forEach(line => items.push(`${t('config.review.removed')}: ${line}`));
        next.filter(line => !previous.includes(line)).forEach(line => items.push(`${t('config.review.added')}: ${line}`));
        items.push(`${t('config.review.commands')}:\n${next.join('\n') || t('config.notSet')}`);
      }
      if (launchChanged) items.push(`${t('config.launchOptions')}: ${snapshot.launchOptions || t('config.notSet')} → ${launchOptions || t('config.notSet')}`);
      if (!await confirm({ title: t('config.review.title'), message: t('config.review.message'), items, wrapItems: true, itemsLabel: t('config.review.changeCount', { count: items.length }), confirmLabel: t('config.apply') })) return;
      const next = await applyConfigWorkspace({ reviewToken: snapshot.reviewToken, gameinfo: values,
        ...(commandsChanged ? { autoexecCommands: commands.split('\n').map(line => line.trim()).filter(Boolean) } : {}),
        ...(launchChanged ? { launchOptions } : {}) });
      accept(next); setSaved(true);
      await useAppStore.getState().loadSettings();
    } catch (failure) { setError(String(failure)); } finally { setBusy(false); }
  };
  const requestRefresh = async () => {
    if (dirty && !await confirm({ title: t('config.discard.title'), message: t('config.discard.message'), confirmLabel: t('config.discard.action') })) return;
    await refresh();
  };
  return <PageLayout maxWidth="7xl">
    <PageHeader title={t('config.title')} description={t('config.description')} stats={t('config.count', { count: visible.length })}
      action={<div className="flex flex-wrap gap-2">
        <Button variant="ghost" size="sm" icon={FileJson} disabled={busy || loading || !snapshot?.available} onClick={() => setBundleOpen(true)}>{t('config.bundle.title')}</Button>
        <Button variant="secondary" size="sm" icon={RefreshCw} disabled={busy || loading} onClick={() => void requestRefresh()}>{t('common.actions.refresh')}</Button>
        <Button size="sm" icon={Save} isLoading={busy} disabled={!dirty || busy || loading || !snapshot?.available} onClick={() => void save()}>{t('config.apply')}</Button>
      </div>} />
    <Card className="p-4 border-accent/25 bg-accent/5"><div className="flex gap-3 items-start">
      <SlidersHorizontal className="w-5 h-5 mt-0.5 text-accent shrink-0" /><p className="text-sm text-text-secondary">{t('config.precedence')}</p>
    </div></Card>
    {!loading && !snapshot?.available && <p role="status" className="text-sm text-state-warning">{t('config.unavailable')}</p>}
    {error && <p role="alert" className="text-sm text-state-danger">{t('config.saveError', { error })}</p>}
    {saved && <p role="status" className="text-sm text-text-secondary">{t('config.saved')}</p>}
    <div className="flex flex-wrap gap-3">
      <div className="flex-1 min-w-60"><Input icon={Search} value={query} onChange={event => { setQuery(event.target.value); setPage(0); }} placeholder={t('config.search')} aria-label={t('config.search')} /></div>
      <Select value={filter} onChange={event => { setFilter(event.target.value as Filter); setPage(0); }} aria-label={t('config.filter')}>
        {(['all', 'changed', 'conflicted', 'gameinfo', 'unknown'] as const).map(value => <option key={value} value={value}>{t(`config.filters.${value}`)}</option>)}
      </Select>
    </div>
    {loading ? <LoadingState /> : <>
      {!error && visible.length === 0 && unknown.length === 0 && <Card className="p-8 text-center text-text-secondary">{t('config.empty')}</Card>}
      <div className="space-y-3">{visible.slice(currentPage * 40, (currentPage + 1) * 40).map(definition => <ConfigValueEditor key={definition.key} definition={definition} state={snapshot?.performance.convarStates?.[definition.key]}
        draft={values[definition.key]} disabled={busy || !snapshot?.available} onChange={value => stageValue(definition.key, value)}
        onUndo={() => setValues(current => { const next = { ...current }; delete next[definition.key]; return next; })} />)}</div>
      {pages > 1 && <div className="flex items-center justify-center gap-3">
        <Button variant="secondary" size="sm" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>{t('config.previous')}</Button>
        <span className="text-xs text-text-secondary">{t('config.page', { page: currentPage + 1, pages })}</span>
        <Button variant="secondary" size="sm" disabled={currentPage + 1 === pages} onClick={() => setPage(currentPage + 1)}>{t('config.next')}</Button>
      </div>}
      {unknown.length > 0 && <Card className="p-4 space-y-3"><h2 className="text-base font-medium">{t('config.unknownKeys')}</h2><p className="text-sm text-text-secondary">{t('config.unknownHelp')}</p>
        {unknown.map((entry, index) => <div key={`${entry.file}:${entry.line}:${index}`} className="flex flex-wrap gap-2 items-center text-sm"><code className="break-all">{entry.key} {entry.value}</code><Badge>{entry.file}:{entry.line}</Badge></div>)}
      </Card>}
      {filter !== 'unknown' && <Card className="p-4 space-y-4">
        <label htmlFor="config-autoexec" className="block font-medium">{t('config.commands')}</label><p className="text-sm text-text-secondary">{t('config.commandsHelp')}</p>
        <Textarea id="config-autoexec" rows={6} className="font-mono text-xs" value={commands} disabled={busy || !snapshot?.available} onChange={event => { setCommands(event.target.value); setSaved(false); }} />
        {!!snapshot?.manualCommands.length && <details><summary className="cursor-pointer text-sm text-text-secondary">{t('config.manualCommands')}</summary><pre className="mt-2 whitespace-pre-wrap break-all text-xs text-text-tertiary">{snapshot.manualCommands.join('\n')}</pre></details>}
        <label htmlFor="config-launch" className="block font-medium">{t('config.launchOptions')}</label><p className="text-sm text-text-secondary">{t('config.launchHelp')}</p>
        <Input id="config-launch" value={launchOptions} maxLength={8192} disabled={busy || !snapshot?.available} onChange={event => { setLaunchOptions(event.target.value); setSaved(false); }} />
      </Card>}
    </>}
    {bundleOpen && <ConfigBundleDialog onClose={() => setBundleOpen(false)} onStage={stageBundle} />}
  </PageLayout>;
}
