import type { LoginResult } from '../../../../shared/domain/pigeonResources.types';
import type { LoginIdentityPort } from '../ports/loginIdentityPort';

import { LoginIdentity } from './loginIdentity';
import { LoginIdentityMessage } from './messages/loginIdentityMessage';

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
  });
});
