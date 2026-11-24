import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { updateProfileNotes } from '../../lib/api';
import { Textarea } from '../common/forms';
import { Button } from '../common/ui';

interface Props {
  profileId: string;
  notes?: string;
  onSave: (notes?: string) => void;
  onError: (error: string) => void;
}

export default function ProfileNotes({ profileId, notes, onSave, onError }: Props) {
  const { t } = useTranslation();
  const inputId = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (draft === null || saving) return;
    setSaving(true);
    try {
      const saved = await updateProfileNotes(profileId, draft);
      onSave(saved.notes);
      setDraft(null);
    } catch (error) {
      onError(String(error));
    } finally {
      setSaving(false);
    }
  };

  if (draft !== null) {
    return (
      <div className="space-y-2">
        <label htmlFor={inputId} className="text-xs text-text-secondary">{t('profiles.notes.label')}</label>
        <Textarea id={inputId} rows={3} value={draft} maxLength={2000} disabled={saving}
          onChange={(event) => setDraft(event.target.value)} />
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" disabled={saving} onClick={() => setDraft(null)}>
            {t('common.actions.cancel')}
          </Button>
          <Button size="sm" variant="secondary" isLoading={saving} onClick={() => void save()}>
            {t('common.actions.save')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {notes && <p className="whitespace-pre-wrap break-words text-sm text-text-secondary">{notes}</p>}
      <Button size="sm" variant="ghost" onClick={() => setDraft(notes ?? '')}>
        {notes ? t('profiles.notes.edit') : t('profiles.notes.add')}
      </Button>
    </div>
  );
}
