import type { IdentityUpdateProfileInput } from '../../../../../contexts/identities/domain/IdentitySignaturePayloadFactory';
import type {
  IdentityResource,
  Session,
} from '../../../../../shared/domain/pigeonResources.types';

import { PigeonIdentityCommandsApi } from '../../../../../contexts/identities/infrastructure/http/PigeonIdentityCommandsApi';
import { PigeonIdentityGateway } from '../../../../../contexts/identities/infrastructure/http/PigeonIdentityGateway';
import { PigeonIdentityProfileApi } from '../../../../../contexts/identities/infrastructure/http/PigeonIdentityProfileApi';

describe(PigeonIdentityProfileApi.name, () => {
  it('coordinates identity reads and profile commands behind one port', async () => {
    const identity = { id: 'identity-1' } as IdentityResource;
    const updated = { id: 'identity-1', version: 2 } as IdentityResource;
    const profile = { name: 'Ada' } as IdentityUpdateProfileInput;
    const session = {} as Session;
    const reader = {
      get: jest.fn().mockResolvedValue(identity),
      refresh: jest.fn().mockResolvedValue(updated),
    } as unknown as PigeonIdentityGateway;
    const commands = {
      updateProfile: jest.fn().mockResolvedValue(updated),
    } as unknown as PigeonIdentityCommandsApi;
    const api = new PigeonIdentityProfileApi(reader, commands);

    await expect(api.getIdentity('identity-1')).resolves.toBe(identity);
    await expect(api.refreshIdentity('identity-1')).resolves.toBe(updated);
    await expect(
      api.updateIdentityProfile(session, profile, 'new-password', {
        passkeyPrfEnabled: true,
      }),
    ).resolves.toBe(updated);

    expect(commands.updateProfile).toHaveBeenCalledWith(
      session,
      profile,
      'new-password',
      { passkeyPrfEnabled: true },
    );
  });
});
