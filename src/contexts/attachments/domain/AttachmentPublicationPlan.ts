import { NullObject, assert } from '@haskou/value-objects';

import { AttachmentEncryptionNetworkRequiredError } from './errors/AttachmentEncryptionNetworkRequiredError';
import { AttachmentNetworkId } from './value-objects/AttachmentNetworkId';
import { AttachmentPublication } from './value-objects/AttachmentPublication';

export class AttachmentPublicationPlan {
  public static encrypted(
    networkId: AttachmentNetworkId,
  ): AttachmentPublicationPlan {
    assert(
      !NullObject.isNullObject(networkId),
      new AttachmentEncryptionNetworkRequiredError(),
    );

    return new AttachmentPublicationPlan(
      AttachmentPublication.ENCRYPTED,
      networkId,
    );
  }

  public static public(): AttachmentPublicationPlan {
    return new AttachmentPublicationPlan(
      AttachmentPublication.PUBLIC,
      NullObject.new(AttachmentNetworkId),
    );
  }

  private constructor(
    private readonly publication: AttachmentPublication,
    private readonly networkId: AttachmentNetworkId,
  ) {}

  public getEncryptionNetworkId(): AttachmentNetworkId {
    assert(this.isEncrypted(), new AttachmentEncryptionNetworkRequiredError());

    return this.networkId;
  }

  public isEncrypted(): boolean {
    return this.publication.isEncrypted();
  }
}
