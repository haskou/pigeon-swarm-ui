import type { Session } from '../../../../../shared/domain/pigeonResources.types';
import type { NetworkNode } from '../../../domain/aggregates/NetworkNode';
import type { NetworkNodeRepository } from '../../../domain/repositories/NetworkNodeRepository';
import type { NetworkActorId } from '../../../domain/value-objects/NetworkActorId';
import type { NetworkNodeMapper } from '../mapping/NetworkNodeMapper';
import type { PigeonNodeApi } from '../PigeonNodeApi';

import { IdentityId } from '../../../../identities/domain/value-objects/IdentityId';
import { IdentityAccessContexts } from '../../../../identities/infrastructure/http/IdentityAccessContexts';
import { NetworkNodeClaimed } from '../../../domain/events/NetworkNodeClaimed';
import { PublicNetworkAttached } from '../../../domain/events/PublicNetworkAttached';

export class PigeonNetworkNodeRepository implements NetworkNodeRepository {
  public constructor(
    private readonly nodeApi: PigeonNodeApi,
    private readonly identities: IdentityAccessContexts,
    private readonly mapper: NetworkNodeMapper,
  ) {}

  private session(actorId: NetworkActorId): Session | undefined {
    if (actorId.isAnonymous()) return undefined;

    return this.identities.find(IdentityId.fromString(actorId.toString()))
      .session;
  }

  public async find(): Promise<NetworkNode> {
    return this.mapper.toAggregate(await this.nodeApi.getInfo());
  }

  public async save(
    node: NetworkNode,
    actorId: NetworkActorId,
  ): Promise<NetworkNode> {
    const session = this.session(actorId);

    for (const event of node.pullDomainEvents()) {
      if (event instanceof NetworkNodeClaimed && session) {
        await this.nodeApi.claim(session);
      }

      if (event instanceof PublicNetworkAttached) {
        await this.nodeApi.createPublicNetwork(session);
      }
    }

    return node;
  }
}
