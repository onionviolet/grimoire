import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image as ImageIcon, Loader2, Play, Square, Volume2 } from 'lucide-react';
import { foundryAuditionSourceClip, foundrySourceThumbnail } from '../../lib/api';
import { showToast } from '../../stores/toastStore';
import { alternativePreviewFor, rememberPreviewUrl } from './alternativePreview';
import type { FoundryPoolMember } from './poolView';

/**
 * The alternatives gallery: what one pool member *looks like* (or sounds like),
 * rendered into the leading slot of `PoolMemberCell` through the
 * `renderMemberPreview` prop the pool view already exposes. It adds no grouping,
 * no ownership rule, and no state of its own to the pool.
 *
 * Two deliberate non-features, both required by the lane's contract:
 *
 *  - **It never implies an enabled state.** The thumbnail is drawn identically
 *    whether the member is enabled, disabled, winning, or losing. Which
 *    alternative the game actually loads is the cell's winner badge, resolved
 *    from the shared `foundryInspectAssetSources` call; selecting one is the
 *    cell's existing power button, which is the same mod-store toggle Installed
 *    and the Locker call. Nothing here writes.
 *  - **It never invents an image.** A preview exists only where provenance
 *    recorded one. Anything else falls back to the same kind icon the pool view
 *    shows without this component, so a blank frame is never mistaken for an
 *    asset that failed to load.
 *
 * Caching: thumbnails are produced and bounded in the main process over the
 * existing `grimoire-foundry:` protocol (128px, 256 files / 32 MB). The map below
 * is only a per-session memo of the resolved URLs, itself bounded, so scrolling a
 * pool list does not re-cross the IPC boundary for every render.
 */
const urlCache = new Map<string, string | null>();

export default function AlternativePreview({ member }: { member: FoundryPoolMember }) {
  const preview = alternativePreviewFor(member);

  if (preview?.kind === 'sound') {
    return <AuditionButton member={member} modId={preview.modId} entryPath={preview.entryPath} />;
  }
  if (preview?.kind === 'recorded-thumbnail') {
    return <PreviewImage src={preview.src} member={member} />;
  }
  if (preview?.kind === 'image') {
    // Keyed on the path so a member whose source changes starts from a clean
    // resolve rather than briefly showing the previous alternative's image.
    return <SourceThumbnail key={preview.sourcePath} sourcePath={preview.sourcePath} member={member} />;
  }
  return <KindIcon member={member} />;
}

/** The unchanged fallback: exactly what the cell renders on its own. */
function KindIcon({ member }: { member: FoundryPoolMember }) {
  const Icon = member.kind === 'sound' ? Volume2 : ImageIcon;
  return <Icon size={14} className="text-accent" />;
}

function PreviewImage({ src, member }: { src: string; member: FoundryPoolMember }) {
  const { t } = useTranslation();
  const [broken, setBroken] = useState(false);
  if (broken) return <KindIcon member={member} />;
  return (
    <img
      src={src}
      alt={t('alternatives.previewAlt', { name: member.title })}
      title={t('alternatives.previewAlt', { name: member.title })}
      draggable={false}
      onError={() => setBroken(true)}
      // No enabled/winner-derived styling: this is the source material, not a
      // claim about what the game is loading.
      className="h-full w-full rounded-sm object-cover"
    />
  );
}

function SourceThumbnail({ sourcePath, member }: { sourcePath: string; member: FoundryPoolMember }) {
  const { t } = useTranslation();
  const [url, setUrl] = useState<string | null | undefined>(() =>
    urlCache.has(sourcePath) ? urlCache.get(sourcePath) : undefined,
  );

  useEffect(() => {
    // Already memoized this session: the initial state above has it, so there is
    // nothing to do and nothing to set.
    if (urlCache.has(sourcePath)) return;
    let cancelled = false;
    foundrySourceThumbnail(sourcePath)
      .then((resolved) => {
        rememberPreviewUrl(urlCache, sourcePath, resolved);
        if (!cancelled) setUrl(resolved);
      })
      .catch(() => {
        // A failed preview is not an error the user can act on, and it says
        // nothing about whether the change works. Fall back quietly.
        rememberPreviewUrl(urlCache, sourcePath, null);
        if (!cancelled) setUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [sourcePath]);

  if (url === undefined) return <Loader2 size={12} className="animate-spin text-text-secondary" />;
  if (url === null) {
    return (
      <span
        title={t('alternatives.sourceMissing', { file: member.sourceFileName ?? sourcePath })}
        className="flex h-full w-full items-center justify-center"
      >
        <KindIcon member={member} />
      </span>
    );
  }
  return <PreviewImage src={url} member={member} />;
}

/**
 * A sound member has no image, so it gets the audition instead: the clip is
 * extracted from that mod's own VPK by the existing
 * `foundry:auditionSourceClip` path, which answers "what does this alternative
 * sound like" rather than "what does the base game ship". Playing it changes
 * nothing.
 */
function AuditionButton({
  member,
  modId,
  entryPath,
}: {
  member: FoundryPoolMember;
  modId: string;
  entryPath: string;
}) {
  const { t } = useTranslation();
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => () => {
    audioRef.current?.pause();
    audioRef.current = null;
  }, []);

  const audition = useCallback(async () => {
    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
      return;
    }
    setBusy(true);
    try {
      const url = await foundryAuditionSourceClip(modId, entryPath);
      if (!url) {
        showToast(t('alternatives.auditionFailed', { name: member.title }), { tone: 'error' });
        return;
      }
      const audio = audioRef.current ?? new Audio();
      audioRef.current = audio;
      audio.src = url;
      audio.onended = () => setPlaying(false);
      setPlaying(true);
      await audio.play();
    } catch (cause) {
      setPlaying(false);
      showToast(cause instanceof Error ? cause.message : String(cause), { tone: 'error' });
    } finally {
      setBusy(false);
    }
  }, [playing, modId, entryPath, member.title, t]);

  const label = playing
    ? t('alternatives.auditionStop', { name: member.title })
    : t('alternatives.auditionPlay', { name: member.title });

  return (
    <button
      type="button"
      onClick={() => void audition()}
      disabled={busy}
      aria-label={label}
      title={t('alternatives.auditionHint', { path: entryPath })}
      className="flex h-full w-full items-center justify-center text-accent hover:text-text-primary disabled:opacity-50"
    >
      {busy ? <Loader2 size={12} className="animate-spin" /> : playing ? <Square size={12} /> : <Play size={12} />}
    </button>
  );
}
