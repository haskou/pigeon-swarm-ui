import type { ChatMessage } from '../../../../../shared/domain/pigeonResources.types';

import { MessageTimelineEntries } from '../../../../../contexts/messages/presentation/view-models/MessageTimelineEntries';

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

  it('keeps replies visible when no thread summary exists for their root', () => {
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

    const entries = MessageTimelineEntries.build([root, normalReply], [], []);

    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      id: `message:${root.id}`,
      threadSummary: undefined,
      type: 'message',
    });
    expect(entries[1]).toMatchObject({
      id: `message:${normalReply.id}`,
      replyMessage: root,
      threadSummary: undefined,
      type: 'message',
    });
  });

  it('ignores stale thread summaries that point to visible normal replies', () => {
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

    const entries = MessageTimelineEntries.build(
      [root, normalReply],
      [],
      [
        {
          count: 1,
          lastMessage: normalReply,
          rootMessageId: root.id,
        },
      ],
    );

    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      id: `message:${root.id}`,
      threadSummary: undefined,
      type: 'message',
    });
    expect(entries[1]).toMatchObject({
      id: `message:${normalReply.id}`,
      replyMessage: root,
      threadSummary: undefined,
      type: 'message',
    });
  });

  it('hides marked thread messages even when no thread summary is loaded', () => {
    const root = chatMessage({
      content: 'Root',
      id: 'root-message',
      timestamp: 1,
    });
    const threadReply = chatMessage({
      content: 'Thread reply',
      id: 'thread-reply',
      rawReplyToMessageId: root.id,
      threadRootMessageId: root.id,
      timestamp: 2,
    });

    const entries = MessageTimelineEntries.build([root, threadReply], [], []);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      id: `message:${root.id}`,
      threadSummary: undefined,
      type: 'message',
    });
  });

  it('keeps marked messages visible when threads are disabled', () => {
    const root = chatMessage({
      content: 'Root',
      id: 'root-message',
      timestamp: 1,
    });
    const markedMessage = chatMessage({
      content: 'Message in a one-to-one conversation',
      id: 'marked-message',
      rawReplyToMessageId: root.id,
      threadRootMessageId: root.id,
      timestamp: 2,
    });

    const entries = MessageTimelineEntries.build(
      [root, markedMessage],
      [],
      [],
      false,
    );

    expect(entries).toHaveLength(2);
    expect(entries[1]).toMatchObject({
      id: `message:${markedMessage.id}`,
      replyMessage: root,
    });
  });

  it('hides messages that belong to explicit thread summaries', () => {
    const root = chatMessage({
      content: 'Root',
      id: 'root-message',
      timestamp: 1,
    });
    const threadReply = chatMessage({
      content: 'Thread reply',
      id: 'thread-reply',
      rawReplyToMessageId: root.id,
      threadRootMessageId: root.id,
      timestamp: 2,
    });

    const entries = MessageTimelineEntries.build(
      [root, threadReply],
      [],
      [
        {
          count: 1,
          lastMessage: threadReply,
          rootMessageId: root.id,
        },
      ],
    );

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      id: `message:${root.id}`,
      threadSummary: {
        count: 1,
        lastMessage: threadReply,
        rootMessageId: root.id,
      },
      type: 'message',
    });
  });

  it('hides thread summary last messages even when they are missing the thread marker', () => {
    const root = chatMessage({
      content: 'Root',
      id: 'root-message',
      timestamp: 1,
    });
    const threadReply = chatMessage({
      content: 'Thread reply',
      id: 'thread-reply',
      rawReplyToMessageId: root.id,
      replyPreviewMessageId: 'thread-parent-message',
      timestamp: 2,
    });

    const entries = MessageTimelineEntries.build(
      [root, threadReply],
      [],
      [
        {
          count: 1,
          lastMessage: threadReply,
          rootMessageId: root.id,
        },
      ],
    );

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      id: `message:${root.id}`,
      threadSummary: {
        count: 1,
        lastMessage: threadReply,
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
  replyPreviewMessageId?: string;
  threadRootMessageId?: string;
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
    replyPreview: input.replyPreviewMessageId
      ? {
          authorIdentityId: 'identity-id',
          content: 'Reply parent',
          messageId: input.replyPreviewMessageId,
        }
      : undefined,
    threadRootMessageId: input.threadRootMessageId,
    timestamp: input.timestamp,
  };
}
