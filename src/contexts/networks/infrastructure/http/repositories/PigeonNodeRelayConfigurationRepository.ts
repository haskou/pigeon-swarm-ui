import type { Session } from '../../../../../shared/domain/pigeonResources.types';
import type { IdentityAccessContexts } from '../../../../identities/infrastructure/http/IdentityAccessContexts';
import type { NodeRelayConfiguration } from '../../../domain/aggregates/NodeRelayConfiguration';
import type { NodeRelayConfigurationRepository } from '../../../domain/repositories/NodeRelayConfigurationRepository';
import type { NetworkActorId } from '../../../domain/value-objects/NetworkActorId';
import type { NodeRelayConfigurationMapper } from '../mapping/NodeRelayConfigurationMapper';
import type { PigeonNodeApi } from '../PigeonNodeApi';

import { IdentityId } from '../../../../identities/domain/value-objects/IdentityId';

// eslint-disable-next-line max-len
export class PigeonNodeRelayConfigurationRepository implements NodeRelayConfigurationRepository {
  public constructor(
    private readonly nodeApi: PigeonNodeApi,
    private readonly identities: IdentityAccessContexts,
    private readonly mapper: NodeRelayConfigurationMapper,
  ) {}

  private session(actorId: NetworkActorId): Session | undefined {
    if (actorId.isAnonymous()) return undefined;

    return this.identities.find(IdentityId.fromString(actorId.toString()))
      .session;
  }

  public async find(actorId: NetworkActorId): Promise<NodeRelayConfiguration> {
    const session = this.session(actorId);
    const [node, resource] = await Promise.all([
      this.nodeApi.getInfo(),
      this.nodeApi.getRelayConfiguration(session),
    ]);

    return this.mapper.toAggregate(node.id, resource);
  }

  public async save(
    configuration: NodeRelayConfiguration,
    actorId: NetworkActorId,
  ): Promise<NodeRelayConfiguration> {
    const session = this.session(actorId);
    const resource = await this.nodeApi.updateRelayConfiguration(
      this.mapper.toResource(configuration),
      session,
    );
    configuration.pullDomainEvents();

    return this.mapper.toAggregate(
      configuration.toPrimitives().nodeId,
      resource,
    );
  }
}
