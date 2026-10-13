import type { GroupMailboxGenerationPrimitives } from './GroupMailboxGenerationPrimitives';

import { GroupMailboxGenerationSecret } from './value-objects/GroupMailboxGenerationSecret';

/**
 * Generation `k` of a group conversation: `gen_k`, the MLS epoch it was
 * exported from, and a digest of that epoch's leaves. Every member mailbox
 * of the generation derives from it.
 */
export class GroupMailboxGeneration {
  /**
   * How long a superseded generation's inboxes are still read: long enough
   * for copies a member sent before it processed the membership change.
   */
  public static readonly DRAIN_WINDOW_MS = 6 * 60 * 60 * 1000;

  public static fromPrimitives(
    primitives: GroupMailboxGenerationPrimitives,
  ): GroupMailboxGeneration {
    return new GroupMailboxGeneration(
      primitives.index,
      GroupMailboxGenerationSecret.fromString(primitives.secret),
      BigInt(primitives.epoch),
      primitives.tree,
      primitives.retiredAt,
    );
  }

  public constructor(
    public readonly index: number,
    public readonly secret: GroupMailboxGenerationSecret,
    public readonly epoch: bigint,
    public readonly tree: string,
    public readonly retiredAt?: number,
  ) {}

  /** Current, or retired no longer ago than the drain window. */
  public isReadableAt(now: number): boolean {
    return (
      this.retiredAt === undefined ||
      now - this.retiredAt <= GroupMailboxGeneration.DRAIN_WINDOW_MS
    );
  }

  public reinstate(): GroupMailboxGeneration {
    return new GroupMailboxGeneration(
      this.index,
      this.secret,
      this.epoch,
      this.tree,
    );
  }

  public retire(at: number): GroupMailboxGeneration {
    return new GroupMailboxGeneration(
      this.index,
      this.secret,
      this.epoch,
      this.tree,
      at,
    );
  }

  public toPrimitives(): GroupMailboxGenerationPrimitives {
    return {
      epoch: this.epoch.toString(),
      index: this.index,
      ...(this.retiredAt === undefined ? {} : { retiredAt: this.retiredAt }),
      secret: this.secret.valueOf(),
      tree: this.tree,
    };
  }
}
