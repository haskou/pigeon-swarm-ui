import type { Session } from '../../../../shared/domain/pigeonResources.types';
import type { ListConversationsPort } from '../ports/ListConversationsPort';

import { ListConversations } from './ListConversations';
import { ListConversationsMessage } from './messages/ListConversationsMessage';

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

  it('keeps conversations without activity timestamps without loading messages', async () => {
    const session = { identity: { id: 'me' } } as unknown as Session;
    const loadMessages = jest.fn();
    const gateway = {
      listConversations: jest.fn().mockResolvedValue([
        { id: 'with-activity', latestMessageAt: 10, networkId: 'net' },
        { id: 'without-key', networkId: 'net' },
      ]),
      loadMessages,
    } as unknown as ListConversationsPort;

    await expect(
      new ListConversations(gateway).list(
        new ListConversationsMessage(session),
      ),
    ).resolves.toEqual([
      { id: 'with-activity', latestMessageAt: 10, networkId: 'net' },
      { id: 'without-key', networkId: 'net' },
    ]);
    expect(loadMessages).not.toHaveBeenCalled();
  });
});
