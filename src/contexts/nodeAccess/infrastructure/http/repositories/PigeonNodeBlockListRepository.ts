import type { NodeBlockListRepository } from '../../../domain/repositories/NodeBlockListRepository';
import type { NodeAccessActorId } from '../../../domain/value-objects/NodeAccessActorId';
import type { NodeBlockListSigner } from '../../signing/NodeBlockListSigner';
import type { PigeonNodeAccessApi } from '../PigeonNodeAccessApi';
import type { NodeAccessSessions } from './NodeAccessSessions';

import { NodeBlockList } from '../../../domain/NodeBlockList';

export class PigeonNodeBlockListRepository implements NodeBlockListRepository {
  public constructor(
    private readonly api: PigeonNodeAccessApi,
    private readonly sessions: NodeAccessSessions,
    private readonly signer: NodeBlockListSigner,
  ) {}

  public async find(actorId: NodeAccessActorId): Promise<NodeBlockList | null> {
    const stored = await this.api.getBlockList(this.sessions.find(actorId));

    return stored ? NodeBlockList.fromPrimitives(stored) : null;
  }

  public async save(
    list: NodeBlockList,
    actorId: NodeAccessActorId,
  ): Promise<NodeBlockList> {
    const session = this.sessions.find(actorId);
    const stored = await this.api.putBlockList(
      await this.signer.sign(list.toPrimitives(), session),
      session,
    );
    list.pullDomainEvents();

    return NodeBlockList.fromPrimitives(stored);
  }
}
