import { mock } from 'jest-mock-extended';

import type { PigeonIdentitiesGateway } from '../../../../../contexts/identities/infrastructure/http/PigeonIdentitiesGateway';
import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';

import { DeviceRetirement } from '../../../../../contexts/identities/domain/value-objects/DeviceRetirement';
import { IdentityId } from '../../../../../contexts/identities/domain/value-objects/IdentityId';
import { IdentityAccessContextNotFoundError } from '../../../../../contexts/identities/infrastructure/http/errors/IdentityAccessContextNotFoundError';
import { IdentityAccessContexts } from '../../../../../contexts/identities/infrastructure/http/IdentityAccessContexts';
import { PigeonOwnDeviceRepository } from '../../../../../contexts/identities/infrastructure/http/PigeonOwnDeviceRepository';

const session = { identity: { id: 'identity-a' } } as unknown as Session;

describe(PigeonOwnDeviceRepository.name, () => {
  it.each([
    ['already-revoked', DeviceRetirement.ALREADY_REVOKED],
    ['last-device', DeviceRetirement.LAST_DEVICE],
    ['revoked', DeviceRetirement.REVOKED],
  ] as const)(
    'retires the device of the registered session as %s',
    async (outcome, retirement) => {
      const gateway = mock<PigeonIdentitiesGateway>();
      const contexts = new IdentityAccessContexts();

      contexts.register(session);
      gateway.retireOwnDevice.mockResolvedValue(outcome);

      const result = await new PigeonOwnDeviceRepository(
        gateway,
        contexts,
      ).retire(IdentityId.fromString('identity-a'));

      expect(result.isEqual(retirement)).toBe(true);
      expect(gateway.retireOwnDevice).toHaveBeenCalledWith(session);
    },
  );

  it('fails explicitly when the session was not registered', async () => {
    const gateway = mock<PigeonIdentitiesGateway>();

    await expect(
      new PigeonOwnDeviceRepository(
        gateway,
        new IdentityAccessContexts(),
      ).retire(IdentityId.fromString('identity-a')),
    ).rejects.toThrow(IdentityAccessContextNotFoundError);
    expect(gateway.retireOwnDevice).not.toHaveBeenCalled();
  });
});
