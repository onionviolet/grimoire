import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CHAT_WHEEL_FIRST_MENU_ID, CHAT_WHEEL_RESOURCE } from '../../lib/chatWheelAddon';
import type { ChatWheelInspection } from '../../types/chatWheelPlatform';
import { Button } from '../common/ui';

export default function ChatWheelInspector() {
  const { t } = useTranslation();
  const [inspection, setInspection] = useState<ChatWheelInspection | null>();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const inspect = async () => {
    setBusy(true);
    setFailed(false);
    try {
      setInspection(await window.electronAPI.chatWheelInspect());
    } catch {
      setInspection(undefined);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const firstMounted = inspection?.providers.find(provider => provider.order !== null)?.id;
  return <details className="space-y-3 rounded-sm border border-border bg-bg-secondary p-4">
    <summary className="cursor-pointer text-sm font-medium text-text-primary">{t('chatWheel.inspector.title')}</summary>
    <code className="block break-all text-xs text-text-secondary">{CHAT_WHEEL_RESOURCE}</code>
    <Button size="sm" variant="secondary" isLoading={busy} onClick={() => void inspect()}>{t('chatWheel.inspector.scan')}</Button>
    {failed && <p role="alert" className="text-sm text-state-danger">{t('chatWheel.inspector.failed')}</p>}
    {inspection === null && <p className="text-sm text-text-secondary">{t('chatWheel.inspector.noGame')}</p>}
    {inspection && <>
      {!inspection.mountOrderKnown && <p className="text-sm text-state-warning">{t('chatWheel.inspector.unknownMounts')}</p>}
      {!inspection.providers.length && <p className="text-sm text-text-secondary">{t('chatWheel.inspector.noProvider')}</p>}
      <ul className="space-y-2 text-sm">
        {inspection.providers.map(provider => <li key={provider.id}>
          <p className="break-words font-medium">{provider.name}</p>
          <code className="break-all text-xs text-text-secondary">{provider.mount}</code>
          <p className="text-text-secondary">{!provider.enabled ? t('chatWheel.inspector.disabled')
            : provider.id === firstMounted ? t('chatWheel.inspector.firstMounted')
            : provider.order !== null ? t('chatWheel.inspector.mounted') : t('chatWheel.inspector.mountUnconfirmed')}</p>
          {provider.menus === null ? <p className="text-xs text-text-secondary">{t('chatWheel.inspector.noYaml')}</p>
            : provider.menus.map((menu, index) => <p key={index} className="break-words text-xs text-text-secondary">
              {t('chatWheel.inspector.menu', { id: CHAT_WHEEL_FIRST_MENU_ID + index, menu })}
            </p>)}
        </li>)}
      </ul>
      <p className="text-sm text-text-secondary">{t('chatWheel.inspector.recovery')}</p>
      <details className="text-sm text-text-secondary">
        <summary className="cursor-pointer">{t('chatWheel.inspector.consoleTitle')}</summary>
        <p className="mt-2">{t('chatWheel.inspector.consoleInstructions')}</p>
        <ul className="mt-2 space-y-1">
          {Array.from({ length: 8 }, (_, index) => <li key={index}><code>{`ping_wheel_phrase_${index} 1`}</code></li>)}
        </ul>
      </details>
    </>}
  </details>;
}
