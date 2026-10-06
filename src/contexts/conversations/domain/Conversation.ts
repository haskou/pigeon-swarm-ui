import { Timestamp, assert, type PrimitiveOf } from '@haskou/value-objects';

import { AggregateRoot } from '../../../shared/domain/AggregateRoot';
import { ConversationActivity } from './entities/ConversationActivity';
import { ConversationAdmins } from './entities/ConversationAdmins';
import { ConversationParticipants } from './entities/ConversationParticipants';
import { ConversationRosterChangeNotAllowedError } from './errors/ConversationRosterChangeNotAllowedError';
import { DirectConversationInvitationNotAllowedError } from './errors/DirectConversationInvitationNotAllowedError';
import { ConversationEventType } from './value-objects/ConversationEventType';
import { ConversationId } from './value-objects/ConversationId';
import { ConversationMetadata } from './value-objects/ConversationMetadata';
import { ConversationName } from './value-objects/ConversationName';
import { ConversationNetworkId } from './value-objects/ConversationNetworkId';
import { ConversationParticipantId } from './value-objects/ConversationParticipantId';
import { ConversationType } from './value-objects/ConversationType';

export class Conversation extends AggregateRoot {
  public static create(
    id: ConversationId,
    networkId: ConversationNetworkId,
    type: ConversationType,
    name: ConversationName,
    participantIds: ConversationParticipantId[],
    creatorId: ConversationParticipantId,
    occurredAt: Timestamp,
  ): Conversation {
    const conversation = new Conversation(
      ConversationMetadata.create(id, networkId, type, name),
      ConversationParticipants.create(participantIds),
      ConversationAdmins.fromPrimitives([]),
      creatorId,
      ConversationActivity.empty(),
    );

    conversation.record(
      conversation.metadata.identifyEvent(
        ConversationEventType.CREATED,
        occurredAt,
      ),
    );

    return conversation;
  }

  public static fromPrimitives(
    primitives: PrimitiveOf<Conversation>,
  ): Conversation {
    return new Conversation(
      ConversationMetadata.fromPrimitives({
        id: primitives.id,
        name: primitives.name,
        networkId: primitives.networkId,
        type: primitives.type,
      }),
      ConversationParticipants.fromPrimitives(primitives.participantIds),
      ConversationAdmins.fromPrimitives(primitives.adminIds),
      primitives.creatorId === undefined
        ? undefined
        : ConversationParticipantId.fromString(primitives.creatorId),
      ConversationActivity.fromPrimitives({
        latestMessageAt: primitives.latestMessageAt,
        unreadCount: primitives.unreadCount,
      }),
    );
  }

  private constructor(
    private readonly metadata: ConversationMetadata,
    private readonly participants: ConversationParticipants,
    private readonly admins: ConversationAdmins,
    private readonly creatorId: ConversationParticipantId | undefined,
    private readonly activity: ConversationActivity,
  ) {
    super();
  }

  private assertGroupRoster(): void {
    assert(
      this.metadata.isGroup(),
      new ConversationRosterChangeNotAllowedError(),
    );
  }

  private assertRosterChange(allowed: boolean): void {
    assert(allowed, new ConversationRosterChangeNotAllowedError());
  }

  private isCreator(participantId: ConversationParticipantId): boolean {
    return this.creatorId?.isEqual(participantId) ?? false;
  }

  public belongsTo(id: ConversationId): boolean {
    return this.metadata.belongsTo(id);
  }

  /** The creator and the admins manage the roster of a group. */
  public canInvite(actorId: ConversationParticipantId): boolean {
    return (
      this.metadata.isGroup() &&
      (this.isCreator(actorId) || this.admins.includes(actorId))
    );
  }

  /** The creator is the only one who never leaves. */
  public canLeave(actorId: ConversationParticipantId): boolean {
    return (
      this.metadata.isGroup() &&
      this.participants.includes(actorId) &&
      !this.isCreator(actorId)
    );
  }

  public canDemote(
    targetId: ConversationParticipantId,
    actorId: ConversationParticipantId,
  ): boolean {
    return (
      this.metadata.isGroup() &&
      this.isCreator(actorId) &&
      this.admins.includes(targetId)
    );
  }

  public canPromote(
    targetId: ConversationParticipantId,
    actorId: ConversationParticipantId,
  ): boolean {
    return (
      this.metadata.isGroup() &&
      this.isCreator(actorId) &&
      this.participants.includes(targetId) &&
      !this.isCreator(targetId) &&
      !this.admins.includes(targetId)
    );
  }

  /** Nobody removes themselves, the creator or (unless creator) an admin. */
  public canRemove(
    targetId: ConversationParticipantId,
    actorId: ConversationParticipantId,
  ): boolean {
    return (
      this.canInvite(actorId) &&
      this.participants.includes(targetId) &&
      !this.isCreator(targetId) &&
      targetId.isNotEqual(actorId) &&
      (!this.admins.includes(targetId) || this.isCreator(actorId))
    );
  }

  public demote(
    targetId: ConversationParticipantId,
    actorId: ConversationParticipantId,
    occurredAt: Timestamp,
  ): void {
    this.assertRosterChange(this.canDemote(targetId, actorId));
    this.admins.remove(targetId);
    this.record(
      this.metadata.identifyEvent(
        ConversationEventType.ADMIN_DEMOTED,
        occurredAt,
      ),
    );
  }

  public invite(
    participantId: ConversationParticipantId,
    actorId: ConversationParticipantId,
    occurredAt: Timestamp,
  ): void {
    assert(
      this.metadata.isGroup(),
      new DirectConversationInvitationNotAllowedError(),
    );
    this.assertRosterChange(this.canInvite(actorId));
    this.participants.assertExcludes(participantId);
    this.participants.add(participantId);
    this.record(
      this.metadata.identifyEvent(
        ConversationEventType.PARTICIPANT_INVITED,
        occurredAt,
      ),
    );
  }

  public isMoreRecentThan(conversation: Conversation): boolean {
    return this.activity.isMoreRecentThan(conversation.activity);
  }

  public isGroup(): boolean {
    return this.metadata.isGroup();
  }

  public leave(
    actorId: ConversationParticipantId,
    occurredAt: Timestamp,
  ): void {
    this.assertGroupRoster();
    this.assertRosterChange(this.canLeave(actorId));
    this.participants.remove(actorId);
    this.admins.remove(actorId);
    this.record(
      this.metadata.identifyEvent(
        ConversationEventType.PARTICIPANT_LEFT,
        occurredAt,
      ),
    );
  }

  public markRead(occurredAt: Timestamp): void {
    if (!this.activity.markRead()) return;

    this.record(
      this.metadata.identifyEvent(ConversationEventType.READ, occurredAt),
    );
  }

  public peerOf(
    participantId: ConversationParticipantId,
  ): ConversationParticipantId | undefined {
    if (this.metadata.isGroup()) return undefined;

    return this.participants.peerOf(participantId);
  }

  public promote(
    targetId: ConversationParticipantId,
    actorId: ConversationParticipantId,
    occurredAt: Timestamp,
  ): void {
    this.assertRosterChange(this.canPromote(targetId, actorId));
    this.admins.add(targetId);
    this.record(
      this.metadata.identifyEvent(
        ConversationEventType.ADMIN_PROMOTED,
        occurredAt,
      ),
    );
  }

  public recordActivity(occurredAt: Timestamp): void {
    if (!this.activity.record(occurredAt)) return;
    this.record(
      this.metadata.identifyEvent(
        ConversationEventType.ACTIVITY_RECORDED,
        occurredAt,
      ),
    );
  }

  public removeParticipant(
    targetId: ConversationParticipantId,
    actorId: ConversationParticipantId,
    occurredAt: Timestamp,
  ): void {
    this.assertRosterChange(this.canRemove(targetId, actorId));
    this.participants.remove(targetId);
    this.admins.remove(targetId);
    this.record(
      this.metadata.identifyEvent(
        ConversationEventType.PARTICIPANT_REMOVED,
        occurredAt,
      ),
    );
  }

  public toPrimitives() {
    return {
      ...this.metadata.toPrimitives(),
      ...this.activity.toPrimitives(),
      adminIds: this.admins.toPrimitives(),
      creatorId: this.creatorId?.toString(),
      participantIds: this.participants.toPrimitives(),
    };
  }
}
