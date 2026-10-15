import type { NodeRegistrationRepository } from '../../../domain/repositories/NodeRegistrationRepository';
import type { NodeAccessActorId } from '../../../domain/value-objects/NodeAccessActorId';
import type { PigeonNodeAccessApi } from '../PigeonNodeAccessApi';
import type { NodeAccessSessions } from './NodeAccessSessions';

import { NodeRegistration } from '../../../domain/NodeRegistration';

// eslint-disable-next-line max-len
export class PigeonNodeRegistrationRepository implements NodeRegistrationRepository {
  public constructor(
    private readonly api: PigeonNodeAccessApi,
    private readonly sessions: NodeAccessSessions,
  ) {}

  public async find(): Promise<NodeRegistration> {
    const node = await this.api.getInfo();

    return NodeRegistration.fromPrimitives({
      mode: node.registration.mode,
      nodeId: node.id,
    });
  }

  public async save(
    registration: NodeRegistration,
    actorId: NodeAccessActorId,
  ): Promise<NodeRegistration> {
    await this.api.updateRegistrationMode(
      registration.toPrimitives().mode,
      this.sessions.find(actorId),
    );
    registration.pullDomainEvents();

    return registration;
  }
}
