import { useEffect, useMemo, useState } from 'react';
import { Heart, ExternalLink, Loader2, Search, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import ModThumbnail from '../components/ModThumbnail';
import { Button, IconButton } from '../components/common/ui';
import type { CachedMod, SavedMod } from '../types/electron';
import { formatDate } from '../types/gamebanana';
import { useAppStore } from '../stores/appStore';

type SavedFilter = 'all' | 'Mod' | 'Sound' | 'Wip';
type SavedSort = 'saved' | 'name' | 'updated';

interface SavedRow {
  saved: SavedMod;
  mod: CachedMod | null;
}

const sectionLabels: Record<SavedFilter, string> = {
  all: 'All',
  Mod: 'Mods',
  Sound: 'Sounds',
  Wip: 'WiPs',
};

export default function Saved() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setBrowseUi = useAppStore((state) => state.setBrowseUi);
  const [rows, setRows] = useState<SavedRow[]>([]);
  const [filter, setFilter] = useState<SavedFilter>('all');
  const [sort, setSort] = useState<SavedSort>('saved');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const loadSaved = async () => {
    setLoading(true);
    try {
      const favorites = await window.electronAPI.getSavedMods();
      const loaded = await Promise.all(
        favorites.map(async (favorite) => ({
          saved: favorite,
          mod: await window.electronAPI.getCachedMod(favorite.modId),
        }))
      );
      setRows(loaded);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSaved();
  }, []);

  const visibleRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return rows
      .filter((row) => filter === 'all' || row.saved.section === filter)
      .filter((row) => {
        if (!query) return true;
        const haystack = `${row.mod?.name ?? row.saved.titleSnapshot ?? ''} ${row.mod?.submitterName ?? ''} ${row.mod?.categoryName ?? ''} ${row.saved.fileName ?? ''} ${row.saved.modId}`.toLocaleLowerCase();
        return haystack.includes(query);
      })
      .sort((left, right) => {
        if (sort === 'name') return (left.mod?.name ?? left.saved.titleSnapshot ?? '').localeCompare(right.mod?.name ?? right.saved.titleSnapshot ?? '');
        if (sort === 'updated') return (right.mod?.dateModified ?? 0) - (left.mod?.dateModified ?? 0);
        return right.saved.savedAt - left.saved.savedAt;
      });
  }, [filter, rows, search, sort]);

  const openInBrowse = (row: SavedRow) => {
    setBrowseUi({ section: row.saved.section, search: '', categoryId: 'all', heroCategoryId: 'all', submitter: undefined });
    navigate('/browse');
  };

  const remove = async (row: SavedRow) => {
    await window.electronAPI.removeSavedMod(row.saved.modId, row.saved.section, row.saved.fileId);
    setRows((current) => current.filter((candidate) => candidate !== row));
  };

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-accent">
              <Heart className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-[0.18em]">{t('nav.saved')}</span>
            </div>
            <h1 className="mt-1 text-2xl font-semibold text-text-primary">{t('saved.title')}</h1>
            <p className="mt-1 text-sm text-text-secondary">{t('saved.description')}</p>
          </div>
          <div className="flex w-full max-w-md items-center gap-2 rounded-md border border-border bg-bg-secondary px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-text-secondary" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('saved.search')}
              className="min-w-0 flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-secondary"
            />
          </div>
        </div>

        <div className="mb-5 flex flex-wrap items-center gap-2">
          {(Object.keys(sectionLabels) as SavedFilter[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${filter === value ? 'border-accent bg-accent/15 text-accent' : 'border-border text-text-secondary hover:text-text-primary'}`}
            >
              {t(`saved.sections.${value}`, sectionLabels[value])}
            </button>
          ))}
          <label className="ml-auto flex items-center gap-2 text-sm text-text-secondary">
            <span>{t('saved.sort')}</span>
            <select value={sort} onChange={(event) => setSort(event.target.value as SavedSort)} className="rounded-md border border-border bg-bg-secondary px-2 py-1.5 text-text-primary outline-none">
              <option value="saved">{t('saved.sortOptions.saved')}</option>
              <option value="name">{t('saved.sortOptions.name')}</option>
              <option value="updated">{t('saved.sortOptions.updated')}</option>
            </select>
          </label>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-text-secondary"><Loader2 className="h-5 w-5 animate-spin" />{t('saved.loading')}</div>
        ) : visibleRows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-12 text-center text-text-secondary">
            <Heart className="mx-auto mb-3 h-8 w-8 opacity-50" />
            <p className="text-text-primary">{rows.length === 0 ? t('saved.empty.title') : t('saved.empty.filtered')}</p>
            <p className="mt-1 text-sm">{rows.length === 0 ? t('saved.empty.description') : t('saved.empty.filteredDescription')}</p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visibleRows.map((row) => (
              <article key={`${row.saved.section}:${row.saved.modId}:${row.saved.fileId ?? 'parent'}`} className="flex min-h-[132px] gap-3 rounded-xl border border-border bg-bg-secondary p-3">
                <ModThumbnail
                  src={row.mod?.thumbnailUrl ?? undefined}
                  alt={row.mod?.name ?? `GameBanana ${row.saved.modId}`}
                  nsfw={row.mod?.isNsfw}
                  hideNsfw={false}
                  className="h-24 w-24 shrink-0 rounded-lg bg-bg-tertiary"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="line-clamp-2 font-medium text-text-primary">{row.mod?.name ?? row.saved.titleSnapshot ?? t('saved.unavailable')}</h2>
                    <IconButton icon={Trash2} label={t('saved.remove')} onClick={() => void remove(row)} className="shrink-0" />
                  </div>
                  <p className="mt-1 text-xs uppercase tracking-wider text-accent">{t(`saved.sections.${row.saved.section}`, row.saved.section)}{row.saved.fileName ? ` · ${row.saved.fileName}` : ''}</p>
                  {row.mod ? (
                    <p className="mt-1 text-xs text-text-secondary">{row.mod.submitterName ?? t('saved.unknownCreator')} · {t('saved.updated', { date: formatDate(row.mod.dateModified) })}</p>
                  ) : (
                    <p className="mt-1 text-xs text-warning">{t('saved.unavailableDetail')}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => openInBrowse(row)}><ExternalLink className="mr-1.5 h-3.5 w-3.5" />{t('saved.openInBrowse')}</Button>
                    <span className="self-center text-[11px] text-text-secondary">{t('saved.savedAt', { date: formatDate(Math.floor(row.saved.savedAt / 1000)) })}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
