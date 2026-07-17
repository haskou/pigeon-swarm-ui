import { AttachmentByteSize } from '../../../../../contexts/attachments/domain/value-objects/AttachmentByteSize';
import { AttachmentEncryptionPreference } from '../../../../../contexts/attachments/domain/value-objects/AttachmentEncryptionPreference';

describe(AttachmentEncryptionPreference.name, () => {
  const small = AttachmentByteSize.fromBytes(1024);
  const large = AttachmentByteSize.fromBytes(51 * 1024 * 1024);

  it('encrypts small attachments by default', () => {
    const preference = AttachmentEncryptionPreference.SMALL_ONLY;

    expect(preference.requiresEncryption(small)).toBe(true);
    expect(preference.requiresEncryption(large)).toBe(false);
  });

  it('supports every explicit encryption combination', () => {
    const all = AttachmentEncryptionPreference.ALL;
    const largeOnly = AttachmentEncryptionPreference.LARGE_ONLY;
    const none = AttachmentEncryptionPreference.NONE;

    expect(all.requiresEncryption(small)).toBe(true);
    expect(all.requiresEncryption(large)).toBe(true);
    expect(largeOnly.requiresEncryption(small)).toBe(false);
    expect(largeOnly.requiresEncryption(large)).toBe(true);
    expect(none.requiresEncryption(small)).toBe(false);
    expect(none.requiresEncryption(large)).toBe(false);
  });
});
