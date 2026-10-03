import { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useTranslation } from 'react-i18next';
import { ParticleEffect } from '../locker/ParticleEffect';
import { unsupportedParticleClasses, type FxDescriptor } from '../locker/fxDescriptor';
import { Button } from '../common/ui';
import { ErrorBoundary } from '../common/ErrorBoundary';
export default function ParticleAssetPreview({ descriptor, textureBaseUrl }: { descriptor: FxDescriptor; textureBaseUrl: string }) {
  const { t } = useTranslation();
  const [playing, setPlaying] = useState(false);
  const unsupported = unsupportedParticleClasses(descriptor);
  return <div className="space-y-2">
    {unsupported.length > 0 && <p role="status" className="break-all text-xs text-state-warning">{t('foundry.assets.unsupportedClasses', { classes: unsupported.join(', ') })}</p>}
    <Button variant="secondary" size="sm" onClick={() => setPlaying(value => !value)}>{playing ? t('locker.abilityPreview.stop') : t('foundry.assets.playSprites')}</Button>
    {playing && <div className="h-80 overflow-hidden rounded-sm bg-bg-sunken"><ErrorBoundary fallback={<p>{t('foundry.assets.previewFailed')}</p>}>
      <Canvas camera={{ position: [0, 60, 160], fov: 45 }} dpr={[1, 1.5]}><ParticleEffect descriptor={descriptor} textureBaseUrl={textureBaseUrl} /><OrbitControls /></Canvas>
    </ErrorBoundary></div>}
  </div>;
}
