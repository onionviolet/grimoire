/** Local recovery points describe installed bytes, never portable downloads. */
export interface ProfileRecoverySummary {
  id: string;
  createdAt: string;
  profileName: string;
  modCount: number;
  enabledCount: number;
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
}
