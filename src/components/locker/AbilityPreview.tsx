import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { useOwnedGltf } from './useOwnedGltf';
import { useTranslation } from 'react-i18next';
import { getHeroAbilityPreviews, prepareHeroAbilityPreview } from '../../lib/api';
import type { HeroAbilityPlayback, HeroAbilityPreview, HeroAbilityPreviewOptions } from '../../types/abilityPreview';
import { Button, ModalHeader } from '../common/ui';
import { FormField, Input, Select } from '../common/forms';
import { Modal, ModalBody } from '../common/Modal';
import { LoadingState } from '../common/PageComponents';
import { ErrorBoundary } from '../common/ErrorBoundary';
import RecolorTexturePreview from './RecolorTexturePreview';
import { AbilityPlaybackController, type AbilityPlaybackSnapshot } from './abilityPlaybackController';
import { HeroPreviewAppearance, HeroPreviewLighting } from './HeroPreviewScene';
import { HERO_PREVIEW_CAMERA, HERO_PREVIEW_GL, normalizeHeroPreview } from './heroPreviewSceneSetup';
import { AbilityEventDetails } from './AbilityEventDetails';

interface PlaybackProps {
  playback: HeroAbilityPlayback;
  onController: (controller: AbilityPlaybackController) => void;
  onSnapshot: (controller: AbilityPlaybackController, snapshot: AbilityPlaybackSnapshot) => void;
  onFailure: (key: 'missingClip' | 'audioFailed' | 'audioResumeFailed' | 'failed') => void;
}

function Playback(props: PlaybackProps) {
  const { playback } = props;
  const gltf = useOwnedGltf(playback.modelUrl!, { source2: true });
  return gltf ? <AbilityPlaybackScene {...props} gltf={gltf} /> : null;
}

function PlaybackFailure({ onFailure }: Pick<PlaybackProps, 'onFailure'>) {
  const { t } = useTranslation();
  useEffect(() => onFailure('failed'), [onFailure]);
  return <p className="p-4 text-sm text-state-danger">{t('locker.abilityPreview.failed')}</p>;
}

export function AbilityPlaybackScene({ playback, gltf, onController, onSnapshot, onFailure }: PlaybackProps & { gltf: GLTF }) {
  const scene = gltf.scene;
  const controllerRef = useRef<AbilityPlaybackController | null>(null);
  const normalization = useMemo(() => normalizeHeroPreview(scene, { bindPose: true }), [scene]);
  useEffect(() => {
    const clip = gltf.animations.find(clip => clip.name === playback.ability.clip);
    if (!clip) { onFailure('missingClip'); return; }
    let active = true;
    const controller = new AbilityPlaybackController({
      scene, clip, soundUrl: playback.soundUrl,
      pitch: playback.soundParams?.pitch, volumeDb: playback.soundParams?.volumeDb,
      onChange: snapshot => { if (active) onSnapshot(controller, snapshot); },
    });
    controllerRef.current = controller;
    onController(controller);
    void controller.prepare().then(async () => {
      if (!active) return;
      try { await controller.play(); }
      catch { if (active) onFailure('audioResumeFailed'); }
    }).catch(() => { controller.dispose(); if (active) onFailure('audioFailed'); });
    return () => { active = false; controller.dispose(); controllerRef.current = null; };
  }, [gltf.animations, scene, playback, onController, onSnapshot, onFailure]);
  useFrame(() => controllerRef.current?.update());
  return <>
    <group scale={normalization.scale}>
      <group position={[-normalization.center.x, -normalization.center.y, -normalization.center.z]}>
        <primitive object={scene} />
      </group>
    </group>
    <HeroPreviewAppearance scene={scene} />
  </>;
}
export default function AbilityPreview({ heroName, skinSources, fallbackSkinMetaKey }: { heroName: string } & HeroAbilityPreviewOptions) {
  const { t } = useTranslation();
  const [sourceMode, setSourceMode] = useState<'base' | 'applied'>('applied');
  const [selected, setSelected] = useState<number>(1);
  const [clipChoice, setClipChoice] = useState<{ hero: string; slot: number; name: string } | null>(null);
  const clipName = clipChoice?.hero === heroName && clipChoice.slot === selected ? clipChoice.name : '';
  const setClipName = (name: string) => setClipChoice(name ? { hero: heroName, slot: selected, name } : null);
  const sourceKey = JSON.stringify({ skinSources, fallbackSkinMetaKey, sourceMode, ...(clipName ? { clipName } : {}) });
  const [open, setOpen] = useState(false);
  const [abilityData, setAbilityData] = useState<{ hero: string; items: HeroAbilityPreview[] } | null>(null);
  const abilities = abilityData?.hero === heroName ? abilityData.items : null;
  const context = JSON.stringify([heroName, selected, sourceKey]);
  const [playbackData, setPlaybackData] = useState<{ context: string; result: HeroAbilityPlayback } | null>(null);
  const playback = playbackData?.context === context ? playbackData.result : null;
  const [error, setError] = useState<string | null>(null);
  const [preparingFor, setPreparingFor] = useState<string | null>(null);
  const preparing = preparingFor === context;
  const [generation, setGeneration] = useState(0);
  const [request, setRequest] = useState<{ context: string; id: number } | null>(null);
  const [runtimeData, setRuntimeData] = useState<{ playback: HeroAbilityPlayback; controller: AbilityPlaybackController; snapshot: AbilityPlaybackSnapshot } | null>(null);
  const runtime = runtimeData?.playback === playback ? runtimeData : null;
  const ready = runtime && runtime.snapshot.status !== 'loading' && runtime.snapshot.status !== 'disposed';
  const onController = useCallback((controller: AbilityPlaybackController) => {
    if (playback) setRuntimeData({ playback, controller, snapshot: controller.getSnapshot() });
  }, [playback]);
  const onSnapshot = useCallback((controller: AbilityPlaybackController, snapshot: AbilityPlaybackSnapshot) => {
    if (playback) setRuntimeData({ playback, controller, snapshot });
  }, [playback]);
  const onFailure = useCallback((key: 'missingClip' | 'audioFailed' | 'audioResumeFailed' | 'failed') => {
    const messages = {
      missingClip: t('locker.abilityPreview.missingClip'),
      audioFailed: t('locker.abilityPreview.audioFailed'),
      audioResumeFailed: t('locker.abilityPreview.audioResumeFailed'),
      failed: t('locker.abilityPreview.failed'),
    };
    setError(messages[key]);
    if (key !== 'audioResumeFailed') setRuntimeData(null);
  }, [t]);
  const playOrReplay = (replay = false) => {
    if (!ready || !runtime) return;
    setError(null);
    const controller = runtime.controller;
    void (replay ? controller.replay() : controller.play()).catch(() => {
      if (controller.getSnapshot().status !== 'disposed') onFailure('audioResumeFailed');
    });
  };
  useEffect(() => {
    if (!open) return;
    let active = true;
    getHeroAbilityPreviews(heroName).then(items => { if (active) setAbilityData({ hero: heroName, items }); })
      .catch(error => { if (active) setError(String(error)); });
    return () => { active = false; };
  }, [heroName, open]);
  useEffect(() => {
    if (!open || !request || request.context !== context) return;
    let active = true;
    prepareHeroAbilityPreview(heroName, selected as 1 | 2 | 3 | 4, JSON.parse(sourceKey) as HeroAbilityPreviewOptions).then(result => {
      if (active) { setPlaybackData({ context, result }); setGeneration(value => value + 1); setPreparingFor(null); }
    }).catch(error => { if (active) { setError(String(error)); setPreparingFor(null); } });
    return () => { active = false; };
  }, [heroName, open, request, selected, sourceKey, context]);
  const ability = abilities?.find(ability => ability.slot === selected);
  const close = () => { runtime?.controller.dispose(); setOpen(false); setPlaybackData(null); setRuntimeData(null); setRequest(null); setPreparingFor(null); };
  return <>
    <Button size="sm" variant="secondary" onClick={() => { setOpen(true); setError(null); }}>{t('locker.abilityPreview.open')}</Button>
    <Modal open={open} onClose={close} size="xl" labelledBy="ability-preview-title">
      <ModalHeader titleId="ability-preview-title" title={t('locker.abilityPreview.title', { hero: heroName })} onClose={close} />
      <ModalBody>
        <p className="text-sm text-text-secondary">{t('locker.abilityPreview.hint')}</p>
        {error && <p role="alert" className="my-3 break-all text-sm text-state-danger">{error}</p>}
        {!abilities && !error ? <LoadingState label={t('locker.abilityPreview.loading')} /> : abilities && <div className="my-3 flex flex-wrap gap-3">
          <Select aria-label={t('locker.abilityPreview.source')} value={sourceMode} disabled={preparing} className="max-w-64"
            onChange={event => { setSourceMode(event.target.value as 'base' | 'applied'); setPlaybackData(null); setRequest(null); setError(null); }}>
            <option value="applied">{t('locker.abilityPreview.sourceApplied')}</option>
            <option value="base">{t('locker.abilityPreview.sourceBase')}</option>
          </Select>
          <Select aria-label={t('locker.abilityPreview.select')} className="max-w-80" value={selected} onChange={event => { setSelected(Number(event.target.value)); setClipName(''); setPlaybackData(null); setRequest(null); setPreparingFor(null); setError(null); }}>
            {abilities.map(ability => <option key={ability.slot} value={ability.slot}>{ability.slot}: {ability.label}</option>)}
          </Select>
          {!!ability?.clipChoices?.length && <Select aria-label={t('locker.abilityPreview.clipSelect')} value={clipName} disabled={preparing} className="max-w-80"
            onChange={event => { setClipName(event.target.value); setPlaybackData(null); setRequest(null); setError(null); }}>
            <option value="">{t('locker.abilityPreview.clipAutomatic')}</option>
            {ability.clipChoices.map(name => <option key={name} value={name}>{name}</option>)}
          </Select>}
          <Button size="sm" variant="secondary" disabled={!(clipName || ability?.clip) || preparing} isLoading={preparing} onClick={() => { setPlaybackData(null); setError(null); setPreparingFor(context); setRequest(value => ({ context, id: (value?.id ?? 0) + 1 })); }}>{t('locker.abilityPreview.play')}</Button>
          <Button size="sm" variant="ghost" disabled={!ready} onClick={() => runtime?.controller.stop()}>{t('locker.abilityPreview.stop')}</Button>
          {playback && <>
            <Button size="sm" variant="secondary" disabled={!ready} onClick={() => {
              if (runtime?.snapshot.status === 'playing') runtime.controller.pause(); else playOrReplay();
            }}>{!runtime || runtime.snapshot.status === 'loading' || runtime.snapshot.status === 'playing' ? t('locker.abilityPreview.pause') : t('locker.abilityPreview.resume')}</Button>
            <Button size="sm" variant="ghost" disabled={!ready} onClick={() => playOrReplay(true)}>{t('locker.abilityPreview.replay')}</Button>
          </>}
        </div>}
        {ability && <div className="mb-3 space-y-1 text-xs text-text-secondary">
          <p>{clipName || ability.clip ? t('locker.abilityPreview.clip', { clip: clipName || ability.clip }) : t('locker.abilityPreview.noClip')}</p>
          {clipName && <p>{t('locker.abilityPreview.manualClip')}</p>}
          <p>{ability.soundPath ? t('locker.abilityPreview.sound', { path: ability.soundPath }) : t('locker.abilityPreview.noSound')}</p>
          <p>{t('locker.abilityPreview.noEffectJoin')}</p>
        </div>}
        {abilities?.length === 0 && <p className="text-sm text-text-secondary">{t('locker.abilityPreview.noAbilities')}</p>}
        {playback?.modelUrl && <>
          <p className="mb-2 text-xs text-text-secondary">{playback.skinApplied ? t('locker.abilityPreview.appliedSkin') : t('locker.abilityPreview.baseSkin')}</p>
          {playback.skinFallback && <p className="mb-2 text-xs text-state-warning">{t('locker.abilityPreview.skinFallback')}</p>}
          <p className="mb-2 text-xs text-text-secondary">{playback.soundSource === 'applied' ? t('locker.abilityPreview.appliedSound') : playback.soundSource === 'base' ? t('locker.abilityPreview.baseSound') : t('locker.abilityPreview.noSound')}</p>
          {playback.soundParams && <p className="mb-2 text-xs text-text-secondary">{t('locker.abilityPreview.tuningHint')}</p>}
          <AbilityEventDetails metadata={playback.clipEvents} />
          <div className="h-96 overflow-hidden rounded-sm bg-bg-sunken"><ErrorBoundary key={generation} fallback={<PlaybackFailure onFailure={onFailure} />}>
            <Canvas camera={HERO_PREVIEW_CAMERA} gl={HERO_PREVIEW_GL} dpr={[1, 1.5]}>
              <HeroPreviewLighting bloom />
              <Suspense fallback={null}><Playback playback={playback} onController={onController} onSnapshot={onSnapshot} onFailure={onFailure} /></Suspense>
              <OrbitControls makeDefault enablePan={false} minDistance={1.2} maxDistance={6} />
            </Canvas>
          </ErrorBoundary></div>
          <div className="mt-3 flex flex-wrap items-end gap-4">
            <FormField label={t('locker.abilityPreview.timeline')} className="min-w-48 flex-1">
              <Input type="range" min={0} max={runtime?.snapshot.duration || 1} step={0.01} value={runtime?.snapshot.position ?? 0} disabled={!ready}
                aria-label={t('locker.abilityPreview.timeline')}
                aria-valuetext={t('locker.abilityPreview.timelineTime', { position: (runtime?.snapshot.position ?? 0).toFixed(2), duration: (runtime?.snapshot.duration ?? 0).toFixed(2) })}
                onChange={event => runtime?.controller.seek(Number(event.target.value))} />
            </FormField>
            <FormField label={t('locker.abilityPreview.speed')} className="w-32">
              <Select aria-label={t('locker.abilityPreview.speed')} value={runtime?.snapshot.speed ?? 1} disabled={!ready} onChange={event => runtime?.controller.setSpeed(Number(event.target.value))}>
                {[0.25, 0.5, 0.75, 1, 1.5, 2].map(speed => <option key={speed} value={speed}>{t('locker.abilityPreview.speedValue', { speed })}</option>)}
              </Select>
            </FormField>
          </div>
          <p className="mt-2 text-xs text-text-secondary" role="status">{!ready && error ? t('locker.abilityPreview.failed') : !runtime || runtime.snapshot.status === 'loading' ? t('locker.abilityPreview.assetsLoading')
            : runtime.snapshot.status === 'finished' ? t('locker.abilityPreview.finished')
              : runtime.snapshot.status === 'playing' ? t('locker.abilityPreview.playing') : t('locker.abilityPreview.paused')}
            {ready && <span className="ml-2 tabular-nums">{t('locker.abilityPreview.timelineTime', { position: runtime.snapshot.position.toFixed(2), duration: runtime.snapshot.duration.toFixed(2) })}</span>}
          </p>
        </>}
        {open && sourceMode === 'applied' && <RecolorTexturePreview heroName={heroName} />}
      </ModalBody>
    </Modal>
  </>;
}
