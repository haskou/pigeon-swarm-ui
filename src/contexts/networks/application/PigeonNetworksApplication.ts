import type {
  IpfsReplicationStatus,
  Session,
} from '../../../shared/domain/pigeonResources.types';
import type { CheckRelayPortsPort } from './check-relay-ports/CheckRelayPortsPort';
import type { ClaimNodePort } from './claim-node/ClaimNodePort';
import type { NodeRelayConfiguration } from './configure-node-relay/NodeRelayConfiguration';
import type { NodeRelayPortCheckResource } from './configure-node-relay/NodeRelayPortCheckResource';
import type { NodeRelayPortCheckTarget } from './configure-node-relay/NodeRelayPortCheckTarget';
import type { CreateNetworkForNodePort } from './create-network-for-node/CreateNetworkForNodePort';
import type { CreateNetworkPort } from './create-network/CreateNetworkPort';
import type { CreatePublicNetworkPort } from './create-public-network/CreatePublicNetworkPort';
import type { GetNodeInfoPort } from './get-node-info/GetNodeInfoPort';
import type { GetRelayConfigurationPort } from './get-relay-configuration/GetRelayConfigurationPort';
import type { GetReplicationStatusPort } from './get-replication-status/GetReplicationStatusPort';
import type { JoinNetworkForNodePort } from './join-network-for-node/JoinNetworkForNodePort';
import type { JoinNetworkPort } from './join-network/JoinNetworkPort';
import type { ListNodeNetworksPort } from './list-node-networks/ListNodeNetworksPort';
import type { NodeNetwork } from './list-node-networks/NodeNetwork';
import type { ListPeersPort } from './list-peers/ListPeersPort';
import type { Peer } from './list-peers/Peer';
import type { RemoveNodeNetworkPort } from './remove-node-network/RemoveNodeNetworkPort';
import type { UpdateRelayConfigurationPort } from './update-relay-configuration/UpdateRelayConfigurationPort';

import { CreateNetwork } from './create-network/CreateNetwork';
import { CreateNetworkMessage } from './create-network/messages/CreateNetworkMessage';
import { CreatePublicNetwork } from './create-public-network/CreatePublicNetwork';
import { CreatePublicNetworkMessage } from './create-public-network/messages/CreatePublicNetworkMessage';
import { JoinNetwork } from './join-network/JoinNetwork';
import { JoinNetworkMessage } from './join-network/messages/JoinNetworkMessage';
import { ListNodeNetworks } from './list-node-networks/ListNodeNetworks';
import { ListNodeNetworksMessage } from './list-node-networks/messages/ListNodeNetworksMessage';
import { ListPeers } from './list-peers/ListPeers';
import { ListPeersMessage } from './list-peers/messages/ListPeersMessage';
import { RemoveNodeNetworkMessage } from './remove-node-network/messages/RemoveNodeNetworkMessage';
import { RemoveNodeNetwork } from './remove-node-network/RemoveNodeNetwork';

export class PigeonNetworksApplication {
  private readonly createNetwork: CreateNetwork;

  private readonly createPublicNetwork: CreatePublicNetwork;

  private readonly joinNetwork: JoinNetwork;

  private readonly listNetworks: ListNodeNetworks;

  private readonly listPeers: ListPeers;

  private readonly removeNetwork: RemoveNodeNetwork;

  public constructor(
    private readonly dependencies: {
      checkRelayPorts: CheckRelayPortsPort;
      claimNode: ClaimNodePort;
      createNetwork: CreateNetworkPort;
      createNetworkForNode: CreateNetworkForNodePort;
      createPublicNetwork: CreatePublicNetworkPort;
      getNodeInfo: GetNodeInfoPort;
      getRelayConfiguration: GetRelayConfigurationPort;
      getReplicationStatus: GetReplicationStatusPort;
      joinNetwork: JoinNetworkPort;
      joinNetworkForNode: JoinNetworkForNodePort;
      listNodeNetworks: ListNodeNetworksPort;
      listPeers: ListPeersPort;
      removeNodeNetwork: RemoveNodeNetworkPort;
      updateRelayConfiguration: UpdateRelayConfigurationPort;
    },
  ) {
    this.createNetwork = new CreateNetwork({
      create: async (name) => await dependencies.createNetwork.create(name),
    });
    this.createPublicNetwork = new CreatePublicNetwork({
      createPublic: async (session) =>
        await dependencies.createPublicNetwork.createPublic(session),
    });
    this.joinNetwork = new JoinNetwork({
      joinNetwork: async (id, name, key) =>
        await dependencies.joinNetwork.joinNetwork(id, name, key),
    });
    this.listNetworks = new ListNodeNetworks({
      getNodeNetworks: async (session) =>
        await dependencies.listNodeNetworks.getNodeNetworks(session),
    });
    this.listPeers = new ListPeers({
      getPeers: async () => await dependencies.listPeers.getPeers(),
    });
    this.removeNetwork = new RemoveNodeNetwork({
      remove: async (networkId, session) =>
        await dependencies.removeNodeNetwork.remove(networkId, session),
    });
  }

  public async checkRelayPorts(
    publicHost: string,
    checks: NodeRelayPortCheckTarget[],
    session: Session,
  ): Promise<NodeRelayPortCheckResource> {
    return await this.dependencies.checkRelayPorts.checkRelayPorts(
      publicHost,
      checks,
      session,
    );
  }

  public async claimNode(session: Session): Promise<void> {
    await this.dependencies.claimNode.claim(session);
  }

  public async create(name: string): Promise<void> {
    await this.createNetwork.create(new CreateNetworkMessage(name));
  }

  public async createForNode(session: Session, name: string): Promise<void> {
    await this.dependencies.createNetworkForNode.createNetwork(name, session);
  }

  public async createPublic(session?: Session): Promise<void> {
    await this.createPublicNetwork.create(
      new CreatePublicNetworkMessage(session),
    );
  }

  public async getNodeInfo(): Promise<{ id: string; owner: string | null }> {
    return await this.dependencies.getNodeInfo.getInfo();
  }

  public async getRelayConfiguration(
    session: Session,
  ): Promise<NodeRelayConfiguration> {
    return await this.dependencies.getRelayConfiguration.getRelayConfiguration(
      session,
    );
  }

  public async getReplicationStatus(
    session: Session,
  ): Promise<IpfsReplicationStatus> {
    const getReplicationStatus = this.dependencies.getReplicationStatus;

    return await getReplicationStatus.getIpfsReplicationStatus(session);
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
    await this.dependencies.joinNetworkForNode.joinNetwork(
      id,
      name,
      key,
      session,
    );
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
    const updateRelayConfiguration = this.dependencies.updateRelayConfiguration;

    return await updateRelayConfiguration.updateRelayConfiguration(
      configuration,
      session,
    );
  }
}
