import type { ConversationResource } from '../../conversations/infrastructure/http/ConversationResource';
import type { Session } from '../../identities/infrastructure/session/Session';
import type { ChatMessage } from '../../messages/domain/ChatMessage';
import type { DirectMessageTimelineChange } from '../../messages/domain/DirectMessageTimelineChange';
import type { EditMessageOptions } from '../../messages/infrastructure/http/resources/EditMessageOptions';
import type { SendMessageOptions } from '../../messages/infrastructure/http/resources/SendMessageOptions';
import type { GroupMailboxGenesisFields } from '../domain/GroupMailboxGenesisFields';
import type { GroupMailboxRoster } from '../domain/GroupMailboxRoster';
import type { GroupConversationActivity } from './GroupConversationActivity';
import type { GroupConversationPorts } from './GroupConversationPorts';
import type { GroupConversationSyncOutcome } from './GroupConversationSyncOutcome';
import type { GroupTimelineApply } from './GroupTimelineApply';

import { MlsRejectedError } from '../../communities/infrastructure/mls/MlsRejectedError';
import { IdentityMatch } from '../../identities/domain/IdentityMatch';
import { DirectMailboxRecords } from '../../mailboxes/domain/DirectMailboxRecords';
import { MessagePinChange } from '../../messages/domain/MessagePinChange';
import { MessageReactionChange } from '../../messages/domain/MessageReactionChange';
import { MessageId } from '../../messages/domain/value-objects/MessageId';
import { MessagePinAction } from '../../messages/domain/value-objects/MessagePinAction';
import { MessageReactionAction } from '../../messages/domain/value-objects/MessageReactionAction';
import { MessageReactionEmoji } from '../../messages/domain/value-objects/MessageReactionEmoji';
import { GroupMailboxGenesis } from '../domain/GroupMailboxGenesis';
import { GroupMessageId } from './crypto/GroupMessageId';
import { GroupConversationMember } from './GroupConversationMember';
import { GroupConversationSender } from './GroupConversationSender';
import { GroupConversationStores } from './GroupConversationStores';
import { GroupConversationTimeline } from './GroupConversationTimeline';

/**
 * Group conversations over MLS and per-member mailboxes. The node keeps the
 * roster; of the members holding a leaf whom the roster lets change
 * membership (its creator and admins, or anyone when it names none), the
 * lowest identity id commits every removal, then every add, so members
 * never race each other's commits. A leaver is removed by that member on
 * its next sync.
 * Each leaf is a device. Of an identity's devices, only the one with the
 * lowest device credential among its current devices holding a leaf
 * commits, so its devices never race each other either: it removes the
 * leaves of devices the identity's signed transitions no longer authorize,
 * as after a revoke, and adds the authorized devices that hold no leaf. A
 * device only the node lists is never asked for a key package.
 * Reading a conversation's inboxes and replaying its history run one at a
 * time, so a replay never misses what a background read stored meanwhile.
 */
export class GroupConversationMailbox {
  public static readonly HISTORY_PAGE = 50;

  private readonly members = new Map<string, GroupConversationMember>();
  private readonly reconciling = new Map<string, Promise<void>>();
  private readonly sender: GroupConversationSender;
  /** The tail of each conversation's inbox reads and replays. */
  private readonly serial = new Map<string, Promise<unknown>>();
  private readonly stores: GroupConversationStores;
  private readonly timeline: GroupConversationTimeline;

  private static fail(what: string): void {
    // eslint-disable-next-line no-console
    console.debug(`Group ${what} failed.`);
  }

  public constructor(private readonly ports: GroupConversationPorts) {
    this.stores = new GroupConversationStores(ports.storage);
    this.sender = new GroupConversationSender(ports, this.stores.history);
    this.timeline = new GroupConversationTimeline(ports.projector);
  }

  private member(session: Session): GroupConversationMember {
    const identityId = session.identity.id;
    const known = this.members.get(identityId);

    if (known) {
      known.follow(session);

      return known;
    }
    const opened = GroupConversationMember.open(
      session,
      this.ports,
      this.stores,
    );

    this.members.set(identityId, opened);

    return opened;
  }

  /**
   * Adds this identity's verified devices that hold no leaf yet, unless the
   * roster no longer lists this identity. Resolves how many it added.
   */
  private async addMissingDevices(
    member: GroupConversationMember,
    conversationId: string,
    roster: GroupMailboxRoster,
    verified: ReadonlySet<string>,
    leaves: readonly string[],
  ): Promise<number> {
    if (!roster.has(member.session.identity.id)) return 0;
    const missing = [...verified].filter(
      (credential) => !leaves.includes(credential),
    );

    if (missing.length > 0) {
      await member.control.addDevices(conversationId, missing);
    }

    return missing.length;
  }

  /**
   * Commits the roster and the devices this identity's signed transitions
   * authorize into the MLS group when this device is the one. A device
   * that awaits the group's confirmation commits nothing. Logs counts
   * only.
   */
  private async reconcile(
    member: GroupConversationMember,
    conversationId: string,
    known?: GroupMailboxRoster,
  ): Promise<void> {
    const { session } = member;
    // A device not yet welcomed has no group and nothing to commit.
    const leaves = await member.engine.devices(conversationId);

    if (
      leaves.length === 0 ||
      (await member.engine.awaitsConfirmation(conversationId))
    ) {
      return;
    }
    const verified = new Set(await this.ports.verifiedDevices(session));
    const lead = leaves.find((credential) => verified.has(credential));

    if (lead !== session.deviceCredentialKeyPair.toPrimitives().publicKey) {
      return;
    }
    const roster = known ?? (await this.ports.roster(session, conversationId));
    const revoked = leaves.filter((credential) => !verified.has(credential));

    if (revoked.length > 0) {
      await member.control.removeDevices(conversationId, revoked);
    }
    await this.reconcileMembers(member, conversationId, roster);
    const added = await this.addMissingDevices(
      member,
      conversationId,
      roster,
      verified,
      leaves,
    );

    if (revoked.length > 0 || added > 0) {
      // Count-only: no ids, credentials or keys.
      // eslint-disable-next-line no-console
      console.info(
        `Group devices reconciled: removed ${revoked.length}, added ${added}.`,
      );
    }
  }

  /**
   * Commits the roster's removals, then its adds, when this identity is the
   * first committer holding a leaf.
   */
  private async reconcileMembers(
    member: GroupConversationMember,
    conversationId: string,
    roster: GroupMailboxRoster,
  ): Promise<void> {
    const current = new Set(await member.engine.members(conversationId));

    if (
      !IdentityMatch.isSame(
        roster.committers(current)[0],
        member.session.identity.id,
      )
    ) {
      return;
    }

    const leaving = [...current].filter((id) => !roster.has(id));
    const joining = roster.participants().filter((id) => !current.has(id));

    if (leaving.length > 0)
      await member.control.remove(conversationId, leaving);

    if (joining.length > 0) await member.control.add(conversationId, joining);
  }

  /** Runs `work` after the conversation's earlier inbox reads and replays. */
  private serially<T>(
    session: Session,
    conversationId: string,
    work: () => Promise<T>,
  ): Promise<T> {
    const key = `${session.identity.id}/${conversationId}`;
    const result = (this.serial.get(key) ?? Promise.resolve()).then(work);
    const tail = result.catch(() => undefined);

    this.serial.set(key, tail);
    void tail.then(() => {
      if (this.serial.get(key) === tail) this.serial.delete(key);
    });

    return result;
  }

  /**
   * The newest message time and unread count of a conversation on this
   * device, from its stored history. Rejects on failure.
   */
  public async activity(
    session: Session,
    conversationId: string,
  ): Promise<GroupConversationActivity> {
    return await this.stores.history.activity(session, conversationId);
  }

  /**
   * Starts the MLS group with this device alone, then adds the roster.
   * `genesis` must derive the conversation id; joiners learn it from this
   * identity's key package requests, so a welcome from it confirms.
   */
  public async create(
    session: Session,
    conversationId: string,
    genesis: GroupMailboxGenesisFields,
  ): Promise<void> {
    const derived = GroupMailboxGenesis.of(conversationId, genesis);

    if (!derived) {
      throw new MlsRejectedError('The genesis does not derive the group id');
    }
    const { engine } = this.member(session);

    await engine.learnGenesis(derived);
    await engine.createGroup(conversationId);
    void this.membersChanged(session, conversationId);
  }

  /**
   * Brings the MLS group in line with the node's roster, then retries the
   * queue, whose messages wait while a removal is pending or this device
   * awaits the group's confirmation; an unconfirmed device commits
   * nothing. A call while one is running joins it. Never throws: a failure
   * logs one line and the next sync tries again.
   */
  public async membersChanged(
    session: Session,
    conversationId: string,
    roster?: GroupMailboxRoster,
  ): Promise<void> {
    const key = `${session.identity.id}/${conversationId}`;
    const running = this.reconciling.get(key);

    if (running) return await running;
    const member = this.member(session);
    const work = this.reconcile(member, conversationId, roster)
      .then(() => member.outbox.flush())
      .catch(() => GroupConversationMailbox.fail('membership update'))
      .finally(() => this.reconciling.delete(key));

    this.reconciling.set(key, work);
    await work;
  }

  /**
   * Queues a message for every member. Rejects before anything is queued.
   * The message carries its outbox state, as `held` while a removal is
   * pending or this device awaits the group's confirmation.
   */
  public async send(
    session: Session,
    conversation: ConversationResource,
    content: string,
    options: SendMessageOptions,
  ): Promise<ChatMessage> {
    const message = await this.sender.send(
      this.member(session),
      conversation,
      content,
      options,
    );

    return this.withOutboxState(session, conversation.id, [message])[0];
  }

  /** Queues an edit of this identity's message. Rejects like send. */
  public async edit(
    session: Session,
    conversation: ConversationResource,
    messageId: string,
    content: string,
    options: EditMessageOptions,
  ): Promise<ChatMessage> {
    return await this.sender.edit(
      this.member(session),
      conversation,
      messageId,
      content,
      options,
    );
  }

  /** Queues the deletion of this identity's message. Rejects like send. */
  public async delete(
    session: Session,
    conversation: ConversationResource,
    messageId: string,
  ): Promise<void> {
    await this.sender.delete(this.member(session), conversation.id, messageId);
  }

  /** Queues a reaction added or removed. Rejects like send. */
  public async reaction(
    session: Session,
    conversation: ConversationResource,
    reaction: { action: 'add' | 'remove'; emoji: string; messageId: string },
  ): Promise<void> {
    await this.sender.reaction(
      this.member(session),
      conversation.id,
      MessageReactionChange.now(
        MessageReactionAction.fromPrimitives(reaction.action),
        MessageReactionEmoji.fromString(reaction.emoji),
        MessageId.fromString(reaction.messageId),
      ),
    );
  }

  /** Queues a pin or unpin. Rejects like send. */
  public async pin(
    session: Session,
    conversation: ConversationResource,
    pin: { action: 'pin' | 'unpin'; messageId: string },
  ): Promise<void> {
    await this.sender.pin(
      this.member(session),
      conversation.id,
      MessagePinChange.now(
        MessagePinAction.fromPrimitives(pin.action),
        MessageId.fromString(pin.messageId),
      ),
    );
  }

  /**
   * Queues a poll in the conversation and resolves with its change. Rejects
   * like send, and before queuing a poll the poll rules refuse.
   */
  public async createPoll(
    session: Session,
    conversation: ConversationResource,
    poll: {
      allowsMultipleVotes: boolean;
      options: { id: string; text: string }[];
      question: string;
    },
  ): Promise<Extract<DirectMessageTimelineChange, { kind: 'poll' }>> {
    return this.timeline.poll(
      await this.sender.createPoll(this.member(session), conversation.id, poll),
    );
  }

  /**
   * Queues this identity's vote on a poll, or its withdrawal when no option
   * is chosen, and resolves with its change. Rejects like send.
   */
  public async votePoll(
    session: Session,
    conversation: ConversationResource,
    pollId: string,
    optionIds: string[],
  ): Promise<Extract<DirectMessageTimelineChange, { kind: 'poll_vote' }>> {
    return this.timeline.pollVote(
      await this.sender.votePoll(
        this.member(session),
        conversation.id,
        pollId,
        optionIds,
      ),
    );
  }

  /** Queues the close of this identity's poll. Rejects like send. */
  public async closePoll(
    session: Session,
    conversation: ConversationResource,
    pollId: string,
  ): Promise<Extract<DirectMessageTimelineChange, { kind: 'poll_close' }>> {
    return this.timeline.pollClose(
      await this.sender.closePoll(
        this.member(session),
        conversation.id,
        pollId,
      ),
    );
  }

  /**
   * Tells the other members this identity is typing, at most once per 10
   * seconds per conversation. Ephemeral: never queued, kept or retried.
   */
  public async typing(session: Session, conversationId: string): Promise<void> {
    await this.sender.typing(this.member(session), conversationId);
  }

  /**
   * Tells the other members this identity updated its profile, so they
   * fetch it again. Ephemeral: never queued, kept or retried.
   */
  public async identityUpdated(
    session: Session,
    conversationId: string,
  ): Promise<void> {
    await this.sender.identityUpdated(this.member(session), conversationId);
  }

  /** Marks the conversation's stored history read on this device. */
  public async markRead(
    session: Session,
    conversationId: string,
  ): Promise<void> {
    await this.stores.history.markRead(session, conversationId);
  }

  /**
   * Reads every inbox of a conversation that is not open into its stored
   * history, hands the author of each identity update to
   * `onIdentityUpdated`, then resolves with its activity. Rejects on
   * failure.
   */
  public async receive(
    session: Session,
    conversationId: string,
    signal: AbortSignal,
    onIdentityUpdated: (identityId: string) => void,
  ): Promise<GroupConversationActivity> {
    await this.serially(session, conversationId, () =>
      this.member(session).inbox.sync(conversationId, signal, (records) => {
        for (const record of records) {
          if (record.type === DirectMailboxRecords.TYPE.identityUpdated) {
            onIdentityUpdated(record.authorId);
          }
        }
      }),
    );

    return await this.stores.history.activity(session, conversationId);
  }

  /** Replays the stored history. Never throws. */
  public async restore(
    session: Session,
    conversationId: string,
    signal: AbortSignal,
    apply: GroupTimelineApply,
  ): Promise<void> {
    try {
      const records = await this.serially(session, conversationId, () =>
        this.stores.history.load(
          session,
          conversationId,
          GroupConversationMailbox.HISTORY_PAGE,
        ),
      );

      if (!signal.aborted) apply(this.timeline.changes(session, records));
    } catch {
      GroupConversationMailbox.fail('history restore');
    }
  }

  /**
   * Reads every inbox of the conversation once, then reads the roster and
   * reconciles it in the background. Resolves whether this identity has
   * left the roster, a roster that cannot be read counting as staying, and
   * whether this device still awaits the group's confirmation. Rejects
   * when the inboxes cannot be read.
   */
  public async sync(
    session: Session,
    conversationId: string,
    signal: AbortSignal,
    apply: GroupTimelineApply,
  ): Promise<GroupConversationSyncOutcome> {
    await this.serially(session, conversationId, () =>
      this.member(session).inbox.sync(conversationId, signal, (records) =>
        apply(this.timeline.changes(session, records)),
      ),
    );
    const roster = await this.ports
      .roster(session, conversationId)
      .catch(() => undefined);

    void this.membersChanged(session, conversationId, roster);

    return {
      removed: roster?.has(session.identity.id) === false,
      unconfirmed:
        await this.member(session).engine.awaitsConfirmation(conversationId),
    };
  }

  /**
   * Reads pending control letters: key packages, welcomes. Resolves with
   * the conversations a welcome joined. Never throws.
   */
  public async receiveControl(session: Session): Promise<string[]> {
    try {
      return [...(await this.member(session).pump.run())];
    } catch {
      GroupConversationMailbox.fail('control receive');

      return [];
    }
  }

  /** Resumes queued deliveries after unlock. */
  public async resume(session: Session): Promise<void> {
    await this.member(session).outbox.resume();
  }

  /**
   * After a revoke rotated the root, cuts the replaced root and the revoked
   * device off this identity's group inboxes, then, in the background,
   * has the device that commits for this identity remove the revoked
   * device's leaves, so it cannot decrypt what is sent next. Rejects when
   * any inbox is not cut.
   */
  public async cutOffRevokedReaders(session: Session): Promise<void> {
    const member = this.member(session);

    try {
      await member.inbox.cutOffRevokedReaders();
    } finally {
      void member.generations
        .conversationIds()
        .then((conversationIds) =>
          Promise.all(
            conversationIds.map((conversationId) =>
              this.membersChanged(session, conversationId),
            ),
          ),
        )
        .catch(() => GroupConversationMailbox.fail('device removal'));
    }
  }

  /** Stops this identity's background work, for logout. State is kept. */
  public stop(identityId: string): void {
    this.members.get(identityId)?.close();
    this.members.delete(identityId);
  }

  /**
   * Deletes this identity's group state on this device, after any running
   * membership update of it, so none writes MLS state back. Every store is
   * tried; rejects when any could not be deleted. An outbox append or a
   * notification pump run already in flight is not awaited: such a run that
   * joins a group right then can write MLS state back after the delete.
   */
  public async forget(identityId: string): Promise<void> {
    this.stop(identityId);
    const running = [...this.reconciling]
      .filter(([key]) => key.startsWith(`${identityId}/`))
      .map(([, work]) => work);

    await Promise.all(running);
    await this.stores.forget(identityId);
  }

  /**
   * The messages with this identity's queued group messages stamped with
   * their outbox state, and delivered ones cleared; the same array when
   * nothing changes. Optimistic sends and others' messages are untouched.
   */
  public withOutboxState(
    session: Session,
    conversationId: string,
    messages: ChatMessage[],
  ): ChatMessage[] {
    const self = session.identity.id;
    const states = new Map(
      this.member(session)
        .outbox.items(conversationId)
        .map(({ reference, state }) => [reference, state]),
    );
    let changed = false;
    const stamped = messages.map((message) => {
      const state = states.get(message.id);

      if (
        message.deliveryStatus === state ||
        !message.mine ||
        !GroupMessageId.belongsTo(message.id, self)
      ) {
        return message;
      }
      changed = true;

      return { ...message, deliveryStatus: state };
    });

    return changed ? stamped : messages;
  }
}
