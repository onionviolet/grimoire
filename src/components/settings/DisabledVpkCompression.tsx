import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DisabledCompressionResult, DisabledCompressionStatus } from '../../types/disabledCompression';
import { Button } from '../common/ui';

type Operation = 'compress' | 'expand';

export default function DisabledVpkCompression({ gamePath }: { gamePath?: string }) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<DisabledCompressionStatus | null>(null);
  const [result, setResult] = useState<DisabledCompressionResult | null>(null);
  const [operation, setOperation] = useState<Operation | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!gamePath) return;
    let active = true;
    window.electronAPI.disabledCompression.inspect().then(
      value => { if (active) setStatus(value); },
      reason => { if (active) setError(String(reason)); },
    );
    return () => { active = false; };
  }, [gamePath]);

  const apply = async (mode: Operation) => {
    if (!status?.supported || operation) return;
    setOperation(mode);
    setResult(null);
    setError('');
    try {
      setResult(await window.electronAPI.disabledCompression.apply(mode));
    } catch (reason) {
      setError(String(reason));
    } finally {
      setOperation(null);
    }
  };

  return (
    <div className="space-y-2" id="settings-disabled-vpk-compression">
      <p className="text-sm text-text-primary">{t('settings.vpkCompression.title')}</p>
      <p className="text-xs text-text-secondary">{t('settings.vpkCompression.description')}</p>
      {status && !status.supported && <p className="text-xs text-text-secondary">{t('settings.vpkCompression.unavailable')}</p>}
      {status?.supported && (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" disabled={operation !== null || !status.fileCount} isLoading={operation === 'compress'}
            onClick={() => void apply('compress')}>{t('settings.vpkCompression.compress')}</Button>
          <Button size="sm" variant="secondary" disabled={operation !== null || !status.fileCount} isLoading={operation === 'expand'}
            onClick={() => void apply('expand')}>{t('settings.vpkCompression.expand')}</Button>
          <span className="text-xs text-text-secondary">{t('settings.vpkCompression.files', { count: status.fileCount })}</span>
        </div>
      )}
      {result && <p role="status" className="text-xs text-text-secondary">{t('settings.vpkCompression.result', {
        processed: result.processedFiles, skipped: result.skippedFiles, failed: result.failedFiles,
      })}</p>}
      {error && <p role="alert" className="break-words text-xs text-state-danger">{error}</p>}
    </div>
  );
}
