import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getActiveHeroColor, previewHeroColor } from '../../lib/api';
import { Button } from '../common/ui';
import { Input } from '../common/forms';
/** A genuine decode of the engine recipe's representative texture. Editing
 * these preview controls never bakes, applies or replaces a mod. */
export default function RecolorTexturePreview({ heroName }: { heroName: string }) {
  const { t } = useTranslation();
  const [ready, setReady] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [hue, setHue] = useState(0);
  const [saturation, setSaturation] = useState(1);
  const [brightness, setBrightness] = useState(1);
  const [image, setImage] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let active = true;
    getActiveHeroColor(heroName).then(color => {
      if (!active) return;
      if (color && (!color.mode || color.mode === 'hue')) {
        setHue(color.hue); setSaturation(color.saturation); setBrightness(color.brightness);
      }
      setReady(true);
    }).catch(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, [heroName]);
  useEffect(() => {
    if (!enabled || !ready) return;
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true); setMessage(null); setImage(null);
      previewHeroColor(heroName, hue, saturation, brightness).then(url => {
        if (active) { setImage(url); if (!url) setMessage(t('locker.abilityPreview.noTexture')); }
      }).catch(error => { if (active) setMessage(String(error)); }).finally(() => { if (active) setLoading(false); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [brightness, enabled, heroName, hue, ready, saturation, t]);
  return <div className="mt-4 space-y-3 rounded-sm border border-border p-3">
    <Button variant="secondary" size="sm" onClick={() => setEnabled(value => !value)} disabled={!ready}>{enabled ? t('locker.abilityPreview.hideTexture') : t('locker.abilityPreview.showTexture')}</Button>
    {enabled && <>
      <p className="text-xs text-text-secondary">{t('locker.abilityPreview.textureHint')}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="text-xs text-text-secondary">{t('locker.abilityPreview.hue', { value: hue })}<Input type="range" min={0} max={359} value={hue} onChange={event => setHue(Number(event.target.value))} /></label>
        <label className="text-xs text-text-secondary">{t('locker.abilityPreview.saturation', { value: saturation })}<Input type="range" min={0} max={3} step={0.05} value={saturation} onChange={event => setSaturation(Number(event.target.value))} /></label>
        <label className="text-xs text-text-secondary">{t('locker.abilityPreview.brightness', { value: brightness })}<Input type="range" min={0.1} max={3} step={0.05} value={brightness} onChange={event => setBrightness(Number(event.target.value))} /></label>
      </div>
      {loading && <p role="status" className="text-xs text-text-secondary">{t('locker.abilityPreview.textureLoading')}</p>}
      {message && <p role="status" className="break-all text-xs text-state-warning">{message}</p>}
      {image && <img src={image} alt={t('locker.abilityPreview.textureAlt')} className="mx-auto max-h-64 max-w-full object-contain" />}
    </>}
  </div>;
}
