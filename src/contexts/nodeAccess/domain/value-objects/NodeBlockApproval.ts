import { assert } from '@haskou/value-objects';

import type { NodeBlockListVersion } from './NodeBlockListVersion';

import { InvalidNodeBlockApprovalError } from '../errors/InvalidNodeBlockApprovalError';
import { NodeBlockEntries } from './NodeBlockEntries';

/**
 * Pending entries of one source version the node owner approves: all of them,
 * or the named ones.
 */
export class NodeBlockApproval {
  public static all(version: NodeBlockListVersion): NodeBlockApproval {
    return new NodeBlockApproval(version, true, NodeBlockEntries.empty());
  }

  public static entries(
    version: NodeBlockListVersion,
    entries: NodeBlockEntries,
  ): NodeBlockApproval {
    assert(!entries.isEmpty(), new InvalidNodeBlockApprovalError());

    return new NodeBlockApproval(version, false, entries);
  }

  private constructor(
    private readonly version: NodeBlockListVersion,
    private readonly all: boolean,
    private readonly entries: NodeBlockEntries,
  ) {}

  public toPrimitives(): {
    all: boolean;
    identityIds: string[];
    nodePeerIds: string[];
    version: number;
  } {
    return {
      all: this.all,
      ...this.entries.toPrimitives(),
      version: this.version.valueOf(),
    };
  }
}
