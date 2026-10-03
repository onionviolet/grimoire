/** Base-game model entries, never installed mods or authoring inputs. */
export interface FoundryModelEntry {
    path: string;
    label: string;
    size: number;
}

export interface FoundryModelPreview {
    url: string;
    bytes: number;
}
