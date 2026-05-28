import type {
  ChatMessage,
  ConversationResource,
} from '../../../shared/domain/pigeonResources.types';

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
const conversation = (
  overrides: Partial<ConversationResource> = {},
): ConversationResource => ({
  id: 'conversation-1',
  latestMessageAt: 100,
  networkId: 'network-1',
  ...overrides,
});

describe(MessageCollection.name, () => {
  it('finds the last delivered message without returning pending failures', () => {
    expect(
      MessageCollection.lastDelivered([
        message({ id: 'message-1', timestamp: 100 }),
        message({
          deliveryStatus: 'pending',
          id: 'message-2',
          timestamp: 200,
        }),
        message({
          deliveryStatus: 'failed',
          id: 'message-3',
          timestamp: 300,
        }),
      ])?.id,
    ).toBe('message-1');

    expect(
      MessageCollection.lastDelivered([
        message({ deliveryStatus: 'pending', id: 'message-1' }),
      ]),
    ).toBeUndefined();
  });

  it('finds the latest delivered timestamp independently from list order', () => {
    expect(
      MessageCollection.latestDeliveredTimestamp([
        message({ id: 'message-1', timestamp: 300 }),
        message({ id: 'message-2', timestamp: 100 }),
        message({
          deliveryStatus: 'pending',
          id: 'message-3',
          timestamp: 500,
        }),
        message({ id: 'message-4', timestamp: 200 }),
      ]),
    ).toBe(300);
  });

  it('detects whether loaded messages already include the conversation latest message', () => {
    expect(
      MessageCollection.isCaughtUpWithConversation(
        [message({ timestamp: 100 })],
        conversation({ latestMessageAt: 100 }),
      ),
    ).toBe(true);
    expect(
      MessageCollection.isCaughtUpWithConversation(
        [message({ timestamp: 100 })],
        conversation({ latestMessageAt: 200 }),
      ),
    ).toBe(false);
    expect(
      MessageCollection.isCaughtUpWithConversation(
        [message({ deliveryStatus: 'pending', timestamp: 300 })],
        conversation({ latestMessageAt: 200 }),
      ),
    ).toBe(false);
  });

  it('treats conversations without latest message metadata as caught up', () => {
    expect(
      MessageCollection.isCaughtUpWithConversation(
        [],
        conversation({ latestMessageAt: undefined }),
      ),
    ).toBe(true);
  });

  it('detects whether a latest-message probe matches the loaded timeline', () => {
    expect(
      MessageCollection.hasSameLatestDeliveredMessage(
        [
          message({ id: 'message-1', timestamp: 100 }),
          message({ id: 'message-2', timestamp: 200 }),
        ],
        [message({ id: 'message-2', timestamp: 200 })],
      ),
    ).toBe(true);
    expect(
      MessageCollection.hasSameLatestDeliveredMessage(
        [message({ id: 'message-1', timestamp: 100 })],
        [message({ id: 'message-2', timestamp: 200 })],
      ),
    ).toBe(false);
    expect(MessageCollection.hasSameLatestDeliveredMessage([], [])).toBe(true);
  });

  it('treats changed latest message content as not caught up', () => {
    expect(
      MessageCollection.hasSameLatestDeliveredMessage(
        [
          message({
            content: 'before',
            edited: false,
            id: 'message-1',
            timestamp: 100,
          }),
        ],
        [
          message({
            content: 'after',
            edited: true,
            editedAt: 120,
            id: 'message-1',
            raw: { editedAt: 120, id: 'message-1', type: 'sent' },
            timestamp: 100,
          }),
        ],
      ),
    ).toBe(false);
  });

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
