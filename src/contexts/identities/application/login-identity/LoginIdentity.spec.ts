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
    const loadMessages = jest.fn();
    const gateway = {
      loadMessages,
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
    expect(gateway.login).toHaveBeenCalledWith(
      'identity-1',
      'secret',
      undefined,
      undefined,
    );
    expect(loadMessages).not.toHaveBeenCalled();
  });

  it('keeps login conversations without activity timestamps without loading messages', async () => {
    const expected = {
      conversations: [
        { id: 'with-activity', latestMessageAt: 10, networkId: 'net' },
        { id: 'without-activity', networkId: 'net' },
      ],
      session: { identity: { id: 'identity-1' }, password: 'secret' },
    } as unknown as LoginResult;
    const loadMessages = jest.fn();
    const gateway = {
      loadMessages,
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
        { id: 'with-activity', latestMessageAt: 10, networkId: 'net' },
        { id: 'without-activity', networkId: 'net' },
      ],
    });
    expect(loadMessages).not.toHaveBeenCalled();
  });
});
