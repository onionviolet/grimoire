import { useEffect, useState } from 'react';
import type { BrowserFilterStats } from '../../types/foundry';

/** Local IPC polling only. Never requests or records browsing history. */
export function useBrowserFilterStats() {
    const [stats, setStats] = useState<BrowserFilterStats | null>(null);
    useEffect(() => {
        let cancelled = false;
        let timer: ReturnType<typeof setTimeout>;
        const refresh = async () => {
            try {
                const next = await window.electronAPI.browser.filterStats();
                if (!cancelled) setStats(next);
            } catch { if (!cancelled) setStats(null); }
            if (!cancelled) timer = setTimeout(refresh, 1000);
        };
        void refresh();
        return () => { cancelled = true; clearTimeout(timer); };
    }, []);
    return stats;
}
