import type {
  LocalKeychain,
  LoginResult,
  Session,
} from '../../shared/domain/pigeonResources.types';

import { PigeonPresenceGateway } from './gateways/PigeonPresenceGateway';
import { PigeonApiGateway } from './PigeonApiGateway';
import { PigeonIdentitiesApplication } from './PigeonIdentitiesApplication';

describe(PigeonIdentitiesApplication.name, () => {
  function gatewayDouble(): jest.Mocked<PigeonApiGateway> {
    return {
      login: jest.fn(),
      publishKeychain: jest.fn(),
      register: jest.fn(),
    } as unknown as jest.Mocked<PigeonApiGateway>;
  }

  function presenceDouble(): jest.Mocked<PigeonPresenceGateway> {
    return {
      get: jest.fn(),
      getMany: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<PigeonPresenceGateway>;
  }

  it('passes passkey and recovery protection through registration', async () => {
    const gateway = gatewayDouble();
    const result = { conversations: [] } as unknown as LoginResult;
    gateway.register.mockResolvedValue(result);
    const application = new PigeonIdentitiesApplication(
      gateway,
      presenceDouble(),
    );

    await expect(
      application.register(
        'Ada Lovelace',
        'correct horse battery staple',
        ['network-1'],
        'ada',
        { passkeyPrfEnabled: true, recoveryKey: 'recovery-key' },
      ),
    ).resolves.toBe(result);

    expect(gateway.register).toHaveBeenCalledWith(
      'Ada Lovelace',
      'correct horse battery staple',
      ['network-1'],
      'ada',
      { passkeyPrfEnabled: true, recoveryKey: 'recovery-key' },
    );
  });

  it('publishes keychains without exposing identity internals', async () => {
    const gateway = gatewayDouble();
    const session = {
      identity: { id: 'identity-1' },
    } as unknown as Session;
    const keychain = { conversations: {}, version: 2 } as LocalKeychain;
    const published = {
      keychain,
      keychainExternalIdentifier: 'keychain-cid',
    };
    gateway.publishKeychain.mockResolvedValue(published);
    const application = new PigeonIdentitiesApplication(
      gateway,
      presenceDouble(),
    );

    await expect(application.publishKeychain(session, keychain)).resolves.toBe(
      published,
    );
    expect(gateway.publishKeychain).toHaveBeenCalledWith(session, keychain);
  });
});
