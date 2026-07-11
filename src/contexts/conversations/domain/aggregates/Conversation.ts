import { Timestamp } from '@haskou/value-objects';

import { AggregateRoot } from '../../../../shared/domain/AggregateRoot';
import { ConversationId } from '../value-objects/ConversationId';
import { ConversationParticipantId } from '../value-objects/ConversationParticipantId';

export class Conversation extends AggregateRoot {
  public static reconstitute(
    id: ConversationId,
    networkId: string,
    participants: readonly ConversationParticipantId[],
    latestMessageAt: Timestamp,
    type: 'group' | 'one-to-one',
    peerIdentityId?: ConversationParticipantId,
  ): Conversation {
    return new Conversation(
      id,
      networkId,
      [...participants],
      latestMessageAt,
      type,
      peerIdentityId,
    );
  }

  private constructor(
    private readonly id: ConversationId,
    private readonly networkId: string,
    private readonly participants: ConversationParticipantId[],
    private latestActivityAt: Timestamp,
    private readonly type: 'group' | 'one-to-one',
    private readonly explicitPeerIdentityId?: ConversationParticipantId,
  ) {
    super();
  }

  public bumpActivity(timestamp: Timestamp): void {
    if (timestamp.isAfter(this.latestActivityAt)) {
      this.latestActivityAt = timestamp;
    }
  }

  public getId(): ConversationId {
    return this.id;
  }

  public isMoreRecentThan(conversation: Conversation): boolean {
    return this.latestMessageAt().isAfter(conversation.latestMessageAt());
  }

  public latestMessageAt(): Timestamp {
    return this.latestActivityAt;
  }

  public peerIdentity(
    currentIdentityId: ConversationParticipantId,
    fallbackPeerIdentityId?: ConversationParticipantId,
  ): ConversationParticipantId | undefined {
    if (this.type === 'group' || this.getId().isGroupConversation()) {
      return undefined;
    }

    if (this.explicitPeerIdentityId) return this.explicitPeerIdentityId;

    const participantPeer = this.participants.find((participantId) =>
      participantId.isNotEqual(currentIdentityId),
    );

    if (participantPeer) return participantPeer;

    return fallbackPeerIdentityId;
  }
}
