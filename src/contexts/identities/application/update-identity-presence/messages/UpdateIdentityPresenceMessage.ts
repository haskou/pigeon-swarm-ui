import { Timestamp } from '@haskou/value-objects';

import { IdentityId } from '../../../domain/value-objects/IdentityId';
import { IdentityPresenceStatus } from '../../../domain/value-objects/IdentityPresenceStatus';

export class UpdateIdentityPresenceMessage {
  public constructor(
    private readonly actorIdentityId: string,
    private readonly status: string,
    private readonly occurredAt: number,
  ) {}

  public getActorIdentityId(): IdentityId {
    return IdentityId.fromString(this.actorIdentityId);
  }

  public getOccurredAt(): Timestamp {
    return new Timestamp(this.occurredAt);
  }

  public getStatus(): IdentityPresenceStatus {
    return IdentityPresenceStatus.fromPrimitives(this.status);
  }
}
