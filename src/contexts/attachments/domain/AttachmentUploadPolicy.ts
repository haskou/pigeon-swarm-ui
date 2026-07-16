import { AttachmentPublicationPlan } from './AttachmentPublicationPlan';
import { AttachmentByteSize } from './value-objects/AttachmentByteSize';
import { AttachmentEncryptionPreference } from './value-objects/AttachmentEncryptionPreference';
import { AttachmentNetworkId } from './value-objects/AttachmentNetworkId';

export class AttachmentUploadPolicy {
  public static define(
    encryptionPreference: AttachmentEncryptionPreference,
    networkId: AttachmentNetworkId,
  ): AttachmentUploadPolicy {
    return new AttachmentUploadPolicy(encryptionPreference, networkId);
  }

  private constructor(
    private readonly encryptionPreference: AttachmentEncryptionPreference,
    private readonly networkId: AttachmentNetworkId,
  ) {}

  public planFor(size: AttachmentByteSize): AttachmentPublicationPlan {
    return this.encryptionPreference.requiresEncryption(size)
      ? AttachmentPublicationPlan.encrypted(this.networkId)
      : AttachmentPublicationPlan.public();
  }
}
