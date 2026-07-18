import type {
  IpfsReplicationStatus,
  Session,
} from '../../../shared/domain/pigeonResources.types';
import type { CreateNetwork } from '../../../contexts/networks/application/create-network/CreateNetwork';
import type { JoinNetwork } from '../../../contexts/networks/application/join-network/JoinNetwork';
import type { ListNodeNetworks } from '../../../contexts/networks/application/list-node-networks/ListNodeNetworks';
import type { Peer } from '../../../contexts/networks/application/list-peers/Peer';
import type { RemoveNodeNetwork } from '../../../contexts/networks/application/remove-node-network/RemoveNodeNetwork';
import type { NodeRelayConfiguration } from '../../../contexts/networks/application/configure-node-relay/NodeRelayConfiguration';
import type { NodeRelayPortCheckResource } from '../../../contexts/networks/application/configure-node-relay/NodeRelayPortCheckResource';
import type { NodeRelayPortCheckTarget } from '../../../contexts/networks/application/configure-node-relay/NodeRelayPortCheckTarget';
import type { IdentityAccessContexts } from '../../../contexts/identities/infrastructure/http/IdentityAccessContexts';
import type { PigeonNodeApi } from '../../../contexts/networks/infrastructure/http/PigeonNodeApi';
import type { NodeNetwork } from '../../../contexts/networks/presentation/view-models/NodeNetwork';
import type { Network } from '../../../contexts/networks/domain/aggregates/Network';

import { CreateNetworkMessage } from '../../../contexts/networks/application/create-network/messages/CreateNetworkMessage';
import { JoinNetworkMessage } from '../../../contexts/networks/application/join-network/messages/JoinNetworkMessage';
import { ListNodeNetworksMessage } from '../../../contexts/networks/application/list-node-networks/messages/ListNodeNetworksMessage';
import { RemoveNodeNetworkMessage } from '../../../contexts/networks/application/remove-node-network/messages/RemoveNodeNetworkMessage';

export class PigeonNetworksFacade {
  public constructor(
    private readonly identities: IdentityAccessContexts,
    private readonly networkCreator: CreateNetwork,
    private readonly networkJoiner: JoinNetwork,
    private readonly networkSearcher: ListNodeNetworks,
    private readonly networkRemover: RemoveNodeNetwork,
    private readonly node: PigeonNodeApi,
  ) {}

  private actorIdentityId(session?: Session): string | undefined {
    if (!session) return undefined;

    this.identities.register(session);

    return session.identity.id;
  }

  private toNodeNetwork(network: Network): NodeNetwork {
    const primitives = network.toPrimitives();

    return {
      id: primitives.id,
      key: primitives.key,
      name: primitives.name,
    };
  }

  public async checkRelayPorts(
    publicHost: string,
    checks: NodeRelayPortCheckTarget[],
    session: Session,
  ): Promise<NodeRelayPortCheckResource> {
    this.actorIdentityId(session);

    return await this.node.checkRelayPorts(publicHost, checks, session);
  }

  public async claimNode(session: Session): Promise<void> {
    this.actorIdentityId(session);
    await this.node.claim(session);
  }

  public async create(name: string): Promise<void> {
    await this.networkCreator.create(new CreateNetworkMessage({ name }));
  }

  public async createForNode(session: Session, name: string): Promise<void> {
    await this.networkCreator.create(
      new CreateNetworkMessage({
        actorIdentityId: this.actorIdentityId(session),
        name,
      }),
    );
  }

  public async createPublic(session?: Session): Promise<void> {
    if (session) this.actorIdentityId(session);

    await this.node.createPublicNetwork(session);
  }

  public async getNodeInfo(): Promise<{ id: string; owner: string | null }> {
    return await this.node.getInfo();
  }

  public async getRelayConfiguration(
    session: Session,
  ): Promise<NodeRelayConfiguration> {
    this.actorIdentityId(session);

    return await this.node.getRelayConfiguration(session);
  }

  public async getReplicationStatus(
    session: Session,
  ): Promise<IpfsReplicationStatus> {
    this.actorIdentityId(session);

    return await this.node.getIpfsReplicationStatus(session);
  }

  public async join(id: string, name: string, key: string): Promise<void> {
    await this.networkJoiner.join(new JoinNetworkMessage({ id, key, name }));
  }

  public async joinForNode(
    session: Session,
    id: string,
    name: string,
    key: string,
  ): Promise<void> {
    await this.networkJoiner.join(
      new JoinNetworkMessage({
        actorIdentityId: this.actorIdentityId(session),
        id,
        key,
        name,
      }),
    );
  }

  public async list(session?: Session): Promise<NodeNetwork[]> {
    const networks = await this.networkSearcher.list(
      new ListNodeNetworksMessage(this.actorIdentityId(session)),
    );

    return networks.map((network) => this.toNodeNetwork(network));
  }

  public async peers(): Promise<Peer[]> {
    return await this.node.getPeers();
  }

  public async remove(
    networkId: string,
    session?: Session,
  ): Promise<NodeNetwork[]> {
    const networks = await this.networkRemover.remove(
      new RemoveNodeNetworkMessage({
        actorIdentityId: this.actorIdentityId(session),
        networkId,
      }),
    );

    return networks.map((network) => this.toNodeNetwork(network));
  }

  public async updateRelayConfiguration(
    configuration: NodeRelayConfiguration,
    session?: Session,
  ): Promise<NodeRelayConfiguration> {
    if (session) this.actorIdentityId(session);

    return await this.node.updateRelayConfiguration(configuration, session);
  }
}
