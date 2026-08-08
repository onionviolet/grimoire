import { create } from 'zustand';

/**
 * The tool-download refusal banner's seam between the app-scoped subscriber
 * and the Browser page. The only subscriber that learns about a refusal is
 * now app scoped (`useBrowserToolDownloadHandoff`, called from `Layout`), but
 * the danger-tone banner that renders it belongs to the Browser page, so the
 * two need a seam and this store is the smallest one: no persistence, one
 * field, one action. Fork only, mirroring `poseFailureStore.ts`'s shape minus
 * the localStorage persistence this transient value does not want.
 */

interface BrowserToolDownloadState {
  refusal: string | null;
  setRefusal: (text: string | null) => void;
}

export const useBrowserToolDownloadStore = create<BrowserToolDownloadState>((set) => ({
  refusal: null,
  setRefusal: (text) => set({ refusal: text }),
}));

/** Imperative helper for the non-component subscriber call site, mirroring
 *  `toastStore.ts`'s `showToast`/`dismissToast` convention. */
export function setBrowserToolDownloadRefusal(text: string | null): void {
  useBrowserToolDownloadStore.getState().setRefusal(text);
}
