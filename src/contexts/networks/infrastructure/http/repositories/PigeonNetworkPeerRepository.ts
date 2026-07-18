import type { NetworkPeer } from '../../../domain/entities/NetworkPeer';
import type { NetworkPeerRepository } from '../../../domain/repositories/NetworkPeerRepository';
import type { PigeonNodeApi } from '../PigeonNodeApi';

import { NetworkPeerMapper } from '../mapping/NetworkPeerMapper';

export class PigeonNetworkPeerRepository implements NetworkPeerRepository {
  public constructor(
    private readonly node: PigeonNodeApi,
    private readonly mapper: NetworkPeerMapper,
  ) {}

  public async search(): Promise<NetworkPeer[]> {
    const resources = await this.node.getPeers();

    return resources.map((resource) => this.mapper.toAggregate(resource));
  }
}
