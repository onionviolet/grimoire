export interface ModelReplacementRequest {
  entryPath: string;
  sourcePath: string;
  reviewToken: string;
  entries: string[];
}
export interface ModelReplacementReview extends ModelReplacementRequest {
  dependencies: Array<{ path: string; source: 'bundle' | 'base' }>;
}
export interface ModelReplacementSelection {
  review: ModelReplacementReview;
  preview: import('./foundryModels').FoundryModelPreview;
}
