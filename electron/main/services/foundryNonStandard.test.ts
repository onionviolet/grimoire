import { describe, expect, it } from 'vitest';
import { classifyNonStandardEntries, namingSignal } from './foundryNonStandard';
import type { HeroInfo } from '../../../src/types/foundry';

const roster: HeroInfo[] = [
    { codename: 'live', name: 'Live', selectable: true, inDevelopment: false, disabled: false },
    { codename: 'cut', name: 'Cut', selectable: false, inDevelopment: false, disabled: true },
];

describe('non-standard Foundry scan', () => {
    it('flags disabled and absent hero subjects but leaves live subjects alone', () => {
        const findings = classifyNonStandardEntries([
            'models/heroes/cut/body.vmdl_c',
            'materials/models/heroes/missing/face.vtex_c',
            'models/heroes/live/body.vmdl_c',
        ], roster, new Set());
        expect(findings.map((finding) => finding.path)).toEqual([
            'models/heroes/cut/body.vmdl_c',
            'materials/models/heroes/missing/face.vtex_c',
        ]);
        expect(findings.every((finding) => finding.tier === 'subject-not-live')).toBe(true);
    });

    it('flags only clips without a live sound-event reference', () => {
        const findings = classifyNonStandardEntries([
            'sounds/ui/live.vsnd_c', 'sounds/ui/orphan.vsnd_c',
        ], roster, new Set(['sounds/ui/live.vsnd_c']));
        expect(findings).toEqual([expect.objectContaining({
            path: 'sounds/ui/orphan.vsnd_c', tier: 'unreferenced-sound',
        })]);
    });

    it('keeps naming signals separate from confirmed tiers', () => {
        expect(namingSignal('materials/old_icons/test_thing.vtex_c')).toBe('old_icons');
        expect(namingSignal('maps/unused.vmap_c')).toBe('unused.vmap_c');
        const findings = classifyNonStandardEntries(['materials/old_icons/icon.vtex_c'], roster, new Set());
        expect(findings[0]).toMatchObject({ tier: 'naming-signal', reason: expect.stringContaining('naming signal') });
    });
});
