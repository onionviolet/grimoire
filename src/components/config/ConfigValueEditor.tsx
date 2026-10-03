import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { Badge, Button, Card } from '../common/ui';
import { Input, Select } from '../common/forms';
import type { ConfigKeyDefinition, PerformanceConvarState } from '../../types/electron';

interface Props {
  definition: ConfigKeyDefinition;
  state?: PerformanceConvarState;
  draft?: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onUndo: () => void;
}

export default function ConfigValueEditor({ definition, state, draft, disabled, onChange, onUndo }: Props) {
  const { t } = useTranslation();
  const value = draft ?? state?.value ?? '';
  const options = definition.allowedValues ?? (definition.type === 'boolean' ? ['true', 'false', '1', '0'] : null);
  const baseline = state?.presetValue ?? state?.gameDefault ?? state?.engineDefault;
  const controlId = `config-${definition.key}`;
  return <Card className="p-4 space-y-3">
    <div className="flex flex-wrap gap-2 items-center">
      <label htmlFor={controlId} className="font-medium text-text-primary">{definition.key.replace(/[_.]+/g, ' ')}</label>
      <Badge>{definition.file}</Badge>
      {state && <Badge>{t(`config.origins.${state.origin}`)}</Badge>}
      {draft !== undefined && <Badge>{t('config.staged')}</Badge>}
    </div>
    <code className="block text-xs text-text-tertiary break-all">{definition.key}</code>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
      <div><span className="text-text-tertiary">{t('config.resolved')}</span><strong className="block text-text-primary break-all">{state?.resolvedValue ?? t('config.unknown')}</strong><span className="text-xs text-text-tertiary">{state?.resolvedFrom}</span></div>
      <div><span className="text-text-tertiary">{t('config.stock')}</span><strong className="block text-text-primary break-all">{state?.gameDefault ?? state?.engineDefault ?? t('config.unknown')}</strong></div>
      <div><span className="text-text-tertiary">{t('config.presetValue')}</span><strong className="block text-text-primary break-all">{state?.presetValue ?? t('config.notSet')}</strong></div>
    </div>
    <div className="flex flex-wrap gap-2 items-center">
      <div className="flex-1 min-w-48">
        {options ? <Select id={controlId} value={value} disabled={disabled} onChange={event => onChange(event.target.value)}>
          <option value="" disabled>{t('config.notSet')}</option>
          {!options.includes(value) && value && <option value={value}>{value}</option>}
          {options.map(option => <option key={option} value={option}>{option}</option>)}
        </Select> : <Input id={controlId} value={value} disabled={disabled} type={definition.type === 'numeric' ? 'number' : 'text'}
          min={definition.min} max={definition.max} step={definition.step} maxLength={512} onChange={event => onChange(event.target.value)} />}
      </div>
      <Button variant="ghost" size="sm" disabled={disabled || baseline == null} onClick={() => baseline != null && onChange(baseline)}>{t('config.useBaseline')}</Button>
      {draft !== undefined && <Button variant="ghost" size="sm" disabled={disabled} onClick={onUndo}>{t('common.actions.cancel')}</Button>}
    </div>
    {state?.autoexec && <div className="flex gap-2 text-sm text-state-warning"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{t('config.conflictDetail', { value: state.autoexec.value, line: state.autoexec.line })}</div>}
  </Card>;
}
