import type { GroupMailboxRosterChange } from './GroupMailboxRosterChange';
import type { GroupMailboxRosterFields } from './GroupMailboxRosterFields';

import { ConversationName } from '../../conversations/domain/value-objects/ConversationName';

/** `group:` and base64url of 32 bytes, unpadded and canonical. */
const CONVERSATION_ID = /^group:[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/;
const MAX_IDENTITY_LENGTH = 1024;
/** A UTF-16 surrogate without its pair, which canonical JSON refuses. */
const LONE_SURROGATE =
  /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

const sorted = (values: Iterable<string>): string[] =>
  [...values].sort((left, right) => (left < right ? -1 : 1));

/** What `next` holds that `before` does not. */
const missingFrom = (
  before: ReadonlySet<string>,
  next: ReadonlySet<string>,
): string[] => [...next].filter((value) => !before.has(value));

/**
 * The roster of a group conversation, as its MLS group carries it in the
 * GroupContext (`GroupMailboxRosterExtension`): the rules for who may hold a
 * leaf and who may change membership. The managers are the creator and the
 * admins. The creator is always a member and never an admin; admins are
 * members. Only a GroupContextExtensions proposal changes it, by one roster
 * operation per commit (`allowsCommit`).
 */
export class GroupMailboxRoster {
  /** The most members a group holds, as the node's own limit. */
  public static readonly MAX_PARTICIPANTS = 256;
  public static readonly VERSION = 1;

  private readonly admins: ReadonlySet<string>;
  private readonly members: ReadonlySet<string>;

  private static identity(value: unknown): value is string {
    return (
      typeof value === 'string' &&
      value !== '' &&
      value.length <= MAX_IDENTITY_LENGTH &&
      value.trim() === value &&
      !LONE_SURROGATE.test(value)
    );
  }

  private static distinct(values: readonly unknown[]): values is string[] {
    return (
      values.every((value) => GroupMailboxRoster.identity(value)) &&
      new Set(values).size === values.length
    );
  }

  private static wellHeaded(fields: GroupMailboxRosterFields): boolean {
    return (
      fields.version === GroupMailboxRoster.VERSION &&
      CONVERSATION_ID.test(fields.conversationId) &&
      GroupMailboxRoster.identity(fields.creatorId)
    );
  }

  private static wellNamed(name: unknown): boolean {
    return (
      typeof name === 'string' &&
      name !== '' &&
      name.trim() === name &&
      name.length <= ConversationName.MAX_LENGTH &&
      !LONE_SURROGATE.test(name)
    );
  }

  /** The creator is a member and no admin; admins are members. */
  private static wellManned(fields: GroupMailboxRosterFields): boolean {
    const { adminIds, creatorId, memberIds } = fields;

    return (
      GroupMailboxRoster.distinct(memberIds) &&
      GroupMailboxRoster.distinct(adminIds) &&
      memberIds.length <= GroupMailboxRoster.MAX_PARTICIPANTS &&
      memberIds.includes(creatorId) &&
      !adminIds.includes(creatorId) &&
      adminIds.every((adminId) => memberIds.includes(adminId))
    );
  }

  /** The roster `fields` describe when it is well formed; else undefined. */
  public static of(
    fields: GroupMailboxRosterFields,
  ): GroupMailboxRoster | undefined {
    if (
      !GroupMailboxRoster.wellHeaded(fields) ||
      !GroupMailboxRoster.wellNamed(fields.name) ||
      !GroupMailboxRoster.wellManned(fields)
    ) {
      return undefined;
    }

    return new GroupMailboxRoster(fields);
  }

  private constructor(private readonly fields: GroupMailboxRosterFields) {
    this.admins = new Set(fields.adminIds);
    this.members = new Set(fields.memberIds);
  }

  /** The roster with these fields changed, when it stays well formed. */
  private with(
    change: Partial<Pick<GroupMailboxRosterFields, 'adminIds' | 'memberIds'>>,
  ): GroupMailboxRoster | undefined {
    return GroupMailboxRoster.of({ ...this.toFields(), ...change });
  }

  /**
   * Whether every leaf the commit removes belongs to an identity off the
   * roster, or to the committer itself.
   */
  private removesOnlyStrays(change: GroupMailboxRosterChange): boolean {
    return change.removed.every(
      (identityId) =>
        identityId === change.committer || !this.members.has(identityId),
    );
  }

  /**
   * A commit with no roster change: the committer rotates its own leaf and
   * adds or removes leaves of its own identity; a manager may also add
   * leaves of members, or remove leaves of identities off the roster.
   */
  private allowsLeafChange(change: GroupMailboxRosterChange): boolean {
    const { committer } = change;
    const added = change.added.filter((identityId) => identityId !== committer);
    const removed = change.removed.filter(
      (identityId) => identityId !== committer,
    );

    if (added.length === 0 && removed.length === 0) return true;

    return (
      this.manages(committer) &&
      added.every((identityId) => this.members.has(identityId)) &&
      removed.every((identityId) => !this.members.has(identityId))
    );
  }

  /**
   * One roster operation, judged against this roster: the add, removal,
   * leave, promotion or demotion of exactly one identity, with the leaves
   * that go with it.
   */
  private allowsOperation(
    change: GroupMailboxRosterChange,
    next: GroupMailboxRoster,
  ): boolean {
    const joined = missingFrom(this.members, next.members);
    const dropped = missingFrom(next.members, this.members);
    const promoted = missingFrom(this.admins, next.admins);
    const demoted = missingFrom(next.admins, this.admins);
    const changes = joined.length + dropped.length;

    if (!this.keepsHeader(next)) return false;

    if (joined.length === 1 && changes === 1) {
      return this.allowsJoin(
        change,
        joined[0],
        promoted.length + demoted.length,
      );
    }

    if (dropped.length === 1 && changes === 1) {
      return this.allowsDrop(change, dropped[0], promoted, demoted);
    }

    return (
      changes === 0 &&
      this.allowsRankChange(change, promoted.length + demoted.length)
    );
  }

  /** Whether `next` keeps this roster's conversation, creator and name. */
  private keepsHeader(next: GroupMailboxRoster): boolean {
    return (
      next.fields.conversationId === this.fields.conversationId &&
      next.fields.creatorId === this.fields.creatorId &&
      next.fields.name === this.fields.name &&
      next.fields.version === this.fields.version
    );
  }

  /** A manager adds one identity and only its leaves. */
  private allowsJoin(
    change: GroupMailboxRosterChange,
    joiner: string,
    rankChanges: number,
  ): boolean {
    return (
      this.manages(change.committer) &&
      rankChanges === 0 &&
      change.removed.length === 0 &&
      change.added.every((identityId) => identityId === joiner)
    );
  }

  /** One identity leaves or is removed, with every leaf it holds. */
  private allowsDrop(
    change: GroupMailboxRosterChange,
    leaver: string,
    promoted: readonly string[],
    demoted: readonly string[],
  ): boolean {
    const { committer } = change;

    if (
      !this.keepsAdminsBut(leaver, promoted, demoted) ||
      change.added.length > 0
    ) {
      return false;
    }

    if (leaver === committer) {
      return leaver !== this.fields.creatorId && this.removesOnlyStrays(change);
    }

    return (
      this.mayRemove(committer, leaver) &&
      this.removesAllLeavesOf(change, leaver)
    );
  }

  /** Whether the admins change only by the leaver's own seat. */
  private keepsAdminsBut(
    leaver: string,
    promoted: readonly string[],
    demoted: readonly string[],
  ): boolean {
    return (
      promoted.length === 0 &&
      demoted.length === (this.admins.has(leaver) ? 1 : 0)
    );
  }

  /** Whether the commit removes exactly the leaves `leaver` holds. */
  private removesAllLeavesOf(
    change: GroupMailboxRosterChange,
    leaver: string,
  ): boolean {
    return (
      change.removed.every((identityId) => identityId === leaver) &&
      change.removed.length ===
        change.holders.filter((identityId) => identityId === leaver).length
    );
  }

  /**
   * The creator promotes or demotes one admin, removing no leaf but those
   * of identities already off the roster, as a leaver's.
   */
  private allowsRankChange(
    change: GroupMailboxRosterChange,
    rankChanges: number,
  ): boolean {
    return (
      rankChanges === 1 &&
      change.committer === this.fields.creatorId &&
      change.added.length === 0 &&
      change.removed.every((identityId) => !this.members.has(identityId))
    );
  }

  /** The conversation's rule for removing someone on the roster. */
  private mayRemove(committer: string, target: string): boolean {
    return (
      this.manages(committer) &&
      target !== this.fields.creatorId &&
      target !== committer &&
      (!this.admins.has(target) || committer === this.fields.creatorId)
    );
  }

  public get conversationId(): string {
    return this.fields.conversationId;
  }

  public get creatorId(): string {
    return this.fields.creatorId;
  }

  public get name(): string {
    return this.fields.name;
  }

  public adminIds(): string[] {
    return sorted(this.admins);
  }

  /**
   * Whether the committer may make this commit. No commit adds a leaf while
   * an identity off the roster holds one, as that identity would learn of
   * it: its leaves go first, in a commit that adds none. Without a roster
   * change (`next` undefined), see `allowsLeafChange`. Removing a member's
   * leaves needs the roster change that removes the member, in the same
   * commit. With one, `next` must differ from this roster by exactly one
   * operation (`allowsOperation`). The creator, conversation and name never
   * change.
   */
  public allowsCommit(
    change: GroupMailboxRosterChange,
    next?: GroupMailboxRoster,
  ): boolean {
    if (!this.members.has(change.committer)) return false;

    if (
      change.added.length > 0 &&
      change.holders.some((identityId) => !this.members.has(identityId))
    ) {
      return false;
    }

    return next === undefined
      ? this.allowsLeafChange(change)
      : this.allowsOperation(change, next);
  }

  /** Of the identities holding a leaf, those that may change membership. */
  public committers(holders: Iterable<string>): string[] {
    return sorted(new Set(holders)).filter((identityId) =>
      this.manages(identityId),
    );
  }

  public demoted(identityId: string): GroupMailboxRoster | undefined {
    return this.admins.has(identityId)
      ? this.with({
          adminIds: this.adminIds().filter((admin) => admin !== identityId),
        })
      : undefined;
  }

  public has(identityId: string): boolean {
    return this.members.has(identityId);
  }

  public isAdmin(identityId: string): boolean {
    return this.admins.has(identityId);
  }

  /** Whether the identity may add and remove members. */
  public manages(identityId: string): boolean {
    return identityId === this.fields.creatorId || this.admins.has(identityId);
  }

  public memberIds(): string[] {
    return sorted(this.members);
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

    if (committer === this.fields.creatorId) return 2;

    return change.removed.some((identityId) => identityId !== committer)
      ? 1
      : 0;
  }

  public promoted(identityId: string): GroupMailboxRoster | undefined {
    return this.members.has(identityId) && !this.admins.has(identityId)
      ? this.with({ adminIds: [...this.adminIds(), identityId] })
      : undefined;
  }

  /** The fields, with both lists sorted. */
  public toFields(): GroupMailboxRosterFields {
    return {
      ...this.fields,
      adminIds: this.adminIds(),
      memberIds: this.memberIds(),
    };
  }

  public withMember(identityId: string): GroupMailboxRoster | undefined {
    return this.members.has(identityId)
      ? undefined
      : this.with({ memberIds: [...this.memberIds(), identityId] });
  }

  /** The roster without the identity, which also stops being an admin. */
  public withoutMember(identityId: string): GroupMailboxRoster | undefined {
    return this.members.has(identityId)
      ? this.with({
          adminIds: this.adminIds().filter((admin) => admin !== identityId),
          memberIds: this.memberIds().filter((member) => member !== identityId),
        })
      : undefined;
  }
}
