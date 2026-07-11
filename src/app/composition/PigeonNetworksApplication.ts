import type { NodeRelayConfiguration } from '../../contexts/networks/application/configure-node-relay/NodeRelayConfiguration';
import type { NodeRelayPortCheckResource } from '../../contexts/networks/application/configure-node-relay/NodeRelayPortCheckResource';
import type { NodeRelayPortCheckTarget } from '../../contexts/networks/application/configure-node-relay/NodeRelayPortCheckTarget';
import type { NodeNetwork } from '../../contexts/networks/application/list-node-networks/ListNodeNetworks';
import type { Peer } from '../../contexts/networks/application/list-peers/ListPeers';
import type {
  IpfsReplicationStatus,
  Session,
} from '../../shared/domain/pigeonResources.types';

import { CreateNetwork } from '../../contexts/networks/application/create-network/CreateNetwork';
import { CreateNetworkMessage } from '../../contexts/networks/application/create-network/messages/CreateNetworkMessage';
import { CreatePublicNetwork } from '../../contexts/networks/application/create-public-network/CreatePublicNetwork';
import { CreatePublicNetworkMessage } from '../../contexts/networks/application/create-public-network/messages/CreatePublicNetworkMessage';
import { JoinNetwork } from '../../contexts/networks/application/join-network/JoinNetwork';
import { JoinNetworkMessage } from '../../contexts/networks/application/join-network/messages/JoinNetworkMessage';
import { ListNodeNetworks } from '../../contexts/networks/application/list-node-networks/ListNodeNetworks';
import { ListNodeNetworksMessage } from '../../contexts/networks/application/list-node-networks/messages/ListNodeNetworksMessage';
import { ListPeers } from '../../contexts/networks/application/list-peers/ListPeers';
import { ListPeersMessage } from '../../contexts/networks/application/list-peers/messages/ListPeersMessage';
import { RemoveNodeNetworkMessage } from '../../contexts/networks/application/remove-node-network/messages/RemoveNodeNetworkMessage';
import { RemoveNodeNetwork } from '../../contexts/networks/application/remove-node-network/RemoveNodeNetwork';
import { PigeonNodeGateway } from './gateways/PigeonNodeGateway';

export class PigeonNetworksApplication {
  private readonly createNetwork: CreateNetwork;

  private readonly createPublicNetwork: CreatePublicNetwork;

  private readonly joinNetwork: JoinNetwork;

  private readonly listNetworks: ListNodeNetworks;

  private readonly listPeers: ListPeers;

  private readonly removeNetwork: RemoveNodeNetwork;

  public constructor(private readonly gateway: PigeonNodeGateway) {
    this.createNetwork = new CreateNetwork({
      create: async (name) => await gateway.createNetwork(name.toString()),
    });
    this.createPublicNetwork = new CreatePublicNetwork({
      createPublic: async (session) =>
        await gateway.createPublicNetwork(session),
    });
    this.joinNetwork = new JoinNetwork({
      joinNetwork: async (id, name, key) =>
        await gateway.joinNetwork(
          id.toString(),
          name.toString(),
          key.toString(),
        ),
    });
    this.listNetworks = new ListNodeNetworks({
      getNodeNetworks: async (session) => await gateway.getNetworks(session),
    });
    this.listPeers = new ListPeers({
      getPeers: async () => await gateway.getPeers(),
    });
    this.removeNetwork = new RemoveNodeNetwork({
      remove: async (networkId, session) =>
        await gateway.removeNetwork(networkId.toString(), session),
    });
  }

  public async checkRelayPorts(
    publicHost: string,
    checks: NodeRelayPortCheckTarget[],
    session: Session,
  ): Promise<NodeRelayPortCheckResource> {
    return await this.gateway.checkRelayPorts(publicHost, checks, session);
  }

  public async claimNode(session: Session): Promise<void> {
    await this.gateway.claim(session);
  }

  public async create(name: string): Promise<void> {
    await this.createNetwork.create(new CreateNetworkMessage(name));
  }

  public async createForNode(session: Session, name: string): Promise<void> {
    await this.gateway.createNetwork(name, session);
  }

  public async createPublic(session?: Session): Promise<void> {
    await this.createPublicNetwork.create(
      new CreatePublicNetworkMessage(session),
    );
  }

  public async getNodeInfo(): Promise<{ id: string; owner: string | null }> {
    return await this.gateway.getInfo();
  }

  public async getRelayConfiguration(
    session: Session,
  ): Promise<NodeRelayConfiguration> {
    return await this.gateway.getRelayConfiguration(session);
  }

  public async getReplicationStatus(
    session: Session,
  ): Promise<IpfsReplicationStatus> {
    return await this.gateway.getIpfsReplicationStatus(session);
  }

  public async join(id: string, name: string, key: string): Promise<void> {
    await this.joinNetwork.join(new JoinNetworkMessage({ id, key, name }));
  }

  public async joinForNode(
    session: Session,
    id: string,
    name: string,
    key: string,
  ): Promise<void> {
    await this.gateway.joinNetwork(id, name, key, session);
  }

  public async list(session?: Session): Promise<NodeNetwork[]> {
    return await this.listNetworks.list(new ListNodeNetworksMessage(session));
  }

  public async peers(): Promise<Peer[]> {
    return await this.listPeers.list(new ListPeersMessage());
  }

  public async remove(
    networkId: string,
    session?: Session,
  ): Promise<NodeNetwork[]> {
    return await this.removeNetwork.remove(
      new RemoveNodeNetworkMessage({ networkId, session }),
    );
  }

  public async updateRelayConfiguration(
    configuration: NodeRelayConfiguration,
    session?: Session,
  ): Promise<NodeRelayConfiguration> {
    return await this.gateway.updateRelayConfiguration(configuration, session);
  }
}
