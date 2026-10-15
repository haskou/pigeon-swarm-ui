import type { CommunityOperation } from './operations/CommunityOperation';

import { CommunityMlsRoster } from './CommunityMlsRoster';

/**
 * A community's verified operations as a causal history, to judge an MLS
 * commit by the roster its committer saw: the community's roster, or the
 * roster of the channel it is for. A frontier names operations by digest and
 * stands for them and everything they descend from. Operations are signed,
 * so a frontier can only name history that exists; which part of it, its
 * author chooses, which is why a group never accepts a frontier that leaves
 * out one it already followed (`follows`).
 */
export class CommunityRosterHistory {
  private readonly operations: ReadonlyMap<string, CommunityOperation>;
  private readonly rosters = new Map<string, CommunityMlsRoster | undefined>();

  public static of(
    operations: readonly CommunityOperation[],
    channelId?: string,
  ): CommunityRosterHistory {
    return new CommunityRosterHistory(operations, channelId);
  }

  private constructor(
    operations: readonly CommunityOperation[],
    private readonly channelId: string | undefined,
  ) {
    this.operations = new Map(
      operations.map((operation) => [operation.getHash(), operation]),
    );
  }

  /** The operations a frontier stands for; undefined if one is unknown. */
  private closureOf(
    frontier: readonly string[],
  ): Map<string, CommunityOperation> | undefined {
    const reached = new Map<string, CommunityOperation>();
    const open = [...frontier];

    for (let hash = open.pop(); hash !== undefined; hash = open.pop()) {
      const operation = this.operations.get(hash);

      if (!operation) return undefined;

      if (!reached.has(hash)) {
        reached.set(hash, operation);
        open.push(...operation.getParents());
      }
    }

    return reached;
  }

  /** The digests of the operations whose whole ancestry is known. */
  private complete(): Set<string> {
    const waiting = new Map<string, number>();
    const children = new Map<string, string[]>();
    const ready: string[] = [];

    for (const [hash, operation] of this.operations) {
      const parents = new Set(operation.getParents());

      waiting.set(hash, parents.size);

      if (parents.size === 0) ready.push(hash);
      parents.forEach((parent) =>
        children.set(parent, [...(children.get(parent) ?? []), hash]),
      );
    }
    const complete = new Set<string>();

    for (let hash = ready.pop(); hash !== undefined; hash = ready.pop()) {
      complete.add(hash);
      for (const child of children.get(hash) ?? []) {
        const left = (waiting.get(child) ?? 0) - 1;

        waiting.set(child, left);

        if (left === 0) ready.push(child);
      }
    }

    return complete;
  }

  /**
   * The frontier of everything known: the digests of the complete
   * operations no other complete operation descends from, sorted.
   */
  public heads(): string[] {
    const complete = this.complete();
    const parents = new Set(
      [...complete].flatMap((hash) => [
        ...(this.operations.get(hash)?.getParents() ?? []),
      ]),
    );

    return [...complete].filter((hash) => !parents.has(hash)).sort();
  }

  /** The roster from every known operation. */
  public latest(): CommunityMlsRoster {
    return this.rosterAt(this.heads()) ?? CommunityMlsRoster.empty();
  }

  /** The roster at the frontier; undefined while part of it is unknown. */
  public rosterAt(frontier: readonly string[]): CommunityMlsRoster | undefined {
    const key = [...frontier].sort().join('\n');

    if (!this.rosters.has(key)) {
      const operations = this.closureOf(frontier);

      this.rosters.set(
        key,
        operations &&
          CommunityMlsRoster.replay([...operations.values()], this.channelId),
      );
    }

    return this.rosters.get(key);
  }

  /** Whether the frontier stands for every operation the baseline names. */
  public follows(
    frontier: readonly string[],
    baseline: readonly string[],
  ): boolean {
    const operations = this.closureOf(frontier);

    return (
      operations !== undefined && baseline.every((hash) => operations.has(hash))
    );
  }

  /**
   * How many operations the frontier stands for, 0 while part of it is
   * unknown. Operations are content-addressed, so every member counts the
   * same for the same frontier.
   */
  public reach(frontier: readonly string[]): number {
    return this.closureOf(frontier)?.size ?? 0;
  }
}
