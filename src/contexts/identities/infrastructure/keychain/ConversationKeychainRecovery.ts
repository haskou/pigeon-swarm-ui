import { SHA256Hash } from '@haskou/pigeon-swarm-crypto';

import type {
  ConversationResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { ConversationKeyEntry } from './ConversationKeyEntry';

import { ConversationIdFactory } from '../../../conversations/domain/ConversationIdFactory';
import { ConversationNetworkId } from '../../../conversations/domain/value-objects/ConversationNetworkId';
import { ConversationParticipantId } from '../../../conversations/domain/value-objects/ConversationParticipantId';

export class ConversationKeychainRecovery {
  public constructor(private readonly ids: ConversationIdFactory) {}

  private matchesLegacyEntry(
    entry: ConversationKeyEntry | undefined,
    legacyId: string,
    peer: ConversationParticipantId,
  ): entry is ConversationKeyEntry {
    return Boolean(
      entry &&
      entry.kind === 'conversation' &&
      entry.conversationId === legacyId &&
      entry.peerIdentityId &&
      peer.isEqual(ConversationParticipantId.fromString(entry.peerIdentityId)),
    );
  }

  private recoverEntry(
    session: Session,
    conversation: ConversationResource,
  ): ConversationKeyEntry | undefined {
    if (
      !conversation.networkId ||
      !conversation.peerIdentityId ||
      conversation.type === 'group' ||
      session.keychain.conversations[conversation.id]
    )
      return undefined;

    const owner = ConversationParticipantId.fromString(session.identity.id);
    const peer = ConversationParticipantId.fromString(
      conversation.peerIdentityId,
    );
    const network = ConversationNetworkId.fromString(conversation.networkId);

    if (!this.ids.create(owner, peer, network).hasValue(conversation.id))
      return undefined;

    const [first, second] = owner.orderedWith(peer);
    const legacyId = `one-to-one:${SHA256Hash.from(`${second.toString()}:${first.toString()}:${network.toString()}`).toString()}`;
    const entry = session.keychain.conversations[legacyId];

    if (!this.matchesLegacyEntry(entry, legacyId, peer)) return undefined;

    return { ...entry, conversationId: conversation.id };
  }

  public recover(
    session: Session,
    conversations: ConversationResource[],
  ): Session {
    const recovered: Record<string, ConversationKeyEntry> = {};

    for (const conversation of conversations) {
      const entry = this.recoverEntry(session, conversation);

      if (entry) recovered[conversation.id] = entry;
    }

    if (Object.keys(recovered).length === 0) return session;

    return {
      ...session,
      keychain: {
        ...session.keychain,
        conversations: { ...session.keychain.conversations, ...recovered },
      },
    };
  }
}
