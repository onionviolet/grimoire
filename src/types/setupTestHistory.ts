export interface SetupTestSnapshot {
  reviewToken: string;
  installationKey: string;
  baseFingerprint: string;
  modCount: number;
  managedFileCount?: number;
  mods: Array<{ name: string; sha256: string; priority: number; placement?: string }>;
}

export interface SetupTestRecord extends SetupTestSnapshot {
  id: string;
  testedAt: string;
  result: 'works' | 'crashes';
  note: string;
}

export interface SetupTestHistory {
  current: SetupTestSnapshot;
  records: Array<SetupTestRecord & { current: boolean; sameBuild: boolean }>;
}
