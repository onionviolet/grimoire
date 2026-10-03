import type { FxDescriptor } from '../components/locker/fxDescriptor';
export type AssetInspectionKind = 'texture' | 'material' | 'particle';
export interface AssetInspectionEntry { path: string; label: string; kind: AssetInspectionKind; size: number }
export interface AssetInspectionResult {
  entry: AssetInspectionEntry;
  imageUrl?: string | null;
  /** Authored inspector output, not a reconstructed shader. */
  details?: string;
  descriptor?: FxDescriptor;
  textureBaseUrl?: string;
  unavailable?: string;
}
