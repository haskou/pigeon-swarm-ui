import type { Network } from '../aggregates/Network';
import type { NetworkActorId } from '../value-objects/NetworkActorId';
import type { NetworkId } from '../value-objects/NetworkId';

export interface NetworkRepository {
  create(network: Network, actorId: NetworkActorId): Promise<Network>;
  find(networkId: NetworkId, actorId: NetworkActorId): Promise<Network>;
  save(network: Network, actorId: NetworkActorId): Promise<Network>;
  search(actorId: NetworkActorId): Promise<Network[]>;
}
