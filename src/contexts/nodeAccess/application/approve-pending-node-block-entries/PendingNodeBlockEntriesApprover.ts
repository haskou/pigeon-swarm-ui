import type { NodeBlockSource } from '../../domain/NodeBlockSource';
import type { NodeBlockSourceRepository } from '../../domain/repositories/NodeBlockSourceRepository';

import { NodeBlockApproval } from '../../domain/value-objects/NodeBlockApproval';
import { NodeBlockEntries } from '../../domain/value-objects/NodeBlockEntries';
import { ApprovePendingNodeBlockEntriesMessage } from './messages/ApprovePendingNodeBlockEntriesMessage';

export class PendingNodeBlockEntriesApprover {
  public constructor(private readonly sources: NodeBlockSourceRepository) {}

  /**
   * Approves against the version the node owner reviewed, so the node refuses
   * the approval and applies nothing when the source published a newer
   * version meanwhile.
   */
  public async approve(
    message: ApprovePendingNodeBlockEntriesMessage,
  ): Promise<NodeBlockSource> {
    const version = message.getVersion();
    const entry = message.getEntry();

    return await this.sources.approve(
      message.getSourceOwnerIdentityId(),
      entry
        ? NodeBlockApproval.entries(
            version,
            NodeBlockEntries.empty().with(entry),
          )
        : NodeBlockApproval.all(version),
      message.getActorId(),
    );
  }
}
