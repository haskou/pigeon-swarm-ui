import type { ListConversationsPort } from '../../../../../contexts/conversations/application/list-conversations/ListConversationsPort';
import type { Session } from '../../../../../shared/domain/pigeonResources.types';

import { ListConversations } from '../../../../../contexts/conversations/application/list-conversations/ListConversations';
import { ListConversationsMessage } from '../../../../../contexts/conversations/application/list-conversations/messages/ListConversationsMessage';

describe(ListConversations.name, () => {
  it('orders conversations by latest activity without loading message history', async () => {
    const session = { identity: { id: 'me' } } as unknown as Session;
    const loadMessages = jest.fn();
    const gateway = {
      listConversations: jest.fn().mockResolvedValue([
        { id: 'older', latestMessageAt: 10, networkId: 'net' },
        { id: 'newer', latestMessageAt: 20, networkId: 'net' },
      ]),
      loadMessages,
    } as unknown as ListConversationsPort;

    await expect(
      new ListConversations(gateway).list(
        new ListConversationsMessage(session),
      ),
    ).resolves.toEqual([
      { id: 'newer', latestMessageAt: 20, networkId: 'net' },
      { id: 'older', latestMessageAt: 10, networkId: 'net' },
    ]);
    expect(loadMessages).not.toHaveBeenCalled();
  });

  it('recovers latest activity for conversations without timestamps', async () => {
    const session = { identity: { id: 'me' } } as unknown as Session;
    const loadMessages = jest.fn().mockResolvedValue({
      messages: [{ id: 'message-1', raw: { createdAt: 30 } }],
    });
    const gateway = {
      listConversations: jest.fn().mockResolvedValue([
        { id: 'with-activity', latestMessageAt: 20, networkId: 'net' },
        { id: 'without-timestamp', networkId: 'net' },
      ]),
      loadMessages,
    } as unknown as ListConversationsPort;

    await expect(
      new ListConversations(gateway).list(
        new ListConversationsMessage(session),
      ),
    ).resolves.toEqual([
      { id: 'without-timestamp', latestMessageAt: 30, networkId: 'net' },
      { id: 'with-activity', latestMessageAt: 20, networkId: 'net' },
    ]);
    expect(loadMessages).toHaveBeenCalledTimes(1);
    expect(loadMessages).toHaveBeenCalledWith(
      session,
      'without-timestamp',
      null,
      { limit: 1 },
    );
  });

  it('keeps conversations without activity timestamps when legacy recovery has no messages', async () => {
    const session = { identity: { id: 'me' } } as unknown as Session;
    const loadMessages = jest.fn().mockResolvedValue({ messages: [] });
    const gateway = {
      listConversations: jest.fn().mockResolvedValue([
        { id: 'with-activity', latestMessageAt: 10, networkId: 'net' },
        { id: 'without-timestamp', networkId: 'net' },
      ]),
      loadMessages,
    } as unknown as ListConversationsPort;

    await expect(
      new ListConversations(gateway).list(
        new ListConversationsMessage(session),
      ),
    ).resolves.toEqual([
      { id: 'with-activity', latestMessageAt: 10, networkId: 'net' },
      { id: 'without-timestamp', networkId: 'net' },
    ]);
    expect(loadMessages).toHaveBeenCalledTimes(1);
  });
});
