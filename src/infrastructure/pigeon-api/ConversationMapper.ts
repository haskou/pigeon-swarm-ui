import type { ConversationResource } from '../../domain/types';

import { ConversationIdFactory } from '../../domain/conversations/ConversationIdFactory';

type ConversationListEnvelope = {
  conversations?: ConversationResource[];
  data?: ConversationResource[];
  items?: ConversationResource[];
};

function conversationId(
  input: ConversationResource,
  fallbackPeer: string | undefined,
  idFactory: ConversationIdFactory,
): string {
  return (
    input.id ??
    input.conversationId ??
    idFactory.create('', fallbackPeer ?? 'unknown')
  );
}

function conversationPeerId(
  input: ConversationResource,
  id: string,
  fallbackPeer: string | undefined,
): string | undefined {
  if (input.type === 'group' || id.startsWith('group:')) return undefined;

  return input.peerIdentityId ?? fallbackPeer;
}

export class ConversationMapper {
  private readonly idFactory: ConversationIdFactory;

  public constructor(
    idFactory: ConversationIdFactory = new ConversationIdFactory(),
  ) {
    this.idFactory = idFactory;
  }

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
    const id = conversationId(input, fallbackPeer, this.idFactory);

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
}
