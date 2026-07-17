import type {
  ChatMessage,
  PollResource,
} from '../../../../../shared/domain/pigeonResources.types';

import { communityMessageIdentityIds } from '../../../../../contexts/communities/presentation/components/communityMessageIdentityIds';

function chatMessage(
  overrides: Partial<ChatMessage> & Pick<ChatMessage, 'authorIdentityId'>,
): ChatMessage {
  return {
    attachments: [],
    content: 'message',
    encrypted: false,
    id: 'message-id',
    mine: false,
    raw: {
      id: 'message-id',
      type: 'sent',
    },
    reactions: [],
    timestamp: 1,
    ...overrides,
  };
}

function poll(
  overrides: Partial<PollResource> & Pick<PollResource, 'creatorIdentityId'>,
): PollResource {
  return {
    allowsMultipleVotes: false,
    createdAt: 1,
    id: 'poll-id',
    options: [],
    question: 'question',
    scope: {
      channelId: 'channel-id',
      communityId: 'community-id',
      networkId: 'network-id',
      type: 'community_channel',
    },
    status: 'open',
    votes: [],
    ...overrides,
  };
}

describe('communityMessageIdentityIds', () => {
  it('collects historical authors from messages, replies, reactions, and polls', () => {
    const message = chatMessage({
      authorIdentityId: 'author-1',
      poll: poll({
        creatorIdentityId: 'poll-creator',
        votes: [
          {
            createdAt: 1,
            optionIds: ['option-id'],
            voterIdentityId: 'poll-voter',
          },
        ],
      }),
      reactions: [
        {
          authorIdentityId: 'reaction-author',
          createdAt: 1,
          emoji: '+1',
        },
        { authorIdentityId: 'author-1', createdAt: 1, emoji: '+1' },
      ],
      replyPreview: {
        authorIdentityId: 'reply-author',
        messageId: 'reply-message',
      },
    });
    const externalPoll = poll({
      creatorIdentityId: 'external-poll-creator',
      votes: [
        {
          createdAt: 1,
          optionIds: ['option-id'],
          voterIdentityId: 'external-poll-voter',
        },
      ],
    });

    expect(
      communityMessageIdentityIds({
        messages: [message],
        polls: [externalPoll],
      }),
    ).toEqual([
      'author-1',
      'reply-author',
      'reaction-author',
      'poll-creator',
      'poll-voter',
      'external-poll-creator',
      'external-poll-voter',
    ]);
  });
});
