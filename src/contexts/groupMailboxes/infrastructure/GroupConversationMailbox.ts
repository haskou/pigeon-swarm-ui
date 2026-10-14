import type { ConversationResource } from '../../conversations/infrastructure/http/ConversationResource';
import type { Session } from '../../identities/infrastructure/session/Session';
import type { EditMessageOptions } from '../../messages/infrastructure/http/resources/EditMessageOptions';
import type { SendMessageOptions } from '../../messages/infrastructure/http/resources/SendMessageOptions';
import type { ChatMessage } from '../../messages/presentation/view-models/ChatMessage';
import type { GroupConversationPorts } from './GroupConversationPorts';
import type { GroupTimelineApply } from './GroupTimelineApply';

import { GroupConversationMember } from './GroupConversationMember';
import { GroupConversationSender } from './GroupConversationSender';
import { GroupConversationStores } from './GroupConversationStores';
import { GroupConversationTimeline } from './GroupConversationTimeline';

/**
 * Group conversations over MLS and per-member mailboxes. The node keeps the
 * roster; the lowest identity id among the members still in both the roster
 * and the MLS group commits every add and removal, so members never race
 * each other's commits. A leaver is removed by that member on its next sync.
 */
export class GroupConversationMailbox {
  public static readonly HISTORY_PAGE = 50;

  private readonly members = new Map<string, GroupConversationMember>();
  private readonly reconciling = new Map<string, Promise<void>>();
  private readonly sender: GroupConversationSender;
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

    if (known) return known;
    const opened = GroupConversationMember.open(
      session,
      this.ports,
      this.stores,
    );

    this.members.set(identityId, opened);

    return opened;
  }

  /** Commits the roster into the MLS group when this member is the one. */
  private async reconcile(
    member: GroupConversationMember,
    conversationId: string,
  ): Promise<void> {
    const self = member.session.identity.id;
    const roster = await this.ports.roster(member.session, conversationId);
    // A device not yet welcomed has no group and nothing to commit.
    const current = new Set(
      await member.engine.members(conversationId).catch((): string[] => []),
    );
    const staying = [...current]
      .filter((id) => roster.has(id))
      .sort((left, right) => left.localeCompare(right));

    if (staying[0] !== self) return;
    const leaving = [...current].filter((id) => !roster.has(id));
    const joining = [...roster].filter((id) => !current.has(id));

    if (leaving.length > 0)
      await member.control.remove(conversationId, leaving);

    if (joining.length > 0) await member.control.add(conversationId, joining);
  }

  /** Starts the MLS group with this device alone, then adds the roster. */
  public async create(session: Session, conversationId: string): Promise<void> {
    await this.member(session).engine.createGroup(conversationId);
    void this.membersChanged(session, conversationId);
  }

  /**
   * Brings the MLS group in line with the node's roster; a call while one is
   * running joins it. Never throws: a failure logs one line and the next
   * sync tries again.
   */
  public async membersChanged(
    session: Session,
    conversationId: string,
  ): Promise<void> {
    const key = `${session.identity.id}/${conversationId}`;
    const running = this.reconciling.get(key);

    if (running) return await running;
    const work = this.reconcile(this.member(session), conversationId)
      .catch(() => GroupConversationMailbox.fail('membership update'))
      .finally(() => this.reconciling.delete(key));

    this.reconciling.set(key, work);
    await work;
  }

  /** Queues a message for every member. Rejects before anything is queued. */
  public async send(
    session: Session,
    conversation: ConversationResource,
    content: string,
    options: SendMessageOptions,
  ): Promise<ChatMessage> {
    return await this.sender.send(
      this.member(session),
      conversation,
      content,
      options,
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
    reaction: {
      action: 'add' | 'remove';
      createdAt: number;
      emoji: string;
      messageId: string;
    },
  ): Promise<void> {
    await this.sender.reaction(this.member(session), conversation.id, reaction);
  }

  /** Queues a pin or unpin. Rejects like send. */
  public async pin(
    session: Session,
    conversation: ConversationResource,
    pin: { action: 'pin' | 'unpin'; createdAt: number; messageId: string },
  ): Promise<void> {
    await this.sender.pin(this.member(session), conversation.id, pin);
  }

  /** Replays the stored history. Never throws. */
  public async restore(
    session: Session,
    conversationId: string,
    signal: AbortSignal,
    apply: GroupTimelineApply,
  ): Promise<void> {
    try {
      const records = await this.stores.history.load(
        session,
        conversationId,
        GroupConversationMailbox.HISTORY_PAGE,
      );

      if (!signal.aborted) apply(this.timeline.changes(session, records));
    } catch {
      GroupConversationMailbox.fail('history restore');
    }
  }

  /**
   * Reads every inbox of the conversation once, then reconciles the roster
   * in the background. Rejects when the inboxes cannot be read.
   */
  public async sync(
    session: Session,
    conversationId: string,
    signal: AbortSignal,
    apply: GroupTimelineApply,
  ): Promise<void> {
    await this.member(session).inbox.sync(conversationId, signal, (records) =>
      apply(this.timeline.changes(session, records)),
    );
    void this.membersChanged(session, conversationId);
  }

  /** Reads pending control letters: key packages, welcomes. Never throws. */
  public async receiveControl(session: Session): Promise<void> {
    try {
      await this.member(session).pump.run();
    } catch {
      GroupConversationMailbox.fail('control receive');
    }
  }

  /** Resumes queued deliveries after unlock. */
  public async resume(session: Session): Promise<void> {
    await this.member(session).outbox.resume();
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
}
