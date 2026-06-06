import type { NodeNetwork } from '../../../contexts/networks/application/list-node-networks/NodeNetwork';
import type { Peer } from '../../../contexts/networks/application/list-peers/ListPeers';
import type {
  IpfsReplicationStatus,
  Session,
} from '../../../shared/domain/pigeonResources.types';

import { PigeonNodeApi } from '../../../contexts/networks/infrastructure/http/PigeonNodeApi';

export class PigeonNodeGateway {
  public constructor(private readonly node: PigeonNodeApi) {}

  public async getInfo(): Promise<{ id: string; owner: string | null }> {
    return await this.node.getInfo();
  }

  public async claim(session: Session): Promise<void> {
    await this.node.claim(session);
  }

  public async getNetworks(session?: Session): Promise<NodeNetwork[]> {
    return await this.node.getNetworks(session);
  }

  public async getPeers(): Promise<Peer[]> {
    return await this.node.getPeers();
  }

  public async getIpfsReplicationStatus(
    session: Session,
  ): Promise<IpfsReplicationStatus> {
    return await this.node.getIpfsReplicationStatus(session);
  }

  public async createNetwork(name: string, session?: Session): Promise<void> {
    await this.node.createNetwork(name, session);
  }

  public async createPublicNetwork(session?: Session): Promise<void> {
    await this.node.createPublicNetwork(session);
  }

  public async joinNetwork(
    id: string,
    name: string,
    key: string,
    session?: Session,
  ): Promise<void> {
    await this.node.joinNetwork(id, name, key, session);
  }

  public async removeNetwork(
    networkId: string,
    session?: Session,
  ): Promise<NodeNetwork[]> {
    return await this.node.removeNetwork(networkId, session);
  }
}
