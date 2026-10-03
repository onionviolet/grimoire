/** Local recovery points describe installed bytes, never portable downloads. */
export interface ProfileRecoverySummary {
  id: string;
  createdAt: string;
  profileName: string;
  modCount: number;
  enabledCount: number;
  retainedBytes?: boolean;
  purpose?: 'isolation';
}
export interface ProfileRecoveryIssue {
  name: string;
  reason: 'missing' | 'changed' | 'ambiguous';
}
export interface ProfileRecoveryPreview {
  point: ProfileRecoverySummary;
  issues: ProfileRecoveryIssue[];
  canRestore: boolean;
  reviewToken: string;
  disableCount: number;
  recoverCount?: number;
}

export interface InterruptedRecovery {
  createdAt: string;
  fileCount: number;
  canRecover: boolean;
  reviewToken: string;
}
