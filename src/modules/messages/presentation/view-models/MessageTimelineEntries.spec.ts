import type { ChatMessage } from '../../../../shared/domain/pigeonResources.types';

import { MessageTimelineEntries } from './MessageTimelineEntries';

describe(MessageTimelineEntries.name, () => {
  it('keeps visible replies in the root timeline', () => {
    const root = chatMessage({
      content: 'Root',
      id: 'root-message',
      timestamp: 1,
    });
    const editedReply = chatMessage({
      content: 'Edited reply',
      id: 'thread-reply',
      rawReplyToMessageId: root.id,
      timestamp: 2,
    });

    const entries = MessageTimelineEntries.build([root, editedReply], []);

    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      id: `message:${root.id}`,
      threadSummary: undefined,
      type: 'message',
    });
    expect(entries[1]).toMatchObject({
      id: `message:${editedReply.id}`,
      replyMessage: root,
      threadSummary: undefined,
      type: 'message',
    });
  });

  it('uses explicit thread summaries instead of inferring them from replies', () => {
    const root = chatMessage({
      content: 'Root',
      id: 'root-message',
      timestamp: 1,
    });
    const normalReply = chatMessage({
      content: 'Normal reply',
      id: 'normal-reply',
      rawReplyToMessageId: root.id,
      timestamp: 2,
    });

    const entries = MessageTimelineEntries.build([root, normalReply], [], [
      {
        count: 4,
        rootMessageId: root.id,
      },
    ]);

    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      id: `message:${root.id}`,
      threadSummary: {
        count: 4,
        rootMessageId: root.id,
      },
      type: 'message',
    });
  });
});

function chatMessage(input: {
  content: string;
  id: string;
  rawReplyToMessageId?: string;
  timestamp: number;
}): ChatMessage {
  return {
    attachments: [],
    authorIdentityId: 'identity-id',
    content: input.content,
    encrypted: false,
    id: input.id,
    mine: false,
    raw: {
      id: input.id,
      replyToMessageId: input.rawReplyToMessageId,
      type: 'sent',
    },
    reactions: [],
    timestamp: input.timestamp,
  };
}
