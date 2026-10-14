import { Timestamp } from '@haskou/value-objects';

import { IdentityId } from '../../../domain/value-objects/IdentityId';

export class ReceiveContactPresencesMessage {
  public constructor(
    private readonly actorIdentityId: string,
    private readonly receivedAt: number,
  ) {}

  public getActorIdentityId(): IdentityId {
    return IdentityId.fromString(this.actorIdentityId);
  }

  public getReceivedAt(): Timestamp {
    return new Timestamp(this.receivedAt);
  }
}
