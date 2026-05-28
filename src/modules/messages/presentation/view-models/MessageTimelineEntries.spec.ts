import type { ChatMessage } from '../../../../shared/domain/pigeonResources.types';

import { MessageTimelineEntries } from './MessageTimelineEntries';

describe(MessageTimelineEntries.name, () => {
  it('keeps raw thread replies out of the root timeline', () => {
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

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      id: `message:${root.id}`,
      threadSummary: {
        count: 1,
        lastMessage: editedReply,
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
