import type {
  ChatMessage,
  CommunityTextChannel,
} from '../../../../../shared/domain/pigeonResources.types';

import { CommunityThreadRootLabels } from '../../../../../contexts/communities/presentation/view-models/CommunityThreadRootLabels';

function chatMessage(overrides: Partial<ChatMessage>): ChatMessage {
  return {
    attachmentExternalIdentifiers: [],
    authorId: 'identity-1',
    content: 'Message',
    createdAt: 1,
    id: 'message-1',
    raw: {},
    reactions: [],
    type: 'sent',
    ...overrides,
  } as ChatMessage;
}

describe('CommunityThreadRootLabels', () => {
  it('finds each unresolved root once', () => {
    const channels = [
      {
        id: 'channel-1',
        threads: [
          { rootMessageId: 'root-1' },
          { rootMessageId: 'root-1' },
          { rootMessageId: 'root-2' },
        ],
      },
    ] as CommunityTextChannel[];

    expect(
      CommunityThreadRootLabels.missing(
        channels,
        { 'root-1': 'Known root' },
        new Set(),
      ),
    ).toEqual([{ channelId: 'channel-1', rootMessageIds: ['root-2'] }]);
  });

  it('finds roots supplied by a refreshed channel summary', () => {
    const refreshedChannels = [
      {
        id: 'channel-1',
        threads: [{ rootMessageId: 'cached-root' }],
      },
    ] as CommunityTextChannel[];

    expect(
      CommunityThreadRootLabels.missing(refreshedChannels, {}, new Set()),
    ).toEqual([{ channelId: 'channel-1', rootMessageIds: ['cached-root'] }]);
  });

  it('separates thread roots from ordinary replies', () => {
    const messages = [
      chatMessage({ id: 'thread-root' }),
      chatMessage({ id: 'ordinary-reply', replyToMessageId: 'message-1' }),
    ];

    expect(
      CommunityThreadRootLabels.classify(
        'channel-1',
        messages,
        new Set(['thread-root', 'ordinary-reply']),
      ),
    ).toEqual({
      hiddenKeys: ['channel-1:ordinary-reply'],
      labels: { 'thread-root': 'Message' },
      resolvedMessageIds: ['thread-root', 'ordinary-reply'],
    });
  });
});
