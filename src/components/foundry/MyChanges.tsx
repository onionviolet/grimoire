import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  ChevronDown,
  ExternalLink,
  Image as ImageIcon,
  Layers,
  List,
  Loader2,
  Pencil,
  Plus,
  Power,
  RefreshCw,
  Search,
  Shuffle,
  Trash2,
  Volume2,
} from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { canonicalHeroName } from '../../lib/lockerUtils';
import { showToast } from '../../stores/toastStore';
import {
  foundryCheckAudioPaths,
  foundryForgeInstall,
  foundryInspectAssetSources,
  foundrySoundAnnotations,
  saveFoundrySoundAnnotation,
} from '../../lib/api';
import type { FoundryAssetSourcesInspection, SoundAnnotation } from '../../types/foundry';
import { SoundChangeDetails } from './MySoundChanges';
import FoundryPoolList from './ChangePools';
import AlternativePreview from './AlternativesGallery';
import { foundryShuffleKey, groupFoundryShufflePools } from '../../lib/foundryChanges';
import {
  collectFoundryChanges,
  filterFoundryChanges,
  groupFoundryChanges,
  sortFoundryChanges,
  type FoundryChangeEntry,
  type FoundryChangeFilter,
  type FoundryChangeSort,
} from './changeList';

/** Filter shelves, in the order a user is likely to look for them. `all` first,
 *  then the two authoring surfaces they actually spend time in. */
const FILTERS: Array<{ value: FoundryChangeFilter; labelKey: string; fallback: string }> = [
  { value: 'all', labelKey: 'foundry.myChanges.filters.all', fallback: 'Everything' },
  { value: 'sound', labelKey: 'foundry.myChanges.filters.sound', fallback: 'Sounds' },
  { value: 'hero-image', labelKey: 'foundry.myChanges.filters.heroImage', fallback: 'Portraits & hero images' },
  { value: 'ability-icon', labelKey: 'foundry.myChanges.filters.abilityIcon', fallback: 'Ability icons' },
  { value: 'item-icon', labelKey: 'foundry.myChanges.filters.itemIcon', fallback: 'Item icons' },
  { value: 'other', labelKey: 'foundry.myChanges.filters.other', fallback: 'Other textures' },
];

const SORTS: Array<{ value: FoundryChangeSort; labelKey: string; fallback: string }> = [
  { value: 'recent', labelKey: 'foundry.myChanges.sort.recent', fallback: 'Recently added' },
  { value: 'name', labelKey: 'foundry.myChanges.sort.name', fallback: 'Name' },
  { value: 'hero', labelKey: 'foundry.myChanges.sort.hero', fallback: 'Hero' },
  { value: 'enabled', labelKey: 'foundry.myChanges.sort.enabled', fallback: 'Enabled first' },
];

interface MyChangesProps {
  /** Jump to the authoring surface that makes this kind of change. The shell
   *  owns sub-tool selection, so the view only names what the user wants. */
  onAddNew?: (filter: FoundryChangeFilter) => void;
  /** Scope every row to one hero (the hero workshop). Unscoped changes are
   *  excluded rather than shown under a hero they do not belong to. */
  heroName?: string;
}

/**
 * Everything the user has actually changed in Foundry, in one place, derived
 * from installed-mod provenance. It is deliberately a thin view over the normal
 * mod store: toggling here calls the same action Installed and the Locker call,
 * so the three surfaces cannot drift on enabled state.
 *
 * What it adds on top of the store is path-level truth. An enabled change is
 * not necessarily the change you get, because a lower-priority VPK writing the
 * same entries wins. That is resolved by inspecting each row's recorded exact
 * paths, never by trusting a mod's own enabled flag or its label.
 */
export default function MyChanges({ onAddNew, heroName }: MyChangesProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const mods = useAppStore((state) => state.mods);
  const toggleMod = useAppStore((state) => state.toggleMod);
  const deleteMod = useAppStore((state) => state.deleteMod);
  const editLocalMod = useAppStore((state) => state.editLocalMod);

  const foundryShuffleIncluded = useAppStore((state) => state.foundryShuffleIncluded);
  const toggleFoundryShuffleIncluded = useAppStore((state) => state.toggleFoundryShuffleIncluded);
  const shuffleOnLaunch = useAppStore((state) => state.shuffleOnLaunch);

  const [filter, setFilter] = useState<FoundryChangeFilter>('all');
  const [sort, setSort] = useState<FoundryChangeSort>('recent');
  // The flat list stays the default: it is how you find one thing. The pool
  // view is the deciding surface, so it is opt-in rather than a replacement.
  const [viewMode, setViewMode] = useState<'flat' | 'pools'>('flat');
  const [query, setQuery] = useState('');
  const [renaming, setRenaming] = useState<Record<string, boolean>>({});
  const [draftName, setDraftName] = useState<Record<string, string>>({});

  const all = useMemo(() => {
    const changes = collectFoundryChanges(mods);
    if (!heroName) return changes;
    const wanted = canonicalHeroName(heroName);
    // Hero scoping compares canonical names so an alias recorded by one surface
    // still matches the roster name another surface used.
    return changes.filter((entry) => entry.heroName && canonicalHeroName(entry.heroName) === wanted);
  }, [mods, heroName]);
  const visible = useMemo(
    () => sortFoundryChanges(filterFoundryChanges(all, { filter, query }), sort),
    [all, filter, query, sort],
  );
  const groups = useMemo(() => groupFoundryChanges(visible), [visible]);
  const shown = visible.length;

  // Annotations describe the base-game sound, not the mod, and are shared with
  // the Sound browser, so they are fetched once here rather than per row.
  const [annotations, setAnnotations] = useState<Record<string, SoundAnnotation>>({});
  useEffect(() => {
    let cancelled = false;
    foundrySoundAnnotations()
      .then((entries) => {
        if (!cancelled) setAnnotations(Object.fromEntries(entries.map((entry) => [entry.key, entry.annotation])));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const saveAnnotation = useCallback(async (key: string, name: string, note: string) => {
    const saved = await saveFoundrySoundAnnotation(key, name, note, []);
    setAnnotations((current) => {
      const next = { ...current };
      if (saved) next[key] = saved.annotation;
      else delete next[key];
      return next;
    });
  }, []);

  const openInInstalled = useCallback((modId: string) => navigate(`/?focusMod=${encodeURIComponent(modId)}`), [navigate]);

  // Which changes contend for the same game paths. The shuffle only means
  // something inside such a group, so the UI is built from the same grouping
  // the launch planner uses rather than a second opinion about it.
  const poolByModId = useMemo(() => {
    const map = new Map<string, { size: number; siblings: string[] }>();
    for (const pool of groupFoundryShufflePools(mods)) {
      for (const mod of pool.mods) {
        map.set(mod.id, { size: pool.mods.length, siblings: pool.mods.filter((other) => other.id !== mod.id).map((other) => other.name) });
      }
    }
    return map;
  }, [mods]);
  const pooledCount = useMemo(
    () => new Set(all.filter((entry) => foundryShuffleIncluded.has(foundryShuffleKey(entry.mod))).map((entry) => entry.mod.id)).size,
    [all, foundryShuffleIncluded],
  );

  return (
    <div className="space-y-3">
      {/* This view is hosted between the sub-tool rail and the docked build
          tray, and on a high-DPI Windows display the whole viewport can be
          ~1030 CSS px, leaving this column around 250. Every element therefore
          has to be able to shrink: min-w-0 defeats flex's default
          min-width:auto, and the search takes its own row (basis-full) so the
          controls below it wrap instead of pushing the row under the tray. */}
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <label className="relative min-w-0 basis-full">
          <Search size={13} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('foundry.myChanges.searchPlaceholder', 'Search your changes, or paste a game path')}
            aria-label={t('foundry.myChanges.search', 'Search changes')}
            className="w-full rounded-sm border border-border bg-bg-primary py-1.5 pl-7 pr-2 text-sm text-text-primary"
          />
        </label>
        <label className="min-w-0 flex-1 text-xs text-text-secondary">
          <span className="sr-only">{t('foundry.myChanges.filterLabel', 'Show')}</span>
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as FoundryChangeFilter)}
            className="w-full min-w-0 rounded-sm border border-border bg-bg-primary px-2 py-1.5 text-sm text-text-primary"
          >
            {FILTERS.map((option) => (
              <option key={option.value} value={option.value}>{t(option.labelKey, option.fallback)}</option>
            ))}
          </select>
        </label>
        <label className="min-w-0 flex-1 text-xs text-text-secondary">
          <span className="sr-only">{t('foundry.myChanges.sortLabel', 'Sort by')}</span>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as FoundryChangeSort)}
            className="w-full min-w-0 rounded-sm border border-border bg-bg-primary px-2 py-1.5 text-sm text-text-primary"
          >
            {SORTS.map((option) => (
              <option key={option.value} value={option.value}>{t(option.labelKey, option.fallback)}</option>
            ))}
          </select>
        </label>
        {/* Beside the sort control, because it is the same kind of decision:
            how the same set of changes is arranged. */}
        <div role="group" aria-label={t('poolView.viewLabel', 'View')} className="flex shrink-0 rounded-sm border border-border">
          <button
            type="button"
            onClick={() => setViewMode('flat')}
            aria-pressed={viewMode === 'flat'}
            title={t('poolView.viewFlatHint', 'One row per change, for finding one thing')}
            className={`flex items-center gap-1 rounded-l-sm px-2 py-1.5 text-xs ${
              viewMode === 'flat' ? 'bg-accent/15 text-accent' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <List size={13} /> {t('poolView.viewFlat', 'List')}
          </button>
          <button
            type="button"
            onClick={() => setViewMode('pools')}
            aria-pressed={viewMode === 'pools'}
            title={t('poolView.viewPoolsHint', 'Group changes that write the same game paths, for deciding between alternatives')}
            className={`flex items-center gap-1 rounded-r-sm border-l border-border px-2 py-1.5 text-xs ${
              viewMode === 'pools' ? 'bg-accent/15 text-accent' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Layers size={13} /> {t('poolView.viewPools', 'Pools')}
          </button>
        </div>
        {onAddNew && (
          <button
            type="button"
            onClick={() => onAddNew(filter)}
            className="flex items-center gap-1.5 rounded-sm bg-accent px-2.5 py-1.5 text-sm font-medium text-white"
          >
            <Plus size={14} /> {t('foundry.myChanges.addNew', 'Make a new one')}
          </button>
        )}
      </div>

      {/* State the contract plainly: pooling is per contended path group, and
          opting one change in makes that whole group exclusive at launch. A
          user who does not know that would read a disabled sibling as a bug. */}
      {pooledCount > 0 && (
        <p className="flex items-start gap-2 rounded-sm border border-border bg-bg-tertiary/40 p-2 text-[11px] text-text-secondary">
          <Shuffle size={12} className="mt-px shrink-0 text-accent" />
          <span>
            {t('foundry.myChanges.shuffleSummary', { count: pooledCount })}
            {!shuffleOnLaunch && ` ${t('foundry.myChanges.shuffleOff', 'Shuffle on launch is currently off, so nothing will be re-rolled. Turn it on in the Locker.')}`}
          </span>
        </p>
      )}

      {all.length === 0 ? (
        <p className="rounded-sm border border-dashed border-border p-3 text-sm text-text-secondary">
          {t('foundry.myChanges.empty')}
        </p>
      ) : shown === 0 ? (
        <p className="rounded-sm border border-dashed border-border p-3 text-sm text-text-secondary">
          {t('foundry.myChanges.emptyFiltered', 'No change matches this filter. {{total}} in total.', { total: all.length })}
        </p>
      ) : viewMode === 'pools' ? (
        <FoundryPoolList
          mods={mods}
          changes={visible}
          included={foundryShuffleIncluded}
          onToggleShuffleKey={toggleFoundryShuffleIncluded}
          onToggleMod={(modId) => void toggleMod(modId)}
          onOpenInInstalled={openInInstalled}
          // The alternatives gallery. It only fills the cell's leading slot with
          // the change's own source material (a thumbnail, or an audition for a
          // sound); enabled state and the runtime winner stay entirely with the
          // pool card and the mod store.
          renderMemberPreview={(member) => <AlternativePreview member={member} />}
        />
      ) : (
        groups.map(([scope, entries]) => (
          <section key={scope || '__global'} className="rounded-sm border border-border">
            <h3 className="flex items-center justify-between border-b border-border px-3 py-2 text-sm font-medium text-text-primary">
              <span>{scope || t('foundry.myChanges.unscoped', 'Not hero-specific')}</span>
              {scope && (
                <button
                  type="button"
                  onClick={() => navigate(`/locker?hero=${encodeURIComponent(scope)}`)}
                  className="flex items-center gap-1 text-[11px] font-normal text-text-secondary hover:text-text-primary"
                >
                  <ExternalLink size={11} /> {t('foundry.myChanges.openInLocker', 'Open in Locker')}
                </button>
              )}
            </h3>
            {entries.map((entry) => {
              const editing = renaming[entry.id];
              const value = draftName[entry.id] ?? entry.mod.name;
              const Icon = entry.kind === 'sound' ? Volume2 : ImageIcon;
              return (
                <div key={entry.id} className="border-b border-border/60 px-3 py-2 last:border-b-0">
                  <div className="flex items-center gap-2">
                    <Icon size={14} className="shrink-0 text-accent" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-text-primary">{entry.title}</p>
                      <p className="truncate text-[11px] text-text-secondary" title={entry.subtitle}>
                        {[entry.subtitle, entry.sourceFileName].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    {entry.partOfBuild && (
                      <span className="shrink-0 rounded-sm bg-bg-tertiary px-1 text-[10px] uppercase tracking-wide text-text-secondary">
                        {t('foundry.myChanges.partOfBuild', 'part of a build')}
                      </span>
                    )}
                    {(() => {
                      const pool = poolByModId.get(entry.mod.id);
                      const key = foundryShuffleKey(entry.mod);
                      const inPool = foundryShuffleIncluded.has(key);
                      // A change with no recorded paths cannot be pooled: we
                      // would be guessing what it competes with. Say why rather
                      // than offering a control that silently does nothing.
                      const title = !pool
                        ? t('foundry.myChanges.shuffleUnavailable', 'This change has no recorded paths, so it cannot be pooled')
                        : pool.size > 1
                          ? t('foundry.myChanges.shuffleWith', { mods: pool.siblings.join(', ') })
                          : t('foundry.myChanges.shuffleAlone', 'Nothing else writes these paths yet, so this pool has only one outcome');
                      return (
                        <button
                          type="button"
                          disabled={!pool}
                          onClick={() => toggleFoundryShuffleIncluded(key)}
                          title={title}
                          aria-pressed={inPool}
                          className={`shrink-0 rounded-sm border p-1.5 disabled:cursor-not-allowed disabled:opacity-30 ${
                            inPool ? 'border-accent/60 bg-accent/15 text-accent' : 'border-border text-text-secondary hover:text-text-primary'
                          }`}
                        >
                          <Shuffle size={13} />
                        </button>
                      );
                    })()}
                    <span className={`shrink-0 text-[11px] ${entry.mod.enabled ? 'text-green-400' : 'text-text-secondary'}`}>
                      {entry.mod.enabled ? t('foundry.myChanges.enabled') : t('foundry.myChanges.disabled')}
                    </span>
                    <button
                      type="button"
                      onClick={() => void toggleMod(entry.mod.id)}
                      title={entry.mod.enabled ? t('foundry.myChanges.disable') : t('foundry.myChanges.enable')}
                      className="rounded-sm border border-border p-1.5 text-text-secondary hover:text-text-primary"
                    >
                      <Power size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setRenaming((current) => ({ ...current, [entry.id]: !editing }))}
                      title={t('foundry.myChanges.rename')}
                      className="rounded-sm border border-border p-1.5 text-text-secondary hover:text-text-primary"
                    >
                      {editing ? <ChevronDown size={13} /> : <Pencil size={13} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        // A build's parts are one VPK, so deleting any row
                        // deletes the whole thing. Say so before it happens.
                        const prompt = entry.partOfBuild
                          ? t('foundry.myChanges.deleteBuildConfirm', 'Delete "{{name}}"? Every change in this build goes with it.', { name: entry.mod.name })
                          : t('foundry.myChanges.deleteConfirm', { name: entry.mod.name });
                        if (window.confirm(prompt)) void deleteMod(entry.mod.id);
                      }}
                      title={t('foundry.myChanges.delete')}
                      className="rounded-sm border border-border p-1.5 text-red-300 hover:text-red-200"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  {editing && (
                    <form
                      className="mt-2 flex gap-2"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const name = value.trim();
                        if (name) {
                          void editLocalMod(entry.mod.id, { name })
                            .then(() => setRenaming((current) => ({ ...current, [entry.id]: false })));
                        }
                      }}
                    >
                      <input
                        aria-label={t('foundry.myChanges.nameLabel')}
                        value={value}
                        onChange={(event) => setDraftName((current) => ({ ...current, [entry.id]: event.target.value }))}
                        className="min-w-0 flex-1 rounded-sm border border-border bg-bg-primary px-2 py-1 text-sm text-text-primary"
                      />
                      <button className="rounded-sm bg-accent px-2 text-sm text-bg-primary">{t('foundry.myChanges.save')}</button>
                    </form>
                  )}
                  {/* A sound swap has recorded assignments, annotations, and a
                      re-forge of its own, so it keeps its richer panel. Every
                      other row (installed builds, legacy replacements) gets the
                      shared exact-path view. */}
                  {entry.mod.soundSwap && !entry.partOfBuild && entry.kind === 'sound' ? (
                    <SoundChangeDetails
                      mod={entry.mod}
                      annotations={annotations}
                      onSaveAnnotation={saveAnnotation}
                      onOpenInInstalled={openInInstalled}
                    />
                  ) : (
                    <ChangeDetails entry={entry} onOpenInInstalled={openInInstalled} />
                  )}
                </div>
              );
            })}
          </section>
        ))
      )}
    </div>
  );
}

/**
 * The shared detail panel: who actually wins each exact path this change
 * claims, a jump to the owner that beats it, and a rebuild for installed builds
 * that recorded their request.
 *
 * The rebuild deliberately produces a NEW managed mod rather than editing the
 * existing one in place, matching the sound re-forge: the original is the
 * user's to remove from Installed once they are happy with the replacement.
 */
function ChangeDetails({
  entry,
  onOpenInInstalled,
}: {
  entry: FoundryChangeEntry;
  onOpenInInstalled: (modId: string) => void;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [inspection, setInspection] = useState<FoundryAssetSourcesInspection | null>(null);
  const [inspectError, setInspectError] = useState<string | null>(null);
  const [inspecting, setInspecting] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);

  const recorded = entry.mod.foundryBuild?.reforge;
  const entries = entry.entries;

  const inspect = useCallback(async () => {
    if (!entries.length) return;
    setInspecting(true);
    setInspectError(null);
    try {
      setInspection(await foundryInspectAssetSources(entries));
    } catch (cause) {
      setInspection(null);
      setInspectError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setInspecting(false);
    }
  }, [entries]);

  useEffect(() => {
    if (expanded && !inspection && !inspectError && entries.length) void inspect();
  }, [expanded, inspection, inspectError, entries.length, inspect]);

  const losses = useMemo(() => {
    if (!inspection) return [];
    return Object.entries(inspection.winners)
      .filter(([, winnerId]) => winnerId !== null && winnerId !== entry.mod.id)
      .map(([path, winnerId]) => ({
        path,
        winnerId: winnerId as string,
        winnerName: inspection.sources.find((source) => source.modId === winnerId)?.modName ?? winnerId!,
      }));
  }, [inspection, entry.mod.id]);

  const rebuild = useCallback(async () => {
    if (!recorded || rebuilding) return;
    setRebuilding(true);
    try {
      // The recorded sources are the user's own files and may have moved since
      // the build. Check before starting rather than failing partway through.
      const wanted = [...new Set(recorded.edits.flatMap((edit) => (edit.kind === 'sound'
        ? [edit.request.audioPath, ...(edit.request.assignments ?? []).map((assignment) => assignment.audioPath)]
        : [edit.request.imagePath])).filter(Boolean))];
      const present = new Set(await foundryCheckAudioPaths(wanted));
      const missing = wanted.filter((path) => !present.has(path));
      if (missing.length) {
        showToast(
          t('foundry.myChanges.rebuildMissing', {
            count: missing.length,
            files: missing.map((path) => path.split(/[\\/]/).pop()).join(', '),
          }),
          { tone: 'error', duration: 9000 },
        );
        return;
      }
      const preflight = await foundryInspectAssetSources(entries);
      if (preflight.unreadableMods.length) {
        showToast(
          t('foundry.myChanges.reforgeUnreadable', { mods: preflight.unreadableMods.map((mod) => mod.modName).join(', ') }),
          { tone: 'error', duration: 9000 },
        );
        return;
      }
      const others = preflight.sources.filter((source) => source.modId !== entry.mod.id && source.enabled);
      if (others.length && !window.confirm(
        t('foundry.myChanges.reforgeConflict', { mods: others.map((source) => source.modName).join(', ') }),
      )) return;
      await foundryForgeInstall({ ...recorded, name: t('foundry.myChanges.reforgedName', { name: entry.mod.name }) });
      await useAppStore.getState().loadMods({ silent: true });
      setInspection(null);
      showToast(t('foundry.myChanges.reforgeDone', { name: entry.mod.name }), { tone: 'success', duration: 6000 });
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : String(cause), { tone: 'error', duration: 8000 });
    } finally {
      setRebuilding(false);
    }
  }, [recorded, rebuilding, entries, entry.mod.id, entry.mod.name, t]);

  return (
    <div className="mt-1.5 text-[11px] text-text-secondary">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className="flex items-center gap-1 rounded-sm px-1 py-0.5 hover:text-text-primary"
      >
        <ChevronDown size={11} className={expanded ? '' : '-rotate-90'} />
        {entries.length
          ? `${t('foundry.myChanges.assetDetails', 'Asset details')} · ${t('foundry.myChanges.recordedPaths', { count: entries.length })}`
          : t('foundry.myChanges.assetDetails', 'Asset details')}
      </button>
      {expanded && (
        <div className="mt-1 space-y-1.5 rounded-sm border border-border bg-bg-tertiary/40 p-2">
          {entries.length === 0 ? (
            <p>{t('foundry.myChanges.noWriteSet')}</p>
          ) : inspecting ? (
            <p className="flex items-center gap-1"><Loader2 size={11} className="animate-spin" /> {t('foundry.myChanges.resolving')}</p>
          ) : inspectError ? (
            <p className="flex items-start gap-1 text-danger">
              <AlertTriangle size={11} className="mt-px shrink-0" />
              <span>
                {inspectError}{' '}
                <button type="button" onClick={() => { setInspectError(null); void inspect(); }} className="underline">
                  {t('foundry.myChanges.tryAgain')}
                </button>
              </span>
            </p>
          ) : inspection ? (
            <>
              {inspection.unreadableMods.length > 0 && (
                <p className="flex items-start gap-1 text-danger">
                  <AlertTriangle size={11} className="mt-px shrink-0" />
                  <span>{t('foundry.myChanges.incompleteInspection', { mods: inspection.unreadableMods.map((mod) => mod.modName).join(', ') })}</span>
                </p>
              )}
              {losses.length === 0 ? (
                <p className="text-text-primary">{entry.mod.enabled ? t('foundry.myChanges.winsAll') : t('foundry.myChanges.disabledInactive')}</p>
              ) : (
                losses.map((loss) => (
                  <div key={loss.path} className="flex flex-wrap items-center gap-1">
                    <span className="truncate text-danger" title={loss.path}>{t('foundry.myChanges.overriddenAt', { path: loss.path })}</span>
                    <span>{t('foundry.myChanges.overriddenBy', { winner: loss.winnerName })}</span>
                    <button type="button" onClick={() => onOpenInInstalled(loss.winnerId)} className="flex items-center gap-1 rounded-sm border border-border px-1.5 py-0.5 hover:text-text-primary">
                      <ExternalLink size={10} /> {t('foundry.myChanges.openWinner')}
                    </button>
                  </div>
                ))
              )}
              <button type="button" onClick={() => void inspect()} className="flex items-center gap-1 rounded-sm border border-border px-1.5 py-0.5 hover:text-text-primary">
                <RefreshCw size={10} /> {t('foundry.myChanges.recheck')}
              </button>
            </>
          ) : null}

          <div className="flex flex-wrap gap-1 border-t border-border/60 pt-1.5">
            <button
              type="button"
              onClick={() => onOpenInInstalled(entry.mod.id)}
              className="flex items-center gap-1 rounded-sm border border-border px-1.5 py-0.5 hover:text-text-primary"
            >
              <ExternalLink size={10} /> {t('foundry.myChanges.openInInstalled', 'Open in Installed')}
            </button>
            <button
              type="button"
              disabled={!recorded || rebuilding}
              onClick={() => void rebuild()}
              title={recorded ? t('foundry.myChanges.rebuildHint', 'Rebuild this change from its recorded sources') : t('foundry.myChanges.rebuildUnavailable', 'This change has no recorded sources to rebuild from')}
              className="flex items-center gap-1 rounded-sm border border-border px-1.5 py-0.5 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
            >
              {rebuilding ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />} {t('foundry.myChanges.rebuild', 'Rebuild')}
            </button>
          </div>
          {entries.length > 0 && (
            <div className="max-h-24 space-y-0.5 overflow-auto">
              {entries.map((path) => <p key={path} className="truncate" title={path}>{path}</p>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
