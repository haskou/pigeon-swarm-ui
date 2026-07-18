import type { AttachmentNetworkId } from '../value-objects/AttachmentNetworkId';

export interface PublicationStrategy {
  getEncryptionNetworkId(): AttachmentNetworkId;
  hasEncryptionNetwork(): boolean;
  isEncrypted(): boolean;
  toPrimitives():
    | { encrypted: false }
    | { encrypted: true; networkId?: string };
}
