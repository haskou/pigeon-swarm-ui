import type { IdentityPresence } from '../../domain/IdentityPresence';
import type { IdentityPresenceRepository } from '../../domain/repositories/IdentityPresenceRepository';
import type { IdentityId } from '../../domain/value-objects/IdentityId';
import type { PigeonPresenceGateway } from './PigeonPresenceGateway';

import { IdentityAccessContexts } from './IdentityAccessContexts';
import { IdentityPresenceMapper } from './IdentityPresenceMapper';

export class PigeonPresenceRepository implements IdentityPresenceRepository {
  public constructor(
    private readonly gateway: PigeonPresenceGateway,
    private readonly contexts: IdentityAccessContexts,
    private readonly mapper: IdentityPresenceMapper,
  ) {}

  public async find(
    identityId: IdentityId,
    actorIdentityId: IdentityId,
  ): Promise<IdentityPresence> {
    return this.mapper.fromResource(
      await this.gateway.get(
        this.contexts.find(actorIdentityId).session,
        identityId.toString(),
      ),
    );
  }

  public async search(
    identityIds: IdentityId[],
    actorIdentityId: IdentityId,
  ): Promise<IdentityPresence[]> {
    return (
      await this.gateway.getMany(
        this.contexts.find(actorIdentityId).session,
        identityIds.map((identityId) => identityId.toString()),
      )
    ).map((resource) => this.mapper.fromResource(resource));
  }

  public async update(
    presence: IdentityPresence,
    actorIdentityId: IdentityId,
  ): Promise<IdentityPresence> {
    return this.mapper.fromResource(
      await this.gateway.update(
        this.contexts.find(actorIdentityId).session,
        this.mapper.toSelectableStatus(presence),
      ),
    );
  }
}
