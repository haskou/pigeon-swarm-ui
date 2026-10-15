import type { NodeBlockExceptionsRepository } from '../../../domain/repositories/NodeBlockExceptionsRepository';
import type { NodeAccessActorId } from '../../../domain/value-objects/NodeAccessActorId';
import type { PigeonNodeAccessApi } from '../PigeonNodeAccessApi';
import type { NodeAccessSessions } from './NodeAccessSessions';

import { NodeBlockExceptions } from '../../../domain/NodeBlockExceptions';

// eslint-disable-next-line max-len
export class PigeonNodeBlockExceptionsRepository implements NodeBlockExceptionsRepository {
  public constructor(
    private readonly api: PigeonNodeAccessApi,
    private readonly sessions: NodeAccessSessions,
  ) {}

  public async find(actorId: NodeAccessActorId): Promise<NodeBlockExceptions> {
    const [node, exceptions] = await Promise.all([
      this.api.getInfo(),
      this.api.getExceptions(this.sessions.find(actorId)),
    ]);

    return NodeBlockExceptions.fromPrimitives({ ...exceptions, nodeId: node.id });
  }

  public async save(
    exceptions: NodeBlockExceptions,
    actorId: NodeAccessActorId,
  ): Promise<NodeBlockExceptions> {
    const { identityIds, nodeId, nodePeerIds } = exceptions.toPrimitives();
    const stored = await this.api.putExceptions(
      { identityIds, nodePeerIds },
      this.sessions.find(actorId),
    );
    exceptions.pullDomainEvents();

    return NodeBlockExceptions.fromPrimitives({ ...stored, nodeId });
  }
}
