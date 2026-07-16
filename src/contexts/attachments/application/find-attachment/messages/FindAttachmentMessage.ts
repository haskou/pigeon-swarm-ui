import type { PublicationStrategy } from '../../../domain/strategies/PublicationStrategy';

import { EncryptedAttachmentStrategy } from '../../../domain/strategies/EncryptedAttachmentStrategy';
import { PublicAttachmentStrategy } from '../../../domain/strategies/PublicAttachmentStrategy';
import { AttachmentExternalIdentifier } from '../../../domain/value-objects/AttachmentExternalIdentifier';

export class FindAttachmentMessage {
  public constructor(
    private readonly externalIdentifier: string,
    private readonly encrypted: boolean,
  ) {}

  public getExternalIdentifier(): AttachmentExternalIdentifier {
    return AttachmentExternalIdentifier.fromString(this.externalIdentifier);
  }

  public getPublicationStrategy(): PublicationStrategy {
    return this.encrypted
      ? EncryptedAttachmentStrategy.restore()
      : PublicAttachmentStrategy.create();
  }
}
