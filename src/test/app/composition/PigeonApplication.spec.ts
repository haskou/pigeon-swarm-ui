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
  const listConversations = jest.fn();
  const loadMessages = jest.fn();
  const stickersGateway = {
    addSticker: jest.fn(),
    createPack: jest.fn(),
    deleteSticker: jest.fn(),
    favoriteSticker: jest.fn(),
    getMyStickers: jest.fn(),
    getPack: jest.fn(),
    listPacks: jest.fn(),
    markUsed: jest.fn(),
    savePack: jest.fn(),
    unsavePack: jest.fn(),
    updatePack: jest.fn(),
    updateSticker: jest.fn(),
    uploadAsset: jest.fn(),
  };

  return {
    gateway: {
      communityGateway: {},
      conversationsGateway: { listConversations },
      identityGateway: { register },
      identityRegistration: { register },
      messagesGateway: { loadMessages },
      notificationsGateway: {},
      pushGateway: {},
      stickersGateway,
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
