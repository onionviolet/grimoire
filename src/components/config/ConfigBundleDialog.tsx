import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../common/Modal';
import { Button, ModalHeader } from '../common/ui';
import { Textarea } from '../common/forms';
import { exportConfigBundle, parseConfigBundle } from '../../lib/api';
import type { ConfigBundle } from '../../types/configWorkspace';

export default function ConfigBundleDialog({ onClose, onStage }: { onClose: () => void; onStage: (bundle: ConfigBundle) => void }) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setError(null); setCopied(false);
    try { await action(); } catch (failure) { setError(String(failure)); } finally { setBusy(false); }
  };
  return <Modal onClose={onClose} labelledBy="config-bundle-title" size="lg" dismissable={!busy}>
    <ModalHeader title={t('config.bundle.title')} titleId="config-bundle-title" onClose={onClose} />
    <div className="p-4 space-y-4">
      <p className="text-sm text-text-secondary">{t('config.bundle.scope')}</p>
      <label htmlFor="config-bundle-text" className="block text-sm text-text-secondary">{t('config.bundle.text')}</label>
      <Textarea id="config-bundle-text" rows={14} className="font-mono text-xs" value={text} disabled={busy} onChange={event => { setText(event.target.value); setCopied(false); setError(null); }} />
      {error && <p role="alert" className="text-sm text-state-danger">{t('config.bundle.failed', { error })}</p>}
      {copied && <p role="status" className="text-sm text-text-secondary">{t('config.bundle.copied')}</p>}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" disabled={busy} onClick={() => void run(async () => setText(JSON.stringify(await exportConfigBundle(), null, 2)))}>{t('config.bundle.export')}</Button>
        <Button variant="secondary" disabled={busy || !text.trim()} onClick={() => void run(async () => { await navigator.clipboard.writeText(text); setCopied(true); })}>{t('common.actions.copy')}</Button>
        <Button disabled={busy || !text.trim()} onClick={() => void run(async () => { onStage(await parseConfigBundle(text)); onClose(); })}>{t('config.bundle.stage')}</Button>
      </div>
    </div>
  </Modal>;
}
