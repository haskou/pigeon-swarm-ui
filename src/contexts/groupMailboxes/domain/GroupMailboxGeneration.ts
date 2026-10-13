import type { GroupMailboxGenerationPrimitives } from './GroupMailboxGenerationPrimitives';

import { GroupMailboxGenerationSecret } from './value-objects/GroupMailboxGenerationSecret';

/**
 * Generation `k` of a group conversation: `gen_k` and the MLS epoch it was
 * exported from. Every member mailbox of the generation derives from it.
 */
export class GroupMailboxGeneration {
  /** How long a superseded generation's inboxes are still drained. */
  public static readonly DRAIN_WINDOW_MS = 24 * 60 * 60 * 1000;

  public static fromPrimitives(
    primitives: GroupMailboxGenerationPrimitives,
  ): GroupMailboxGeneration {
    return new GroupMailboxGeneration(
      primitives.index,
      GroupMailboxGenerationSecret.fromString(primitives.secret),
      BigInt(primitives.epoch),
      primitives.retiredAt,
    );
  }

  public constructor(
    public readonly index: number,
    public readonly secret: GroupMailboxGenerationSecret,
    public readonly epoch: bigint,
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
    return new GroupMailboxGeneration(this.index, this.secret, this.epoch);
  }

  public retire(at: number): GroupMailboxGeneration {
    return new GroupMailboxGeneration(this.index, this.secret, this.epoch, at);
  }

  public toPrimitives(): GroupMailboxGenerationPrimitives {
    return {
      epoch: this.epoch.toString(),
      index: this.index,
      ...(this.retiredAt === undefined ? {} : { retiredAt: this.retiredAt }),
      secret: this.secret.valueOf(),
    };
  }
}
