// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ list: vi.fn(), preview: vi.fn(), export: vi.fn() }));
vi.mock('../../lib/api', () => ({ foundryModels: h.list, foundryModelPreview: h.preview, foundryExportModel: h.export }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('./ModelAssetPreview', () => ({ default: ({ url }: { url: string }) => <div data-model-url={url} /> }));
const { default: ModelBrowse } = await import('./ModelBrowse');
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;
const buttons = (text: string) => [...document.querySelectorAll('button')].filter(button => button.textContent === text);
beforeEach(() => {
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  h.list.mockResolvedValue(Array.from({ length: 41 }, (_, index) => ({ path: `models/body${index}.vmdl_c`, label: `body${index}`, size: 10 })));
  h.preview.mockResolvedValue({ url: 'grimoire-foundry://t/build/model-assets/body.glb', bytes: 24 });
  h.export.mockResolvedValue({ exported: false });
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.clearAllMocks(); });
describe('Foundry model browser', () => {
  it('bounds the rendered list and offers exact-path search across every page', async () => {
    await act(async () => root.render(<ModelBrowse />));
    expect(buttons('foundry.models.preview')).toHaveLength(40);
    await act(async () => buttons('foundry.models.next')[0].click());
    expect(buttons('foundry.models.preview')).toHaveLength(1);
    expect(host.textContent).toContain('models/body40.vmdl_c');
    const input = host.querySelector('input')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'models/body3.');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(buttons('foundry.models.preview')).toHaveLength(1);
    expect(host.textContent).toContain('models/body3.vmdl_c');
    expect(h.preview).not.toHaveBeenCalled();
    expect(h.export).not.toHaveBeenCalled();
  });
  it('prepares only the selected model and requires a separate export action', async () => {
    await act(async () => root.render(<ModelBrowse />));
    await act(async () => buttons('foundry.models.preview')[0].click());
    expect(h.preview).toHaveBeenCalledExactlyOnceWith('models/body0.vmdl_c');
    expect(h.export).not.toHaveBeenCalled();
    await act(async () => buttons('foundry.models.export')[0].click());
    expect(h.export).toHaveBeenCalledExactlyOnceWith('models/body0.vmdl_c');
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  });
  it('surfaces an exporter failure and disables export for invalid output', async () => {
    h.preview.mockRejectedValue(new Error('Unsupported model'));
    await act(async () => root.render(<ModelBrowse />));
    await act(async () => buttons('foundry.models.preview')[0].click());
    expect(document.body.textContent).toContain('Unsupported model');
    expect(buttons('foundry.models.export')[0].disabled).toBe(true);
  });
});
