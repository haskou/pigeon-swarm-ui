import type { NodeBlockSource } from '../../domain/NodeBlockSource';
import type { NodeBlockSourceRepository } from '../../domain/repositories/NodeBlockSourceRepository';

import { ApprovePendingNodeBlockEntriesMessage } from './messages/ApprovePendingNodeBlockEntriesMessage';

export class PendingNodeBlockEntriesApprover {
  public constructor(private readonly sources: NodeBlockSourceRepository) {}

  /**
   * Approves against the pending version just read, so the node refuses the
   * approval when the source published a newer version meanwhile.
   */
  public async approve(
    message: ApprovePendingNodeBlockEntriesMessage,
  ): Promise<NodeBlockSource> {
    const actorId = message.getActorId();
    const sourceOwnerIdentityId = message.getSourceOwnerIdentityId();
    const pending = await this.sources.findPending(
      sourceOwnerIdentityId,
      actorId,
    );
    const entry = message.getEntry();

    return await this.sources.approve(
      sourceOwnerIdentityId,
      entry ? pending.approve(entry) : pending.approveAll(),
      actorId,
    );
  }
}
