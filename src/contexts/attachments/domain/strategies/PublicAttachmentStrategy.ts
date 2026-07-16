import { NullObject } from '@haskou/value-objects';

import type { PublicationStrategy } from './PublicationStrategy';

import { AttachmentNetworkId } from '../value-objects/AttachmentNetworkId';

export class PublicAttachmentStrategy implements PublicationStrategy {
  public static create(): PublicAttachmentStrategy {
    return new PublicAttachmentStrategy();
  }

  private constructor() {}

  public getEncryptionNetworkId(): AttachmentNetworkId {
    return NullObject.new(AttachmentNetworkId);
  }

  public isEncrypted(): boolean {
    return false;
  }
}
