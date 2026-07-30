import { useId, useMemo } from 'react';

/** Ids tying a SegmentedControl to the body it switches. From useSegmentedTabs. */
export interface SegmentedTabs<T extends string> {
    /** The single body element every segment controls. */
    panelId: string;
    /** The segment for one value, so the body can name itself after it. */
    tabId: (value: T) => string;
    /**
     * Spread onto the body element. Pass the currently selected value: one
     * reused panel is the right model here (the segments swap its contents,
     * they do not reveal one of several siblings), and its accessible name
     * follows the selected segment.
     */
    panelProps: (selected: T) => { id: string; role: 'tabpanel'; 'aria-labelledby': string };
}

export function useSegmentedTabs<T extends string>(): SegmentedTabs<T> {
    const base = useId();
    return useMemo(
        () => ({
            panelId: `${base}-panel`,
            tabId: (value: T) => `${base}-tab-${value}`,
            panelProps: (selected: T) => ({
                id: `${base}-panel`,
                role: 'tabpanel' as const,
                'aria-labelledby': `${base}-tab-${selected}`,
            }),
        }),
        [base]
    );
}
