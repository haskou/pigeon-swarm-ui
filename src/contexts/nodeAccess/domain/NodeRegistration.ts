import type { Timestamp } from '@haskou/value-objects';

import { AggregateRoot } from '../../../shared/domain/AggregateRoot';
import { NodeRegistrationModeChanged } from './events/NodeRegistrationModeChanged';
import { NodeAccessNodeId } from './value-objects/NodeAccessNodeId';
import {
  NodeRegistrationMode,
  type NodeRegistrationModeValue,
} from './value-objects/NodeRegistrationMode';

/** Who may create identities through this node. */
export class NodeRegistration extends AggregateRoot {
  public static fromPrimitives(primitives: {
    mode: string;
    nodeId: string;
  }): NodeRegistration {
    return new NodeRegistration(
      NodeAccessNodeId.fromString(primitives.nodeId),
      NodeRegistrationMode.fromPrimitives(primitives.mode),
    );
  }

  private constructor(
    private readonly nodeId: NodeAccessNodeId,
    private mode: NodeRegistrationMode,
  ) {
    super();
  }

  public changeMode(mode: NodeRegistrationMode, occurredAt: Timestamp): void {
    if (this.mode.isEqual(mode)) return;

    this.mode = mode;
    this.record(new NodeRegistrationModeChanged(this.nodeId, occurredAt));
  }

  public toPrimitives(): { mode: NodeRegistrationModeValue; nodeId: string } {
    return { mode: this.mode.valueOf(), nodeId: this.nodeId.valueOf() };
  }
}
