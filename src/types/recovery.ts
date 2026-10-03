export type HealthIssueCode =
  | 'path-invalid' | 'gameinfo-missing' | 'gameinfo-unreadable' | 'gameinfo-unwritable'
  | 'search-paths-missing' | 'boot-paths-missing' | 'language-paths-missing'
  | 'folder-unreadable' | 'vpk-invalid' | 'vpk-tree-invalid'
  | 'metadata-unreadable' | 'metadata-missing-file' | 'metadata-missing-entry'
  | 'metadata-ambiguous' | 'disk-low' | 'disk-unavailable';

export interface HealthIssue {
  code: HealthIssueCode;
  severity: 'blocking' | 'warning';
  target: 'settings' | 'config' | 'installed';
  /** Exact local mod name when available, otherwise its filename or metadata key. */
  modName?: string;
  fileName?: string;
  /** A filesystem-relative location, never raw errno text or a secret. */
  location?: string;
  format?: string;
}

export interface InstallationHealthReport {
  scannedAt: string;
  pathState: 'unset' | 'invalid' | 'ready';
  gamePath: string | null;
  gameinfo: { readable: boolean; writable: boolean; configured: boolean };
  mods: { checked: number; enabled: number; disabled: number };
  disk: { freeBytes: number; totalBytes: number } | null;
  issues: HealthIssue[];
}
