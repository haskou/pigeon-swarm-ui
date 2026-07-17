import { AttachmentByteSize } from '../../../../../contexts/attachments/domain/value-objects/AttachmentByteSize';

describe(AttachmentByteSize.name, () => {
  it('compares an attachment size with its publication limit', () => {
    const size = AttachmentByteSize.fromBytes(10);

    expect(size.fitsWithin(AttachmentByteSize.fromBytes(10))).toBe(true);
    expect(size.fitsWithin(AttachmentByteSize.fromBytes(9))).toBe(false);
  });

  it('rejects negative byte sizes', () => {
    expect(() => AttachmentByteSize.fromBytes(-1)).toThrow(
      'Attachment byte size cannot be negative.',
    );
  });
});
