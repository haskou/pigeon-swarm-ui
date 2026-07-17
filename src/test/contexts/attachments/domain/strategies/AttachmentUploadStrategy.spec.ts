import { NullObject } from '@haskou/value-objects';

import { AttachmentUploadStrategy } from '../../../../../contexts/attachments/domain/strategies/AttachmentUploadStrategy';
import { AttachmentByteSize } from '../../../../../contexts/attachments/domain/value-objects/AttachmentByteSize';
import { AttachmentEncryptionPreference } from '../../../../../contexts/attachments/domain/value-objects/AttachmentEncryptionPreference';
import { AttachmentNetworkId } from '../../../../../contexts/attachments/domain/value-objects/AttachmentNetworkId';

describe(AttachmentUploadStrategy.name, () => {
  const smallAttachment = AttachmentByteSize.fromBytes(1024);
  const largeAttachment = AttachmentByteSize.fromBytes(51 * 1024 * 1024);

  it('selects encrypted publication for matching attachment sizes', () => {
    const strategy = AttachmentUploadStrategy.define(
      AttachmentEncryptionPreference.SMALL_ONLY,
      AttachmentNetworkId.fromString('network-1'),
    );

    expect(strategy.publicationFor(smallAttachment).isEncrypted()).toBe(true);
    expect(strategy.publicationFor(largeAttachment).isEncrypted()).toBe(false);
  });

  it('selects public publication without requiring a network', () => {
    const strategy = AttachmentUploadStrategy.define(
      AttachmentEncryptionPreference.NONE,
      NullObject.new(AttachmentNetworkId),
    );

    expect(strategy.publicationFor(smallAttachment).isEncrypted()).toBe(false);
  });

  it('rejects an encrypted publication without a network', () => {
    const strategy = AttachmentUploadStrategy.define(
      AttachmentEncryptionPreference.ALL,
      NullObject.new(AttachmentNetworkId),
    );

    expect(() => strategy.publicationFor(smallAttachment)).toThrow(
      'Encrypted attachment publication requires a network.',
    );
  });
});
