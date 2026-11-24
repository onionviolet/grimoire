import { useId, useState, type FormEvent } from 'react';
import { Bookmark, Folder, Link, Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { FormField, Input } from '../common/forms';
import { Modal, ModalBody, ModalFooter } from '../common/Modal';
import { Button, IconButton, ModalHeader } from '../common/ui';
import { bookmarkUrl, type BrowserBookmark } from '../../lib/browserBookmarks';

export function BookmarkBar({ bookmarks, onOpen }: {
    bookmarks: BrowserBookmark[];
    onOpen: (url: string) => void;
}) {
    const { t } = useTranslation();
    const pinned = bookmarks.filter(bookmark => bookmark.onBar);
    return <nav aria-label={t('browser.bookmarks.bar')} className="flex shrink-0 items-center gap-1 overflow-x-auto rounded-sm border border-border px-1 py-1">
        {pinned.length ? pinned.map(bookmark => (
            <Button key={bookmark.url} variant="ghost" size="sm" icon={Bookmark} className="max-w-48 shrink-0"
                title={bookmark.url} onClick={() => onOpen(bookmark.url)}>
                <span className="truncate">{bookmark.title}</span>
            </Button>
        )) : <span className="px-2 text-xs text-text-secondary">{t('browser.bookmarks.emptyBar')}</span>}
    </nav>;
}

export function BookmarkManager({ bookmarks, showBar, onShowBar, onOpen, onEdit, onClose }: {
    bookmarks: BrowserBookmark[];
    showBar: boolean;
    onShowBar: (visible: boolean) => void;
    onOpen: (url: string) => void;
    onEdit: (bookmark: BrowserBookmark) => void;
    onClose: () => void;
}) {
    const { t } = useTranslation();
    const title = useId();
    const [query, setQuery] = useState('');
    const search = query.trim().toLocaleLowerCase();
    const groups = new Map<string, BrowserBookmark[]>();
    for (const bookmark of bookmarks) {
        if (![bookmark.title, bookmark.url, bookmark.folder].some(value => value.toLocaleLowerCase().includes(search))) continue;
        const group = groups.get(bookmark.folder) ?? [];
        group.push(bookmark);
        groups.set(bookmark.folder, group);
    }
    return <Modal labelledBy={title} onClose={onClose} size="lg">
        <ModalHeader title={t('browser.bookmarks.manage')} titleId={title} onClose={onClose} />
        <ModalBody>
            <div className="space-y-4">
                <Input type="search" value={query} onChange={event => setQuery(event.target.value)}
                    aria-label={t('browser.bookmarks.search')} placeholder={t('browser.bookmarks.search')} />
                <label className="flex items-center gap-2 text-sm text-text-secondary">
                    <input type="checkbox" className="accent-accent" checked={showBar} onChange={event => onShowBar(event.target.checked)} />
                    {t('browser.bookmarks.showBar')}
                </label>
                {!groups.size && <p className="text-sm text-text-secondary">
                    {search ? t('browser.bookmarks.noMatches') : t('browser.bookmarks.empty')}
                </p>}
                {[...groups].map(([folder, members]) => <section key={folder} className="space-y-1">
                    <h3 className="flex items-center gap-2 text-sm font-medium text-text-secondary">
                        <Folder size={14} aria-hidden="true" />{folder || t('browser.bookmarks.unfiled')}
                    </h3>
                    <ul className="divide-y divide-border">
                        {members.map(bookmark => <li key={bookmark.url} className="flex min-w-0 items-center gap-2 py-1">
                            <Button variant="ghost" className="min-w-0 flex-1 justify-start" icon={Link} title={bookmark.url}
                                onClick={() => onOpen(bookmark.url)}>
                                <span className="min-w-0 truncate">{bookmark.title}</span>
                                <span className="min-w-0 truncate text-xs text-text-tertiary">{new URL(bookmark.url).hostname}</span>
                            </Button>
                            <IconButton tone="ghost" icon={Pencil} label={t('browser.bookmarks.editNamed', { title: bookmark.title })}
                                onClick={() => onEdit(bookmark)} />
                        </li>)}
                    </ul>
                </section>)}
            </div>
        </ModalBody>
    </Modal>;
}

export function BookmarkEditor({ initial, existing, bookmarks, onSave, onRemove, onClose }: {
    initial: BrowserBookmark;
    existing: boolean;
    bookmarks: BrowserBookmark[];
    onSave: (bookmark: BrowserBookmark) => boolean;
    onRemove: () => boolean;
    onClose: () => void;
}) {
    const { t } = useTranslation();
    const title = useId();
    const form = useId();
    const folders = useId();
    const [draft, setDraft] = useState(initial);
    const [error, setError] = useState<'url' | 'duplicate' | 'storage'>();
    const [removing, setRemoving] = useState(false);
    const update = (patch: Partial<BrowserBookmark>) => { setDraft(value => ({ ...value, ...patch })); setError(undefined); };
    const save = (event: FormEvent) => {
        event.preventDefault();
        const url = bookmarkUrl(draft.url);
        if (!url) { setError('url'); return; }
        if (bookmarks.some(bookmark => bookmark.url === url && (!existing || bookmark.url !== initial.url))) {
            setError('duplicate'); return;
        }
        if (!onSave({ ...draft, url, title: draft.title.trim() || new URL(url).hostname, folder: draft.folder.trim() })) setError('storage');
    };
    return <Modal labelledBy={title} onClose={onClose}>
        <ModalHeader title={t(existing ? 'browser.bookmarks.edit' : 'browser.bookmarks.add')} titleId={title} onClose={onClose} />
        <ModalBody>
            <form id={form} className="space-y-3" onSubmit={save}>
                <FormField label={t('browser.bookmarks.name')}>
                    <Input value={draft.title} maxLength={250} onChange={event => update({ title: event.target.value })} />
                </FormField>
                <FormField label={t('browser.bookmarks.url')}>
                    <Input value={draft.url} spellCheck={false} onChange={event => update({ url: event.target.value })} />
                </FormField>
                <FormField label={t('browser.bookmarks.folder')}>
                    <Input value={draft.folder} list={folders} maxLength={80} onChange={event => update({ folder: event.target.value })} />
                </FormField>
                <datalist id={folders}>
                    {[...new Set(bookmarks.map(bookmark => bookmark.folder).filter(Boolean))].map(folder => <option value={folder} key={folder} />)}
                </datalist>
                <label className="flex items-center gap-2 text-sm text-text-secondary">
                    <input type="checkbox" className="accent-accent" checked={draft.onBar} onChange={event => update({ onBar: event.target.checked })} />
                    {t('browser.bookmarks.pin')}
                </label>
                {error && <p role="alert" className="text-sm text-state-danger">{error === 'url'
                    ? t('browser.bookmarks.invalidUrl')
                    : error === 'duplicate' ? t('browser.bookmarks.duplicate') : t('browser.bookmarks.storage')}</p>}
            </form>
        </ModalBody>
        <ModalFooter>
            {existing && <Button variant={removing ? 'danger' : 'ghost'} className="mr-auto" onClick={() => {
                if (!removing) setRemoving(true);
                else if (!onRemove()) setError('storage');
            }}>{t(removing ? 'browser.bookmarks.confirmRemove' : 'browser.bookmarks.remove')}</Button>}
            <Button variant="secondary" onClick={onClose}>{t('common.actions.cancel')}</Button>
            <Button type="submit" form={form}>{t('common.actions.save')}</Button>
        </ModalFooter>
    </Modal>;
}
