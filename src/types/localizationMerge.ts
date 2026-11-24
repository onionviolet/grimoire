export interface LocalizationTokenChange {
    key: string;
    baseline: string | null;
    candidates: Array<{ value: string; sourceIds: string[] }>;
    conflict: boolean;
}
export interface LocalizationModsReview {
    reviewToken: string;
    files: Array<{ path: string; language: string; changes: LocalizationTokenChange[] }>;
}
export interface LocalizationTokenChoice {
    path: string;
    key: string;
    sourceModId: string | null;
}
