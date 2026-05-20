import type { LoginResult } from '../../../../shared/domain/pigeonResources.types';
import type { PigeonApiGateway } from '../../../../app/composition/pigeonApiGateway';

import { LoginIdentity } from './loginIdentity';

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
    } as unknown as PigeonApiGateway;
    const useCase = new LoginIdentity(gateway);

    await expect(useCase.execute('identity-1', 'secret')).resolves.toEqual({
      ...expected,
      conversations: [
        { id: 'new', latestMessageAt: 2, networkId: 'net' },
        { id: 'old', latestMessageAt: 1, networkId: 'net' },
      ],
    });
    expect(gateway.login).toHaveBeenCalledWith('identity-1', 'secret');
  });
});
