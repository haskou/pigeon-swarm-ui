import { Timestamp } from '@haskou/value-objects';

import { IdentityId } from '../../../domain/value-objects/IdentityId';

export class SearchContactPresencesMessage {
  public constructor(
    private readonly actorIdentityId: string,
    private readonly now: number,
  ) {}

  public getActorIdentityId(): IdentityId {
    return IdentityId.fromString(this.actorIdentityId);
  }

  public getNow(): Timestamp {
    return new Timestamp(this.now);
  }
}
