import type { NodeBlockExceptions } from '../NodeBlockExceptions';
import type { NodeAccessActorId } from '../value-objects/NodeAccessActorId';

export interface NodeBlockExceptionsRepository {
  find(actorId: NodeAccessActorId): Promise<NodeBlockExceptions>;
  save(
    exceptions: NodeBlockExceptions,
    actorId: NodeAccessActorId,
  ): Promise<NodeBlockExceptions>;
}
