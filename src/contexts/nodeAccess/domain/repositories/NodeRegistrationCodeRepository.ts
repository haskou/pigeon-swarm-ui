import type { IssuedNodeRegistrationCode } from '../IssuedNodeRegistrationCode';
import type { NodeRegistrationCode } from '../NodeRegistrationCode';
import type { NodeAccessActorId } from '../value-objects/NodeAccessActorId';
import type { NodeRegistrationCodeExpiry } from '../value-objects/NodeRegistrationCodeExpiry';
import type { NodeRegistrationCodeId } from '../value-objects/NodeRegistrationCodeId';
import type { NodeRegistrationCodeUses } from '../value-objects/NodeRegistrationCodeUses';

export interface NodeRegistrationCodeRepository {
  issue(
    maxUses: NodeRegistrationCodeUses,
    expiresAt: NodeRegistrationCodeExpiry,
    actorId: NodeAccessActorId,
  ): Promise<IssuedNodeRegistrationCode>;
  revoke(id: NodeRegistrationCodeId, actorId: NodeAccessActorId): Promise<void>;
  search(actorId: NodeAccessActorId): Promise<NodeRegistrationCode[]>;
}
