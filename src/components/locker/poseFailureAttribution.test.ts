import { describe, expect, it, vi } from 'vitest';
import {
  attributeBrokenSkinSources,
  MAX_ATTRIBUTION_PROBES,
} from './poseFailureAttribution';
import type { HeroPoseSkinSource } from '../../types/portrait';

describe('attributeBrokenSkinSources', () => {
  const source = (metaKey: string, priority = 0): HeroPoseSkinSource => ({ metaKey, priority });
  const okAlways = async () => true;

  it('blames the only skin in the stack without spending a probe', async () => {
    const probe = vi.fn(okAlways);

    await expect(attributeBrokenSkinSources([source('a')], probe)).resolves.toEqual(['a']);
    // Vanilla already posed, so one source is guilty by elimination.
    expect(probe).not.toHaveBeenCalled();
  });

  it('names only the members that fail on their own', async () => {
    const probe = async (s: HeroPoseSkinSource) => s.metaKey !== 'bad';

    await expect(
      attributeBrokenSkinSources([source('good'), source('bad'), source('fine')], probe)
    ).resolves.toEqual(['bad']);
  });

  it('treats a probe that throws as a failing skin', async () => {
    const probe = async (s: HeroPoseSkinSource) => {
      if (s.metaKey === 'boom') throw new Error('export died');
      return true;
    };

    await expect(
      attributeBrokenSkinSources([source('ok'), source('boom')], probe)
    ).resolves.toEqual(['boom']);
  });

  // A stack whose members each pose fine is a merge problem, not a bad mod.
  // Badging one of them would point at the wrong card.
  it('blames nobody when every member poses alone', async () => {
    await expect(
      attributeBrokenSkinSources([source('a'), source('b')], okAlways)
    ).resolves.toEqual([]);
  });

  it('does not probe a stack deeper than the cap', async () => {
    const sources = Array.from({ length: MAX_ATTRIBUTION_PROBES + 1 }, (_, i) =>
      source(`s${i}`)
    );
    const probe = vi.fn(async () => false);

    await expect(attributeBrokenSkinSources(sources, probe)).resolves.toEqual([]);
    expect(probe).not.toHaveBeenCalled();
  });

  it('reports nothing once the viewer has been torn down mid-probe', async () => {
    let cancelled = false;
    const probe = async () => {
      cancelled = true; // the panel closed while the first probe was in flight
      return false;
    };

    await expect(
      attributeBrokenSkinSources([source('a'), source('b')], probe, () => cancelled)
    ).resolves.toEqual([]);
  });

  it('has nothing to say about an empty stack', async () => {
    await expect(attributeBrokenSkinSources([], okAlways)).resolves.toEqual([]);
  });
});
