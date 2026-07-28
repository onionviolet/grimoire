import { describe, expect, it } from 'vitest';
import { serializeSoundStagedEdit } from './soundStagedEdit';

describe('serializeSoundStagedEdit', () => {
  it('freezes a seeded pool as exact compiled clip writes', () => {
    const request = {
      heroCodename: 'abrams',
      heroName: 'Abrams',
      event: 'Hero_ChargedMelee',
      audioPath: 'C:/audio/first.mp3',
      name: 'Melee pool',
      poolMode: 'seeded-library' as const,
      poolSeed: 42,
      assignments: [
        { clipPath: '\\sounds\\player\\melee\\a.vsnd', audioPath: 'C:/audio/first.mp3' },
        { clipPath: 'sounds/player/melee/b.vsnd_c', audioPath: 'C:/audio/second.mp3' },
      ],
    };

    const staged = serializeSoundStagedEdit({ id: 'sound-1', title: '  Melee pool  ', precedence: 3, request });

    expect(staged).toMatchObject({
      id: 'sound-1',
      kind: 'sound',
      title: 'Melee pool',
      affectedFiles: ['sounds/player/melee/a.vsnd_c', 'sounds/player/melee/b.vsnd_c'],
    });
    expect(staged.request.poolSeed).toBe(42);
    request.assignments[0].clipPath = 'changed.vsnd';
    expect(staged.request.assignments![0].clipPath).toBe('\\sounds\\player\\melee\\a.vsnd');
  });

  it('rejects unresolved event-only work', () => {
    expect(() => serializeSoundStagedEdit({
      id: 'sound-2', title: 'Unresolved', precedence: 0,
      request: { heroCodename: 'abrams', heroName: 'Abrams', event: 'event', audioPath: 'x.mp3', name: 'x' },
    })).toThrow('explicit clip assignments');
  });
});
