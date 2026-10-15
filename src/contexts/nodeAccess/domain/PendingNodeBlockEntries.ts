import { assert } from '@haskou/value-objects';

import type { NodeBlockTarget } from './value-objects/NodeBlockTarget';

import { NodeBlockSourceHasNothingPendingError } from './errors/NodeBlockSourceHasNothingPendingError';
import { NodeAccessIdentityId } from './value-objects/NodeAccessIdentityId';
import { NodeBlockApproval } from './value-objects/NodeBlockApproval';
import { NodeBlockEntries } from './value-objects/NodeBlockEntries';
import { NodeBlockListVersion } from './value-objects/NodeBlockListVersion';

export interface PendingNodeBlockEntriesPrimitives {
  blockedIdentityIds: string[];
  blockedNodePeerIds: string[];
  ownerIdentityId: string;
  version: number | null;
}

/** Entries of a followed list that wait for the node owner's review. */
export class PendingNodeBlockEntries {
  public static fromPrimitives(
    primitives: PendingNodeBlockEntriesPrimitives,
  ): PendingNodeBlockEntries {
    return new PendingNodeBlockEntries(
      NodeAccessIdentityId.fromString(primitives.ownerIdentityId),
      primitives.version === null
        ? null
        : NodeBlockListVersion.fromNumber(primitives.version),
      NodeBlockEntries.fromPrimitives({
        identityIds: primitives.blockedIdentityIds,
        nodePeerIds: primitives.blockedNodePeerIds,
      }),
    );
  }

  private constructor(
    private readonly sourceOwnerIdentityId: NodeAccessIdentityId,
    private readonly version: NodeBlockListVersion | null,
    private readonly entries: NodeBlockEntries,
  ) {}

  private pendingVersion(): NodeBlockListVersion {
    assert(
      this.version !== null && !this.entries.isEmpty(),
      new NodeBlockSourceHasNothingPendingError(),
    );

    return this.version ?? NodeBlockListVersion.first();
  }

  public approveAll(): NodeBlockApproval {
    return NodeBlockApproval.all(this.pendingVersion());
  }

  public approve(target: NodeBlockTarget): NodeBlockApproval {
    assert(
      this.entries.includes(target),
      new NodeBlockSourceHasNothingPendingError(),
    );

    return NodeBlockApproval.entries(
      this.pendingVersion(),
      NodeBlockEntries.empty().with(target),
    );
  }

  public getSourceOwnerIdentityId(): NodeAccessIdentityId {
    return this.sourceOwnerIdentityId;
  }

  public toPrimitives(): PendingNodeBlockEntriesPrimitives {
    const entries = this.entries.toPrimitives();

    return {
      blockedIdentityIds: entries.identityIds,
      blockedNodePeerIds: entries.nodePeerIds,
      ownerIdentityId: this.sourceOwnerIdentityId.valueOf(),
      version: this.version?.valueOf() ?? null,
    };
  }
}
