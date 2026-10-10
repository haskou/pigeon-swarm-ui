import { mock } from 'jest-mock-extended';

import type { IdentityUnlockRepository } from '../../../../../contexts/identities/domain/repositories/IdentityUnlockRepository';

import { DeviceUnlockForgetter } from '../../../../../contexts/identities/application/forget-device-unlock/DeviceUnlockForgetter';
import { ForgetDeviceUnlockMessage } from '../../../../../contexts/identities/application/forget-device-unlock/messages/ForgetDeviceUnlockMessage';
import { IdentityId } from '../../../../../contexts/identities/domain/value-objects/IdentityId';

describe(DeviceUnlockForgetter.name, () => {
  it('forgets the device unlock of the identity through its repository', async () => {
    const repository = mock<IdentityUnlockRepository>();

    repository.forget.mockResolvedValue(undefined);

    await new DeviceUnlockForgetter(repository).forget(
      new ForgetDeviceUnlockMessage('identity-a'),
    );

    expect(repository.forget).toHaveBeenCalledWith(
      IdentityId.fromString('identity-a'),
    );
  });
});
