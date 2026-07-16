import type { AttachmentNetworkId } from '../value-objects/AttachmentNetworkId';

export interface PublicationStrategy {
  getEncryptionNetworkId(): AttachmentNetworkId;
  isEncrypted(): boolean;
}
