import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { LocalizationModsReview, LocalizationTokenChoice } from '../../types/localizationMerge';
import { showToast } from '../../stores/toastStore';
import { Select } from '../common/forms';
import { Modal, ModalBody, ModalFooter } from '../common/Modal';
import { Button, ModalHeader } from '../common/ui';
import type { OverlapMod } from './OverlapCard';

interface Props {
  mods: [OverlapMod, OverlapMod];
  onClose: () => void;
}

const tokenId = (path: string, key: string) => JSON.stringify([path, key]);
const PAGE_SIZE = 40;

export default function LocalizationMergeModal({ mods, onClose }: Props) {
  const { t } = useTranslation();
  const headingId = useId();
  const [review, setReview] = useState<LocalizationModsReview | null>(null);
  const [choices, setChoices] = useState<Record<string, LocalizationTokenChoice>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);

  useEffect(() => {
    let active = true;
    window.electronAPI.reviewLocalizationMerge(mods.map(mod => mod.id)).then(
      result => { if (active) setReview(result); },
      reason => { if (active) setError(String(reason)); },
    );
    return () => { active = false; };
  }, [mods]);

  const items = review?.files.flatMap(({ path, changes }) => changes.map(change => ({ path, change }))) ?? [];
  const pageItems = items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const pageCount = Math.ceil(items.length / PAGE_SIZE);
  const chosen = Object.values(choices);
  const close = () => { if (!saving) onClose(); };

  const fillUnreviewed = (useSingleCandidate: boolean) => {
    setChoices(current => {
      const next = { ...current };
      for (const { path, change } of items) {
        const id = tokenId(path, change.key);
        if (next[id] || useSingleCandidate && change.candidates.length !== 1) continue;
        next[id] = { path, key: change.key, sourceModId: useSingleCandidate ? change.candidates[0].sourceIds[0] : null };
      }
      return next;
    });
  };

  const save = async () => {
    if (!review || saving || chosen.length !== items.length) return;
    setSaving(true);
    setError('');
    try {
      const path = await window.electronAPI.exportLocalizationMerge(mods.map(mod => mod.id), review.reviewToken, chosen);
      if (path) {
        showToast(t('overlap.localization.saved', { path }), { tone: 'success' });
        onClose();
      }
    } catch (reason) {
      setError(String(reason));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={close} dismissable={!saving} labelledBy={headingId} size="lg">
      <ModalHeader title={t('overlap.localization.title')} titleId={headingId} onClose={close} closeLabel={t('common.actions.close')} />
      <ModalBody className="space-y-4">
        <p className="text-sm text-text-secondary">{t('overlap.localization.description')}</p>
        {error && <p role="alert" className="break-words text-sm text-state-danger">{error}</p>}
        {!review && !error && <p role="status" className="text-sm text-text-secondary">{t('overlap.localization.loading')}</p>}
        {review && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="secondary" disabled={saving} onClick={() => fillUnreviewed(true)}>
                {t('overlap.localization.chooseSingle')}
              </Button>
              <Button size="sm" variant="secondary" disabled={saving} onClick={() => fillUnreviewed(false)}>
                {t('overlap.localization.keepStockForRemaining')}
              </Button>
            </div>
            {pageCount > 1 && (
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>{t('overlap.localization.previous')}</Button>
                <span className="text-xs text-text-secondary">{t('overlap.localization.page', { page: page + 1, total: pageCount })}</span>
                <Button size="sm" variant="ghost" disabled={page + 1 >= pageCount} onClick={() => setPage(page + 1)}>{t('overlap.localization.next')}</Button>
              </div>
            )}
            {pageItems.map(({ path, change }, index) => {
                  const id = tokenId(path, change.key);
                  const selected = choices[id];
                  const value = selected ? selected.sourceModId === null ? 'stock' : `mod:${selected.sourceModId}` : '';
                  return (
                    <div key={id} className="space-y-2">
                      {pageItems[index - 1]?.path !== path && <h3 className="break-all font-mono text-xs text-text-secondary">{path}</h3>}
                      <label className="block space-y-1 rounded-sm border border-border p-2">
                      <span className="block break-all font-mono text-xs">{change.key}</span>
                      <Select value={value} disabled={saving} onChange={(event) => {
                        const nextValue = event.target.value;
                        setChoices(current => {
                          const next = { ...current };
                          if (nextValue) next[id] = { path, key: change.key, sourceModId: nextValue === 'stock' ? null : nextValue.slice(4) };
                          else delete next[id];
                          return next;
                        });
                      }}>
                        <option value="">{t('overlap.localization.chooseText')}</option>
                        <option value="stock">{change.baseline === null ? t('overlap.localization.stockMissing') : t('overlap.localization.stock', { text: change.baseline })}</option>
                        {change.candidates.map(candidate => (
                          <option key={candidate.sourceIds[0]} value={`mod:${candidate.sourceIds[0]}`}>
                            {t('overlap.localization.candidate', {
                              names: mods.filter(mod => candidate.sourceIds.includes(mod.id)).map(mod => mod.variant ? `${mod.name} (${mod.variant})` : mod.name).join(', '),
                              text: candidate.value,
                            })}
                          </option>
                        ))}
                      </Select>
                      </label>
                    </div>
                  );
            })}
          </>
        )}
      </ModalBody>
      <ModalFooter>
        {review && <span className="mr-auto text-xs text-text-secondary">{t('overlap.localization.progress', { chosen: chosen.length, total: items.length })}</span>}
        <Button variant="secondary" disabled={saving} onClick={close}>{t('common.actions.cancel')}</Button>
        <Button isLoading={saving} disabled={!review || chosen.length !== items.length || !chosen.some(choice => choice.sourceModId !== null)} onClick={() => void save()}>
          {t('overlap.localization.export')}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
