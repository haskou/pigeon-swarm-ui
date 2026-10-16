import type { IdentityAccessContexts } from '../../../../identities/infrastructure/http/IdentityAccessContexts';
import type { Session } from '../../../../identities/infrastructure/session/Session';
import type { NodeAccessActorId } from '../../../domain/value-objects/NodeAccessActorId';

import { IdentityId } from '../../../../identities/domain/value-objects/IdentityId';

/** Resolves the signed-in session that signs the actor's owner requests. */
export class NodeAccessSessions {
  public constructor(private readonly identities: IdentityAccessContexts) {}

  public find(actorId: NodeAccessActorId): Session {
    return this.identities.find(IdentityId.fromString(actorId.valueOf()))
      .session;
  }
}
