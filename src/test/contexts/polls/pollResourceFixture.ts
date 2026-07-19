import type { PollResource } from '../../../contexts/polls/infrastructure/http/resources/PollResource';

export function pollResourceFixture(
  overrides: Partial<PollResource> = {},
): PollResource {
  return {
    allowsMultipleVotes: false,
    createdAt: 100,
    creatorIdentityId: 'identity-a',
    expiresAt: null,
    id: 'poll-a',
    options: [
      { id: 'option-a', text: 'A' },
      { id: 'option-b', text: 'B' },
    ],
    question: 'Choose?',
    scope: {
      conversationId: 'conversation-a',
      networkId: 'network-a',
      type: 'group_conversation',
    },
    status: 'open',
    votes: [],
    ...overrides,
  };
}
