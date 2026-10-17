import { useCallback, useEffect, useRef, useState } from 'react';
import { applyProfile, previewProfile } from '../../lib/api';
import type { ProfileApplyPreview } from '../../types/electron';
import ProfileApplyReview from './ProfileApplyReview';

/** Both entry points use the same review; dismissing it never applies anything. */
export function useReviewedProfileApply() {
    const [preview, setPreview] = useState<ProfileApplyPreview | null>(null);
    const [mappingBusy, setMappingBusy] = useState(false);
    const [mappingError, setMappingError] = useState(false);
    const pending = useRef<((review: ProfileApplyPreview | null) => void) | null>(null);
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
    const decide = useCallback((review: ProfileApplyPreview | null) => {
        pending.current?.(review);
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
                const decision = await new Promise<ProfileApplyPreview | null>((resolve) => {
                    pending.current = resolve;
                    setMappingError(false);
                    setPreview(review);
                });
                if (decision === null || !mounted.current) return null;
                token = decision.reviewToken;
                if (decision.mappings?.length) return await applyProfile(profileId, token, decision.mappings);
            }
            return await applyProfile(profileId, token);
        } finally {
            inFlight.current = false;
        }
    }, []);
    const mapEntry = async (entryIndex: number, modId: string) => {
        if (!preview || mappingBusy) return;
        setMappingBusy(true); setMappingError(false);
        const mappings = (preview.mappings ?? []).filter(mapping => mapping.entryIndex !== entryIndex);
        if (modId) mappings.push({ entryIndex, modId });
        try {
            const next = await previewProfile(preview.profileId, mappings);
            if (mounted.current && pending.current) setPreview(next);
        } catch { if (mounted.current) setMappingError(true); }
        finally { if (mounted.current) setMappingBusy(false); }
    };
    const reviewDialog = preview && <ProfileApplyReview preview={preview} busy={mappingBusy} mappingError={mappingError}
        onMap={mapEntry} onClose={() => decide(null)} onApply={() => decide(preview)} />;
    return { apply, reviewDialog };
}
