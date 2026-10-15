import { NodeAccessIdentityId } from './NodeAccessIdentityId';
import { NodeBlockTarget } from './NodeBlockTarget';
import { NodePeerId } from './NodePeerId';

function compareCodeUnits(left: string, right: string): number {
  if (left === right) return 0;

  return left < right ? -1 : 1;
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values)].sort(compareCodeUnits);
}

/**
 * A set of blocked identities and nodes, kept sorted by code unit and unique
 * so one set of entries has exactly one signed form.
 */
export class NodeBlockEntries {
  public static empty(): NodeBlockEntries {
    return new NodeBlockEntries([], []);
  }

  public static fromPrimitives(primitives: {
    identityIds: string[];
    nodePeerIds: string[];
  }): NodeBlockEntries {
    return new NodeBlockEntries(
      primitives.identityIds.map((value) =>
        NodeAccessIdentityId.fromString(value),
      ),
      primitives.nodePeerIds.map((value) => NodePeerId.fromString(value)),
    );
  }

  private readonly identityIds: string[];

  private readonly nodePeerIds: string[];

  private constructor(
    identityIds: NodeAccessIdentityId[],
    nodePeerIds: NodePeerId[],
  ) {
    this.identityIds = sortedUnique(identityIds.map((id) => id.valueOf()));
    this.nodePeerIds = sortedUnique(nodePeerIds.map((id) => id.valueOf()));
  }

  public includes(target: NodeBlockTarget): boolean {
    const identityId = target.getIdentityId();
    const nodePeerId = target.getNodePeerId();

    if (identityId) return this.identityIds.includes(identityId.valueOf());

    return nodePeerId ? this.nodePeerIds.includes(nodePeerId.valueOf()) : false;
  }

  public isEmpty(): boolean {
    return this.identityIds.length === 0 && this.nodePeerIds.length === 0;
  }

  public with(target: NodeBlockTarget): NodeBlockEntries {
    const identityId = target.getIdentityId();
    const nodePeerId = target.getNodePeerId();

    return NodeBlockEntries.fromPrimitives({
      identityIds: identityId
        ? [...this.identityIds, identityId.valueOf()]
        : this.identityIds,
      nodePeerIds: nodePeerId
        ? [...this.nodePeerIds, nodePeerId.valueOf()]
        : this.nodePeerIds,
    });
  }

  public without(target: NodeBlockTarget): NodeBlockEntries {
    const removed = target.toString();

    return NodeBlockEntries.fromPrimitives({
      identityIds: this.identityIds.filter((value) => value !== removed),
      nodePeerIds: this.nodePeerIds.filter((value) => value !== removed),
    });
  }

  public toPrimitives(): { identityIds: string[]; nodePeerIds: string[] } {
    return {
      identityIds: [...this.identityIds],
      nodePeerIds: [...this.nodePeerIds],
    };
  }
}
