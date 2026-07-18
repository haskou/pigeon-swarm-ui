import type { Session } from '../../../../../shared/domain/pigeonResources.types';
import type { Network } from '../../../domain/Network';
import type { NetworkRepository } from '../../../domain/repositories/NetworkRepository';
import type { NetworkActorId } from '../../../domain/value-objects/NetworkActorId';
import type { NetworkId } from '../../../domain/value-objects/NetworkId';
import type { PigeonNodeApi } from '../PigeonNodeApi';

import { IdentityId } from '../../../../identities/domain/value-objects/IdentityId';
import { IdentityAccessContexts } from '../../../../identities/infrastructure/http/IdentityAccessContexts';
import { NetworkNotFoundError } from '../../../domain/errors/NetworkNotFoundError';
import { NetworkRemoved } from '../../../domain/events/NetworkRemoved';
import { NetworkMapper } from '../mapping/NetworkMapper';

export class PigeonNetworkRepository implements NetworkRepository {
  public constructor(
    private readonly node: PigeonNodeApi,
    private readonly identities: IdentityAccessContexts,
    private readonly mapper: NetworkMapper,
  ) {}

  private session(actorId: NetworkActorId): Session | undefined {
    if (actorId.isAnonymous()) return undefined;

    return this.identities.find(IdentityId.fromString(actorId.toString()))
      .session;
  }

  public async create(
    network: Network,
    actorId: NetworkActorId,
  ): Promise<Network> {
    await this.node.createNetwork(
      this.mapper.toResource(network),
      this.session(actorId),
    );
    network.pullDomainEvents();

    return network;
  }

  public async find(
    networkId: NetworkId,
    actorId: NetworkActorId,
  ): Promise<Network> {
    const network = (await this.search(actorId)).find((candidate) =>
      candidate.belongsTo(networkId),
    );

    if (!network) throw new NetworkNotFoundError();

    return network;
  }

  public async save(
    network: Network,
    actorId: NetworkActorId,
  ): Promise<Network> {
    for (const event of network.pullDomainEvents()) {
      if (!(event instanceof NetworkRemoved)) continue;

      await this.node.removeNetwork(event.aggregateId, this.session(actorId));
    }

    return network;
  }

  public async search(actorId: NetworkActorId): Promise<Network[]> {
    return (await this.node.getNetworks(this.session(actorId))).map(
      (resource) => this.mapper.toAggregate(resource),
    );
  }
}
