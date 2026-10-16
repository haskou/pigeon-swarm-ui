import type { NodeBlockPublicationRepository } from '../../../domain/repositories/NodeBlockPublicationRepository';
import type { NodeAccessActorId } from '../../../domain/value-objects/NodeAccessActorId';
import type { PigeonNodeAccessApi } from '../PigeonNodeAccessApi';
import type { NodeAccessSessions } from './NodeAccessSessions';

import { NodeBlockPublication } from '../../../domain/NodeBlockPublication';

// eslint-disable-next-line max-len
export class PigeonNodeBlockPublicationRepository implements NodeBlockPublicationRepository {
  public constructor(
    private readonly api: PigeonNodeAccessApi,
    private readonly sessions: NodeAccessSessions,
  ) {}

  public async find(actorId: NodeAccessActorId): Promise<NodeBlockPublication> {
    const [node, published] = await Promise.all([
      this.api.getInfo(),
      this.api.getPublication(this.sessions.find(actorId)),
    ]);

    return NodeBlockPublication.fromPrimitives({ nodeId: node.id, published });
  }

  public async save(
    publication: NodeBlockPublication,
    actorId: NodeAccessActorId,
  ): Promise<NodeBlockPublication> {
    const { nodeId, published } = publication.toPrimitives();
    const stored = await this.api.putPublication(
      published,
      this.sessions.find(actorId),
    );
    publication.pullDomainEvents();

    return NodeBlockPublication.fromPrimitives({ nodeId, published: stored });
  }
}
