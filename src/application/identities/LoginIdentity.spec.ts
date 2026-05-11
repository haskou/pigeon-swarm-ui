import type { LoginResult } from '../../domain/types';
import type { PigeonApiGateway } from '../../infrastructure/pigeon-api/PigeonApiGateway';

import { LoginIdentity } from './LoginIdentity';

describe(LoginIdentity.name, () => {
  it('delegates login to the pigeon API gateway', async () => {
    const expected = {
      conversations: [],
      session: { password: 'secret' },
    } as unknown as LoginResult;
    const gateway = {
      login: jest.fn().mockResolvedValue(expected),
    } as unknown as PigeonApiGateway;
    const useCase = new LoginIdentity(gateway);

    await expect(useCase.execute('identity-1', 'secret')).resolves.toBe(
      expected,
    );
    expect(gateway.login).toHaveBeenCalledWith('identity-1', 'secret');
  });
});
