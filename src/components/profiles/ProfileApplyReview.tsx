import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { ProfileApplyPreview } from '../../types/electron';
import { Modal, ModalBody, ModalFooter } from '../common/Modal';
import { Button, ModalHeader } from '../common/ui';
import { Select } from '../common/forms';

export default function ProfileApplyReview({ preview, busy, onClose, onApply, onMap, mappingError }: {
    preview: ProfileApplyPreview;
    busy: boolean;
    onClose: () => void;
    onApply: () => void;
    onMap?: (entryIndex: number, modId: string) => Promise<void>;
    mappingError?: boolean;
}) {
    const { t } = useTranslation();
    const titleId = useId();
    const available = preview.entries.filter((entry) => entry.enabled && entry.modId).length;
    return (
        <Modal onClose={onClose} labelledBy={titleId} dismissable={!busy} size="lg">
            <ModalHeader title={t('profiles.review.title', { name: preview.profileName })}
                titleId={titleId} onClose={onClose} closeDisabled={busy} />
            <ModalBody>
                <p className="text-sm text-text-primary">{t('profiles.review.summary', {
                    available, enable: preview.enableCount, disable: preview.disableCount,
                })}</p>
                <p className="mt-2 text-sm text-text-secondary">{t('profiles.review.explanation')}</p>
                {onMap && !!preview.localMods?.length && <p className="mt-2 text-xs text-text-secondary">{t('profiles.review.mappingHint')}</p>}
                {mappingError && <p role="alert" className="mt-2 text-sm text-state-danger">{t('profiles.review.mappingFailed')}</p>}
                <ul className="mt-4 divide-y divide-border">
                    {preview.issues.map((entry, index) => (
                        <li key={`${entry.fileName}-${index}`} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
                            <span className="min-w-0 break-all text-text-primary">{entry.status === 'mapped' ? entry.fileName : entry.modName ?? entry.fileName}</span>
                            <span className="text-state-warning">{t(`profiles.review.status.${entry.status}`)}{entry.status === 'mapped' && `: ${entry.modName}`}</span>
                            {onMap && entry.entryIndex !== undefined && !!preview.localMods?.length && <Select
                                aria-label={t('profiles.review.mapEntry', { name: entry.fileName })} disabled={busy}
                                value={preview.mappings?.find(mapping => mapping.entryIndex === entry.entryIndex)?.modId ?? ''}
                                onChange={event => void onMap(entry.entryIndex!, event.target.value)}>
                                <option value="">{t('profiles.review.keepResolution')}</option>
                                {preview.localMods.map(mod => <option key={mod.id} value={mod.id}>{mod.name} ({mod.fileName})</option>)}
                            </Select>}
                        </li>
                    ))}
                </ul>
                {available === 0 && <p className="mt-3 text-sm text-state-warning">{t('profiles.review.noMatches')}</p>}
            </ModalBody>
            <ModalFooter>
                <Button variant="secondary" onClick={onClose} disabled={busy}>{t('common.actions.cancel')}</Button>
                <Button onClick={onApply} isLoading={busy} disabled={busy || available === 0}>
                    {t('profiles.review.apply')}
                </Button>
            </ModalFooter>
        </Modal>
    );
}
