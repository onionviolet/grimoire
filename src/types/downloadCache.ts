export interface DownloadCachePreview {
  reviewToken: string;
  bytes: number;
  items: Array<{ name: string; bytes: number; kind: 'archive' | 'partial' | 'metadata'; removable: boolean; reason: 'copy' | 'retryable' | 'recent' | 'in-use' }>;
}
export interface DownloadCacheCleanup {
  removed: number;
  bytesFreed: number;
  failed: number;
}
