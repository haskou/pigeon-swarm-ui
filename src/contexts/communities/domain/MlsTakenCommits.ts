import type { MlsTakenCommitsPrimitives } from './MlsTakenCommitsPrimitives';

const DECIMAL = /^\d+$/u;
/** How many epochs before the group's keep the commit taken in them. */
const KEPT_EPOCHS = 2n;

/** Whether a commit in `epoch` is kept by a group in `current`. */
const keeps = (epoch: bigint, current: bigint): boolean =>
  epoch < current && epoch >= current - KEPT_EPOCHS;

/**
 * The commit an MLS group took in each of its latest epochs, by record id,
 * as of the epoch the group is in. `MlsGroup` keeps which commit it took
 * only in memory; this record outlives a restart, so the device neither
 * applies a commit it took again nor misjudges which one won an epoch.
 * Only the commits of the two epochs before the group's are kept, the ones
 * sync still lists: commits from earlier ones are dropped even when the
 * node lists them.
 */
export class MlsTakenCommits {
  public static none(epoch: bigint): MlsTakenCommits {
    return new MlsTakenCommits(epoch, new Map());
  }

  public static fromPrimitives(
    primitives: MlsTakenCommitsPrimitives,
  ): MlsTakenCommits {
    const { commits, epoch } = primitives;

    if (
      !DECIMAL.test(epoch) ||
      typeof commits !== 'object' ||
      commits === null
    ) {
      throw new RangeError('Invalid MLS taken commits');
    }
    const current = BigInt(epoch);
    const entries = Object.entries(commits).map(([key, commitId]) => {
      if (
        !DECIMAL.test(key) ||
        typeof commitId !== 'string' ||
        commitId === '' ||
        !keeps(BigInt(key), current)
      ) {
        throw new RangeError('Invalid MLS taken commits');
      }

      return [Number(key), commitId] as const;
    });

    return new MlsTakenCommits(current, new Map(entries));
  }

  private constructor(
    public readonly epoch: bigint,
    private readonly commits: ReadonlyMap<number, string>,
  ) {}

  /** The record id of the commit the group took in `epoch`, if kept. */
  public commitIn(epoch: number): string | undefined {
    return this.commits.get(epoch);
  }

  /**
   * The record once the group took `commitId` in `epoch`, which leads it to
   * the next epoch. A rival replacing the commit of an earlier epoch undid
   * every later one, so they are forgotten.
   */
  public took(epoch: number, commitId: string): MlsTakenCommits {
    const next = BigInt(epoch) + 1n;
    const commits = new Map(
      [...this.commits].filter(([kept]) => keeps(BigInt(kept), next)),
    );

    commits.set(epoch, commitId);

    return new MlsTakenCommits(next, commits);
  }

  public toPrimitives(): MlsTakenCommitsPrimitives {
    return {
      commits: Object.fromEntries(
        [...this.commits].map(([epoch, commitId]) => [String(epoch), commitId]),
      ),
      epoch: this.epoch.toString(),
    };
  }
}
