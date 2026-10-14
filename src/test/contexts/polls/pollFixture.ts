import type { PrimitiveOf } from '@haskou/value-objects';

import { Poll } from '../../../contexts/polls/domain/Poll';

export function pollFixture(overrides: Partial<PrimitiveOf<Poll>> = {}): Poll {
  return Poll.fromPrimitives({
    createdAt: 100,
    definition: {
      allowsMultipleVotes: false,
      creatorIdentityId: 'identity-a',
      expiresAt: null,
      options: [
        { id: 'option-a', text: 'A' },
        { id: 'option-b', text: 'B' },
      ],
      question: 'Choose?',
      scope: {
        firstIdentifier: 'community-a',
        secondIdentifier: 'channel-a',
        type: 'community_channel',
      },
    },
    id: 'poll-a',
    status: 'open',
    votes: [],
    ...overrides,
  });
}
