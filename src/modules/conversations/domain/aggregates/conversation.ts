import { Timestamp } from '@haskou/value-objects';

import type {
  ConversationResource,
  LocalKeychain,
} from '../../../../shared/domain/pigeonResources.types';

import { AggregateRoot } from '../../../../shared/domain/aggregateRoot';
import { ConversationId } from '../value-objects/conversationId';
import { ConversationParticipantId } from '../value-objects/conversationParticipantId';

export class Conversation extends AggregateRoot {
  private constructor(private readonly resource: ConversationResource) {
    super();
  }

  public static fromResource(resource: ConversationResource): Conversation {
    return new Conversation(resource);
  }

  public bumpActivity(timestamp: Timestamp): ConversationResource {
    const latestMessageAt = timestamp.isAfter(this.latestMessageAt())
      ? timestamp.valueOf()
      : this.latestMessageAt().valueOf();

    return { ...this.resource, latestMessageAt };
  }

  public getId(): ConversationId {
    return ConversationId.fromString(this.resource.id);
  }

  public isMoreRecentThan(conversation: Conversation): boolean {
    return this.latestMessageAt().isAfter(conversation.latestMessageAt());
  }

  public latestMessageAt(): Timestamp {
    return new Timestamp(Number(this.resource.latestMessageAt ?? 0));
  }

  public peerIdentity(
    currentIdentityId: ConversationParticipantId,
    keychain?: LocalKeychain,
  ): ConversationParticipantId | undefined {
    const peerIdentityId = this.peerIdentityId(
      currentIdentityId.toString(),
      keychain,
    );

    return peerIdentityId
      ? ConversationParticipantId.fromString(peerIdentityId)
      : undefined;
  }

  public peerIdentityId(
    currentIdentityId: string,
    keychain?: LocalKeychain,
  ): string | undefined {
    if (this.resource.type === 'group' || this.getId().isGroupConversation()) {
      return undefined;
    }

    if (this.resource.peerIdentityId) return this.resource.peerIdentityId;

    const participantIds =
      this.resource.participantIdentityIds ??
      this.resource.participantIds ??
      this.resource.participants ??
      [];
    const currentParticipantId =
      ConversationParticipantId.fromString(currentIdentityId);
    const participantPeer = participantIds.find((identityId) =>
      ConversationParticipantId.fromString(identityId).isNotEqual(
        currentParticipantId,
      ),
    );

    if (participantPeer) return participantPeer;

    return keychain?.conversations[this.resource.id]?.peerIdentityId;
  }
}
