import type {
  ChatMessage,
  CommunityChannelThreadSummary,
} from '../../../../../shared/domain/pigeonResources.types';

import {
  hiddenCommunityThreadSummaryKeysFromMessages,
  threadRootLabelKey,
  visibleCommunityThreadSummaries,
} from '../../../../../contexts/communities/presentation/components/communityThreadState';

function communityThreadSummary(
  rootMessageId: string,
  input: Partial<CommunityChannelThreadSummary> = {},
): CommunityChannelThreadSummary {
  return {
    lastReplyAt: input.lastReplyAt ?? 1,
    lastReplyMessageId: input.lastReplyMessageId ?? `${rootMessageId}:reply`,
    replyCount: input.replyCount ?? 1,
    rootMessageId,
  };
}

function chatMessage(input: {
  id: string;
  replyToMessageId?: string;
  threadRootMessageId?: string;
}): ChatMessage {
  return {
    attachments: [],
    authorIdentityId: 'identity-1',
    content: input.id,
    encrypted: false,
    id: input.id,
    mine: false,
    raw: {
      id: input.id,
      replyToMessageId: input.replyToMessageId,
      type: 'sent',
    },
    reactions: [],
    replyToMessageId: input.replyToMessageId,
    threadRootMessageId: input.threadRootMessageId,
    timestamp: 1,
  };
}

describe(visibleCommunityThreadSummaries.name, () => {
  it('keeps thread summaries whose root was not rejected', () => {
    const thread = communityThreadSummary('root-message');

    expect(
      visibleCommunityThreadSummaries({
        channelId: 'channel-1',
        hiddenThreadRootLabelKeys: new Set(),
        threads: [thread],
      }),
    ).toEqual([thread]);
  });

  it('hides thread summaries whose root is known to be a normal reply', () => {
    const visibleThread = communityThreadSummary('thread-root-message');
    const normalReplySummary = communityThreadSummary('normal-reply-message');

    expect(
      visibleCommunityThreadSummaries({
        channelId: 'channel-1',
        hiddenThreadRootLabelKeys: new Set([
          threadRootLabelKey('channel-1', normalReplySummary.rootMessageId),
        ]),
        threads: [visibleThread, normalReplySummary],
      }),
    ).toEqual([visibleThread]);
  });
});

describe(hiddenCommunityThreadSummaryKeysFromMessages.name, () => {
  it('hides a thread summary when its last reply is a normal reply', () => {
    const summary = communityThreadSummary('root-message', {
      lastReplyMessageId: 'normal-reply',
    });

    expect(
      hiddenCommunityThreadSummaryKeysFromMessages({
        channelId: 'channel-1',
        messages: [
          chatMessage({
            id: 'normal-reply',
            replyToMessageId: 'root-message',
          }),
        ],
        threads: [summary],
      }),
    ).toEqual([threadRootLabelKey('channel-1', 'root-message')]);
  });

  it('keeps a thread summary when its last reply belongs to the thread root', () => {
    const summary = communityThreadSummary('root-message', {
      lastReplyMessageId: 'thread-reply',
    });

    expect(
      hiddenCommunityThreadSummaryKeysFromMessages({
        channelId: 'channel-1',
        messages: [
          chatMessage({
            id: 'thread-reply',
            replyToMessageId: 'root-message',
            threadRootMessageId: 'root-message',
          }),
        ],
        threads: [summary],
      }),
    ).toEqual([]);
  });

  it('does not decide until the last reply is loaded', () => {
    const summary = communityThreadSummary('root-message', {
      lastReplyMessageId: 'missing-reply',
    });

    expect(
      hiddenCommunityThreadSummaryKeysFromMessages({
        channelId: 'channel-1',
        messages: [chatMessage({ id: 'root-message' })],
        threads: [summary],
      }),
    ).toEqual([]);
  });
});
