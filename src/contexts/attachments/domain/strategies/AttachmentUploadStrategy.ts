import type { PublicationStrategy } from './PublicationStrategy';

import { AttachmentByteSize } from '../value-objects/AttachmentByteSize';
import { AttachmentEncryptionPreference } from '../value-objects/AttachmentEncryptionPreference';
import { AttachmentNetworkId } from '../value-objects/AttachmentNetworkId';
import { EncryptedAttachmentStrategy } from './EncryptedAttachmentStrategy';
import { PublicAttachmentStrategy } from './PublicAttachmentStrategy';

export class AttachmentUploadStrategy {
  public static define(
    encryptionPreference: AttachmentEncryptionPreference,
    networkId: AttachmentNetworkId,
  ): AttachmentUploadStrategy {
    return new AttachmentUploadStrategy(encryptionPreference, networkId);
  }

  private constructor(
    private readonly encryptionPreference: AttachmentEncryptionPreference,
    private readonly networkId: AttachmentNetworkId,
  ) {}

  public publicationFor(size: AttachmentByteSize): PublicationStrategy {
    return this.encryptionPreference.requiresEncryption(size)
      ? EncryptedAttachmentStrategy.forNetwork(this.networkId)
      : PublicAttachmentStrategy.create();
  }
}
