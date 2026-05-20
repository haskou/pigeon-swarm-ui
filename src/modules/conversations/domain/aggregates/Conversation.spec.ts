import { Timestamp } from '@haskou/value-objects';

import type { ConversationResource } from '../../../../shared/domain/pigeonResources.types';

import { ConversationParticipantId } from '../value-objects/ConversationParticipantId';
import { Conversation } from './Conversation';

const conversationResource = (
  overrides: Partial<ConversationResource> = {},
): ConversationResource => ({
  id: 'conversation-a',
  latestMessageAt: 100,
  networkId: 'network-a',
  participantIds: ['identity-a', 'identity-b'],
  ...overrides,
});

describe('Conversation', () => {
  it('resolves the one-to-one peer through participant value objects', () => {
    const conversation = Conversation.fromResource(conversationResource());

    const peer = conversation.peerIdentity(
      ConversationParticipantId.fromString('identity-a'),
    );

    expect(
      peer?.isEqual(ConversationParticipantId.fromString('identity-b')),
    ).toBe(true);
  });

  it('bumps activity only when the new timestamp is more recent', () => {
    const conversation = Conversation.fromResource(conversationResource());

    expect(conversation.bumpActivity(new Timestamp(50)).latestMessageAt).toBe(
      100,
    );
    expect(conversation.bumpActivity(new Timestamp(150)).latestMessageAt).toBe(
      150,
    );
  });
});
