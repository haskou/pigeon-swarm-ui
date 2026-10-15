import type { NodeBlockList } from '../NodeBlockList';
import type { NodeAccessActorId } from '../value-objects/NodeAccessActorId';

export interface NodeBlockListRepository {
  /** The stored list, or null while the node has none. */
  find(actorId: NodeAccessActorId): Promise<NodeBlockList | null>;
  /** Signs the list with the actor's identity key and stores it. */
  save(list: NodeBlockList, actorId: NodeAccessActorId): Promise<NodeBlockList>;
}
