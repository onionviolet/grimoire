/** Read-only events from the exact embedded animation selected by the exporter.
 * This metadata does not establish a hero slot or a playable particle mapping. */
export interface EmbeddedClipEvent {
  name: string;
  frame: number | null;
  endFrame: number | null;
  cycle: number | null;
  authoredDuration: number | null;
  timeSeconds: number | null;
  durationSeconds: number | null;
  eventData: Record<string, unknown> | null;
  options: string | null;
}

export interface EmbeddedClipEventMetadata {
  status: 'available' | 'unavailable' | 'unsupported';
  reason?: string;
  provenance: {
    modelEntry: string;
    clipName: string;
    animationName?: string;
    format: 'ANIM/ASEQ';
  };
  /** Defined only when the embedded animation set can be read conclusively. */
  hasEmbeddedClips?: boolean;
  fps?: number;
  frameCount?: number;
  durationSeconds?: number;
  events: EmbeddedClipEvent[];
}
