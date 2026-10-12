import { describe, expect, it } from '@jest/globals';

import type { DirectMessageTimelineChange } from '../../../../../contexts/messages/infrastructure/mailbox/DirectMessageMailbox';
import type {
  ChatMessage,
  MessageResource,
} from '../../../../../shared/domain/pigeonResources.types';

import { applyDirectMessageTimelineChanges } from '../../../../../app/presentation/workspace/components/directMessageTimelineChanges';

const conversationId = 'conversation-1';

const message = (id: string, timestamp: number): ChatMessage => ({
  attachments: [],
  authorIdentityId: 'alice',
  content: `${id} body`,
  encrypted: false,
  id,
  mine: false,
  raw: { conversationId, id, type: 'sent' } as unknown as MessageResource,
  reactions: [],
  timestamp,
});

const edit = (
  id: string,
  targetMessageId: string,
  timestamp: number,
): ChatMessage => ({
  ...message(id, timestamp),
  content: `${id} edited body`,
  raw: {
    conversationId,
    id,
    targetMessageId,
    type: 'edited',
  } as unknown as MessageResource,
});

describe('applyDirectMessageTimelineChanges', () => {
  it('dedupes a replayed sent message by id', () => {
    const result = applyDirectMessageTimelineChanges(
      [message('message-1', 100)],
      [{ kind: 'message', message: message('message-1', 100) }],
    );

    expect(result.map((item) => item.id)).toEqual(['message-1']);
  });

  it('keeps one copy of a message repeated within one batch', () => {
    const changes: DirectMessageTimelineChange[] = [
      { kind: 'message', message: message('message-1', 100) },
      { kind: 'message', message: message('message-1', 100) },
    ];

    const result = applyDirectMessageTimelineChanges([], changes);

    expect(result.map((item) => item.id)).toEqual(['message-1']);
  });

  it('applies an edit to its target message', () => {
    const result = applyDirectMessageTimelineChanges(
      [message('message-1', 100)],
      [{ kind: 'edit', message: edit('edit-1', 'message-1', 200) }],
    );

    expect(result).toEqual([
      expect.objectContaining({
        content: 'edit-1 edited body',
        edited: true,
        editMessageId: 'edit-1',
        id: 'message-1',
      }),
    ]);
  });

  it('ignores an edit whose target is not in the timeline', () => {
    const current = [message('message-1', 100)];

    const result = applyDirectMessageTimelineChanges(current, [
      { kind: 'edit', message: edit('edit-1', 'missing-message', 200) },
    ]);

    expect(result).toEqual(current);
  });

  it('removes the message named by a removed change', () => {
    const result = applyDirectMessageTimelineChanges(
      [message('message-1', 100), message('message-2', 200)],
      [{ kind: 'removed', messageId: 'message-1' }],
    );

    expect(result.map((item) => item.id)).toEqual(['message-2']);
  });

  it('adds a reaction and then removes it', () => {
    const added = applyDirectMessageTimelineChanges(
      [message('message-1', 100)],
      [
        {
          action: 'add',
          authorId: 'bob',
          createdAt: 300,
          emoji: '👍',
          kind: 'reaction',
          messageId: 'message-1',
        },
      ],
    );

    expect(added[0].reactions).toEqual([
      { authorIdentityId: 'bob', createdAt: 300, emoji: '👍' },
    ]);

    const removed = applyDirectMessageTimelineChanges(added, [
      {
        action: 'remove',
        authorId: 'bob',
        createdAt: 400,
        emoji: '👍',
        kind: 'reaction',
        messageId: 'message-1',
      },
    ]);

    expect(removed[0].reactions).toEqual([]);
  });

  it('ignores a reaction on a message that is not in the timeline', () => {
    const current = [message('message-1', 100)];

    const result = applyDirectMessageTimelineChanges(current, [
      {
        action: 'add',
        authorId: 'bob',
        createdAt: 300,
        emoji: '👍',
        kind: 'reaction',
        messageId: 'missing-message',
      },
    ]);

    expect(result).toEqual(current);
  });

  it('applies ordered changes in sequence', () => {
    const result = applyDirectMessageTimelineChanges(
      [],
      [
        { kind: 'message', message: message('message-1', 100) },
        {
          action: 'add',
          authorId: 'bob',
          createdAt: 150,
          emoji: '👍',
          kind: 'reaction',
          messageId: 'message-1',
        },
        { kind: 'message', message: message('message-2', 200) },
        { kind: 'removed', messageId: 'message-1' },
      ],
    );

    expect(result.map((item) => item.id)).toEqual(['message-2']);
  });
});
