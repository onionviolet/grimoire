/** Only the guest methods used by the browser UI. No Electron runtime import. */
export interface BrowserWebview extends HTMLElement {
    src: string;
    canGoBack(): boolean;
    canGoForward(): boolean;
    goBack(): void;
    goForward(): void;
    reload(): void;
    reloadIgnoringCache(): void;
    stop(): void;
    getURL(): string;
    findInPage(text: string, options?: { forward?: boolean; findNext?: boolean }): number;
    stopFindInPage(action: 'clearSelection'): void;
    getZoomFactor(): number;
    setZoomFactor(factor: number): void;
}
