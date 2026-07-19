import { assert, type PrimitiveOf, Timestamp } from '@haskou/value-objects';

import { AggregateRoot } from '../../../shared/domain/AggregateRoot';
import { NetworkNodeAlreadyClaimedError } from './errors/NetworkNodeAlreadyClaimedError';
import { PublicNetworkAlreadyAttachedError } from './errors/PublicNetworkAlreadyAttachedError';
import { NetworkNodeClaimed } from './events/NetworkNodeClaimed';
import { PublicNetworkAttached } from './events/PublicNetworkAttached';
import { NetworkNodeId } from './value-objects/NetworkNodeId';
import { NetworkNodeOwnerId } from './value-objects/NetworkNodeOwnerId';
import { NodeCapabilityStatus } from './value-objects/NodeCapabilityStatus';

export class NetworkNode extends AggregateRoot {
  public static fromPrimitives(
    primitives: PrimitiveOf<NetworkNode>,
  ): NetworkNode {
    return new NetworkNode(
      NetworkNodeId.fromString(primitives.id),
      NetworkNodeOwnerId.fromOptional(primitives.ownerId),
      NodeCapabilityStatus.fromBoolean(primitives.publicNetworkAttached),
    );
  }

  private constructor(
    private readonly id: NetworkNodeId,
    private ownerId: NetworkNodeOwnerId,
    private publicNetworkAttached: NodeCapabilityStatus,
  ) {
    super();
  }

  public attachPublicNetwork(occurredAt: Timestamp): void {
    assert(
      !this.publicNetworkAttached.isEnabled(),
      new PublicNetworkAlreadyAttachedError(),
    );
    this.publicNetworkAttached = NodeCapabilityStatus.fromBoolean(true);
    this.record(new PublicNetworkAttached(this.id, occurredAt));
  }

  public claim(ownerId: NetworkNodeOwnerId, occurredAt: Timestamp): void {
    assert(!this.ownerId.isAssigned(), new NetworkNodeAlreadyClaimedError());
    this.ownerId = ownerId;
    this.record(new NetworkNodeClaimed(this.id, ownerId, occurredAt));
  }

  public toPrimitives() {
    return {
      id: this.id.toString(),
      ownerId: this.ownerId.isAssigned() ? this.ownerId.toString() : undefined,
      publicNetworkAttached: this.publicNetworkAttached.isEnabled(),
    };
  }
}
