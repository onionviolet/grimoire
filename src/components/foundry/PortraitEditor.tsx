import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useConfirm } from '../common/confirmContext';
import { AlertTriangle, Check, History, Images, Layers, Loader2, Undo2, Upload } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button, ModalHeader } from '../common/ui';
import LockerImageCropper from '../locker/LockerImageCropper';
import {
  foundryFullImage,
  foundryInspectAssetSources,
  foundryListPortraitImages,
  foundryStagePortraitImage,
} from '../../lib/api';
import type { TextureGridItem } from '../../types/foundry';
import type { VisualStagedEdit } from './visualEdits';
import {
  cropToTargetRect,
  planPortraitFamilyEdits,
  portraitFamilyCoverageGap,
  portraitFamilyVariants,
  portraitVariantLabelKey,
  stagePortraitFamily,
  type PixelSize,
  type PortraitCrop,
  type PortraitVariant,
} from './portraitFamily';

interface PortraitEditorProps {
  /** The catalog entry the user opened the editor from, or null when closed. */
  item: TextureGridItem | null;
  /** The loaded category, so the family is discovered from real entries. */
  catalog: readonly TextureGridItem[];
  /** Resolved hero display name for `item.hero`, when the codename maps to one. */
  heroName?: string;
  /** Image the user already dropped/picked on the card that opened the editor,
   *  loaded straight into the frame so the gesture is not repeated. */
  initialFile?: File | null;
  onClose: () => void;
  /** Hand the staged family to the shared build tray. Nothing is installed. */
  onStage: (edits: VisualStagedEdit[]) => void;
}

/** Which slot the crop frame is currently authoring. */
type Slot = { kind: 'family' } | { kind: 'override'; path: string };

const FAMILY: Slot = { kind: 'family' };

function slotId(slot: Slot): string {
  return slot.kind === 'family' ? 'family' : `override:${slot.path}`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('image decode failed'));
    el.src = src;
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('file read failed'));
    reader.readAsDataURL(file);
  });
}

/**
 * The portrait editor.
 *
 * Two things a raw PNG drop could never do:
 *
 * 1. **Preview against the real target.** The crop frame is locked to the
 *    template's own aspect (from the catalog's recorded native size, or measured
 *    off the decoded template when the catalog did not record one), and the bake
 *    is written at those exact pixel dimensions. What the frame shows is what the
 *    card shows, at the size the game reads.
 * 2. **Treat the portrait family as the unit it already is.** The staging
 *    preflight inspects every discovered state variant (normal, low-HP, gloat,
 *    minimap, ...), so the editor lists them all, applies one image across all of
 *    them by default, and allows a per-variant override. It refuses to stage a
 *    subset, because that would deliver less than the preflight just warned about.
 *
 * It authors an image and nothing else: staging runs through
 * `prepareVisualStagedEdit` unchanged (via `stagePortraitFamily`), so there is no
 * second install path here. The only write is a PNG parked in a bounded userData
 * cache, because the staging contract records a path rather than bytes.
 */
export default function PortraitEditor({ item, catalog, heroName, initialFile, onClose, onStage }: PortraitEditorProps) {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const fileRef = useRef<HTMLInputElement>(null);

  const [slot, setSlot] = useState<Slot>(FAMILY);
  const [source, setSource] = useState<string | null>(null);
  const [familyImage, setFamilyImage] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [targets, setTargets] = useState<Record<string, PixelSize>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceSize, setSourceSize] = useState<PixelSize | null>(null);
  // Intake reuse, borrowed from the Locker picker: images the user framed before
  // and the game's own art for the entry being edited. A file drop is now one
  // way in rather than the only one.
  const [recent, setRecent] = useState<Array<{ path: string; label: string | null; dataUrl: string }>>([]);
  // The filename behind the image currently in the frame, when it came from one.
  const [sourceName, setSourceName] = useState<string | null>(null);

  // Reset per opened entry: a previous family's bakes must never leak into a
  // different portrait.
  useEffect(() => {
    setSlot(FAMILY);
    setSource(null);
    setSourceSize(null);
    setFamilyImage(null);
    setOverrides({});
    setError(null);
  }, [item?.path]);

  const variants = useMemo<PortraitVariant<TextureGridItem>[]>(
    () => (item ? portraitFamilyVariants(item, catalog) : []),
    [item, catalog],
  );

  // Template dimensions: the catalog records them for thumbnailed entries; when
  // it did not, measure the decoded template rather than assuming a shape.
  useEffect(() => {
    if (variants.length === 0) return;
    let cancelled = false;
    const known: Record<string, PixelSize> = {};
    for (const variant of variants) {
      const { sourceWidth, sourceHeight } = variant.item;
      if (sourceWidth && sourceHeight) known[variant.path] = { width: sourceWidth, height: sourceHeight };
    }
    setTargets(known);
    const missing = variants.filter((variant) => !known[variant.path]);
    void Promise.all(
      missing.map(async (variant) => {
        try {
          const url = await foundryFullImage(variant.item.category, variant.path);
          if (!url) return null;
          const img = await loadImage(url);
          return [variant.path, { width: img.naturalWidth, height: img.naturalHeight }] as const;
        } catch {
          return null;
        }
      }),
    ).then((measured) => {
      if (cancelled) return;
      const found = measured.filter((entry): entry is NonNullable<typeof entry> => !!entry);
      if (found.length > 0) setTargets((prev) => ({ ...prev, ...Object.fromEntries(found) }));
    });
    return () => {
      cancelled = true;
    };
  }, [variants]);

  const anchorPath = variants[0]?.path ?? item?.path ?? '';
  const activePath = slot.kind === 'family' ? anchorPath : slot.path;
  const activeTarget = targets[activePath] ?? null;
  const aspect = activeTarget ? activeTarget.width / activeTarget.height : 1;

  const plan = useMemo(() => planPortraitFamilyEdits(variants, familyImage, overrides), [variants, familyImage, overrides]);
  const gap = useMemo(() => portraitFamilyCoverageGap(variants, familyImage, overrides), [variants, familyImage, overrides]);

  const pick = useCallback(async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError(t('portraitEditor.notAnImage', 'That file is not an image.'));
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const img = await loadImage(dataUrl);
      setSource(dataUrl);
      // Carried purely so the staged bake can be named after the file the user
      // chose. The storage key stays the content hash (issue #261).
      setSourceName(file.name);
      setSourceSize({ width: img.naturalWidth, height: img.naturalHeight });
      setError(null);
    } catch {
      setError(t('portraitEditor.imageReadFailed', "That image couldn't be read."));
    }
  }, [t]);

  // Load the image the opening gesture already supplied, if there was one.
  useEffect(() => {
    if (initialFile) void pick(initialFile);
  }, [initialFile, pick]);

  /** Load any already-decoded image straight into the crop frame. Shared by the
   *  recent strip and the "use the current art" button, because both hand over
   *  a data URL and neither should re-open a file dialog to do it. */
  const loadIntoFrame = useCallback(
    async (dataUrl: string, name?: string | null) => {
      try {
        const img = await loadImage(dataUrl);
        setSource(dataUrl);
        setSourceName(name ?? null);
        setSourceSize({ width: img.naturalWidth, height: img.naturalHeight });
        setError(null);
      } catch {
        setError(t('portraitEditor.imageReadFailed', "That image couldn't be read."));
      }
    },
    [t]
  );

  // Refresh the recent strip each time the editor opens on an entry: staging in
  // a previous session (or a previous open) is exactly what makes it useful.
  useEffect(() => {
    if (!item) return;
    let cancelled = false;
    void foundryListPortraitImages()
      .then((images) => {
        if (!cancelled) setRecent(images.map(({ path, label, dataUrl }) => ({ path, label, dataUrl })));
      })
      .catch(() => {
        // A missing cache is an empty strip, not an error worth a banner.
        if (!cancelled) setRecent([]);
      });
    return () => {
      cancelled = true;
    };
  }, [item]);

  /** Load the game's own art for the variant being authored, so the stock
   *  portrait can be recropped or repainted without leaving the app. */
  const loadCurrentArt = useCallback(async () => {
    if (!item) return;
    setBusy(true);
    try {
      const url = await foundryFullImage(item.category, activePath || item.path);
      if (!url) {
        setError(t('portraitEditor.currentArtUnavailable'));
        return;
      }
      await loadIntoFrame(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [item, activePath, loadIntoFrame, t]);

  // Bake the framed region at the template's real pixel size, park it on disk,
  // and record the returned path against the slot being authored.
  const applyCrop = useCallback(
    async (result: { source: string; crop: PortraitCrop }) => {
      setBusy(true);
      setError(null);
      try {
        const img = await loadImage(result.source);
        const natural = { width: img.naturalWidth, height: img.naturalHeight };
        const rect = cropToTargetRect(
          result.crop,
          natural,
          activeTarget ?? { width: result.crop.sw * natural.width, height: result.crop.sh * natural.height },
        );
        const canvas = document.createElement('canvas');
        canvas.width = rect.width;
        canvas.height = rect.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error(t('portraitEditor.bakeFailed', "The image couldn't be prepared."));
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, rect.width, rect.height);
        const imagePath = await foundryStagePortraitImage(
          canvas.toDataURL('image/png'),
          sourceName ?? undefined
        );
        if (slot.kind === 'family') setFamilyImage(imagePath);
        else setOverrides((prev) => ({ ...prev, [slot.path]: imagePath }));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [activeTarget, slot, sourceName, t],
  );

  const stage = useCallback(async () => {
    if (!item) return;
    setBusy(true);
    setError(null);
    try {
      const staged = await stagePortraitFamily<TextureGridItem>({
        variants,
        catalog,
        familyImagePath: familyImage,
        overrides,
        name: (entry) =>
          t('portraitEditor.editName', '{{label}} portrait', {
            label: entry.variant.item.label || item.label || 'Portrait',
          }),
        inspect: foundryInspectAssetSources,
        confirm: (modNames) =>
          confirm({
            title: t('portraitEditor.stageConflictTitle', 'Stage a separate layered portrait?'),
            message: t(
              'portraitEditor.stageConflictBody',
              'These installed mods already replace this portrait and are enabled. Staging adds a separate managed replacement layered over them; nothing is removed.'
            ),
            items: modNames,
            confirmLabel: t('portraitEditor.stageConflictConfirm', 'Stage anyway'),
          }),
        unreadableMessage: t('portraitEditor.stageUnreadable'),
        coverageMessage: t('portraitEditor.coverageBlocked'),
        heroName,
      });
      if (!staged) return;
      onStage(staged);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [item, variants, catalog, familyImage, overrides, heroName, onStage, onClose, t, confirm]);

  const upscales =
    !!sourceSize && !!activeTarget && (sourceSize.width < activeTarget.width || sourceSize.height < activeTarget.height);

  const variantLabel = (variant: PortraitVariant<TextureGridItem>): string => {
    const key = portraitVariantLabelKey(variant.key);
    return key ? t(key) : variant.key.replace(/_/g, ' ');
  };

  return (
    <Modal open={!!item} onClose={onClose} size="none" panelClassName="max-w-4xl flex flex-col" dismissable={!busy}>
      {item && (
        <>
          <ModalHeader
            title={t('portraitEditor.title', 'Portrait editor')}
            subtitle={`${heroName ? `${heroName} · ` : ''}${item.path}`}
            subtitleTitle={item.path}
            onClose={onClose}
            closeLabel={t('common.actions.close', 'Close')}
            closeDisabled={busy}
          />

          <div className="grid gap-5 overflow-y-auto p-5 md:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
            {/* Frame: locked to the template's own aspect. */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2 text-[11px] text-text-secondary">
                <span>
                  {activeTarget
                    ? t('portraitEditor.target', { width: activeTarget.width, height: activeTarget.height })
                    : t('portraitEditor.targetUnknown', 'Template size unknown')}
                </span>
                <span className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void loadCurrentArt()}
                    title={t('portraitEditor.useCurrentArtHint')}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-sm border border-border px-2 py-1 text-text-secondary transition-colors hover:border-accent/50 hover:text-text-primary disabled:opacity-50"
                  >
                    <Images size={12} />
                    {t('portraitEditor.useCurrentArt')}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => fileRef.current?.click()}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-sm border border-border px-2 py-1 text-text-secondary transition-colors hover:border-accent/50 hover:text-text-primary disabled:opacity-50"
                  >
                    <Upload size={12} />
                    {t('portraitEditor.choose', 'Choose image')}
                  </button>
                </span>
              </div>

              <LockerImageCropper
                key={`${item.path}:${slotId(slot)}:${activeTarget ? `${activeTarget.width}x${activeTarget.height}` : 'unknown'}`}
                imageDataUrl={source}
                aspect={aspect}
                nameControls={false}
                allowHideName={false}
                emptyHint={t('portraitEditor.emptyHint', 'Drop a PNG here, or click to choose one')}
                onPickClick={() => fileRef.current?.click()}
                onDropFile={(file) => void pick(file)}
                busy={busy}
                onApply={(result) => void applyCrop(result)}
              />
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  void pick(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />

              {/* Images already framed in this or an earlier session. The
                  staging cache is content-addressed, so this is a record of
                  real work rather than a second store to keep in sync. */}
              {recent.length > 0 && (
                <div>
                  <p className="mb-1 flex items-center gap-1 text-[11px] text-text-secondary">
                    <History size={12} />
                    {t('portraitEditor.recentTitle')}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {recent.map((image) => (
                      <button
                        key={image.path}
                        type="button"
                        disabled={busy}
                        onClick={() => void loadIntoFrame(image.dataUrl, image.label)}
                        // A hash is not a name. When the original filename was
                        // recorded, it is what identifies the tile.
                        title={image.label ?? t('portraitEditor.recentHint')}
                        className="h-12 w-12 overflow-hidden rounded-sm border border-border transition-colors hover:border-accent/60 disabled:opacity-50 cursor-pointer"
                      >
                        <img
                          src={image.dataUrl}
                          alt={image.label ?? ''}
                          className="h-full w-full object-cover"
                          draggable={false}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {upscales && activeTarget && sourceSize && (
                <p className="flex items-start gap-2 rounded-sm border border-yellow-500/30 bg-yellow-500/10 p-2 text-[11px] text-yellow-300">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  {t('portraitEditor.upscaleWarning', {
                    sourceWidth: sourceSize.width,
                    sourceHeight: sourceSize.height,
                    targetWidth: activeTarget.width,
                    targetHeight: activeTarget.height,
                  })}
                </p>
              )}
            </div>

            {/* The family, made explicit. */}
            <div className="flex min-w-0 flex-col gap-3">
              <div>
                <h3 className="flex items-center gap-1.5 text-sm font-semibold text-text-primary">
                  <Layers size={14} className="text-text-secondary" />
                  {t('portraitEditor.familyTitle', 'This portrait family')}
                </h3>
                <p className="mt-1 text-[11px] leading-snug text-text-secondary">
                  {t('portraitEditor.familyHint', { count: variants.length })}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSlot(FAMILY)}
                className={`flex items-center gap-2 rounded-sm border px-3 py-2 text-left text-xs transition-colors ${
                  slot.kind === 'family' ? 'border-accent/60 bg-accent/10 text-text-primary' : 'border-border text-text-secondary hover:border-accent/40'
                }`}
              >
                <Images size={14} className="shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{t('portraitEditor.familySlot', 'Image for every variant')}</span>
                  <span className="block truncate text-[11px] opacity-80">
                    {familyImage
                      ? t('portraitEditor.familySet', 'Framed and ready')
                      : t('portraitEditor.familyUnset', 'Not set yet')}
                  </span>
                </span>
                {familyImage && <Check size={14} className="shrink-0 text-state-success" />}
              </button>

              <ul className="divide-y divide-border/60 overflow-hidden rounded-sm border border-border">
                {variants.map((variant) => {
                  const override = overrides[variant.path];
                  const target = targets[variant.path];
                  const active = slot.kind === 'override' && slot.path === variant.path;
                  return (
                    <li key={variant.path} className={`flex items-center gap-2 px-3 py-2 ${active ? 'bg-accent/10' : ''}`}>
                      {variant.item.thumbUrl ? (
                        <img src={variant.item.thumbUrl} alt="" className="h-8 w-8 shrink-0 rounded-sm object-cover" draggable={false} />
                      ) : (
                        <span className="h-8 w-8 shrink-0 rounded-sm border border-border/60" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs capitalize text-text-primary">
                          {variantLabel(variant)}
                          {variant.anchor && (
                            <span className="ml-1.5 text-[10px] uppercase tracking-wide text-text-secondary">
                              {t('portraitEditor.opened', 'opened')}
                            </span>
                          )}
                        </span>
                        <span className="block truncate text-[10px] text-text-secondary" title={variant.path}>
                          {target ? `${target.width} x ${target.height} · ` : ''}
                          {variant.path}
                        </span>
                      </span>
                      <span className="shrink-0 text-[10px] uppercase tracking-wide text-text-secondary">
                        {override
                          ? t('portraitEditor.usesOverride', 'override')
                          : familyImage
                            ? t('portraitEditor.usesFamily', 'family')
                            : t('portraitEditor.usesNothing', 'no image')}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSlot({ kind: 'override', path: variant.path })}
                        className="shrink-0 cursor-pointer rounded-sm border border-border px-2 py-1 text-[10px] text-text-secondary transition-colors hover:border-accent/50 hover:text-text-primary"
                      >
                        {override ? t('portraitEditor.recrop', 'Re-crop') : t('portraitEditor.override', 'Override')}
                      </button>
                      {override && (
                        <button
                          type="button"
                          title={t('portraitEditor.clearOverride', 'Use the family image again')}
                          aria-label={t('portraitEditor.clearOverride', 'Use the family image again')}
                          onClick={() =>
                            setOverrides((prev) => {
                              const next = { ...prev };
                              delete next[variant.path];
                              return next;
                            })
                          }
                          className="shrink-0 cursor-pointer rounded-sm border border-border p-1 text-text-secondary transition-colors hover:border-accent/50 hover:text-text-primary"
                        >
                          <Undo2 size={12} />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>

              {gap.length > 0 && (familyImage || Object.keys(overrides).length > 0) && (
                <p className="flex items-start gap-2 rounded-sm border border-yellow-500/30 bg-yellow-500/10 p-2 text-[11px] text-yellow-300">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  {t('portraitEditor.coverageBlocked')}
                </p>
              )}

              {error && (
                <p className="flex items-start gap-2 rounded-sm border border-red-500/40 bg-red-500/10 p-2 text-[11px] text-state-danger">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  <span className="break-words">{error}</span>
                </p>
              )}

              <div className="mt-auto flex items-center justify-between gap-3 pt-2">
                <p className="text-[11px] text-text-secondary">
                  {t('portraitEditor.nothingInstalled', 'Staging adds this to the build tray. Nothing is installed.')}
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  icon={busy ? Loader2 : Layers}
                  disabled={busy || plan.length === 0 || gap.length > 0}
                  onClick={() => void stage()}
                >
                  {t('portraitEditor.stage', { count: plan.length })}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}
