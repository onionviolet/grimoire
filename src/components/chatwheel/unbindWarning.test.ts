import '../../i18n';
import i18next from 'i18next';
import { describe, expect, it, vi } from 'vitest';
import type { ConfirmFn, ConfirmRequest } from '../common/confirmContext';
import { confirmChatWheelUnbind } from './unbindWarning';

const t = i18next.t.bind(i18next);

describe('confirmChatWheelUnbind', () => {
  it('shows nothing and lets an ordinary removal through unchanged', async () => {
    const confirm = vi.fn<ConfirmFn>().mockResolvedValue(false);
    await expect(
      confirmChatWheelUnbind(confirm, t, [
        { name: 'a skin', sourceSection: 'Mod' },
        { name: 'a sound', sourceSection: 'Sound' },
        { name: 'unlabelled', sourceSection: undefined },
      ])
    ).resolves.toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('warns about unbinding, lists only the add-ons, and proceeds on confirm', async () => {
    const confirm = vi.fn<ConfirmFn>().mockResolvedValue(true);
    await expect(
      confirmChatWheelUnbind(confirm, t, [
        { name: 'a skin', sourceSection: 'Mod' },
        { name: 'My Chat Wheel', sourceSection: 'ChatWheel' },
      ])
    ).resolves.toBe(true);

    expect(confirm).toHaveBeenCalledTimes(1);
    const request = confirm.mock.calls[0][0] as ConfirmRequest;
    expect(request.variant).toBe('danger');
    expect(request.items).toEqual(['My Chat Wheel']);
    expect(String(request.title)).toContain('Unbind');
    expect(String(request.message)).toContain('Chat Wheel settings');
    expect(String(request.message)).toContain('crash');
    expect(String(request.confirmLabel)).toBe('Remove add-on');
  });

  it('blocks the removal when the warning is declined', async () => {
    const confirm = vi.fn<ConfirmFn>().mockResolvedValue(false);
    await expect(
      confirmChatWheelUnbind(confirm, t, [{ name: 'My Chat Wheel', sourceSection: 'ChatWheel' }])
    ).resolves.toBe(false);
    expect(confirm).toHaveBeenCalledTimes(1);
  });

  it('pluralises for several add-ons in one removal', async () => {
    const confirm = vi.fn<ConfirmFn>().mockResolvedValue(true);
    await confirmChatWheelUnbind(confirm, t, [
      { name: 'Wheel A', sourceSection: 'ChatWheel' },
      { name: 'Wheel B', sourceSection: 'ChatWheel' },
    ]);
    const request = confirm.mock.calls[0][0] as ConfirmRequest;
    expect(request.items).toEqual(['Wheel A', 'Wheel B']);
    expect(String(request.confirmLabel)).toBe('Remove 2 add-ons');
  });
});
