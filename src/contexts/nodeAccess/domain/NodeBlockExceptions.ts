import type { Timestamp } from '@haskou/value-objects';

import type { NodeBlockTarget } from './value-objects/NodeBlockTarget';

import { AggregateRoot } from '../../../shared/domain/AggregateRoot';
import { NodeBlockExceptionsChanged } from './events/NodeBlockExceptionsChanged';
import { NodeAccessNodeId } from './value-objects/NodeAccessNodeId';
import { NodeBlockEntries } from './value-objects/NodeBlockEntries';

export interface NodeBlockExceptionsPrimitives {
  identityIds: string[];
  nodeId: string;
  nodePeerIds: string[];
}

/** Identities and nodes that followed block lists may never block here. */
export class NodeBlockExceptions extends AggregateRoot {
  public static fromPrimitives(
    primitives: NodeBlockExceptionsPrimitives,
  ): NodeBlockExceptions {
    return new NodeBlockExceptions(
      NodeAccessNodeId.fromString(primitives.nodeId),
      NodeBlockEntries.fromPrimitives(primitives),
    );
  }

  private constructor(
    private readonly nodeId: NodeAccessNodeId,
    private entries: NodeBlockEntries,
  ) {
    super();
  }

  private replace(entries: NodeBlockEntries, occurredAt: Timestamp): void {
    this.entries = entries;
    this.record(new NodeBlockExceptionsChanged(this.nodeId, occurredAt));
  }

  public except(target: NodeBlockTarget, occurredAt: Timestamp): void {
    if (this.entries.includes(target)) return;

    this.replace(this.entries.with(target), occurredAt);
  }

  public removeException(target: NodeBlockTarget, occurredAt: Timestamp): void {
    if (!this.entries.includes(target)) return;

    this.replace(this.entries.without(target), occurredAt);
  }

  public toPrimitives(): NodeBlockExceptionsPrimitives {
    return { ...this.entries.toPrimitives(), nodeId: this.nodeId.valueOf() };
  }
}
