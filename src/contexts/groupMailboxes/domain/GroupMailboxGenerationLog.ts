import { DomainError } from '@haskou/value-objects';

import type { GroupMailboxGenerationPrimitives } from './GroupMailboxGenerationPrimitives';
import type { GroupMailboxGenerationSecret } from './value-objects/GroupMailboxGenerationSecret';

import { GroupMailboxGeneration } from './GroupMailboxGeneration';

/**
 * The generations of one group conversation on this device, oldest first.
 * The empty log is the null object of a conversation this device has no
 * MLS group for.
 */
export class GroupMailboxGenerationLog {
  /**
   * Epochs back from the current one whose commit a rival commit can still
   * win: the group keeps the state before each of the last 8 commits it
   * applied (the library's `RETAINED_EPOCHS`) to switch to a rival, so a
   * rewind forgets only generations exported after the oldest of them.
   */
  public static readonly RIVAL_EPOCHS = 8n;

  public static empty(): GroupMailboxGenerationLog {
    return new GroupMailboxGenerationLog([]);
  }

  public static fromPrimitives(
    primitives: readonly GroupMailboxGenerationPrimitives[],
  ): GroupMailboxGenerationLog {
    return new GroupMailboxGenerationLog(
      primitives.map((generation) =>
        GroupMailboxGeneration.fromPrimitives(generation),
      ),
    );
  }

  private constructor(
    private readonly generations: readonly GroupMailboxGeneration[],
  ) {}

  /** Supersedes the current generation after a membership change. */
  public advance(
    secret: GroupMailboxGenerationSecret,
    epoch: bigint,
    tree: string,
    now: number,
  ): GroupMailboxGenerationLog {
    const current = this.current();

    return new GroupMailboxGenerationLog([
      ...this.generations.slice(0, -1),
      current.retire(now),
      new GroupMailboxGeneration(current.index + 1, secret, epoch, tree),
    ]);
  }

  public current(): GroupMailboxGeneration {
    const current = this.generations[this.generations.length - 1];

    if (!current) throw new DomainError('No group mailbox generation yet');

    return current;
  }

  /**
   * The retired generations whose drain window has closed: their inboxes
   * are no longer read and are deleted.
   */
  public drained(now: number): GroupMailboxGeneration[] {
    return this.generations.filter(
      (generation) =>
        generation.retiredAt !== undefined && !generation.isReadableAt(now),
    );
  }

  public isEmpty(): boolean {
    return this.generations.length === 0;
  }

  /** Newest first: the generations whose inboxes are still read. */
  public readable(now: number): GroupMailboxGeneration[] {
    return this.generations
      .filter((generation) => generation.isReadableAt(now))
      .reverse();
  }

  /**
   * Forgets the generations exported after `epoch`: a competing commit won
   * that epoch, so a removal this device applied there never happened.
   */
  public rewind(epoch: bigint): GroupMailboxGenerationLog {
    const kept = this.generations.filter(
      (generation, index) => index === 0 || generation.epoch <= epoch,
    );
    const current = kept[kept.length - 1];

    if (!current || current === this.generations[this.generations.length - 1])
      return this;

    return new GroupMailboxGenerationLog([
      ...kept.slice(0, -1),
      current.reinstate(),
    ]);
  }

  /**
   * Newest first: every generation this device holds. One a rewind forgot,
   * as exported by a commit a rival won, is not among them. Empty for the
   * empty log.
   */
  public branch(): GroupMailboxGeneration[] {
    return [...this.generations].reverse();
  }

  /** Records the first generation: the epoch this device created or joined. */
  public start(
    secret: GroupMailboxGenerationSecret,
    epoch: bigint,
    tree: string,
    index = 0,
  ): GroupMailboxGenerationLog {
    if (!this.isEmpty()) {
      throw new DomainError('Group mailbox generations already started');
    }

    return new GroupMailboxGenerationLog([
      new GroupMailboxGeneration(index, secret, epoch, tree),
    ]);
  }

  public toPrimitives(): GroupMailboxGenerationPrimitives[] {
    return this.generations.map((generation) => generation.toPrimitives());
  }
}
