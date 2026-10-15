import type { Timestamp } from '@haskou/value-objects';

import { AggregateRoot } from '../../../shared/domain/AggregateRoot';
import { NodeBlockSourceFollowed } from './events/NodeBlockSourceFollowed';
import { NodeAccessIdentityId } from './value-objects/NodeAccessIdentityId';
import { NodeBlockSourceOrigin } from './value-objects/NodeBlockSourceOrigin';

export interface NodeBlockSourcePrimitives {
  appliedCount: number;
  autoApply: boolean;
  lastFetchedAt: number | null;
  lastFetchOutcome: string | null;
  origin: string;
  ownerIdentityId: string;
  pendingCount: number;
  version: number | null;
}

/**
 * Another node owner's published block list this node follows, with the
 * node's diagnostics of the last fetch.
 */
export class NodeBlockSource extends AggregateRoot {
  public static follow(
    ownerIdentityId: NodeAccessIdentityId,
    origin: NodeBlockSourceOrigin,
    autoApply: boolean,
    occurredAt: Timestamp,
  ): NodeBlockSource {
    const source = new NodeBlockSource(ownerIdentityId, origin, autoApply, {
      appliedCount: 0,
      lastFetchedAt: null,
      lastFetchOutcome: null,
      pendingCount: 0,
      version: null,
    });

    source.record(new NodeBlockSourceFollowed(ownerIdentityId, occurredAt));

    return source;
  }

  public static fromPrimitives(
    primitives: NodeBlockSourcePrimitives,
  ): NodeBlockSource {
    return new NodeBlockSource(
      NodeAccessIdentityId.fromString(primitives.ownerIdentityId),
      NodeBlockSourceOrigin.fromString(primitives.origin),
      primitives.autoApply,
      {
        appliedCount: primitives.appliedCount,
        lastFetchedAt: primitives.lastFetchedAt,
        lastFetchOutcome: primitives.lastFetchOutcome,
        pendingCount: primitives.pendingCount,
        version: primitives.version,
      },
    );
  }

  private constructor(
    private readonly ownerIdentityId: NodeAccessIdentityId,
    private readonly origin: NodeBlockSourceOrigin,
    private readonly autoApply: boolean,
    private readonly diagnostics: Omit<
      NodeBlockSourcePrimitives,
      'autoApply' | 'origin' | 'ownerIdentityId'
    >,
  ) {
    super();
  }

  public getOwnerIdentityId(): NodeAccessIdentityId {
    return this.ownerIdentityId;
  }

  public toPrimitives(): NodeBlockSourcePrimitives {
    return {
      ...this.diagnostics,
      autoApply: this.autoApply,
      origin: this.origin.valueOf(),
      ownerIdentityId: this.ownerIdentityId.valueOf(),
    };
  }
}
