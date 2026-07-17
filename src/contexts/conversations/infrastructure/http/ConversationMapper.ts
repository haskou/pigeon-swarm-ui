import type { PrimitiveOf } from '@haskou/value-objects';

import type { ConversationListEnvelope } from './ConversationListEnvelope';
import type { ConversationResource } from './ConversationResource';

import { Conversation } from '../../domain/Conversation';

function conversationPeerId(
  input: ConversationResource,
  id: string,
  fallbackPeer: string | undefined,
): string | undefined {
  if (input.type === 'group' || id.startsWith('group:')) return undefined;

  return input.peerIdentityId ?? fallbackPeer;
}

export class ConversationMapper {
  public list(value: unknown): ConversationResource[] {
    if (Array.isArray(value)) {
      return value.map((item) => this.normalize(item as ConversationResource));
    }

    const envelope = value as ConversationListEnvelope;
    const list =
      envelope.conversations ?? envelope.items ?? envelope.data ?? [];

    return list.map((item) => this.normalize(item));
  }

  public normalize(
    input: ConversationResource,
    fallbackPeer?: string,
  ): ConversationResource {
    const id = input.id?.trim() || input.conversationId?.trim();

    if (!id) throw new TypeError('Conversation resource id is required.');

    return {
      ...input,
      conversationId: input.conversationId ?? id,
      id,
      participantIdentityIds:
        input.participantIdentityIds ?? input.participantIds,
      peerIdentityId: conversationPeerId(input, id, fallbackPeer),
      title: input.title ?? input.name,
    };
  }

  public fromPrimitives(
    resource: ConversationResource,
    fallbackPeer?: string,
  ): Conversation {
    const normalized = this.normalize(resource, fallbackPeer);
    const type =
      normalized.type ??
      (normalized.id.startsWith('group:') ? 'group' : 'one-to-one');

    return Conversation.fromPrimitives({
      id: normalized.id,
      latestMessageAt: normalized.latestMessageAt,
      latestMessagePreview: normalized.latestMessagePreview,
      name: normalized.title,
      networkId: normalized.networkId,
      participantIds:
        normalized.participantIdentityIds ??
        normalized.participantIds ??
        normalized.participants ??
        [],
      peerIdentityId: conversationPeerId(
        normalized,
        normalized.id,
        fallbackPeer,
      ),
      type,
      unreadCount: normalized.unreadCount ?? 0,
    });
  }

  public toResource(conversation: Conversation): ConversationResource {
    const primitives: PrimitiveOf<Conversation> = conversation.toPrimitives();

    return {
      conversationId: primitives.id,
      id: primitives.id,
      latestMessageAt: primitives.latestMessageAt,
      latestMessagePreview: primitives.latestMessagePreview,
      name: primitives.name,
      networkId: primitives.networkId,
      participantIdentityIds: primitives.participantIds,
      participantIds: primitives.participantIds,
      peerIdentityId: primitives.peerIdentityId,
      title: primitives.name,
      type: primitives.type,
      unreadCount: primitives.unreadCount,
    };
  }
}
