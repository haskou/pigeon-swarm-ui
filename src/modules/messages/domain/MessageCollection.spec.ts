import type { ChatMessage } from '../../../shared/domain/pigeonResources.types';

import { MessageCollection } from './MessageCollection';

const message = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  attachments: [],
  authorIdentityId: 'identity-1',
  content: 'original',
  encrypted: false,
  id: 'message-1',
  mine: true,
  raw: { id: 'message-1', type: 'sent' },
  reactions: [],
  timestamp: 100,
  ...overrides,
});

describe(MessageCollection.name, () => {
  it('applies edit events to their target message without rendering the edit event', () => {
    const original = message({
      attachments: [
        {
          cid: 'bafy-attachment',
          contentType: 'image/png',
          filename: 'photo.png',
          size: 123,
        },
      ],
      linkPreview: {
        finalUrl: 'https://example.com',
        title: 'Original',
        url: 'https://example.com',
      },
    });
    const edit = message({
      content: 'edited',
      id: 'edit-message-1',
      linkPreview: undefined,
      raw: {
        id: 'edit-message-1',
        targetMessageId: 'message-1',
        type: 'edited',
      },
      timestamp: 200,
    });

    expect(MessageCollection.merge([original], [edit])).toEqual([
      {
        ...original,
        content: 'edited',
        edited: true,
        editedAt: 200,
        editMessageId: 'edit-message-1',
        linkPreview: undefined,
        mentions: undefined,
        originalContent: 'original',
      },
    ]);
  });

  it('keeps the first original content when applying multiple edit events', () => {
    const edited = MessageCollection.merge(
      [message()],
      [
        message({
          content: 'first edit',
          id: 'edit-message-1',
          raw: {
            id: 'edit-message-1',
            targetMessageId: 'message-1',
            type: 'edited',
          },
          timestamp: 200,
        }),
      ],
    );

    expect(
      MessageCollection.merge(edited, [
        message({
          content: 'second edit',
          id: 'edit-message-2',
          raw: {
            id: 'edit-message-2',
            targetMessageId: 'message-1',
            type: 'edited',
          },
          timestamp: 300,
        }),
      ])[0]?.originalContent,
    ).toBe('original');
  });

  it('preserves orphan edit events until their target message loads', () => {
    const edit = message({
      content: 'edited',
      id: 'edit-message-1',
      raw: {
        id: 'edit-message-1',
        targetMessageId: 'message-1',
        type: 'edited',
      },
      timestamp: 200,
    });

    expect(MessageCollection.merge([], [edit])).toEqual([edit]);
    expect(MessageCollection.merge([edit], [message()])).toEqual([
      {
        ...message(),
        content: 'edited',
        edited: true,
        editedAt: 200,
        editMessageId: 'edit-message-1',
        encrypted: false,
        linkPreview: undefined,
        mentions: undefined,
        originalContent: 'original',
      },
    ]);
  });
});
