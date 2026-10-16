import { Timestamp } from '@haskou/value-objects';

import { NodeAccessActorId } from '../../../domain/value-objects/NodeAccessActorId';
import { NodeRegistrationCodeExpiry } from '../../../domain/value-objects/NodeRegistrationCodeExpiry';
import { NodeRegistrationCodeUses } from '../../../domain/value-objects/NodeRegistrationCodeUses';

export class IssueNodeRegistrationCodeMessage {
  public constructor(
    private readonly input: {
      actorIdentityId: string;
      expiresAt: number;
      maxUses: number;
    },
  ) {}

  public getActorId(): NodeAccessActorId {
    return NodeAccessActorId.fromString(this.input.actorIdentityId);
  }

  public getExpiresAt(): NodeRegistrationCodeExpiry {
    return NodeRegistrationCodeExpiry.future(
      this.input.expiresAt,
      Timestamp.now(),
    );
  }

  public getMaxUses(): NodeRegistrationCodeUses {
    return NodeRegistrationCodeUses.allowance(this.input.maxUses);
  }
}
