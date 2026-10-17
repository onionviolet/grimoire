export interface MergePathPolicy {
  include: string[];
  exclude: string[];
}
export interface MergeRecipe {
  id: string;
  name: string;
  strict: boolean;
  policy: MergePathPolicy;
  sources: Array<{ sha256: string; name: string; gameBananaId?: number; gameBananaFileId?: number; vpkIndex?: number }>;
  outputs: Array<{ path: string; crc: number; size: number }>;
  createdAt: string;
}
export interface MergeRecipeReview {
  recipe: MergeRecipe;
  analysis: import('./mod').MergeAnalysisResult;
  added: string[];
  removed: string[];
  changed: string[];
}
export interface MergeRecipeSave {
  name: string;
  modIds: string[];
  strict: boolean;
  policy: MergePathPolicy;
  reviewToken: string;
}
