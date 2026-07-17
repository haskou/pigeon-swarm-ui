import { assert, StringValueObject } from '@haskou/value-objects';

import { AttachmentNetworkIdRequiredError } from '../errors/AttachmentNetworkIdRequiredError';

export class AttachmentNetworkId extends StringValueObject {
  public static fromString(networkId: string): AttachmentNetworkId {
    return new AttachmentNetworkId(networkId.trim());
  }

  public constructor(networkId: string) {
    super(networkId);
    assert(!this.isEmpty(), new AttachmentNetworkIdRequiredError());
  }
}
