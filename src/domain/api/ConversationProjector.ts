import type { ConversationResource } from '../types';

import { ConversationIdFactory } from './ConversationIdFactory';

type ConversationListEnvelope = {
  conversations?: ConversationResource[];
  data?: ConversationResource[];
  items?: ConversationResource[];
};

export class ConversationProjector {
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
    const id =
      input.id ??
      input.conversationId ??
      this.idFactory.create('', fallbackPeer ?? 'unknown');

    return {
      ...input,
      conversationId: input.conversationId ?? id,
      id,
      participantIdentityIds:
        input.participantIdentityIds ?? input.participantIds,
      peerIdentityId: input.peerIdentityId ?? fallbackPeer,
    };
  }
}
