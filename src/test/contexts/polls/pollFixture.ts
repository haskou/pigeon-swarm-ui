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
        firstIdentifier: 'conversation-a',
        secondIdentifier: undefined,
        type: 'group_conversation',
      },
    },
    id: 'poll-a',
    status: 'open',
    votes: [],
    ...overrides,
  });
}
