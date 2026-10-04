import { Suspense, useEffect, useMemo, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Bounds, OrbitControls } from '@react-three/drei';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { useOwnedGltf } from './useOwnedGltf';
import * as THREE from 'three';
import { useTranslation } from 'react-i18next';
import { getHeroAbilityPreviews, prepareHeroAbilityPreview } from '../../lib/api';
import type { HeroAbilityPlayback, HeroAbilityPreview, HeroAbilityPreviewOptions } from '../../types/abilityPreview';
import { Button, ModalHeader } from '../common/ui';
import { Select } from '../common/forms';
import { Modal, ModalBody } from '../common/Modal';
import { LoadingState } from '../common/PageComponents';
import { ErrorBoundary } from '../common/ErrorBoundary';
import RecolorTexturePreview from './RecolorTexturePreview';
function Playback({ playback }: { playback: HeroAbilityPlayback }) {
  const gltf = useOwnedGltf(playback.modelUrl!);
  return gltf ? <LoadedPlayback playback={playback} gltf={gltf} /> : null;
}
function LoadedPlayback({ playback, gltf }: { playback: HeroAbilityPlayback; gltf: GLTF }) {
  const scene = gltf.scene;
  const mixer = useMemo(() => new THREE.AnimationMixer(scene), [scene]);
  const { t } = useTranslation();
  useEffect(() => {
    const clip = gltf.animations.find(clip => clip.name === playback.ability.clip);
    if (!clip) throw new Error(t('locker.abilityPreview.missingClip'));
    const action = mixer.clipAction(clip);
    action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; action.reset().play();
    const audio = playback.soundUrl ? new Audio(playback.soundUrl) : null;
    // This starts with decoded animation readiness; it is an approximate
    // audition, not a Source 2 event-timed cast or applied sound-override preview.
    if (audio && playback.soundParams) {
      audio.preservesPitch = false;
      audio.playbackRate = playback.soundParams.pitch ?? 1;
      audio.volume = Math.min(1, Math.pow(10, (playback.soundParams.volumeDb ?? 0) / 20));
    }
    if (audio) void audio.play().catch(() => { /* Native audio controls remain available. */ });
    return () => { audio?.pause(); mixer.stopAllAction(); mixer.uncacheRoot(scene); };
  }, [gltf.animations, mixer, playback, scene, t]);
  useFrame((_, delta) => mixer.update(Math.min(delta, 0.1)));
  return <primitive object={scene} />;
}
export default function AbilityPreview({ heroName, skinSources, fallbackSkinMetaKey }: { heroName: string } & HeroAbilityPreviewOptions) {
  const { t } = useTranslation();
  const sourceKey = JSON.stringify({ skinSources, fallbackSkinMetaKey });
  const [open, setOpen] = useState(false);
  const [abilities, setAbilities] = useState<HeroAbilityPreview[] | null>(null);
  const [selected, setSelected] = useState<number>(1);
  const [playback, setPlayback] = useState<HeroAbilityPlayback | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [request, setRequest] = useState(0);
  useEffect(() => {
    if (!open) return;
    let active = true;
    getHeroAbilityPreviews(heroName).then(items => { if (active) setAbilities(items); })
      .catch(error => { if (active) setError(String(error)); });
    return () => { active = false; };
  }, [heroName, open]);
  useEffect(() => {
    if (!open || !request) return;
    let active = true;
    prepareHeroAbilityPreview(heroName, selected as 1 | 2 | 3 | 4, JSON.parse(sourceKey) as HeroAbilityPreviewOptions).then(result => {
      if (active) { setPlayback(result); setGeneration(value => value + 1); setPreparing(false); }
    }).catch(error => { if (active) { setError(String(error)); setPreparing(false); } });
    return () => { active = false; };
  }, [heroName, open, request, selected, sourceKey]);
  const ability = abilities?.find(ability => ability.slot === selected);
  const close = () => { setOpen(false); setPlayback(null); setRequest(0); setPreparing(false); };
  return <>
    <Button size="sm" variant="secondary" onClick={() => { setOpen(true); setError(null); }}>{t('locker.abilityPreview.open')}</Button>
    <Modal open={open} onClose={close} size="xl" labelledBy="ability-preview-title">
      <ModalHeader titleId="ability-preview-title" title={t('locker.abilityPreview.title', { hero: heroName })} onClose={close} />
      <ModalBody>
        <p className="text-sm text-text-secondary">{t('locker.abilityPreview.hint')}</p>
        {error && <p role="alert" className="my-3 break-all text-sm text-state-danger">{error}</p>}
        {!abilities && !error ? <LoadingState label={t('locker.abilityPreview.loading')} /> : abilities && <div className="my-3 flex flex-wrap gap-3">
          <Select aria-label={t('locker.abilityPreview.select')} className="max-w-80" value={selected} onChange={event => { setSelected(Number(event.target.value)); setPlayback(null); setRequest(0); setPreparing(false); setError(null); }}>
            {abilities.map(ability => <option key={ability.slot} value={ability.slot}>{ability.slot}: {ability.label}</option>)}
          </Select>
          <Button size="sm" variant="secondary" disabled={!ability?.clip || preparing} isLoading={preparing} onClick={() => { setPlayback(null); setError(null); setPreparing(true); setRequest(value => value + 1); }}>{t('locker.abilityPreview.play')}</Button>
          <Button size="sm" variant="ghost" disabled={!playback} onClick={() => { setPlayback(null); setRequest(0); }}>{t('locker.abilityPreview.stop')}</Button>
        </div>}
        {ability && <div className="mb-3 space-y-1 text-xs text-text-secondary">
          <p>{ability.clip ? t('locker.abilityPreview.clip', { clip: ability.clip }) : t('locker.abilityPreview.noClip')}</p>
          <p>{ability.soundPath ? t('locker.abilityPreview.sound', { path: ability.soundPath }) : t('locker.abilityPreview.noSound')}</p>
          <p>{t('locker.abilityPreview.noEffectJoin')}</p>
        </div>}
        {abilities?.length === 0 && <p className="text-sm text-text-secondary">{t('locker.abilityPreview.noAbilities')}</p>}
        {playback?.modelUrl && <>
          <p className="mb-2 text-xs text-text-secondary">{playback.skinApplied ? t('locker.abilityPreview.appliedSkin') : t('locker.abilityPreview.baseSkin')}</p>
          {playback.skinFallback && <p className="mb-2 text-xs text-state-warning">{t('locker.abilityPreview.skinFallback')}</p>}
          <p className="mb-2 text-xs text-text-secondary">{playback.soundSource === 'applied' ? t('locker.abilityPreview.appliedSound') : playback.soundSource === 'base' ? t('locker.abilityPreview.baseSound') : t('locker.abilityPreview.noSound')}</p>
          {playback.soundParams && <p className="mb-2 text-xs text-text-secondary">{t('locker.abilityPreview.tuningHint')}</p>}
          <div className="h-96 overflow-hidden rounded-sm bg-bg-sunken"><ErrorBoundary key={generation} fallback={<p>{t('locker.abilityPreview.failed')}</p>}>
            <Canvas camera={{ position: [4, 3, 5], fov: 45 }} dpr={[1, 1.5]}>
              <ambientLight intensity={1} /><directionalLight position={[3, 5, 4]} intensity={2} />
              <Suspense fallback={null}><Bounds fit clip margin={1.3}><Playback playback={playback} /></Bounds></Suspense><OrbitControls makeDefault />
            </Canvas>
          </ErrorBoundary></div>
          {playback.soundUrl && <audio controls src={playback.soundUrl} aria-label={t('locker.abilityPreview.audio')} className="mt-3 w-full" />}
        </>}
        {open && <RecolorTexturePreview heroName={heroName} />}
      </ModalBody>
    </Modal>
  </>;
}
