import { AttachmentNetworkId } from '../../../../../contexts/attachments/domain/value-objects/AttachmentNetworkId';

describe(AttachmentNetworkId.name, () => {
  it('accepts a non-empty network reference', () => {
    expect(
      AttachmentNetworkId.fromString(' network-1 ').isEqual(
        AttachmentNetworkId.fromString('network-1'),
      ),
    ).toBe(true);
  });

  it('rejects an empty network reference', () => {
    expect(() => AttachmentNetworkId.fromString('  ')).toThrow(
      'Attachment network id is required.',
    );
  });
});
