import type { NetworkNode } from '../aggregates/NetworkNode';
import type { NetworkActorId } from '../value-objects/NetworkActorId';

export interface NetworkNodeRepository {
  find(): Promise<NetworkNode>;
  save(node: NetworkNode, actorId: NetworkActorId): Promise<NetworkNode>;
}
