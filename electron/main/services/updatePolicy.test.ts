import { describe, expect, it } from 'vitest';
import { updateChannelPolicy, updateVersionAllowed } from './updatePolicy';
describe('release channel policy', () => {
  it('distinguishes prerelease tags from harmless hyphens in stable build metadata', () => {
    expect(updateVersionAllowed('stable', '1.31.0+fork-build.1')).toBe(true);
    expect(updateVersionAllowed('stable', '1.31.0-beta.1+fork-build.1')).toBe(false);
    expect(updateVersionAllowed('preview', '1.31.0-beta.1')).toBe(true);
  });
  it('requires explicit preview opt-in and never enables application downgrades', () => {
    for (const channel of [undefined, null, '', 'stable', 'nightly', true]) expect(updateChannelPolicy(channel)).toEqual({ allowPrerelease: false, allowDowngrade: false });
    expect(updateChannelPolicy('preview')).toEqual({ allowPrerelease: true, allowDowngrade: false });
  });
});
