// @vitest-environment jsdom
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProfileApplyPreview } from '../../types/electron';
const h = vi.hoisted(() => ({ preview: vi.fn(), apply: vi.fn() }));
vi.mock('../../lib/api', () => ({ previewProfile: h.preview, applyProfile: h.apply }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
import { useReviewedProfileApply } from './useReviewedProfileApply';

let root: Root;
let container: HTMLDivElement;
let run: ReturnType<typeof useReviewedProfileApply>['apply'];
function Harness() {
    const reviewed = useReviewedProfileApply();
    useEffect(() => { run = reviewed.apply; }, [reviewed.apply]);
    return reviewed.reviewDialog;
}
const preview: ProfileApplyPreview = {
    profileId: 'p', profileName: 'P', enableCount: 1, disableCount: 2, reviewToken: 'reviewed-state',
    entries: [{ fileName: 'ready.vpk', enabled: true, status: 'matched', modId: 'ready' },
        { fileName: 'missing.vpk', enabled: true, status: 'missing' }],
    issues: [{ fileName: 'missing.vpk', enabled: true, status: 'missing' }],
};
beforeEach(async () => {
    vi.clearAllMocks();
    h.preview.mockResolvedValue(preview);
    h.apply.mockResolvedValue({ profile: { id: 'p' }, failures: [], unresolved: [] });
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    await act(async () => root.render(<Harness />));
});
afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
});
async function click(key: string) {
    const button = [...document.querySelectorAll('button')].find((button) => button.textContent === key)!;
    await act(async () => button.click());
}

describe('shared profile apply review', () => {
    it('cancels without writing any game state', async () => {
        let pending!: ReturnType<typeof run>;
        await act(async () => { pending = run('p'); });
        expect(document.querySelector('[role="dialog"]')).not.toBeNull();
        await click('common.actions.cancel');
        expect(await pending).toBeNull();
        expect(h.apply).not.toHaveBeenCalled();
    });
    it('passes the reviewed state to main only after explicit Apply', async () => {
        let pending!: ReturnType<typeof run>;
        await act(async () => { pending = run('p'); });
        expect(h.apply).not.toHaveBeenCalled();
        await click('profiles.review.apply');
        await pending;
        expect(h.apply).toHaveBeenCalledWith('p', 'reviewed-state');
    });
    it('resolves a pending review as cancelled when navigating away', async () => {
        let pending!: ReturnType<typeof run>;
        await act(async () => { pending = run('p'); });
        await act(async () => root.render(null));
        expect(await pending).toBeNull();
        expect(h.apply).not.toHaveBeenCalled();
    });
    it('applies an intact profile directly and suppresses simultaneous apply clicks', async () => {
        h.preview.mockResolvedValue({ ...preview, issues: [] });
        await act(async () => {
            const first = run('p');
            expect(await run('p')).toBeNull();
            await first;
        });
        expect(h.apply).toHaveBeenCalledTimes(1);
        expect(h.apply).toHaveBeenCalledWith('p', undefined);
    });
});
