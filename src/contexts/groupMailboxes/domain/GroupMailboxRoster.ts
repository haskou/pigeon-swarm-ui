/**
 * The node's roster of one group conversation, as the rules for its MLS
 * group: who may hold a leaf and who may change membership. The managers
 * are the creator and the admins still on the roster. When the roster
 * names managers, only they add or remove members, and a removal of
 * someone still on the roster follows the conversation's own rule (never
 * the creator or the remover, and an admin only by the creator). A roster
 * that names no manager lets every member manage it. Anyone on the roster
 * may rotate their own leaf, and add or remove leaves of their own
 * identity, which are the leaves of its other devices: a leaf is a device,
 * and only the identity's devices sign one in its name.
 */
export class GroupMailboxRoster {
  private readonly managers: ReadonlySet<string>;

  public static empty(): GroupMailboxRoster {
    return new GroupMailboxRoster(new Set(), undefined, new Set());
  }

  public static of(conversation: {
    adminIds: readonly string[];
    creatorId?: string;
    participantIds: readonly string[];
  }): GroupMailboxRoster {
    return new GroupMailboxRoster(
      new Set(conversation.participantIds),
      conversation.creatorId,
      new Set(conversation.adminIds),
    );
  }

  private constructor(
    private readonly members: ReadonlySet<string>,
    private readonly creatorId: string | undefined,
    private readonly admins: ReadonlySet<string>,
  ) {
    this.managers = new Set(
      [...admins, ...(creatorId === undefined ? [] : [creatorId])].filter(
        (identityId) => members.has(identityId),
      ),
    );
  }

  private manages(identityId: string): boolean {
    return this.managers.size === 0
      ? this.members.has(identityId)
      : this.managers.has(identityId);
  }

  /** The conversation's rule for removing someone still on the roster. */
  private mayRemove(committer: string, target: string): boolean {
    return (
      this.managers.has(committer) &&
      target !== this.creatorId &&
      target !== committer &&
      (!this.admins.has(target) || committer === this.creatorId)
    );
  }

  /** Whether the committer may make this change to the MLS group. */
  public allowsCommit(change: {
    added: readonly string[];
    committer: string;
    removed: readonly string[];
  }): boolean {
    const { committer } = change;

    if (!this.members.has(committer)) return false;
    const added = change.added.filter((identityId) => identityId !== committer);
    const removed = change.removed.filter(
      (identityId) => identityId !== committer,
    );

    if (added.length === 0 && removed.length === 0) return true;

    return (
      this.manages(committer) &&
      added.every((identityId) => this.members.has(identityId)) &&
      removed.every(
        (identityId) =>
          !this.members.has(identityId) ||
          this.mayRemove(committer, identityId),
      )
    );
  }

  /** Of the identities holding a leaf, those that may change membership. */
  public committers(holders: Iterable<string>): string[] {
    return [...new Set(holders)]
      .filter((identityId) => this.manages(identityId))
      .sort((left, right) => left.localeCompare(right));
  }

  /**
   * How a commit ranks against its rivals for one MLS epoch; the higher
   * wins and equal ranks leave it to the lower commit id. The creator's
   * commits rank first, then any commit removing another identity, then
   * the rest. The rank depends on the commit alone, so rivals form one
   * total order and converge whatever order they arrive in. Of two rivals
   * this roster both allows, one removing the other's committer always
   * ranks higher: only the creator removes an admin, and a member who is
   * no manager can change only its own leaves, which ranks it last. That
   * a committer chooses the bytes, and so grinds its commit id low, never
   * lets it beat a commit that removes it. A removal of the committer's
   * own devices ranks with the rest: a member about to be removed could
   * otherwise match the removal and win it back on the id.
   */
  public priorityOf(change: {
    committer: string;
    removed: readonly string[];
  }): number {
    const { committer } = change;

    if (committer === this.creatorId) return 2;

    return change.removed.some((identityId) => identityId !== committer)
      ? 1
      : 0;
  }

  public has(identityId: string): boolean {
    return this.members.has(identityId);
  }

  /** Every identity on the roster. */
  public participants(): string[] {
    return [...this.members];
  }
}
