import { NullObject } from '@haskou/value-objects';

import { AttachmentUploadPolicy } from '../../../../contexts/attachments/domain/AttachmentUploadPolicy';
import { AttachmentByteSize } from '../../../../contexts/attachments/domain/value-objects/AttachmentByteSize';
import { AttachmentEncryptionPreference } from '../../../../contexts/attachments/domain/value-objects/AttachmentEncryptionPreference';
import { AttachmentNetworkId } from '../../../../contexts/attachments/domain/value-objects/AttachmentNetworkId';

describe(AttachmentUploadPolicy.name, () => {
  it('chooses public or encrypted publication from attachment size', () => {
    const policy = AttachmentUploadPolicy.define(
      AttachmentEncryptionPreference.SMALL_ONLY,
      AttachmentNetworkId.fromString('network-1'),
    );

    expect(
      policy.planFor(AttachmentByteSize.fromBytes(1024)).isEncrypted(),
    ).toBe(true);
    expect(
      policy
        .planFor(AttachmentByteSize.fromBytes(51 * 1024 * 1024))
        .isEncrypted(),
    ).toBe(false);
  });

  it('provides the encryption network when private publication is selected', () => {
    const policy = AttachmentUploadPolicy.define(
      AttachmentEncryptionPreference.SMALL_ONLY,
      AttachmentNetworkId.fromString('network-1'),
    );

    expect(
      policy
        .planFor(AttachmentByteSize.fromBytes(1024))
        .getEncryptionNetworkId()
        .isEqual(AttachmentNetworkId.fromString('network-1')),
    ).toBe(true);
  });

  it('rejects encrypted publication without a network', () => {
    const policy = AttachmentUploadPolicy.define(
      AttachmentEncryptionPreference.SMALL_ONLY,
      NullObject.new(AttachmentNetworkId),
    );

    expect(() => policy.planFor(AttachmentByteSize.fromBytes(1024))).toThrow(
      'Encrypted attachment publication requires a network.',
    );
  });
});
