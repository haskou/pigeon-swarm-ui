import type { NodeBlockPublication } from '../NodeBlockPublication';
import type { NodeAccessActorId } from '../value-objects/NodeAccessActorId';

export interface NodeBlockPublicationRepository {
  find(actorId: NodeAccessActorId): Promise<NodeBlockPublication>;
  save(
    publication: NodeBlockPublication,
    actorId: NodeAccessActorId,
  ): Promise<NodeBlockPublication>;
}
