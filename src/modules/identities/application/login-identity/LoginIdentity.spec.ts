import type { LoginResult } from '../../../../shared/domain/pigeonResources.types';
import type { LoginIdentityPort } from '../ports/LoginIdentityPort';

import { LoginIdentity } from './LoginIdentity';
import { LoginIdentityMessage } from './messages/LoginIdentityMessage';

describe(LoginIdentity.name, () => {
  it('delegates login and orders conversations by latest message', async () => {
    const expected = {
      conversations: [
        { id: 'old', latestMessageAt: 1, networkId: 'net' },
        { id: 'new', latestMessageAt: 2, networkId: 'net' },
      ],
      session: { password: 'secret' },
    } as unknown as LoginResult;
    const gateway = {
      loadMessages: jest.fn(),
      login: jest.fn().mockResolvedValue(expected),
    } as unknown as LoginIdentityPort;
    const useCase = new LoginIdentity(gateway);

    await expect(
      useCase.login(
        new LoginIdentityMessage({
          identityId: 'identity-1',
          password: 'secret',
        }),
      ),
    ).resolves.toEqual({
      ...expected,
      conversations: [
        { id: 'new', latestMessageAt: 2, networkId: 'net' },
        { id: 'old', latestMessageAt: 1, networkId: 'net' },
      ],
    });
    expect(gateway.login).toHaveBeenCalledWith('identity-1', 'secret');
    expect(gateway.loadMessages).not.toHaveBeenCalled();
  });

  it('orders login conversations by latest loaded message when activity timestamps are missing', async () => {
    const expected = {
      conversations: [
        { id: 'old', networkId: 'net' },
        { id: 'new', networkId: 'net' },
      ],
      session: { identity: { id: 'identity-1' }, password: 'secret' },
    } as unknown as LoginResult;
    const gateway = {
      loadMessages: jest.fn((_session, conversationId: string) =>
        Promise.resolve(
          conversationId === 'new'
            ? {
                messages: [
                  { id: 'newest', timestamp: 40 },
                  { id: 'older', timestamp: 20 },
                ],
              }
            : { messages: [{ id: 'oldest', timestamp: 10 }] },
        ),
      ),
      login: jest.fn().mockResolvedValue(expected),
    } as unknown as LoginIdentityPort;
    const useCase = new LoginIdentity(gateway);

    await expect(
      useCase.login(
        new LoginIdentityMessage({
          identityId: 'identity-1',
          password: 'secret',
        }),
      ),
    ).resolves.toEqual({
      ...expected,
      conversations: [
        { id: 'new', latestMessageAt: 40, networkId: 'net' },
        { id: 'old', latestMessageAt: 10, networkId: 'net' },
      ],
    });
  });
});
