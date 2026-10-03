import { useCallback, useEffect, useRef, useState } from 'react';
import { applyProfile, previewProfile } from '../../lib/api';
import type { ProfileApplyPreview } from '../../types/electron';
import ProfileApplyReview from './ProfileApplyReview';

/** Both entry points use the same review; dismissing it never applies anything. */
export function useReviewedProfileApply() {
    const [preview, setPreview] = useState<ProfileApplyPreview | null>(null);
    const pending = useRef<((token: string | null) => void) | null>(null);
    const mounted = useRef(true);
    const inFlight = useRef(false);
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
            pending.current?.(null);
            pending.current = null;
        };
    }, []);
    const decide = useCallback((token: string | null) => {
        pending.current?.(token);
        pending.current = null;
        setPreview(null);
    }, []);
    const apply = useCallback(async (profileId: string) => {
        if (inFlight.current) return null;
        inFlight.current = true;
        try {
            const review = await previewProfile(profileId);
            if (!mounted.current) return null;
            let token: string | undefined;
            if (review.issues.length > 0) {
                const decision = await new Promise<string | null>((resolve) => {
                    pending.current = resolve;
                    setPreview(review);
                });
                if (decision === null || !mounted.current) return null;
                token = decision;
            }
            return await applyProfile(profileId, token);
        } finally {
            inFlight.current = false;
        }
    }, []);
    const reviewDialog = preview && <ProfileApplyReview preview={preview} busy={false}
        onClose={() => decide(null)} onApply={() => decide(preview.reviewToken)} />;
    return { apply, reviewDialog };
}
