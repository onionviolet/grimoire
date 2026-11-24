import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../common/ui';
import { Input } from '../common/forms';
import type { VoiceLine } from '../../types/foundry';
import { serializeSoundStagedEdit, type FoundryStagedSoundEdit } from './soundStagedEdit';
import { AUDIO_EXTENSION, matchVoiceBatch } from './voiceBatchMatches';

const MAX_FILES = 128;
export default function VoiceBatchStaging({ hero, heroName, lines, onStage }: {
  hero: string;
  heroName: string;
  lines: VoiceLine[];
  onStage: (edit: FoundryStagedSoundEdit) => void;
}) {
  const { t } = useTranslation();
  const [files, setFiles] = useState<File[]>([]);
  const [name, setName] = useState('');
  const [issue, setIssue] = useState<'limit' | 'empty' | 'path'>();
  const [staged, setStaged] = useState(false);
  const [audition, setAudition] = useState<{ name: string; url: string }>();
  const rows = useMemo(() => matchVoiceBatch(files, lines), [files, lines]);
  const matched = rows.filter(row => row.target !== null);

  useEffect(() => {
    return () => { if (audition) URL.revokeObjectURL(audition.url); };
  }, [audition]);

  const chooseFolder = (selection: FileList | null) => {
    if (!selection?.length) return;
    setAudition(undefined);
    setStaged(false);
    const audio = Array.from(selection).filter(file => AUDIO_EXTENSION.test(file.name));
    setIssue(audio.length > MAX_FILES ? 'limit' : !audio.length ? 'empty' : undefined);
    setFiles(audio.length <= MAX_FILES ? audio : []);
  };

  const stage = () => {
    const assignments = matched.map(({ file, target }) => ({
      clipPath: target!,
      audioPath: window.electronAPI.getDroppedFilePath(file),
    }));
    if (assignments.some(assignment => !assignment.audioPath)) {
      setIssue('path');
      return;
    }
    const title = name.trim() || t('foundry.sound.voiceBatch.defaultName', { hero: heroName });
    onStage(serializeSoundStagedEdit({
      id: `voice-batch:${hero}:${assignments.map(assignment => assignment.clipPath).sort().join(',')}`,
      title,
      precedence: 0,
      request: { heroCodename: hero, heroName, name: title, audioPath: assignments[0].audioPath, assignments },
    }));
    setIssue(undefined);
    setStaged(true);
  };

  return <details className="space-y-3 rounded-sm border border-border bg-bg-secondary p-3">
    <summary className="cursor-pointer text-sm font-medium text-text-primary">{t('foundry.sound.voiceBatch.title')}</summary>
    <p className="text-sm text-text-secondary">{t('foundry.sound.voiceBatch.instructions', { max: MAX_FILES })}</p>
    <Input type="file" aria-label={t('foundry.sound.voiceBatch.choose')} {...{ webkitdirectory: '' }}
      onChange={event => { chooseFolder(event.currentTarget.files); event.currentTarget.value = ''; }} />
    {issue && <p role="alert" className="text-sm text-state-warning">{issue === 'limit'
      ? t('foundry.sound.voiceBatch.limit', { max: MAX_FILES }) : issue === 'empty'
        ? t('foundry.sound.voiceBatch.empty') : t('foundry.sound.voiceBatch.path')}</p>}
    {!!rows.length && <>
      <p className="text-sm text-text-secondary">{t('foundry.sound.voiceBatch.summary', { matched: matched.length, total: rows.length })}</p>
      <ul className="max-h-64 space-y-2 overflow-auto">
        {rows.map(({ file, target, candidates }, index) => <li className="text-sm" key={file.webkitRelativePath || `${file.name}:${index}`}>
          <div className="flex items-center gap-2">
            <span className="min-w-0 flex-1 break-all">{file.webkitRelativePath || file.name}</span>
            {target && <Button variant="ghost" size="sm" onClick={() => setAudition({ name: file.name, url: URL.createObjectURL(file) })}>{t('foundry.sound.voiceBatch.audition')}</Button>}
          </div>
          {target ? <code className="block break-all text-xs text-text-secondary">{target}</code>
            : <p className="text-xs text-state-warning">{candidates.length
              ? t('foundry.sound.voiceBatch.ambiguous') : t('foundry.sound.voiceBatch.unmatched')}</p>}
        </li>)}
      </ul>
      {audition && <div className="space-y-1">
        <p className="break-all text-sm text-text-secondary">{audition.name}</p>
        <audio key={audition.url} className="w-full" src={audition.url} controls autoPlay aria-label={t('foundry.sound.voiceBatch.audition')} />
      </div>}
      <Input value={name} onChange={event => { setName(event.target.value); setStaged(false); }}
        aria-label={t('foundry.sound.swap.namePlaceholder')}
        placeholder={t('foundry.sound.voiceBatch.defaultName', { hero: heroName })} />
      <Button variant="secondary" disabled={!matched.length || staged} onClick={stage}>{t('foundry.sound.voiceBatch.stage')}</Button>
      {staged && <p role="status" className="text-sm text-text-secondary">{t('foundry.sound.voiceBatch.staged')}</p>}
    </>}
  </details>;
}
