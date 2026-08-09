import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Images, Loader2, AlertCircle, Check, Upload, X, Download, Shuffle } from 'lucide-react';
import {
  applyCustomHeroCard,
  applyHeroCard,
  exportCustomHeroCard,
  getActiveHeroCard,
  getAppliedCustomCard,
  getCustomCardSlots,
  getHeroPortraits,
  readImageDataUrl,
  revealPath,
  revertHeroCard,
  showOpenDialog,
  showSaveDialog,
} from '../../lib/api';
import { showToast } from '../../stores/toastStore';
import { useAppStore } from '../../stores/appStore';
import CardCropper from './CardCropper';
import {
  portraitFamilyCoverageGap,
  type PortraitVariant,
} from '../foundry/portraitFamily';
import type { CustomCardSlot, HeroPortrait } from '../../types/portrait';
import { shuffleCardKey } from '../../lib/lockerRandomizer';
import AssetSourcesPanel from '../foundry/AssetSourcesPanel';
import FoundryPoolList from '../foundry/ChangePools';
import { collectFoundryChanges } from '../foundry/changeList';
import { foundryChangeEntries } from '../../lib/foundryChanges';
import { buildPortraitInventory, overlappingClaims, portraitProvenanceOf } from '../../lib/portraitInventory';
import { variantPreviewClass } from './cardSlotStyles';
import HeroPortraitFamilies from './HeroPortraitFamilies';
import {
  normalizePortraitVariant,
  portraitVariantLabelKey,
  portraitVariantRank,
} from '../../lib/portraitFamilyView';

interface HeroCardPickerProps {
  heroName: string;
}



/** A cheap order-independent fingerprint of the current picks, used to tell
 *  whether the slots differ from what was last applied (drives the Apply vs
 *  Applied vs Update button state). Length + tail avoids hashing whole data
 *  URLs while staying collision-safe in practice. */
function picksSignature(picks: Record<string, string>): string {
  return Object.keys(picks)
    .sort()
    .map((v) => `${v}#${picks[v].length}#${picks[v].slice(-32)}`)
    .join('|');
}

interface PortraitFileGroup {
  modFileName: string;
  variants: HeroPortrait[];
}

/**
 * EXPERIMENTAL: surfaces the hero card/portrait art the user's installed mods
 * ship (decoded on demand via `vpkmerge portrait`) and applies the chosen one.
 * Applying splits that hero's `panorama/images/heroes/<codename>_` art out of
 * its source mod and folds it into a single Locker-managed cosmetics VPK that
 * wins by load order. Clicking the active card again reverts to default.
 */
export default function HeroCardPicker({ heroName }: HeroCardPickerProps) {
  const { t } = useTranslation();
  // Labels and ordering come from the shared portrait view model, so the base
  // card manifest's `minimap`/`small` and the compiled catalog's `mm`/`sm` are
  // one variant with one name wherever they are shown (#10 Part 2 item 9).
  const variantLabel = useCallback(
    (variant: string) => {
      const canonical = normalizePortraitVariant(variant);
      const key = portraitVariantLabelKey(canonical);
      return key ? t(key) : variant;
    },
    [t],
  );
  const variantRank = useCallback(
    (variant: string) => portraitVariantRank(normalizePortraitVariant(variant)),
    [],
  );
  const loadMods = useAppStore((s) => s.loadMods);
  const mods = useAppStore((s) => s.mods);
  const foundryShuffleIncluded = useAppStore((s) => s.foundryShuffleIncluded);
  const toggleFoundryShuffleIncluded = useAppStore((s) => s.toggleFoundryShuffleIncluded);
  const toggleMod = useAppStore((s) => s.toggleMod);
  const cardShuffleIncluded = useAppStore((s) => s.cardShuffleIncluded);
  const toggleCardShuffleIncluded = useAppStore((s) => s.toggleCardShuffleIncluded);
  // This component is remounted per hero (the parent LockerHeroView is keyed
  // by hero.id), so initial state stands in for the per-hero reset.
  const [portraits, setPortraits] = useState<HeroPortrait[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // The source VPK filename whose card is currently applied for this hero.
  const [activeSource, setActiveSource] = useState<string | null>(null);
  // The source filename mid-apply/revert (drives the per-tile spinner).
  const [busySource, setBusySource] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  // Custom-upload state: the base-derived variant slots, the user's chosen PNG
  // per variant (path + preview data URL), and a busy flag during build.
  const [slots, setSlots] = useState<CustomCardSlot[]>([]);
  // Per-variant cropped output, keyed by variant: a PNG data URL already at the
  // variant's exact target size (produced by the cropper).
  const [picks, setPicks] = useState<Record<string, string>>({});
  // Signature of the picks last applied (or restored from disk on load), so we
  // can show Applied when nothing changed and re-enable on edit. null = unapplied.
  const [appliedSig, setAppliedSig] = useState<string | null>(null);
  const [customBusy, setCustomBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  // The variant currently open in the cropper, with its source image + slot.
  const [cropping, setCropping] = useState<{ slot: CustomCardSlot; sourceDataUrl: string } | null>(
    null
  );

  const customApplied = activeSource?.startsWith('custom:') ?? false;
  const picksSig = useMemo(() => picksSignature(picks), [picks]);
  const hasPicks = Object.keys(picks).length > 0;
  // Dirty == there are picks that differ from what's applied. Drives the button.
  const dirty = hasPicks && picksSig !== appliedSig;

  // A hero card is a family, not one image, and the Locker used to set one
  // surface at a time with no notion that the others exist. Reuses Foundry's
  // coverage reasoning rather than a second copy of it: each slot carries the
  // exact `.vtex_c` entry it replaces, so the ownership key is a real entry path
  // on both sides.
  //
  // Unlike the Foundry editor this warns instead of refusing. Foundry refuses
  // because its staging preflight already warned about the whole family, so
  // delivering a subset would under-deliver against something the user just
  // acknowledged. The Locker has no such preflight: an unfilled slot is simply
  // not written, and a custom main card with stock low-HP art is a legitimate
  // thing to want.
  const coverageGap = useMemo(() => {
    if (!hasPicks) return [];
    // `path` is the slot's real `.vtex_c` entry, so the family reasoning keys on
    // an exact entry path here exactly as it does in Foundry.
    const variants: PortraitVariant<CustomCardSlot & { path: string }>[] = slots.map((slot) => ({
      item: { ...slot, path: slot.entry },
      path: slot.entry,
      key: slot.variant,
      anchor: false,
    }));
    const overrides = Object.fromEntries(
      slots.filter((slot) => picks[slot.variant]).map((slot) => [slot.entry, slot.variant])
    );
    return portraitFamilyCoverageGap(variants, null, overrides);
  }, [slots, picks, hasPicks]);

  const uncoveredVariants = useMemo(() => {
    const byEntry = new Map(slots.map((slot) => [slot.entry, slot.variant]));
    return coverageGap.map((entry) => {
      const variant = byEntry.get(entry) ?? entry;
      return variantLabel(variant);
    });
  }, [coverageGap, slots, variantLabel]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setPicks({});
    setAppliedSig(null);
    Promise.all([
      getHeroPortraits(heroName),
      getActiveHeroCard(heroName),
      getCustomCardSlots(heroName),
      // Restore the user's previously-applied custom art so it persists across
      // restarts (the applied card lives on disk; this re-decodes it to data URLs).
      getAppliedCustomCard(heroName),
    ])
      .then(([list, activeCard, cardSlots, applied]) => {
        if (!active) return;
        setPortraits(list);
        setActiveSource(activeCard?.sourceFileName ?? null);
        setSlots(cardSlots);
        if (applied.length > 0) {
          const restored: Record<string, string> = {};
          for (const a of applied) restored[a.variant] = a.dataUrl;
          setPicks(restored);
          setAppliedSig(picksSignature(restored));
        }
      })
      .catch((err) => {
        if (active) setError(String(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [heroName]);

  /** A rebuild drops any selection whose source VPK has since been uninstalled.
   *  The service reports those names; without this the card just vanishes with
   *  no explanation, so surface them on the shared actionError line. */
  const reportMissingSources = (missing: string[]) => {
    if (missing.length === 0) return;
    setActionError(t('locker.cards.missingSources', { names: missing.join(', ') }));
  };

  const handlePick = async (modFileName: string) => {
    if (busySource) return;
    setBusySource(modFileName);
    setActionError(null);
    try {
      if (activeSource === modFileName) {
        await revertHeroCard(heroName);
        setActiveSource(null);
      } else {
        const result = await applyHeroCard(heroName, modFileName);
        setActiveSource(result.activeSourceFileName);
        reportMissingSources(result.missingSourceFileNames);
      }
      // Rebuild changed the cosmetics VPK and possibly the load order; refresh
      // the shared mod list so Installed/Locker stay in sync.
      await loadMods({ silent: true });
    } catch (err) {
      setActionError(String(err));
    } finally {
      setBusySource(null);
    }
  };

  const handlePickVariant = async (slot: CustomCardSlot) => {
    if (customBusy) return;
    try {
      const path = await showOpenDialog({
        title: t('locker.cards.chooseImageForCard', {
          variant: variantLabel(slot.variant),
        }),
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
      });
      if (!path) return;
      const sourceDataUrl = await readImageDataUrl(path);
      setActionError(null);
      setCropping({ slot, sourceDataUrl });
    } catch (err) {
      setActionError(String(err));
    }
  };

  const handleCropDone = (dataUrl: string) => {
    if (!cropping) return;
    const variant = cropping.slot.variant;
    setPicks((prev) => ({ ...prev, [variant]: dataUrl }));
    setCropping(null);
  };

  const handleClearVariant = (variant: string) => {
    setPicks((prev) => {
      const next = { ...prev };
      delete next[variant];
      return next;
    });
  };

  const handleApplyCustom = async () => {
    const uploads = Object.entries(picks).map(([variant, dataUrl]) => ({ variant, dataUrl }));
    if (uploads.length === 0 || customBusy || !dirty) return;
    const sigAtApply = picksSig;
    setCustomBusy(true);
    setActionError(null);
    try {
      const result = await applyCustomHeroCard(heroName, uploads);
      setActiveSource(result.activeSourceFileName);
      reportMissingSources(result.missingSourceFileNames);
      // Mark these exact picks as applied so the button reads "Applied" until
      // the user changes a slot.
      setAppliedSig(sigAtApply);
      await loadMods({ silent: true });
    } catch (err) {
      setActionError(String(err));
    } finally {
      setCustomBusy(false);
    }
  };

  const handleRevertCustom = async () => {
    if (customBusy) return;
    setCustomBusy(true);
    setActionError(null);
    try {
      await revertHeroCard(heroName);
      setActiveSource(null);
      setPicks({});
      setAppliedSig(null);
      await loadMods({ silent: true });
    } catch (err) {
      setActionError(String(err));
    } finally {
      setCustomBusy(false);
    }
  };

  const handleExportCustom = async () => {
    const uploads = Object.entries(picks).map(([variant, dataUrl]) => ({ variant, dataUrl }));
    if (uploads.length === 0 || exporting || customBusy) return;
    setActionError(null);
    try {
      const safeName = heroName.toLowerCase().replace(/[^a-z0-9]+/g, '_');
      const destPath = await showSaveDialog({
        title: t('locker.cards.exportDialogTitle', { hero: heroName }),
        defaultPath: `${safeName}_custom_card_dir.vpk`,
        filters: [{ name: 'VPK addon', extensions: ['vpk'] }],
      });
      if (!destPath) return;
      setExporting(true);
      const written = await exportCustomHeroCard(heroName, uploads, destPath);
      showToast(t('locker.cards.exportedToast', { path: written }), { tone: 'success', duration: 6000 });
      // Open the OS file browser at the exported file so they can find it.
      void revealPath(written);
    } catch (err) {
      setActionError(String(err));
    } finally {
      setExporting(false);
    }
  };

  // Group every decoded portrait under the mod file it came from. A single
  // file usually ships several variants (card, vertical, low-HP, gloat...), and
  // apply works on the whole per-hero prefix, so the file is the selectable
  // unit and its variants are shown side by side for preview.
  const portraitInventory = useMemo(() => buildPortraitInventory(mods), [mods]);
  const inventoryEntries = useMemo(() => portraitInventory.byHero.get(heroName) ?? [], [portraitInventory, heroName]);
  const inventoryByMetaKey = useMemo(() => new Map(inventoryEntries.map((entry) => [entry.metaKey, entry])), [inventoryEntries]);
  const modByMetaKey = useMemo(() => new Map(mods.map((mod) => [mod.metaKey, mod])), [mods]);
  const claimOverlaps = useMemo(() => overlappingClaims(inventoryEntries), [inventoryEntries]);
  const slotPaths = useMemo(() => new Set(slots.map((slot) => slot.entry.replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase())), [slots]);
  const slotLabels = useMemo(() => Object.fromEntries(slots.map((slot) => [slot.entry.replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase(), variantLabel(slot.variant)])), [slots, variantLabel]);
  const portraitFoundryMods = useMemo(() => mods.filter((mod) => foundryChangeEntries(mod).some((entry) => slotPaths.has(entry))), [mods, slotPaths]);
  const portraitFoundryChanges = useMemo(() => collectFoundryChanges(portraitFoundryMods).filter((entry) => entry.entries.some((path) => slotPaths.has(path))), [portraitFoundryMods, slotPaths]);

  const fileGroups = useMemo<PortraitFileGroup[]>(() => {
    const byFile = new Map<string, HeroPortrait[]>();
    for (const p of portraits) {
      const arr = byFile.get(p.modFileName) ?? [];
      arr.push(p);
      byFile.set(p.modFileName, arr);
    }
    return Array.from(byFile.entries()).map(([modFileName, variants]) => ({
      modFileName,
      variants: [...variants].sort((a, b) => variantRank(a.variant) - variantRank(b.variant)),
    }));
  }, [portraits, variantRank]);

  return (
    <section className="space-y-3 border-t border-border/60 pt-5">
      <div className="flex items-center gap-2">
        <Images className="w-4 h-4 text-accent" />
        <h3 className="text-sm font-semibold text-text-primary">{t('locker.cards.heroCard')}</h3>
        <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
          {t('locker.cards.experimental')}
        </span>
      </div>
      <p className="text-xs text-text-secondary">
        {t('locker.cards.intro', { hero: heroName })}
      </p>

      {loading && (
        <div className="flex items-center gap-2 py-4 text-xs text-text-secondary">
          <Loader2 className="w-4 h-4 animate-spin" /> {t('locker.cards.decodingPortraits')}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 py-2 text-xs text-state-danger">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span className="break-words">{error}</span>
        </div>
      )}

      {actionError && (
        <div className="flex items-start gap-2 py-2 text-xs text-state-danger">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span className="break-words">{actionError}</span>
        </div>
      )}

      {/* Browse first: the base-game family, what the game draws for it now,
          and where each variant came from. Everything below this is the
          existing install-and-upload flow, which starts from a mod or a file
          rather than from the portrait. */}
      {!error && (
        <HeroPortraitFamilies
          heroName={heroName}
          slots={slots}
          portraits={portraits}
          mods={mods}
          loading={loading}
          onReplaceVariant={handlePickVariant}
        />
      )}

      {!loading && !error && fileGroups.length === 0 && (
        <p className="py-2 text-xs text-text-secondary">
          {t('locker.cards.noCardArt', { hero: heroName })}
        </p>
      )}

      {claimOverlaps.length > 0 && (
        <p className="rounded-md border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-[11px] text-amber-200">{t('locker.cards.overlapNote', { count: claimOverlaps.length })}</p>
      )}
      {portraitFoundryChanges.length > 0 && (
        <div className="rounded-[10px] border border-border/70 bg-bg-sunken/55 p-3">
          <p className="text-xs font-semibold text-text-primary">{t('locker.cards.forgedPools')}</p>
          <p className="mt-1 text-[11px] text-text-secondary">{t('locker.cards.forgedPoolsNote')}</p>
          {/* The scope caption belongs at this call site rather than inside
              ChangePools.tsx: that component also renders in the cross-hero
              Foundry view, where the pool list scopes to all forged portraits,
              not to this hero. One key, one wording for the same shared pool. */}
          <p className="mt-1 text-[11px] text-text-secondary">{t('foundry.myChanges.shuffleScopeAllForged')}</p>
          <div className="mt-2"><FoundryPoolList mods={portraitFoundryMods} changes={portraitFoundryChanges} included={foundryShuffleIncluded} onToggleShuffleKey={toggleFoundryShuffleIncluded} onToggleMod={(modId) => void toggleMod(modId)} onOpenInInstalled={(modId) => { window.location.hash = `#/?focusMod=${encodeURIComponent(modId)}`; }} /></div>
        </div>
      )}
      {fileGroups.length > 0 && (
        <div className="space-y-2.5">
          {/* One caption for the whole per-hero shuffle control group, not one
              per card row: every row's shuffle button toggles the same per-hero
              shuffle set, keyed by hero and mod file, so they are one mechanism
              with one scope. */}
          <p className="text-[11px] text-text-secondary">{t('locker.cards.shuffleScopeThisHero')}</p>
          {fileGroups.map((group) => {
            const isApplied = activeSource === group.modFileName;
            const isBusy = busySource === group.modFileName;
            const shuffleKey = shuffleCardKey(heroName, group.modFileName);
            const inShuffle = cardShuffleIncluded.has(shuffleKey);
            const inventory = inventoryByMetaKey.get(group.modFileName);
            const source = inventory ?? (() => { const mod = modByMetaKey.get(group.modFileName); return mod ? { enabled: mod.enabled, provenance: portraitProvenanceOf(mod) } : null; })();
            return (
              <div
                key={group.modFileName}
                // Card tokens shared with the Skins grid / Global view so the
                // Cards tab reads as a sibling of Skins: accent border + glow
                // when applied, dim glass at rest. backdrop-blur on the resting
                // state too since these sit directly over the hero portrait.
                className={`group relative overflow-hidden rounded-[10px] border text-left backdrop-blur-sm transition-[border-color,background-color,box-shadow] duration-200 ${
                  isApplied
                    ? 'border-accent bg-accent/[0.08] shadow-[0_0_0_1px_var(--color-accent),0_0_18px_-6px_var(--color-accent)] hover:bg-accent/[0.12]'
                    : 'border-white/[0.08] bg-bg-sunken/55 hover:border-white/[0.16]'
                } ${busySource !== null && !isBusy ? 'opacity-60' : ''}`}
              >
                <div className="relative z-10 flex items-center justify-between gap-2 border-b border-border/50 px-3 py-2">
                  {/* The mod's own name, the same string the sources panel one
                      scroll below uses. These read as two different mods
                      otherwise: the 2026-07-30 matrix caught `pak12` heading a
                      card whose sources row called it
                      `Crying Girlfriend Mina`. */}
                  <span
                    className="truncate text-xs font-semibold text-text-primary"
                    title={group.modFileName}
                  >
                    {modByMetaKey.get(group.modFileName)?.name?.trim() ||
                      group.modFileName.replace(/_dir\.vpk$/, '')}
                  </span>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    {source && (<span className="rounded-full border border-border/70 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-text-secondary">{t(`locker.cards.provenance.${source.provenance}`)} {source.enabled ? t('locker.cards.enabled') : t('locker.cards.disabled')}</span>)}
                    <button
                      type="button"
                      disabled={busySource !== null}
                      onClick={() => toggleCardShuffleIncluded(shuffleKey)}
                      title={inShuffle ? t('locker.randomize.removeFromShuffle', { name: group.modFileName }) : t('locker.randomize.addToShuffle', { name: group.modFileName })}
                      aria-label={inShuffle ? t('locker.randomize.removeFromShuffle', { name: group.modFileName }) : t('locker.randomize.addToShuffle', { name: group.modFileName })}
                      className={`rounded p-1 transition-colors ${inShuffle ? 'bg-accent text-accent-foreground' : 'text-text-secondary hover:bg-white/10 hover:text-text-primary'}`}
                    >
                      <Shuffle className="h-3.5 w-3.5" />
                    </button>
                    {isApplied ? (
                      <span className="flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-accent-foreground">
                        <Check className="h-2.5 w-2.5" /> {t('locker.cards.applied')}
                      </span>
                    ) : (
                      <span className="text-[10px] uppercase tracking-wide text-text-secondary">
                        {t('locker.cards.portraitCount', { count: group.variants.length })}
                      </span>
                    )}
                  </div>
                </div>
                {/* Uniform aspect-3/4 tiles in a fixed grid keep the strip tidy
                    regardless of each variant's native aspect. max-w/h-full
                    contains the art without ever upscaling it, so tiny minimap
                    art stays crisp instead of blurring up to a forced height. */}
                <div className="relative z-10 grid grid-cols-4 gap-2 p-3">
                  {group.variants.map((p, i) => (
                    <figure key={`${p.variant}:${i}`} className="min-w-0">
                      <div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-md border border-border/50 bg-bg-primary/40">
                        <img
                          src={p.dataUrl}
                          alt={`${heroName} ${variantLabel(p.variant)}`}
                          title={`${variantLabel(p.variant)} (${t('locker.cards.variantToken', { token: p.variant })}) · ${p.width}x${p.height} · ${p.formatName}`}
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                      <figcaption className="mt-1 truncate text-center text-[9px] uppercase tracking-wide text-text-secondary">
                        {variantLabel(p.variant)}
                      </figcaption>
                    </figure>
                  ))}
                </div>
                <details className="relative z-10 border-t border-border/50 px-3 py-2">
                  <summary className="cursor-pointer text-[11px] text-text-secondary hover:text-text-primary">{t('locker.cards.ownership')}</summary>
                  <AssetSourcesPanel paths={[...slotPaths]} pathLabels={slotLabels} />
                </details>
                {isBusy && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <Loader2 className="h-5 w-5 animate-spin text-white" />
                  </span>
                )}
                <button
                  type="button"
                  disabled={busySource !== null}
                  onClick={() => handlePick(group.modFileName)}
                  title={t('locker.cards.fileGroupTitle', { file: group.modFileName, count: group.variants.length })}
                  aria-label={t('locker.cards.fileGroupTitle', { file: group.modFileName, count: group.variants.length })}
                  className="absolute inset-0 z-0 cursor-pointer disabled:cursor-not-allowed"
                />
              </div>
            );
          })}
        </div>
      )}

      {!loading && !error && slots.length > 0 && (
        <div
          className={`space-y-3 rounded-[10px] border p-3 backdrop-blur-sm transition-[border-color,box-shadow] duration-200 ${
            customApplied
              ? 'border-accent bg-accent/[0.08] shadow-[0_0_0_1px_var(--color-accent),0_0_18px_-6px_var(--color-accent)]'
              : 'border-white/[0.08] bg-bg-sunken/55'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Upload className="h-3.5 w-3.5 text-accent" />
              <span className="text-xs font-semibold text-text-primary">{t('locker.cards.uploadYourOwn')}</span>
            </div>
            {customApplied ? (
              <span className="flex flex-shrink-0 items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-accent-foreground">
                <Check className="h-2.5 w-2.5" /> {t('locker.cards.applied')}
              </span>
            ) : (
              <span className="flex-shrink-0 text-[10px] uppercase tracking-wide text-text-secondary">
                {t('locker.cards.slotCount', { count: slots.length })}
              </span>
            )}
          </div>
          <p className="text-[11px] leading-snug text-text-secondary">
            {t('locker.cards.uploadInstructions')}
          </p>

          {/* One tile per variant the base game ships. An empty slot rests
              subdued with an upload hint; a filled slot shows the cropped
              result with a clear (x) button. Each tile keeps the variant's true
              aspect so the preview matches the in-game shape.

              Empty slots subdue the base art so a filled slot reads first, but
              hover and keyboard focus restore it to full colour: the whole
              point of showing base art is to let you see what is actually there
              before you replace it, and a permanently dimmed preview cannot do
              that. The upload hint is a corner badge rather than a full-cover
              scrim for the same reason, since darkening the art during the
              reveal would defeat the reveal. Same treatment as the inactive
              skin thumbnails in HeroSkinsPanel. */}
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
            {slots.map((slot) => {
              const pick = picks[slot.variant];
              return (
                <figure key={slot.variant} className="relative min-w-0">
                  <button
                    type="button"
                    disabled={customBusy}
                    onClick={() => handlePickVariant(slot)}
                    title={`${variantLabel(slot.variant)} · ${slot.width} x ${slot.height}`}
                    style={{ aspectRatio: `${slot.width} / ${slot.height}` }}
                    className="group relative flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-md border border-border/50 bg-bg-primary/40 transition-colors hover:border-accent/50 disabled:cursor-not-allowed"
                  >
                    <img
                      src={pick ?? slot.baseDataUrl}
                      alt={`${heroName} ${variantLabel(slot.variant)}`}
                      className={variantPreviewClass(Boolean(pick))}
                    />
                    <span className="pointer-events-none absolute bottom-1 right-1 flex items-center rounded-full bg-black/70 p-1 text-white/75 opacity-80 ring-1 ring-white/15 transition-[opacity,color] duration-200 group-hover:text-white group-hover:opacity-100 group-focus-within:text-white group-focus-within:opacity-100 motion-reduce:transition-none">
                      <Upload className="h-3 w-3" />
                    </span>
                  </button>
                  {pick && (
                    <button
                      type="button"
                      disabled={customBusy}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClearVariant(slot.variant);
                      }}
                      title={t('locker.cards.clearImage')}
                      aria-label={t('locker.cards.clearVariantImage', {
                        variant: variantLabel(slot.variant),
                      })}
                      className="absolute right-1 top-1 z-10 cursor-pointer rounded-full bg-black/75 p-1 text-white/90 shadow-sm ring-1 ring-white/10 transition-colors hover:bg-black/90 hover:text-white disabled:cursor-not-allowed"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <figcaption className="mt-1 text-center">
                    <span className="block truncate text-[9px] uppercase tracking-wide text-text-secondary">
                      {variantLabel(slot.variant)}
                    </span>
                    <span className="block text-[9px] tabular-nums text-text-secondary/70">
                      {slot.width} x {slot.height}
                    </span>
                  </figcaption>
                </figure>
              );
            })}
          </div>

          {/* Partial-family warning: name the variants that will keep their
              stock art, so an incomplete card is a choice rather than a
              surprise noticed in-game. */}
          {uncoveredVariants.length > 0 && (
            <p className="flex items-start gap-1.5 rounded-md border border-amber-400/40 bg-amber-400/10 px-2.5 py-1.5 text-[11px] leading-snug text-amber-300">
              <AlertCircle className="mt-px h-3.5 w-3.5 flex-shrink-0" />
              <span>
                {t('locker.cards.partialFamily', {
                  count: uncoveredVariants.length,
                  variants: uncoveredVariants.join(', '),
                })}
              </span>
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              // Clickable only when there's something new to apply. After apply
              // it reads "Applied" and stays disabled until a slot changes.
              disabled={customBusy || !dirty}
              onClick={handleApplyCustom}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed ${
                customApplied && !dirty
                  ? 'bg-accent/15 text-accent ring-1 ring-accent/40'
                  : 'bg-accent text-accent-foreground hover:bg-accent-hover disabled:opacity-50'
              }`}
            >
              {customBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              {customBusy
                ? t('locker.cards.applying')
                : customApplied && !dirty
                  ? t('locker.cards.applied')
                  : customApplied
                    ? t('locker.cards.updateCustomCard')
                    : t('locker.cards.applyCustomCard')}
            </button>
            <button
              type="button"
              disabled={exporting || customBusy || !hasPicks}
              onClick={handleExportCustom}
              title={t('locker.cards.exportVpkTitle')}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border/60 px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-white/20 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {exporting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              {t('locker.cards.exportVpk')}
            </button>
            {customApplied && (
              <button
                type="button"
                disabled={customBusy}
                onClick={handleRevertCustom}
                className="inline-flex cursor-pointer items-center rounded-md border border-border/60 px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-white/20 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t('locker.cards.revert')}
              </button>
            )}
          </div>
        </div>
      )}

      {cropping && (
        <CardCropper
          imageDataUrl={cropping.sourceDataUrl}
          targetWidth={cropping.slot.width}
          targetHeight={cropping.slot.height}
          variantLabel={variantLabel(cropping.slot.variant)}
          onCancel={() => setCropping(null)}
          onCrop={handleCropDone}
        />
      )}
    </section>
  );
}
