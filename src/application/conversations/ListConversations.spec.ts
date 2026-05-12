import type { Session } from '../../domain/types';
import type { PigeonApiGateway } from '../../infrastructure/pigeon-api/PigeonApiGateway';

import { ListConversations } from './ListConversations';

describe(ListConversations.name, () => {
  it('orders conversations by latest loaded message when the list has no activity timestamp', async () => {
    const session = { identity: { id: 'me' } } as unknown as Session;
    const gateway = {
      listConversations: jest.fn().mockResolvedValue([
        { id: 'older', networkId: 'net' },
        { id: 'newer', networkId: 'net' },
      ]),
      loadMessages: jest.fn((_session: Session, conversationId: string) =>
        Promise.resolve(
          conversationId === 'newer'
            ? { messages: [{ id: '2', timestamp: 20 }] }
            : { messages: [{ id: '1', timestamp: 10 }] },
        ),
      ),
    } as unknown as PigeonApiGateway;

    await expect(
      new ListConversations(gateway).execute(session),
    ).resolves.toEqual([
      { id: 'newer', latestMessageAt: 20, networkId: 'net' },
      { id: 'older', latestMessageAt: 10, networkId: 'net' },
    ]);
  });

  it('keeps conversations without readable messages in the list', async () => {
    const session = { identity: { id: 'me' } } as unknown as Session;
    const gateway = {
      listConversations: jest.fn().mockResolvedValue([
        { id: 'with-key', networkId: 'net' },
        { id: 'without-key', networkId: 'net' },
      ]),
      loadMessages: jest.fn((_session: Session, conversationId: string) => {
        if (conversationId === 'without-key') {
          return Promise.reject(new Error('missing key'));
        }

        return Promise.resolve({ messages: [{ id: '1', timestamp: 10 }] });
      }),
    } as unknown as PigeonApiGateway;

    await expect(
      new ListConversations(gateway).execute(session),
    ).resolves.toEqual([
      { id: 'with-key', latestMessageAt: 10, networkId: 'net' },
      { id: 'without-key', networkId: 'net' },
    ]);
  });
});
