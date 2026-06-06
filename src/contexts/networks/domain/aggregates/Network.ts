import { DomainError } from '@haskou/value-objects';

import type { NodeNetwork } from '../../application/list-node-networks/NodeNetwork';
import type { NetworkInvite } from '../networkInviteCode';

import { AggregateRoot } from '../../../../shared/domain/AggregateRoot';
import { NetworkId } from '../value-objects/NetworkId';
import { NetworkKey } from '../value-objects/NetworkKey';
import { NetworkName } from '../value-objects/NetworkName';

export class Network extends AggregateRoot {
  private constructor(
    private readonly id: NetworkId,
    private name: NetworkName,
    private readonly key?: NetworkKey,
  ) {
    super();
  }

  public static fromNodeNetwork(resource: NodeNetwork): Network {
    return new Network(
      NetworkId.fromString(resource.id),
      NetworkName.fromString(resource.name),
      resource.key ? NetworkKey.fromString(resource.key) : undefined,
    );
  }

  public canIssueInvite(): boolean {
    return this.key !== undefined;
  }

  public getId(): NetworkId {
    return this.id;
  }

  public getName(): NetworkName {
    return this.name;
  }

  public issueInvite(): NetworkInvite {
    if (!this.key) {
      throw new DomainError('Network key is required to issue an invite.');
    }

    return {
      id: this.id.toString(),
      key: this.key.toString(),
      name: this.name.toString(),
    };
  }

  public rename(name: NetworkName): void {
    if (this.name.isEqual(name)) return;

    this.name = name;
    this.record({
      aggregateId: this.id.toString(),
      occurredAt: Date.now(),
      type: 'NetworkRenamed',
    });
  }

  public toNodeNetwork(): NodeNetwork {
    return {
      id: this.id.toString(),
      key: this.key?.toString(),
      name: this.name.toString(),
    };
  }
}
