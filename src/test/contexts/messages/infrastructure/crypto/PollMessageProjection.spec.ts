import type { MessageResource } from '../../../../../shared/domain/pigeonResources.types';

import { PollMessageProjection } from '../../../../../contexts/messages/infrastructure/crypto/PollMessageProjection';

const pollResource = {
  allowsMultipleVotes: false,
  createdAt: 100,
  creatorIdentityId: 'identity-a',
  id: 'poll-a',
  options: [],
  question: 'Ship it?',
  scope: { conversationId: 'conversation-a', type: 'conversation' },
  status: 'open',
  type: 'poll',
  votes: [],
} as unknown as MessageResource;

describe(PollMessageProjection.name, () => {
  it('projects a poll-shaped message resource into the timeline', () => {
    expect(
      PollMessageProjection.toChatMessage(pollResource, 'identity-a'),
    ).toMatchObject({
      authorIdentityId: 'identity-a',
      id: 'poll-a',
      kind: 'poll',
      mine: true,
      timestamp: 100,
    });
  });

  it('rejects resources without a complete poll', () => {
    expect(
      PollMessageProjection.fromMessageResource({
        id: 'message-a',
        type: 'sent',
      } as MessageResource),
    ).toBeNull();
  });
});
