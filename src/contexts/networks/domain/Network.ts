import { assert, type PrimitiveOf, Timestamp } from '@haskou/value-objects';

import { AggregateRoot } from '../../../shared/domain/AggregateRoot';
import { NetworkInviteUnavailableError } from './errors/NetworkInviteUnavailableError';
import { NetworkNotAttachedError } from './errors/NetworkNotAttachedError';
import { NetworkCreated } from './events/NetworkCreated';
import { NetworkJoined } from './events/NetworkJoined';
import { NetworkRemoved } from './events/NetworkRemoved';
import { NetworkInvite } from './NetworkInvite';
import { NetworkAttachmentStatus } from './value-objects/NetworkAttachmentStatus';
import { NetworkId } from './value-objects/NetworkId';
import { NetworkKey } from './value-objects/NetworkKey';
import { NetworkName } from './value-objects/NetworkName';

export class Network extends AggregateRoot {
  public static create(name: NetworkName, occurredAt: Timestamp): Network {
    const network = new Network(
      NetworkId.generate(),
      name,
      NetworkAttachmentStatus.attached(),
      NetworkKey.generate(),
    );

    network.record(new NetworkCreated(network.id, occurredAt));

    return network;
  }

  public static fromPrimitives(primitives: PrimitiveOf<Network>): Network {
    return new Network(
      NetworkId.fromString(primitives.id),
      NetworkName.fromString(primitives.name),
      NetworkAttachmentStatus.fromPrimitives(primitives.status),
      primitives.key ? NetworkKey.fromString(primitives.key) : undefined,
    );
  }

  public static join(
    id: NetworkId,
    name: NetworkName,
    key: NetworkKey,
    occurredAt: Timestamp,
  ): Network {
    const network = new Network(
      id,
      name,
      NetworkAttachmentStatus.attached(),
      key,
    );

    network.record(new NetworkJoined(id, occurredAt));

    return network;
  }

  private constructor(
    private readonly id: NetworkId,
    private readonly name: NetworkName,
    private status: NetworkAttachmentStatus,
    private readonly key?: NetworkKey,
  ) {
    super();
  }

  public belongsTo(id: NetworkId): boolean {
    return this.id.isEqual(id);
  }

  public canIssueInvite(): boolean {
    return this.key !== undefined && this.status.isAttached();
  }

  public issueInvite(): NetworkInvite {
    const key = this.key;

    assert(
      key !== undefined && this.status.isAttached(),
      new NetworkInviteUnavailableError(),
    );

    return NetworkInvite.fromPrimitives({
      id: this.id.toString(),
      key: key.toString(),
      name: this.name.toString(),
    });
  }

  public remove(occurredAt: Timestamp): void {
    assert(this.status.isAttached(), new NetworkNotAttachedError());
    this.status = NetworkAttachmentStatus.removed();
    this.record(new NetworkRemoved(this.id, occurredAt));
  }

  public toPrimitives() {
    return {
      id: this.id.toString(),
      key: this.key?.toString(),
      name: this.name.toString(),
      status: this.status.valueOf(),
    };
  }
}
