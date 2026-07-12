import type { RegisterIdentityPort } from '../../../contexts/identities/application/register-identity/RegisterIdentityPort';
import type { LoginResult } from '../../../shared/domain/pigeonResources.types';

import { PigeonApiGateway } from '../../../app/composition/PigeonApiGateway';
import { PigeonApplication } from '../../../app/composition/PigeonApplication';
import { RealtimeGateway } from '../../../shared/infrastructure/realtime/RealtimeGateway';

type IdentityRegistrationMock = jest.MockedFunction<
  RegisterIdentityPort['register']
>;

function gatewayDouble(): {
  gateway: PigeonApiGateway;
  register: IdentityRegistrationMock;
} {
  const register: IdentityRegistrationMock = jest.fn().mockResolvedValue({
    conversations: [],
    session: { identity: { id: 'identity-1' } },
  } as unknown as LoginResult);

  return {
    gateway: {
      communityGateway: {},
      identityGateway: { register },
      identityRegistration: { register },
    } as unknown as PigeonApiGateway,
    register,
  };
}

describe(PigeonApplication.name, () => {
  it('passes passkey PRF registration options to the gateway', async () => {
    const { gateway, register } = gatewayDouble();
    const application = new PigeonApplication(
      gateway,
      {} as unknown as RealtimeGateway,
    );

    await application.identities.register(
      'Ada Lovelace',
      'secret-password',
      ['network-1'],
      'ada',
      {
        passkeyPrfEnabled: true,
      },
    );

    const [name, password, networks, handle, options] = register.mock.calls[0];

    expect(name.toString()).toBe('Ada Lovelace');
    expect(password).toBe('secret-password');
    expect(networks.toPrimitives()).toEqual(['network-1']);
    expect(handle?.toString()).toBe('ada');
    expect(options).toEqual({
      passkeyPrfEnabled: true,
      recoveryKey: undefined,
    });
  });
});
