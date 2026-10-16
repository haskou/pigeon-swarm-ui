import type { Timestamp } from '@haskou/value-objects';

import { AggregateRoot } from '../../../shared/domain/AggregateRoot';
import { NodeBlockPublicationChanged } from './events/NodeBlockPublicationChanged';
import { NodeAccessNodeId } from './value-objects/NodeAccessNodeId';

/** Whether this node publishes its signed block list for other nodes. */
export class NodeBlockPublication extends AggregateRoot {
  public static fromPrimitives(primitives: {
    nodeId: string;
    published: boolean;
  }): NodeBlockPublication {
    return new NodeBlockPublication(
      NodeAccessNodeId.fromString(primitives.nodeId),
      primitives.published,
    );
  }

  private constructor(
    private readonly nodeId: NodeAccessNodeId,
    private published: boolean,
  ) {
    super();
  }

  public change(published: boolean, occurredAt: Timestamp): void {
    if (this.published === published) return;

    this.published = published;
    this.record(new NodeBlockPublicationChanged(this.nodeId, occurredAt));
  }

  public toPrimitives(): { nodeId: string; published: boolean } {
    return { nodeId: this.nodeId.valueOf(), published: this.published };
  }
}
