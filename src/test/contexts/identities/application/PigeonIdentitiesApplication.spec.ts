import type { RegisterIdentityPort } from '../../../../contexts/identities/application/ports/RegisterIdentityPort';
import type {
  LocalKeychain,
  LoginResult,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

import { PigeonIdentitiesApplication } from '../../../../contexts/identities/application/PigeonIdentitiesApplication';

describe(PigeonIdentitiesApplication.name, () => {
  type Dependencies = ConstructorParameters<
    typeof PigeonIdentitiesApplication
  >[0];

  function dependencies(): Dependencies {
    return {
      keychain: { publishKeychain: jest.fn() },
      login: { login: jest.fn() },
      presence: { get: jest.fn(), getMany: jest.fn(), update: jest.fn() },
      profile: {
        getIdentity: jest.fn(),
        refreshIdentity: jest.fn(),
        updateIdentityProfile: jest.fn(),
      },
      protection: { configureLocalPasskeyUnlock: jest.fn() },
      register: { register: jest.fn() },
    } as unknown as Dependencies;
  }

  it('passes passkey and recovery protection through registration', async () => {
    const deps = dependencies();
    const result = { conversations: [] } as unknown as LoginResult;
    deps.register.register = jest.fn().mockResolvedValue(result);
    const application = new PigeonIdentitiesApplication(deps);

    await expect(
      application.register(
        'Ada Lovelace',
        'correct horse battery staple',
        ['network-1'],
        'ada',
        { passkeyPrfEnabled: true, recoveryKey: 'recovery-key' },
      ),
    ).resolves.toBe(result);

    expect(deps.register.register).toHaveBeenCalledTimes(1);
    const register = deps.register.register as jest.MockedFunction<
      RegisterIdentityPort['register']
    >;
    const [name, password, networks, handle, options] = register.mock.calls[0];
    expect(name.toString()).toBe('Ada Lovelace');
    expect(password).toBe('correct horse battery staple');
    expect(networks.toPrimitives()).toEqual(['network-1']);
    expect(handle?.toString()).toBe('ada');
    expect(options).toEqual({
      passkeyPrfEnabled: true,
      recoveryKey: 'recovery-key',
    });
  });

  it('publishes keychains without exposing identity internals', async () => {
    const deps = dependencies();
    const session = {
      identity: { id: 'identity-1' },
    } as unknown as Session;
    const keychain = { conversations: {}, version: 2 } as LocalKeychain;
    const published = {
      keychain,
      keychainExternalIdentifier: 'keychain-cid',
    };
    deps.keychain.publishKeychain = jest.fn().mockResolvedValue(published);
    const application = new PigeonIdentitiesApplication(deps);

    await expect(application.publishKeychain(session, keychain)).resolves.toBe(
      published,
    );
    expect(deps.keychain.publishKeychain).toHaveBeenCalledWith(
      session,
      keychain,
    );
  });
});
