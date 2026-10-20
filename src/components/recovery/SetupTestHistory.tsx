import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getSetupTestHistory, recordSetupTest } from '../../lib/api';
import type { SetupTestHistory as History } from '../../types/setupTestHistory';
import { Button } from '../common/ui';
import { Textarea } from '../common/forms';
import { SectionHeader } from '../common/PageComponents';

export default function SetupTestHistory() {
  const { t } = useTranslation();
  const [history, setHistory] = useState<History | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const refresh = async () => {
    setBusy(true); setFailed(false);
    try { setHistory(await getSetupTestHistory()); }
    catch { setHistory(null); setFailed(true); }
    finally { setBusy(false); }
  };
  const record = async (result: 'works' | 'crashes') => {
    if (!history) return;
    setBusy(true); setFailed(false);
    try {
      await recordSetupTest(history.current.reviewToken, result, note);
      setNote(''); setHistory(await getSetupTestHistory());
    } catch { setHistory(null); setFailed(true); }
    finally { setBusy(false); }
  };
  return <section className="space-y-3 rounded-sm border border-border bg-bg-secondary p-4">
    <SectionHeader>{t('setupTests.title')}</SectionHeader>
    <p className="text-sm text-text-secondary">{t('setupTests.description')}</p>
    <Button variant="secondary" disabled={busy} isLoading={busy} onClick={refresh}>{t('setupTests.review')}</Button>
    {failed && <p role="alert" className="text-sm text-state-danger">{t('setupTests.failed')}</p>}
    {history && <>
      <p className="text-xs text-text-secondary">{t('setupTests.identity', { build: history.current.baseFingerprint.slice(0, 12), count: history.current.modCount, managed: history.current.managedFileCount ?? 0 })}</p>
      <label htmlFor="setup-test-note" className="block text-sm text-text-secondary">{t('setupTests.note')}</label>
      <Textarea id="setup-test-note" rows={2} maxLength={300} value={note} disabled={busy} onChange={event => setNote(event.target.value)} />
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" disabled={busy} onClick={() => void record('works')}>{t('setupTests.works')}</Button>
        <Button variant="secondary" disabled={busy} onClick={() => void record('crashes')}>{t('setupTests.crashes')}</Button>
      </div>
      {!history.records.length && <p className="text-sm text-text-secondary">{t('setupTests.empty')}</p>}
      <ul className="divide-y divide-border" aria-live="polite">
        {history.records.map(record => <li key={record.id} className="space-y-1 py-3 text-sm">
          <p>{t(`setupTests.result.${record.result}`)} · {new Date(record.testedAt).toLocaleString()}</p>
          <p className="text-xs text-text-secondary">{t(record.current ? 'setupTests.current' : record.sameBuild ? 'setupTests.setupChanged' : 'setupTests.buildChanged')}</p>
          {record.note && <p className="break-words text-text-secondary">{record.note}</p>}
        </li>)}
      </ul>
    </>}
  </section>;
}
