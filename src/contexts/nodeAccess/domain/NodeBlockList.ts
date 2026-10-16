import type { Timestamp } from '@haskou/value-objects';

import { assert } from '@haskou/value-objects';

import { AggregateRoot } from '../../../shared/domain/AggregateRoot';
import { NodeBlockEntryAlreadyBlockedError } from './errors/NodeBlockEntryAlreadyBlockedError';
import { NodeBlockEntryNotBlockedError } from './errors/NodeBlockEntryNotBlockedError';
import { NodeOwnerIdentityCannotBeBlockedError } from './errors/NodeOwnerIdentityCannotBeBlockedError';
import { NodeBlockListChanged } from './events/NodeBlockListChanged';
import { NodeAccessIdentityId } from './value-objects/NodeAccessIdentityId';
import { NodeBlockEntries } from './value-objects/NodeBlockEntries';
import { NodeBlockListVersion } from './value-objects/NodeBlockListVersion';
import { NodeBlockTarget } from './value-objects/NodeBlockTarget';

export interface NodeBlockListPrimitives {
  blockedIdentityIds: string[];
  blockedNodePeerIds: string[];
  issuedAt: number | null;
  ownerIdentityId: string;
  version: number | null;
}

/**
 * The node owner's list of blocked identities and nodes. Every change is a
 * new, higher version issued by the current owner, who can never block
 * themselves.
 */
export class NodeBlockList extends AggregateRoot {
  public static empty(ownerIdentityId: NodeAccessIdentityId): NodeBlockList {
    return new NodeBlockList(
      ownerIdentityId,
      null,
      null,
      NodeBlockEntries.empty(),
    );
  }

  /**
   * The list the given node owner changes next: the stored one, adopted when
   * a previous owner issued it, or a new empty one.
   */
  public static continuing(
    stored: NodeBlockList | null,
    ownerIdentityId: NodeAccessIdentityId,
  ): NodeBlockList {
    return stored?.adoptedBy(ownerIdentityId) ?? this.empty(ownerIdentityId);
  }

  public static fromPrimitives(
    primitives: NodeBlockListPrimitives,
  ): NodeBlockList {
    return new NodeBlockList(
      NodeAccessIdentityId.fromString(primitives.ownerIdentityId),
      primitives.version === null
        ? null
        : NodeBlockListVersion.fromNumber(primitives.version),
      primitives.issuedAt,
      NodeBlockEntries.fromPrimitives({
        identityIds: primitives.blockedIdentityIds,
        nodePeerIds: primitives.blockedNodePeerIds,
      }),
    );
  }

  private constructor(
    private readonly ownerIdentityId: NodeAccessIdentityId,
    private version: NodeBlockListVersion | null,
    private issuedAt: number | null,
    private entries: NodeBlockEntries,
  ) {
    super();
  }

  private isOwner(target: NodeBlockTarget): boolean {
    return target.getIdentityId()?.isEqual(this.ownerIdentityId) ?? false;
  }

  private issue(entries: NodeBlockEntries, occurredAt: Timestamp): void {
    this.entries = entries;
    this.version = this.version?.next() ?? NodeBlockListVersion.first();
    this.issuedAt = occurredAt.valueOf();
    this.record(new NodeBlockListChanged(this.ownerIdentityId, occurredAt));
  }

  /**
   * The list a new node owner starts from: the previous owner's entries minus
   * the new owner, issued again from the first version under the new owner.
   */
  private adoptedBy(ownerIdentityId: NodeAccessIdentityId): NodeBlockList {
    if (this.ownerIdentityId.isEqual(ownerIdentityId)) return this;

    return new NodeBlockList(
      ownerIdentityId,
      null,
      null,
      this.entries.without(NodeBlockTarget.identity(ownerIdentityId.valueOf())),
    );
  }

  public block(target: NodeBlockTarget, occurredAt: Timestamp): void {
    assert(!this.isOwner(target), new NodeOwnerIdentityCannotBeBlockedError());

    assert(
      !this.entries.includes(target),
      new NodeBlockEntryAlreadyBlockedError(),
    );

    this.issue(this.entries.with(target), occurredAt);
  }

  public unblock(target: NodeBlockTarget, occurredAt: Timestamp): void {
    assert(this.entries.includes(target), new NodeBlockEntryNotBlockedError());

    this.issue(this.entries.without(target), occurredAt);
  }

  /** Version and issue time stay null until the first version is issued. */
  public toPrimitives(): NodeBlockListPrimitives {
    const entries = this.entries.toPrimitives();

    return {
      blockedIdentityIds: entries.identityIds,
      blockedNodePeerIds: entries.nodePeerIds,
      issuedAt: this.issuedAt,
      ownerIdentityId: this.ownerIdentityId.valueOf(),
      version: this.version?.valueOf() ?? null,
    };
  }
}
