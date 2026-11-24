import { useEffect, useId, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { IconButton, SegmentedControl } from '../common/ui';
import { Select } from '../common/forms';
import { PreviewLoader } from '../common/PreviewLoader';
import HeroPoseViewer from '../locker/HeroPoseViewer';
import { AnimationTimeline } from '../locker/HeroViewerToolbar';
import { exportAnimationModPreview } from '../../lib/api';
import { heroClipLabel, type HeroPlaybackProgress, type HeroPlaybackSeek } from '../../lib/heroViewerPlayback';
import type { MovementFxChoice } from '../../lib/movementFx';
import type { AnimationModPreview } from '../../types/portrait';
import type { SkinEditSource } from '../../types/skinEditor';

/** The hero Installed previews of dash and heavy melee effects play on. */
export const MOVEMENT_PREVIEW_HERO = 'Lash';

function Status({ failed, stock = false }: { failed: boolean; stock?: boolean }): ReactNode {
  const { t } = useTranslation();
  if (!failed) return <PreviewLoader label={t('foundry.skin.loading')} />;
  return <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
    <p role="status" className="text-center text-xs text-text-secondary">
      {t(stock ? 'installed.preview.stockClipUnavailable' : 'installed.preview.unavailable')}
    </p>
  </div>;
}

/** A Door Stuck movement effect, rebuilt from the settings saved with the mod and played on Lash. */
export function MovementModViewer({ choice, active, turn }: { choice: MovementFxChoice; active: boolean; turn: RefObject<number | null> }) {
  const choiceKey = JSON.stringify(choice);
  // choiceKey carries the choice's contents; the object itself is rebuilt on every mods refresh
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const preview = useMemo(() => ({ kind: choice.kind, revision: 0, loop: true, request: { choice, heroName: MOVEMENT_PREVIEW_HERO } }), [choiceKey]);
  return <HeroPoseViewer heroName={MOVEMENT_PREVIEW_HERO} compact active={active} turn={turn} movementPreview={preview} />;
}

const ALL = '';
const BLANK_PROGRESS = { time: 0, duration: 0 };
type ViewerProps = { active: boolean; turn: RefObject<number | null>; expanded?: boolean };
type SkinOption = { key: string; label: string; source: SkinEditSource };

function useComparisonPlayback() {
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [seek, setSeek] = useState<HeroPlaybackSeek>();
  const progressRef = useRef<HeroPlaybackProgress>({ ...BLANK_PROGRESS });
  const jump = (time: number) => setSeek(previous => ({ time, revision: (previous?.revision ?? 0) + 1 }));
  const reset = () => { progressRef.current = { ...BLANK_PROGRESS }; jump(0); };
  const holdFrame = () => jump(progressRef.current.duration > 0 ? progressRef.current.time : seek?.time ?? 0);
  return { playback: { paused, speed, seek, progressRef }, setPaused, setSpeed, jump, reset, holdFrame };
}

function PlaybackControls({ controller, loading = false }: { controller: ReturnType<typeof useComparisonPlayback>; loading?: boolean }) {
  const { t } = useTranslation();
  const { playback, setPaused, setSpeed, jump } = controller;
  return <div className={`flex items-center gap-1${loading ? ' opacity-60' : ''}`} inert={loading}>
    <IconButton size="sm" icon={playback.paused ? Play : Pause}
      label={t(playback.paused ? 'audioPreview.play' : 'audioPreview.pause')} onClick={() => setPaused(!playback.paused)} />
    <IconButton size="sm" icon={RotateCcw} label={t('installed.preview.restart')} onClick={() => jump(0)} />
    <div className="min-w-0 flex-1">
      <AnimationTimeline frozen={loading} progressRef={playback.progressRef} onSeek={time => { setPaused(true); jump(time); }} />
    </div>
    <Select inputSize="sm" aria-label={t('locker.pose.speed')} value={playback.speed} onChange={event => setSpeed(Number(event.target.value))}>
      {[0.25, 0.5, 1, 1.5, 2].map(speed => <option key={speed} value={speed}>{speed}×</option>)}
    </Select>
  </div>;
}

export function SkinComparisonViewer({ source, active, turn, expanded }: ViewerProps & { source: SkinEditSource }) {
  const { t } = useTranslation();
  const [stock, setStock] = useState(false);
  const controller = useComparisonPlayback();
  const panelId = useId();
  const showStock = expanded && stock;
  return <div className="flex h-full flex-col">
    <div className="relative min-h-0 flex-1" id={expanded ? panelId : undefined}
      role={expanded ? 'tabpanel' : undefined} aria-labelledby={expanded ? `${panelId}-tab-${stock ? 'stock' : 'mod'}` : undefined}>
      <HeroPoseViewer heroName={source.heroName}
        skinSources={showStock ? undefined : source.skinSources} compact active={active} turn={turn}
        previewPlayback={expanded ? controller.playback : undefined} />
    </div>
    {expanded && <div className="space-y-1 border-t border-border px-5 py-2">
      <SegmentedControl variant="joined" size="sm" fill panelId={panelId} label={t('installed.preview.modelSource')} value={stock ? 'stock' : 'mod'}
        onChange={value => { controller.holdFrame(); setStock(value === 'stock'); }}
        options={[{ value: 'mod', label: t('installed.preview.modSkin') }, { value: 'stock', label: t('installed.preview.stockSkin') }]} />
      <PlaybackControls controller={controller} />
    </div>}
  </div>;
}

/** Compare matching clip paths independently of the selected installed skin. */
export function AnimationModViewer({ metaKey, active, turn, expanded = false, skinsForHero }: ViewerProps & {
  metaKey: string;
  skinsForHero: (heroName: string) => SkinOption[];
}) {
  const { t } = useTranslation();
  const [preview, setPreview] = useState<AnimationModPreview | null>(null);
  const [failed, setFailed] = useState(false);
  const [clip, setClip] = useState(ALL);
  const [stock, setStock] = useState(false);
  const [stockPreview, setStockPreview] = useState<AnimationModPreview | null | undefined>();
  const [skinKey, setSkinKey] = useState<string>();
  const controller = useComparisonPlayback();
  const panelId = useId();
  useEffect(() => {
    let cancelled = false;
    exportAnimationModPreview(metaKey).then((value) => {
      if (cancelled) return;
      if (value) setPreview(value); else setFailed(true);
    }, () => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [metaKey]);
  useEffect(() => {
    if (!stock || stockPreview !== undefined) return;
    let cancelled = false;
    exportAnimationModPreview(metaKey, true).then(value => {
      if (!cancelled) setStockPreview(value);
    }, () => { if (!cancelled) setStockPreview(null); });
    return () => { cancelled = true; };
  }, [metaKey, stock, stockPreview]);
  if (!preview) return <Status failed={failed} />;
  const skins = expanded ? skinsForHero(preview.heroName) : [];
  const skin = skins.find(option => option.key === (skinKey ?? metaKey));
  const showStock = expanded && stock;
  const pickedClip = expanded ? clip : ALL;
  const loadingStock = showStock && stockPreview === undefined;
  const requestedMotion = showStock && !loadingStock ? stockPreview : preview;
  const playableMotion = requestedMotion && (!pickedClip || requestedMotion.clips.includes(pickedClip)) ? requestedMotion : null;
  const canPlay = !!playableMotion;
  const motion = playableMotion ?? preview;
  return <div className="flex h-full flex-col">
    <div className="relative min-h-0 flex-1" id={expanded ? panelId : undefined}
      role={expanded ? 'tabpanel' : undefined} aria-labelledby={expanded ? `${panelId}-tab-${stock ? 'stock' : 'mod'}` : undefined}>
      <div className={`absolute inset-0${canPlay ? '' : ' invisible'}`} aria-hidden={!canPlay} inert={!canPlay}>
        <HeroPoseViewer heroName={motion.heroName} skinSources={skin?.source.skinSources} compact active={active && canPlay} turn={turn}
          meshGroup={skin ? undefined : preview.meshGroup ?? undefined}
          previewPlayback={expanded ? { ...controller.playback, paused: controller.playback.paused || loadingStock } : undefined}
          clipOverride={{ key: motion.key, url: `grimoire-hero://a/${motion.key}/clips.glb`, clip: pickedClip || null }} />
      </div>
      {!canPlay && <Status failed stock={showStock} />}
      {loadingStock && <p role="status" className="absolute inset-x-3 bottom-3 z-10 rounded-sm bg-bg-secondary/95 p-2 text-xs text-text-secondary">
        {t('installed.preview.loadingStock')}
      </p>}
    </div>
    {expanded && <div className="space-y-1 border-t border-border px-5 py-2">
      <SegmentedControl variant="joined" size="sm" fill panelId={panelId} label={t('installed.preview.animationSource')} value={stock ? 'stock' : 'mod'}
        onChange={value => {
          if (value === 'stock' && !clip) {
            controller.reset();
            setClip(preview.clips[0]);
          } else controller.holdFrame();
          setStock(value === 'stock');
        }}
        options={[{ value: 'mod', label: t('installed.preview.modMotion') }, { value: 'stock', label: t('installed.preview.stockMotion') }]} />
      <div className="flex gap-1">
        <Select inputSize="sm" className="min-w-0 flex-1" aria-label={t('installed.preview.clips')} value={clip}
          onChange={event => { controller.reset(); setClip(event.target.value); }}>
          {!stock && <option value={ALL}>{t('installed.preview.allClips')}</option>}
          {preview.clips.map(name => <option key={name} value={name}>{heroClipLabel(name, t, preview.heroName)}</option>)}
        </Select>
        {skins.length > 0 && <Select inputSize="sm" className="min-w-0 flex-1" aria-label={t('installed.preview.modelSource')}
          value={skin?.key ?? ''} onChange={event => { controller.holdFrame(); setSkinKey(event.target.value); }}>
          <option value="">{t('installed.preview.stockSkin')}</option>
          {skins.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}
        </Select>}
      </div>
      <PlaybackControls controller={controller} loading={!canPlay || loadingStock} />
    </div>}
  </div>;
}
