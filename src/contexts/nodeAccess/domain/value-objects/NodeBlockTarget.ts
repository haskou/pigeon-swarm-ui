import { NodeAccessIdentityId } from './NodeAccessIdentityId';
import { NodePeerId } from './NodePeerId';

/** One entry of a block list: an identity or a node by its peer id. */
export class NodeBlockTarget {
  /** An identity when `identityId` is given, otherwise a node by peer id. */
  public static fromPrimitives(primitives: {
    identityId?: string;
    nodePeerId?: string;
  }): NodeBlockTarget {
    return primitives.identityId === undefined
      ? this.node(primitives.nodePeerId ?? '')
      : this.identity(primitives.identityId);
  }

  public static identity(value: string): NodeBlockTarget {
    return new NodeBlockTarget(NodeAccessIdentityId.fromString(value), null);
  }

  public static node(value: string): NodeBlockTarget {
    return new NodeBlockTarget(null, NodePeerId.fromString(value));
  }

  private constructor(
    private readonly identityId: NodeAccessIdentityId | null,
    private readonly nodePeerId: NodePeerId | null,
  ) {}

  public getIdentityId(): NodeAccessIdentityId | null {
    return this.identityId;
  }

  public getNodePeerId(): NodePeerId | null {
    return this.nodePeerId;
  }

  public toString(): string {
    return (this.identityId ?? this.nodePeerId)?.valueOf() ?? '';
  }
}
