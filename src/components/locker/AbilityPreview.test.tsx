// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ list: vi.fn(), prepare: vi.fn() }));
vi.mock('../../lib/api', () => ({ getHeroAbilityPreviews: h.list, prepareHeroAbilityPreview: h.prepare }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('./RecolorTexturePreview', () => ({ default: () => null }));
vi.mock('./useOwnedGltf', () => ({ useOwnedGltf: () => null }));
import AbilityPreview from './AbilityPreview';
let root: Root; let container: HTMLDivElement;
const ability = { slot: 1, label: 'Test ability', token: 'test', clip: null, clipChoices: ['manual_cast'], soundPath: null, particlePath: null };
beforeEach(async () => {
  vi.clearAllMocks();
  h.list.mockResolvedValue([ability]);
  h.prepare.mockResolvedValue({ ability, modelUrl: null, soundUrl: null, effect: null, skinApplied: false });
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root.render(<AbilityPreview heroName="Test hero" />));
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
async function click(key: string) {
  const button = [...document.querySelectorAll('button')].find(button => button.textContent === key)!;
  await act(async () => button.click());
}
async function select(label: string, value: string) {
  const control = document.querySelector(`select[aria-label="${label}"]`) as HTMLSelectElement;
  await act(async () => { control.value = value; control.dispatchEvent(new Event('change', { bubbles: true })); });
}
describe('explicit animation auditions', () => {
  it('lets a person choose an unresolved clip and stock source, without claiming an effect join or exporting on replay', async () => {
    await click('locker.abilityPreview.open');
    await select('locker.abilityPreview.source', 'base');
    await select('locker.abilityPreview.clipSelect', 'manual_cast');
    expect(document.body.textContent).toContain('locker.abilityPreview.manualClip');
    await click('locker.abilityPreview.play');
    expect(h.prepare).toHaveBeenCalledWith('Test hero', 1, { sourceMode: 'base', clipName: 'manual_cast' });
    const pause = [...document.querySelectorAll('button')].find(button => button.textContent === 'locker.abilityPreview.pause');
    const replay = [...document.querySelectorAll('button')].find(button => button.textContent === 'locker.abilityPreview.replay');
    expect(pause).toHaveProperty('disabled', true);
    expect(replay).toHaveProperty('disabled', true);
    expect(document.querySelector('audio')).toBeNull();
    expect(h.prepare).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).toContain('locker.abilityPreview.noEffectJoin');
  });
  it('discards late results after closing and never starts an audition just because the hero changes', async () => {
    let finish!: (value: unknown) => void;
    h.prepare.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    await click('locker.abilityPreview.open'); await select('locker.abilityPreview.clipSelect', 'manual_cast'); await click('locker.abilityPreview.play');
    await act(async () => root.render(<AbilityPreview heroName="Another hero" />));
    expect(h.prepare).toHaveBeenCalledTimes(1);
    expect(document.querySelector('select[aria-label="locker.abilityPreview.clipSelect"]')).toHaveProperty('value', '');
    await act(async () => finish({ ability, modelUrl: null, soundUrl: null }));
    expect([...document.querySelectorAll('button')].some(button => button.textContent === 'locker.abilityPreview.replay')).toBe(false);
  });
});
