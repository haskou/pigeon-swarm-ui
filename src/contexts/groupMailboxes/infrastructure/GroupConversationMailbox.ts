import { CommitmentId } from '@haskou/pigeon-swarm-crypto';

import type { ConversationResource } from '../../conversations/infrastructure/http/ConversationResource';
import type { Session } from '../../identities/infrastructure/session/Session';
import type { ChatMessage } from '../../messages/domain/ChatMessage';
import type { DirectMessageTimelineChange } from '../../messages/domain/DirectMessageTimelineChange';
import type { EditMessageOptions } from '../../messages/infrastructure/http/resources/EditMessageOptions';
import type { SendMessageOptions } from '../../messages/infrastructure/http/resources/SendMessageOptions';
import type { GroupMailboxInvitation } from './control/GroupMailboxInvitation';
import type { GroupConversationActivity } from './GroupConversationActivity';
import type { GroupConversationPorts } from './GroupConversationPorts';
import type { GroupConversationSyncOutcome } from './GroupConversationSyncOutcome';
import type { GroupTimelineApply } from './GroupTimelineApply';

import { MlsRejectedError } from '../../communities/infrastructure/mls/MlsRejectedError';
import { ConversationIdFactory } from '../../conversations/domain/ConversationIdFactory';
import { ConversationGroupNonce } from '../../conversations/domain/value-objects/ConversationGroupNonce';
import { ConversationNetworkId } from '../../conversations/domain/value-objects/ConversationNetworkId';
import { ConversationParticipantId } from '../../conversations/domain/value-objects/ConversationParticipantId';
import { IdentityMatch } from '../../identities/domain/IdentityMatch';
import { IdentityId } from '../../identities/domain/value-objects/IdentityId';
import { DirectMailboxRecords } from '../../mailboxes/domain/DirectMailboxRecords';
import { MessagePinChange } from '../../messages/domain/MessagePinChange';
import { MessageReactionChange } from '../../messages/domain/MessageReactionChange';
import { MessageId } from '../../messages/domain/value-objects/MessageId';
import { MessagePinAction } from '../../messages/domain/value-objects/MessagePinAction';
import { MessageReactionAction } from '../../messages/domain/value-objects/MessageReactionAction';
import { MessageReactionEmoji } from '../../messages/domain/value-objects/MessageReactionEmoji';
import { GroupMailboxGenesis } from '../domain/GroupMailboxGenesis';
import { GroupMailboxRoster } from '../domain/GroupMailboxRoster';
import { GroupConversationMember } from './GroupConversationMember';
import { GroupConversationSender } from './GroupConversationSender';
import { GroupConversationStores } from './GroupConversationStores';
import { GroupConversationTimeline } from './GroupConversationTimeline';

/**
 * Group conversations over MLS and per-member mailboxes. The roster travels
 * in the MLS group's GroupContext and changes only by roster commits
 * (`addMember`, `removeMember`, `leave`, `promote`, `demote`); the node
 * never learns it. This device lists the groups whose roster names this
 * identity (`conversations`). Of the members holding a leaf whom the roster
 * lets change membership (its creator and admins), the lowest identity id
 * removes the leaves of identities the roster no longer lists, as a
 * leaver's, then asks each listed member holding no leaf for a key package,
 * so members never race each other's commits; the device that asked commits
 * that member's add.
 * Each leaf is a device. Of an identity's devices, only the one with the
 * lowest device credential among its current devices holding a leaf
 * reconciles, so its devices never race each other either: it removes the
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
    const roster = await member.engine.roster(conversationId);

    if (!roster) return;
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
   * Removes the leaves of identities off the roster, then asks the listed
   * members holding no leaf for a key package, when this identity is the
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
    const joining = roster.memberIds().filter((id) => !current.has(id));

    if (leaving.length > 0)
      await member.control.remove(conversationId, leaving);

    if (joining.length > 0) await member.control.add(conversationId, joining);
  }

  /**
   * Commits one roster operation of this identity's, then brings the MLS
   * group in line with the new roster.
   */
  private async rosterChange(
    session: Session,
    conversationId: string,
    change: (member: GroupConversationMember) => Promise<unknown>,
  ): Promise<void> {
    await change(this.member(session));
    void this.membersChanged(session, conversationId);
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

  /** Accepts a deferred group invitation: its key package goes out. */
  public async acceptInvitation(
    session: Session,
    notificationId: string,
  ): Promise<boolean> {
    return this.member(session).pump.accept(notificationId);
  }

  /** Adds an identity to the roster, then asks it for a key package. */
  public async addMember(
    session: Session,
    conversationId: string,
    identityId: string,
  ): Promise<void> {
    await this.rosterChange(session, conversationId, (member) =>
      member.control.addMember(
        conversationId,
        IdentityId.normalize(identityId),
      ),
    );
  }

  /**
   * The group conversations this device holds, whose roster names this
   * identity. Never throws: a group that cannot be read is left out.
   */
  public async conversations(
    session: Session,
  ): Promise<ConversationResource[]> {
    const member = this.member(session);
    const conversationIds = await member.generations.conversationIds();
    const rosters = await Promise.all(
      conversationIds.map((conversationId) =>
        member.engine.roster(conversationId).catch(() => undefined),
      ),
    );
    const networks = await Promise.all(
      conversationIds.map((conversationId) =>
        member.engine.genesis(conversationId).catch(() => undefined),
      ),
    );

    return rosters.flatMap((roster, index) =>
      roster?.has(session.identity.id)
        ? [
            {
              adminIds: roster.adminIds(),
              creatorId: roster.creatorId,
              id: roster.conversationId,
              name: roster.name,
              networkId: networks[index]?.toPrimitives().networkId ?? '',
              participantIds: roster.memberIds(),
              type: 'group' as const,
            },
          ]
        : [],
    );
  }

  /**
   * Starts a group conversation on this device alone: its id derives from a
   * fresh genesis naming this identity as creator, and its roster lists
   * this identity and the invitees, who are then asked for key packages.
   * Joiners learn the genesis from those requests, so a welcome from this
   * identity confirms at once.
   */
  public async create(
    session: Session,
    input: { name: string; networkId: string; participantIds: string[] },
  ): Promise<ConversationResource> {
    const creatorIdentityId = IdentityId.normalize(session.identity.id);
    const nonce = ConversationGroupNonce.generate();
    const conversationId = new ConversationIdFactory()
      .createGroup(
        ConversationParticipantId.fromString(creatorIdentityId),
        ConversationNetworkId.fromString(input.networkId),
        nonce,
      )
      .toString();
    const genesis = GroupMailboxGenesis.of(conversationId, {
      creatorIdentityId,
      networkId: input.networkId,
      nonce: nonce.toString(),
    });
    const roster = GroupMailboxRoster.of({
      adminIds: [],
      conversationId,
      creatorId: creatorIdentityId,
      memberIds: [
        ...new Set([
          creatorIdentityId,
          ...input.participantIds.map((id) => IdentityId.normalize(id)),
        ]),
      ].sort(),
      name: input.name.trim(),
      version: GroupMailboxRoster.VERSION,
    });

    if (!genesis || !roster) {
      throw new MlsRejectedError('The group cannot be created');
    }
    const { engine } = this.member(session);

    await engine.learnGenesis(genesis);
    await engine.createGroup(conversationId, roster);
    void this.membersChanged(session, conversationId);

    return {
      adminIds: roster.adminIds(),
      creatorId: creatorIdentityId,
      id: conversationId,
      name: roster.name,
      networkId: input.networkId,
      participantIds: roster.memberIds(),
      type: 'group',
    };
  }

  /** Declines a deferred group invitation. */
  public async declineInvitation(
    session: Session,
    notificationId: string,
  ): Promise<boolean> {
    return this.member(session).pump.decline(notificationId);
  }

  /** Demotes an admin; only the creator may. */
  public async demote(
    session: Session,
    conversationId: string,
    identityId: string,
  ): Promise<void> {
    await this.rosterChange(session, conversationId, (member) =>
      member.control.demote(conversationId, IdentityId.normalize(identityId)),
    );
  }

  /**
   * The key-package requests from identities that are not contacts, as the
   * last control read found them, waiting to be accepted or declined.
   */
  public invitations(session: Session): GroupMailboxInvitation[] {
    return this.member(session).pump.invitations();
  }

  /** Takes this identity off the roster; the creator never leaves. */
  public async leave(session: Session, conversationId: string): Promise<void> {
    await this.member(session).control.leave(conversationId);
  }

  /**
   * Brings the MLS group in line with its roster, then retries the queue,
   * whose messages wait while a removal is pending or this device awaits
   * the group's confirmation; an unconfirmed device commits nothing. A
   * call while one is running joins it. Never throws: a failure logs one
   * line and the next sync tries again.
   */
  public async membersChanged(
    session: Session,
    conversationId: string,
  ): Promise<void> {
    const key = `${session.identity.id}/${conversationId}`;
    const running = this.reconciling.get(key);

    if (running) return await running;
    const member = this.member(session);
    const work = this.reconcile(member, conversationId)
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

  /** Promotes a member to admin; only the creator may. */
  public async promote(
    session: Session,
    conversationId: string,
    identityId: string,
  ): Promise<void> {
    await this.rosterChange(session, conversationId, (member) =>
      member.control.promote(conversationId, IdentityId.normalize(identityId)),
    );
  }

  /** Removes a member from the roster, and its leaves in the same commit. */
  public async removeMember(
    session: Session,
    conversationId: string,
    identityId: string,
  ): Promise<void> {
    await this.rosterChange(session, conversationId, (member) =>
      member.control.removeMember(
        conversationId,
        IdentityId.normalize(identityId),
      ),
    );
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

  /**
   * Whether this device dropped this identity's stored group history because
   * it no longer opens under the device-sealed root, as after a device revoke.
   * Reports a drop until `acknowledgeHistoryDropped`. Never throws.
   */
  public async checkHistoryDropped(session: Session): Promise<boolean> {
    return await this.stores.history.checkDropped(session);
  }

  /** Clears the identity's reported history drop, once its notice is shown. */
  public acknowledgeHistoryDropped(identityId: string): void {
    this.stores.history.acknowledgeDropped(identityId);
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
   * Reads every inbox of the conversation once, then reconciles the MLS
   * group with its roster in the background. Resolves whether this identity
   * is off the roster, or holds no group for the conversation, and whether
   * this device still awaits the group's confirmation. Rejects when the
   * inboxes cannot be read.
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
    const roster = await this.member(session).engine.roster(conversationId);

    void this.membersChanged(session, conversationId);

    return {
      removed: !roster?.has(session.identity.id),
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
        !CommitmentId.isGroupMessageOf(message.id, self)
      ) {
        return message;
      }
      changed = true;

      return { ...message, deliveryStatus: state };
    });

    return changed ? stamped : messages;
  }
}
