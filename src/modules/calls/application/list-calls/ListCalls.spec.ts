import type { Session } from '../../../../shared/domain/pigeonResources.types';
import type { CallResource } from '../../domain/callSession.types';
import type { ListCallsPort } from '../ports/ListCallsPort';

import { ListCalls } from './ListCalls';
import { ListCallsMessage } from './messages/ListCallsMessage';

describe(ListCalls.name, () => {
  it('lists calls for the session carried by the message', async () => {
    const call = {
      createdAt: 1,
      creatorIdentityId: 'identity-1',
      id: 'call-1',
      networkId: 'network-1',
      participantIds: ['identity-1'],
      participants: [{ identityId: 'identity-1', status: 'joined' }],
      scope: { conversationId: 'conversation-1', type: 'conversation' },
      status: 'active',
    } satisfies CallResource;
    const port: ListCallsPort = {
      list: jest.fn().mockResolvedValue([call]),
    };
    const session = { identity: { id: 'identity-1' } } as Session;
    const message = new ListCallsMessage(session);

    await expect(new ListCalls(port).list(message)).resolves.toEqual([call]);

    expect(port.list).toHaveBeenCalledWith(message);
    expect(message.getSession()).toBe(session);
  });
});
