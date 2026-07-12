import type {
  IpfsReplicationStatus,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { NodeRelayConfiguration } from '../../application/configure-node-relay/NodeRelayConfiguration';
import type { NodeRelayPortCheckResource } from '../../application/configure-node-relay/NodeRelayPortCheckResource';
import type { NodeRelayPortCheckTarget } from '../../application/configure-node-relay/NodeRelayPortCheckTarget';
import type { NodeNetwork } from '../../application/list-node-networks/NodeNetwork';
import type { Peer } from '../../application/list-peers/ListPeers';

import { PigeonNodeApi } from './PigeonNodeApi';

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

  public async getRelayConfiguration(
    session: Session,
  ): Promise<NodeRelayConfiguration> {
    return await this.node.getRelayConfiguration(session);
  }

  public async updateRelayConfiguration(
    configuration: NodeRelayConfiguration,
    session?: Session,
  ): Promise<NodeRelayConfiguration> {
    return await this.node.updateRelayConfiguration(configuration, session);
  }

  public async checkRelayPorts(
    publicHost: string,
    checks: NodeRelayPortCheckTarget[],
    session: Session,
  ): Promise<NodeRelayPortCheckResource> {
    return await this.node.checkRelayPorts(publicHost, checks, session);
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
