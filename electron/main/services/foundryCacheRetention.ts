/** Build-root retention shared by thumbnail pruning and on-demand exports.
 * A game update may obsolete an export, but must not delete its files mid-write. */
const retained = new Map<string, number>();
export function retainFoundryFingerprint(key: string): () => void {
    retained.set(key, (retained.get(key) ?? 0) + 1);
    let released = false;
    return () => {
        if (released) return;
        released = true;
        const count = (retained.get(key) ?? 1) - 1;
        if (count > 0) retained.set(key, count); else retained.delete(key);
    };
}
export function foundryFingerprintIsRetained(key: string): boolean { return retained.has(key); }
