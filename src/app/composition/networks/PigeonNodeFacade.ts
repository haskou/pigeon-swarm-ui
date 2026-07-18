import type { IdentityAccessContexts } from '../../../contexts/identities/infrastructure/http/IdentityAccessContexts';
import type { NetworkNodeClaimer } from '../../../contexts/networks/application/claim-network-node/NetworkNodeClaimer';
import type { PublicNetworkCreator } from '../../../contexts/networks/application/create-public-network/PublicNetworkCreator';
import type { NodeRelayConfigurationFinder } from '../../../contexts/networks/application/find-node-relay-configuration/NodeRelayConfigurationFinder';
import type { NodeRelayConfigurationUpdater } from '../../../contexts/networks/application/update-node-relay-configuration/NodeRelayConfigurationUpdater';
import type { PigeonNodeApi } from '../../../contexts/networks/infrastructure/http/PigeonNodeApi';
import type { IpfsReplicationStatus } from '../../../contexts/networks/presentation/view-models/IpfsReplicationStatus';
import type { NodeRelayConfigurationViewModel } from '../../../contexts/networks/presentation/view-models/NodeRelayConfigurationViewModel';
import type { NodeRelayConfigurationViewModelMapper } from '../../../contexts/networks/presentation/view-models/NodeRelayConfigurationViewModelMapper';
import type { Session } from '../../../shared/domain/pigeonResources.types';

import { ClaimNetworkNodeMessage } from '../../../contexts/networks/application/claim-network-node/messages/ClaimNetworkNodeMessage';
import { CreatePublicNetworkMessage } from '../../../contexts/networks/application/create-public-network/messages/CreatePublicNetworkMessage';
import { FindNodeRelayConfigurationMessage } from '../../../contexts/networks/application/find-node-relay-configuration/messages/FindNodeRelayConfigurationMessage';
import { UpdateNodeRelayConfigurationMessage } from '../../../contexts/networks/application/update-node-relay-configuration/messages/UpdateNodeRelayConfigurationMessage';

export class PigeonNodeFacade {
  public constructor(
    private readonly identities: IdentityAccessContexts,
    private readonly nodeClaimer: NetworkNodeClaimer,
    private readonly publicNetworkCreator: PublicNetworkCreator,
    private readonly relayFinder: NodeRelayConfigurationFinder,
    private readonly relayUpdater: NodeRelayConfigurationUpdater,
    private readonly relayMapper: NodeRelayConfigurationViewModelMapper,
    private readonly node: PigeonNodeApi,
  ) {}

  private actorIdentityId(session?: Session): string | undefined {
    if (!session) return undefined;

    this.identities.register(session);

    return session.identity.id;
  }

  public async claim(session: Session): Promise<void> {
    this.actorIdentityId(session);
    await this.nodeClaimer.claim(
      new ClaimNetworkNodeMessage(session.identity.id),
    );
  }

  public async createPublicNetwork(session?: Session): Promise<void> {
    await this.publicNetworkCreator.create(
      new CreatePublicNetworkMessage(this.actorIdentityId(session)),
    );
  }

  public async getInfo(): Promise<{ id: string; owner: string | null }> {
    return await this.node.getInfo();
  }

  public async getRelayConfiguration(
    session: Session,
  ): Promise<NodeRelayConfigurationViewModel> {
    const configuration = await this.relayFinder.find(
      new FindNodeRelayConfigurationMessage(this.actorIdentityId(session)),
    );

    return this.relayMapper.fromAggregate(configuration);
  }

  public async getReplicationStatus(
    session: Session,
  ): Promise<IpfsReplicationStatus> {
    this.actorIdentityId(session);

    return await this.node.getIpfsReplicationStatus(session);
  }

  public async updateRelayConfiguration(
    configuration: NodeRelayConfigurationViewModel,
    session?: Session,
  ): Promise<NodeRelayConfigurationViewModel> {
    const updated = await this.relayUpdater.update(
      new UpdateNodeRelayConfigurationMessage({
        ...configuration,
        actorIdentityId: this.actorIdentityId(session),
        privateRelay: {
          discoveryEnabled: configuration.privateRelay.discoveryEnabled,
          enabled: configuration.privateRelay.enabled,
          portEnd: configuration.privateRelay.portEnd,
          portStart: configuration.privateRelay.portStart,
        },
      }),
    );

    return this.relayMapper.fromAggregate(updated);
  }
}
