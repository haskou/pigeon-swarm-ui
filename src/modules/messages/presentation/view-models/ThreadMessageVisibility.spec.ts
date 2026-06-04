import type { ChatMessage } from '../../../../shared/domain/pigeonResources.types';

import { ThreadMessageVisibility } from './ThreadMessageVisibility';

describe(ThreadMessageVisibility.name, () => {
  it('keeps marked thread messages in the thread panel', () => {
    const message = chatMessage({
      id: 'thread-message',
      replyToMessageId: 'root-message',
      threadRootMessageId: 'root-message',
    });

    expect(ThreadMessageVisibility.forRoot('root-message', [message])).toEqual([
      message,
    ]);
  });

  it('keeps legacy thread messages without reply preview', () => {
    const message = chatMessage({
      id: 'legacy-thread-message',
      replyToMessageId: 'root-message',
    });

    expect(ThreadMessageVisibility.forRoot('root-message', [message])).toEqual([
      message,
    ]);
  });

  it('excludes normal replies with a reply preview from the thread panel', () => {
    const reply = chatMessage({
      id: 'normal-reply',
      replyPreviewMessageId: 'root-message',
      replyToMessageId: 'root-message',
    });

    expect(ThreadMessageVisibility.forRoot('root-message', [reply])).toEqual(
      [],
    );
  });

  it('excludes messages marked for another thread root', () => {
    const message = chatMessage({
      id: 'other-thread-message',
      replyToMessageId: 'root-message',
      threadRootMessageId: 'other-root',
    });

    expect(ThreadMessageVisibility.forRoot('root-message', [message])).toEqual(
      [],
    );
  });
});

function chatMessage(input: {
  id: string;
  replyPreviewMessageId?: string;
  replyToMessageId?: string;
  threadRootMessageId?: string;
}): ChatMessage {
  return {
    attachments: [],
    authorIdentityId: 'identity-id',
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
    replyPreview: input.replyPreviewMessageId
      ? {
          authorIdentityId: 'identity-id',
          content: 'Root',
          messageId: input.replyPreviewMessageId,
        }
      : undefined,
    replyToMessageId: input.replyToMessageId,
    threadRootMessageId: input.threadRootMessageId,
    timestamp: 1,
  };
}
