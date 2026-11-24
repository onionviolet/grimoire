import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../common/ui';
import { Select } from '../common/forms';
import type { FoundryForgeRequest, FoundrySoundInstallReview } from '../../types/foundry';
import { foundryVoiceclip, foundryAuditionSourceClip } from '../../lib/api';

async function measure(audio: string) {
  const context = new AudioContext();
  try {
    const buffer = await context.decodeAudioData(await (await fetch(audio)).arrayBuffer());
    let peak = 0;
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      for (const sample of buffer.getChannelData(channel)) peak = Math.max(peak, Math.abs(sample));
    }
    return { duration: Math.round(buffer.duration * 1000), peak: peak ? (20 * Math.log10(peak)).toFixed(1) : '−∞' };
  } finally {
    await context.close();
  }
}

export default function SoundBuildReview({ request, review }: { request: FoundryForgeRequest; review: FoundrySoundInstallReview | null }) {
  const { t } = useTranslation();
  const paths = request.confirmation.writeSet.filter((path) => path.endsWith('.vsnd_c'));
  const [selected, setSelected] = useState(paths[0] ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [audio, setAudio] = useState<{ url: string; label: string; details?: string }>();
  const provider = review?.entries.find(({ path }) => path === selected);
  const shared = review?.sharedEvents.find(({ path }) => path === selected);
  const audition = async (mode: 'baked' | 'stock' | 'installed') => {
    setAudio(undefined);
    setError('');
    setBusy(true);
    try {
      if (mode === 'baked') {
        const result = await window.electronAPI.foundry.auditionBuildSound(request, selected);
        const metrics = await measure(result.audio).catch(() => null);
        const loop = result.looping === null ? t('foundry.buildTray.soundReview.loopUnknown')
          : result.looping ? t('foundry.buildTray.soundReview.looping') : t('foundry.buildTray.soundReview.oneShot');
        setAudio({
          url: result.audio,
          label: t('foundry.buildTray.soundReview.baked'),
          details: metrics ? t('foundry.buildTray.soundReview.measurement', { ...metrics, loop }) : loop,
        });
      } else {
        const url = mode === 'installed' && provider?.currentModId
          ? await foundryAuditionSourceClip(provider.currentModId, selected)
          : await foundryVoiceclip(selected);
        if (!url) throw new Error(t('foundry.buildTray.soundReview.previewUnavailable'));
        setAudio({ url, label: mode === 'installed' ? t('foundry.buildTray.soundReview.installed') : t('foundry.buildTray.soundReview.stock') });
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  if (!paths.length) return null;
  return (
    <section className="mb-4 space-y-2 rounded-sm border border-border p-3 text-sm text-text-secondary">
      <h3 className="font-semibold text-text-primary">{t('foundry.buildTray.soundReview.title')}</h3>
      <label className="block text-xs">
        {t('foundry.buildTray.soundReview.clip')}
        <Select value={selected} disabled={busy} onChange={(event) => { setSelected(event.target.value); setAudio(undefined); setError(''); }}>
          {paths.map((path) => <option key={path} value={path}>{path}</option>)}
        </Select>
      </label>
      {provider && <>
        <p>{t('foundry.buildTray.soundReview.winner', { name: provider.winner ?? request.name })}</p>
        {provider.contenders.length > 0 && <ul className="list-disc pl-5 text-xs">
          {provider.contenders.map(({ name, enabled }, index) => <li key={`${name}:${index}`}>
            {t('foundry.buildTray.soundReview.contender', { name, state: enabled ? t('foundry.buildTray.soundReview.enabled') : t('foundry.buildTray.soundReview.disabled') })}
          </li>)}
        </ul>}
      </>}
      {shared && <p className="break-words text-state-warning">{t('foundry.buildTray.soundReview.shared', { names: shared.events.join(', ') })}</p>}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => void audition('baked')}>{t('foundry.buildTray.soundReview.baked')}</Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => void audition('stock')}>{t('foundry.buildTray.soundReview.stock')}</Button>
        {provider?.currentModId && <Button size="sm" variant="ghost" disabled={busy} onClick={() => void audition('installed')}>{t('foundry.buildTray.soundReview.installed')}</Button>}
      </div>
      {busy && <p role="status">{t('foundry.buildTray.soundReview.loading')}</p>}
      {error && <p role="alert" className="break-words text-state-danger">{error}</p>}
      {audio && <div>
        <audio key={audio.url} className="w-full" src={audio.url} controls autoPlay aria-label={audio.label} />
        {audio.details && <p className="tabular-nums">{audio.details}</p>}
      </div>}
    </section>
  );
}
