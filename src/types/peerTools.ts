export interface StockVfxReview {
  sourcePath: string;
  codename: string;
  entries: string[];
  missingStock: string[];
  outsideLayer: string[];
  affectedDependencies: string[];
  missingDependencies: string[];
  reviewToken: string;
}

export interface ModPackageFinding {
  kind: 'archive' | 'invalidVpk' | 'unsupportedWrapper' | 'noVpk' | 'unreadable' | 'missingDependency' | 'siblingDependency' | 'overlap' | 'incomplete';
  file?: string;
  entry?: string;
  detail?: string;
}

export interface ModPackageReview {
  archive: string;
  baseFingerprint: string;
  packages: string[];
  modelsChecked: number;
  findings: ModPackageFinding[];
}
