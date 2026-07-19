import { NullObject, assert } from '@haskou/value-objects';

import type { PublicationStrategy } from './PublicationStrategy';

import { AttachmentEncryptionNetworkRequiredError } from '../errors/AttachmentEncryptionNetworkRequiredError';
import { AttachmentNetworkId } from '../value-objects/AttachmentNetworkId';

export class EncryptedAttachmentStrategy implements PublicationStrategy {
  public static forNetwork(
    networkId: AttachmentNetworkId,
  ): EncryptedAttachmentStrategy {
    assert(
      !NullObject.isNullObject(networkId),
      new AttachmentEncryptionNetworkRequiredError(),
    );

    return new EncryptedAttachmentStrategy(networkId);
  }

  public static restore(): EncryptedAttachmentStrategy {
    return new EncryptedAttachmentStrategy(NullObject.new(AttachmentNetworkId));
  }

  private constructor(private readonly networkId: AttachmentNetworkId) {}

  public getEncryptionNetworkId(): AttachmentNetworkId {
    assert(
      !NullObject.isNullObject(this.networkId),
      new AttachmentEncryptionNetworkRequiredError(),
    );

    return this.networkId;
  }

  public hasEncryptionNetwork(): boolean {
    return !NullObject.isNullObject(this.networkId);
  }

  public isEncrypted(): boolean {
    return true;
  }

  public toPrimitives(): { encrypted: true; networkId?: string } {
    if (!this.hasEncryptionNetwork()) return { encrypted: true };

    return {
      encrypted: true,
      networkId: this.networkId.toString(),
    };
  }
}
