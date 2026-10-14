import { describe, expect, it } from '@jest/globals';

import type { ChatMessage } from '../../../../../contexts/messages/domain/ChatMessage';
import type { DirectMessageTimelineChange } from '../../../../../contexts/messages/domain/DirectMessageTimelineChange';
import type { MessageResource } from '../../../../../contexts/messages/infrastructure/http/MessageResource';

import { applyDirectMessageTimelineChanges } from '../../../../../app/presentation/workspace/components/applyDirectMessageTimelineChanges';
import { MessageReactionUpdater } from '../../../../../contexts/messages/presentation/view-models/MessageReactionUpdater';

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

const reactionChange = (
  action: 'add' | 'remove',
  createdAt: number,
): DirectMessageTimelineChange => ({
  action,
  authorId: 'bob',
  createdAt,
  emoji: '👍',
  kind: 'reaction',
  messageId: 'message-1',
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

  it('leaves the timeline unchanged for a read change', () => {
    const current = [message('message-1', 100)];

    const result = applyDirectMessageTimelineChanges(current, [
      { kind: 'read', messageId: 'message-1' },
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

  it('does not resurrect a reaction when an older add replays after a newer remove', () => {
    const removed = applyDirectMessageTimelineChanges(
      [message('message-1', 100)],
      [reactionChange('add', 300), reactionChange('remove', 400)],
    );

    const replayed = applyDirectMessageTimelineChanges(removed, [
      reactionChange('add', 300),
    ]);

    expect(replayed[0].reactions).toEqual([]);
  });

  it('keeps a reaction absent when an older add follows a newer remove in one batch', () => {
    const result = applyDirectMessageTimelineChanges(
      [message('message-1', 100)],
      [reactionChange('remove', 400), reactionChange('add', 300)],
    );

    expect(result[0].reactions).toEqual([]);
  });

  it('does not resurrect a reaction when an older add arrives after a newer legacy remove', () => {
    const added = MessageReactionUpdater.update(
      message('message-1', 100),
      'bob',
      '👍',
      'add',
      300,
    );
    const legacyRemoved = MessageReactionUpdater.update(
      added,
      'bob',
      '👍',
      'remove',
      400,
    );

    const result = applyDirectMessageTimelineChanges(
      [legacyRemoved],
      [reactionChange('add', 300)],
    );

    expect(result[0].reactions).toEqual([]);
  });

  it('applies a newer add after a remove', () => {
    const result = applyDirectMessageTimelineChanges(
      [message('message-1', 100)],
      [
        reactionChange('add', 300),
        reactionChange('remove', 400),
        reactionChange('add', 500),
      ],
    );

    expect(result[0].reactions).toEqual([
      { authorIdentityId: 'bob', createdAt: 500, emoji: '👍' },
    ]);
  });

  it('keeps a removed reaction removed when a replayed sent message merges over it', () => {
    const removed = applyDirectMessageTimelineChanges(
      [message('message-1', 100)],
      [reactionChange('add', 300), reactionChange('remove', 400)],
    );

    const replayed = applyDirectMessageTimelineChanges(removed, [
      { kind: 'message', message: message('message-1', 100) },
      reactionChange('add', 300),
    ]);

    expect(replayed[0].reactions).toEqual([]);
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
