import type { NodeRegistration } from '../NodeRegistration';
import type { NodeAccessActorId } from '../value-objects/NodeAccessActorId';

export interface NodeRegistrationRepository {
  find(actorId: NodeAccessActorId): Promise<NodeRegistration>;
  save(
    registration: NodeRegistration,
    actorId: NodeAccessActorId,
  ): Promise<NodeRegistration>;
}
