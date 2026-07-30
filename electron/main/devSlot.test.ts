import { describe, expect, it } from 'vitest';
import { devSlotConfig, readDevSlot } from './devSlot';

describe('development slots', () => {
    it('keeps the default ports when no slot is configured', () => {
        expect(devSlotConfig(undefined)).toEqual({ slot: undefined, vitePort: 5173, cdpPort: undefined });
    });

    it('derives every dev port from one slot', () => {
        expect(devSlotConfig('2')).toEqual({ slot: 2, vitePort: 5175, cdpPort: 9224 });
    });

    it.each(['-1', 'two', '2.5', ' 2 ', ''])('rejects an invalid slot: %s', (slot) => {
        if (slot === '') expect(readDevSlot(slot)).toBeUndefined();
        else expect(() => readDevSlot(slot)).toThrow('GRIMOIRE_DEV_SLOT');
    });
});
