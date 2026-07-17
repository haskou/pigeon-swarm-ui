import { Timestamp, assert, type PrimitiveOf } from '@haskou/value-objects';

import { AggregateRoot } from '../../../shared/domain/AggregateRoot';
import { ConversationActivity } from './entities/ConversationActivity';
import { ConversationParticipants } from './entities/ConversationParticipants';
import { DirectConversationInvitationNotAllowedError } from './errors/DirectConversationInvitationNotAllowedError';
import { ConversationEventType } from './value-objects/ConversationEventType';
import { ConversationId } from './value-objects/ConversationId';
import { ConversationMetadata } from './value-objects/ConversationMetadata';
import { ConversationName } from './value-objects/ConversationName';
import { ConversationNetworkId } from './value-objects/ConversationNetworkId';
import { ConversationParticipantId } from './value-objects/ConversationParticipantId';
import { ConversationPreview } from './value-objects/ConversationPreview';
import { ConversationType } from './value-objects/ConversationType';

export class Conversation extends AggregateRoot {
  public static create(
    id: ConversationId,
    networkId: ConversationNetworkId,
    type: ConversationType,
    name: ConversationName,
    participantIds: ConversationParticipantId[],
    occurredAt: Timestamp,
    peerIdentityId?: ConversationParticipantId,
  ): Conversation {
    const conversation = new Conversation(
      ConversationMetadata.create(id, networkId, type, name),
      ConversationParticipants.create(participantIds),
      ConversationActivity.empty(),
      peerIdentityId,
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
      ConversationActivity.fromPrimitives({
        latestMessageAt: primitives.latestMessageAt,
        latestMessagePreview: primitives.latestMessagePreview,
        unreadCount: primitives.unreadCount,
      }),
      primitives.peerIdentityId
        ? ConversationParticipantId.fromString(primitives.peerIdentityId)
        : undefined,
    );
  }

  private constructor(
    private readonly metadata: ConversationMetadata,
    private readonly participants: ConversationParticipants,
    private readonly activity: ConversationActivity,
    private readonly explicitPeerIdentityId?: ConversationParticipantId,
  ) {
    super();
  }

  public belongsTo(id: ConversationId): boolean {
    return this.metadata.belongsTo(id);
  }

  public invite(
    participantId: ConversationParticipantId,
    occurredAt: Timestamp,
  ): void {
    assert(
      this.metadata.isGroup(),
      new DirectConversationInvitationNotAllowedError(),
    );
    this.participants.assertExcludes(participantId);
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

  public markRead(occurredAt: Timestamp): void {
    if (!this.activity.markRead()) return;

    this.record(
      this.metadata.identifyEvent(ConversationEventType.READ, occurredAt),
    );
  }

  public peerOf(
    participantId: ConversationParticipantId,
    fallbackPeerIdentityId?: ConversationParticipantId,
  ): ConversationParticipantId | undefined {
    if (this.metadata.isGroup()) return undefined;

    return (
      this.participants.peerOf(participantId, this.explicitPeerIdentityId) ??
      fallbackPeerIdentityId
    );
  }

  public recordActivity(
    occurredAt: Timestamp,
    preview?: ConversationPreview,
  ): void {
    if (!this.activity.record(occurredAt, preview)) return;
    this.record(
      this.metadata.identifyEvent(
        ConversationEventType.ACTIVITY_RECORDED,
        occurredAt,
      ),
    );
  }

  public toPrimitives() {
    return {
      ...this.metadata.toPrimitives(),
      ...this.activity.toPrimitives(),
      participantIds: this.participants.toPrimitives(),
      peerIdentityId: this.explicitPeerIdentityId?.toString(),
    };
  }
}
