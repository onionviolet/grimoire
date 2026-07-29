import { describe, expect, it } from 'vitest';
import { collapseClipTakes, collapseTakes, hasPersonalLabel, preferredSoundLabel } from './soundLabels';

describe('collapseTakes', () => {
    it('folds numbered takes of one sound into a single run', () => {
        expect(collapseTakes(['attack_01', 'attack_02', 'attack_03'])).toEqual([
            { stem: 'attack', takes: 3, members: ['attack_01', 'attack_02', 'attack_03'] },
        ]);
    });

    it('keeps distinct sounds distinct and preserves first-seen order', () => {
        const runs = collapseTakes(['cast_01', 'death_01', 'cast_02']);
        expect(runs.map((run) => run.stem)).toEqual(['cast', 'death']);
        expect(runs[0].takes).toBe(2);
    });

    it('does not treat a single trailing digit as a take', () => {
        // `wave2` is a different sound from `wave`, not its second take.
        expect(collapseTakes(['wave', 'wave2']).map((run) => run.stem)).toEqual(['wave', 'wave2']);
    });

    it('collapses a separator-delimited single digit', () => {
        expect(collapseTakes(['hit_1', 'hit_2'])).toEqual([
            { stem: 'hit', takes: 2, members: ['hit_1', 'hit_2'] },
        ]);
    });

    it('passes unnumbered values through as runs of one', () => {
        expect(collapseTakes(['ult_cast'])).toEqual([
            { stem: 'ult_cast', takes: 1, members: ['ult_cast'] },
        ]);
    });

    it('leaves a bare number alone: there is no stem to collapse onto', () => {
        expect(collapseTakes(['01', '02']).map((run) => run.stem)).toEqual(['01', '02']);
    });

    it('does not merge an unnumbered value into another value’s stem', () => {
        const runs = collapseTakes(['attack', 'attack_01', 'attack_02']);
        expect(runs.map((run) => [run.stem, run.takes])).toEqual([
            ['attack', 1],
            ['attack', 2],
        ]);
    });
});

describe('collapseClipTakes', () => {
    it('collapses on the clip basename and keeps every path as a member', () => {
        const runs = collapseClipTakes([
            'sounds/abilities/gigawatt/ball_01.vsnd_c',
            'sounds/abilities/gigawatt/ball_02.vsnd_c',
            'sounds/abilities/gigawatt/ult.vsnd',
        ]);
        expect(runs).toHaveLength(2);
        expect(runs[0]).toEqual({
            stem: 'ball',
            takes: 2,
            members: [
                'sounds/abilities/gigawatt/ball_01.vsnd_c',
                'sounds/abilities/gigawatt/ball_02.vsnd_c',
            ],
        });
        expect(runs[1].stem).toBe('ult');
    });

    it('counts the same basename in two folders as two takes of that sound', () => {
        const runs = collapseClipTakes(['a/step_01.vsnd', 'b/step_01.vsnd']);
        expect(runs).toHaveLength(1);
        expect(runs[0].takes).toBe(2);
        expect(runs[0].members).toEqual(['a/step_01.vsnd', 'b/step_01.vsnd']);
    });

    it('normalizes backslashes so a Windows-shaped path collapses too', () => {
        const runs = collapseClipTakes(['sounds\\vo\\seven\\line_01.vsnd', 'sounds/vo/seven/line_02.vsnd']);
        expect(runs).toHaveLength(1);
        expect(runs[0].stem).toBe('line');
    });
});

describe('preferredSoundLabel', () => {
    const annotation = (name: string | null) => ({ name, note: null, tags: [], updatedAt: '' });

    it('puts the user’s own name ahead of the catalog label', () => {
        expect(preferredSoundLabel(annotation('The zap'), 'Lightning Ball', 'E.Zap')).toBe('The zap');
    });

    it('falls back to the catalog label, then to the event id', () => {
        expect(preferredSoundLabel(undefined, 'Lightning Ball', 'E.Zap')).toBe('Lightning Ball');
        expect(preferredSoundLabel(undefined, '', 'E.Zap')).toBe('E.Zap');
        expect(preferredSoundLabel(undefined, null, 'E.Zap')).toBe('E.Zap');
    });

    it('treats a whitespace-only annotation as no name', () => {
        expect(preferredSoundLabel(annotation('   '), 'Lightning Ball', 'E.Zap')).toBe('Lightning Ball');
        expect(hasPersonalLabel(annotation('   '))).toBe(false);
        expect(hasPersonalLabel(annotation('mine'))).toBe(true);
    });
});
