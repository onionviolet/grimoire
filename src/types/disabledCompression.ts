export type DisabledCompressionMode = 'compress' | 'expand';
export interface DisabledCompressionStatus {
    supported: boolean;
    fileCount: number;
    totalBytes: number;
    skippedFiles: number;
}
export interface DisabledCompressionResult {
    processedFiles: number;
    skippedFiles: number;
    failedFiles: number;
}
