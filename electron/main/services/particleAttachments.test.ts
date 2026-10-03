import { describe, expect, it, vi } from 'vitest';
vi.mock('./vpk', () => ({ readVpkEntryBytes: vi.fn() }));
vi.mock('./modMerger', () => ({ runVpkmergeStdout: vi.fn() }));
const { modelAttachmentResource, attachmentsFromKv3 } = await import('./particleAttachments');
describe('authored MDAT attachment bridge', () => {
  it('retags a private MDAT copy without changing bytes or offsets in the source', () => {
    const resource = Buffer.alloc(52); resource.writeUInt32LE(8, 8); resource.writeUInt32LE(2, 12);
    resource.write('DATA', 16); resource.writeUInt32LE(20, 20); resource.writeUInt32LE(6, 24);
    resource.write('MDAT', 28); resource.writeUInt32LE(14, 32); resource.writeUInt32LE(6, 36);
    resource.write('parent', 40); resource.write('attach', 46);
    const copy = modelAttachmentResource(resource)!;
    expect(resource.toString('ascii', 16, 20)).toBe('DATA'); expect(resource.toString('ascii', 28, 32)).toBe('MDAT');
    expect(copy.toString('ascii', 16, 20)).toBe('ODAT'); expect(copy.toString('ascii', 28, 32)).toBe('DATA');
    expect(copy.subarray(40)).toEqual(resource.subarray(40));
  });
  it('rejects malformed block directories instead of rewriting unvalidated resource bytes', () => {
    expect(modelAttachmentResource(Buffer.alloc(8))).toBeNull();
    const invalid = Buffer.alloc(32); invalid.writeUInt32LE(100, 8); invalid.writeUInt32LE(2, 12);
    expect(modelAttachmentResource(invalid)).toBeNull();
  });
  it('projects only complete finite authored influences and keeps root transforms explicit', () => {
    const valid = { m_name: 'ability_cast', m_nInfluences: 1, m_influenceNames: ['hand_R'], m_vInfluenceOffsets: [[1, 2, 3]], m_influenceWeights: [1], m_bInfluenceRootTransform: [false] };
    expect(attachmentsFromKv3({ m_attachments: [{ key: 'ability_cast', value: valid }] })).toEqual([{ name: 'ability_cast', influences: [{ bone: 'hand_R', offset: [1, 2, 3], weight: 1, rootTransform: false }] }]);
    expect(attachmentsFromKv3({ m_attachments: [{ ...valid, m_vInfluenceOffsets: [[NaN, 2, 3]] }] })).toEqual([]);
  });
});
