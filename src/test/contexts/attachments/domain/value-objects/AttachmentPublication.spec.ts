import { AttachmentPublication } from '../../../../../contexts/attachments/domain/value-objects/AttachmentPublication';

describe(AttachmentPublication.name, () => {
  it('answers whether publication is encrypted', () => {
    expect(AttachmentPublication.ENCRYPTED.isEncrypted()).toBe(true);
    expect(AttachmentPublication.PUBLIC.isEncrypted()).toBe(false);
  });
});
