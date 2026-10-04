export type DownloadJobState = 'queued' | 'downloading' | 'retrying' | 'paused' | 'failed' | 'cancelled' | 'completed';
export interface DownloadJob {
  id: string;
  args: import('./electron').DownloadModArgs;
  gamePath: string;
  directUrl?: string;
  state: DownloadJobState;
  updatedAt: string;
  error?: string;
}
