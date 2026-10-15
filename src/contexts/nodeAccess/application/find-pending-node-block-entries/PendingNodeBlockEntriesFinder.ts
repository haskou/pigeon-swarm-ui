import type { PendingNodeBlockEntries } from '../../domain/PendingNodeBlockEntries';
import type { NodeBlockSourceRepository } from '../../domain/repositories/NodeBlockSourceRepository';

import { FindPendingNodeBlockEntriesMessage } from './messages/FindPendingNodeBlockEntriesMessage';

export class PendingNodeBlockEntriesFinder {
  public constructor(private readonly sources: NodeBlockSourceRepository) {}

  public async find(message: FindPendingNodeBlockEntriesMessage): Promise<PendingNodeBlockEntries> {
    return await this.sources.findPending(
      message.getSourceOwnerIdentityId(),
      message.getActorId(),
    );
  }
}
