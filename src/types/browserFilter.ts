export interface BrowserFilterListInfo {
    revision: string;
    fetchedAt: string | null;
    source: 'bundled' | 'updated' | 'fallback';
}

export interface BrowserCustomListInfo {
    accepted: number;
    rejected: number;
    rejectedLines: number[];
}

export interface BrowserFilterUpdateReview {
    reviewId: string;
    revision: string;
    fetchedAt: string;
    networkFilters: number;
    cosmeticFilters: number;
    currentFilters: number;
}
