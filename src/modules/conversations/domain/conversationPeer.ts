import type {
  ConversationResource,
  LocalKeychain,
} from '../../../shared/domain/pigeonResources.types';

import { Conversation } from './aggregates/conversation';
import { ConversationParticipantId } from './value-objects/conversationParticipantId';

export class ConversationPeer {
  public static identityId(
    conversation: ConversationResource,
    currentIdentityId: string,
    keychain?: LocalKeychain,
  ): string | undefined {
    return Conversation.fromResource(conversation)
      .peerIdentity(
        ConversationParticipantId.fromString(currentIdentityId),
        keychain,
      )
      ?.toString();
  }
}
