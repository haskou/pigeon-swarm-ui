import { describe, expect, it } from '@jest/globals';

import type { ConversationThread } from '../../../../../app/presentation/workspace/components/ConversationThread';
import type { ChatMessage } from '../../../../../contexts/messages/domain/ChatMessage';

import { syncConversationThread } from '../../../../../app/presentation/workspace/components/syncConversationThread';

const root = { content: 'root', id: 'root-1' } as unknown as ChatMessage;
const editedRoot = { ...root, content: 'edited root' } as ChatMessage;
const reply = {
  content: 'reply',
  id: 'reply-1',
  threadRootMessageId: 'root-1',
} as unknown as ChatMessage;
const otherReply = {
  content: 'elsewhere',
  id: 'reply-2',
  threadRootMessageId: 'root-2',
} as unknown as ChatMessage;
const thread: ConversationThread = {
  draft: 'draft',
  editingMessage: null,
  error: null,
  messages: [],
  replyTarget: null,
  root,
  state: 'ready',
};

describe('syncConversationThread', () => {
  it('takes the root and its replies from the timeline', () => {
    expect(
      syncConversationThread(thread, [editedRoot, reply, otherReply]),
    ).toEqual({ ...thread, messages: [reply], root: editedRoot });
  });

  it('closes the thread once its root leaves the timeline', () => {
    expect(syncConversationThread(thread, [reply, otherReply])).toBeNull();
  });
});
