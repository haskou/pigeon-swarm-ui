import { DeviceAuthorizationCheckpoint } from '../../../../contexts/identities/domain/DeviceAuthorizationCheckpoint';
import { DeviceAuthorizationIdentityMismatchError } from '../../../../contexts/identities/domain/errors/DeviceAuthorizationIdentityMismatchError';
import { DeviceAuthorizationEpoch } from '../../../../contexts/identities/domain/value-objects/DeviceAuthorizationEpoch';
import { DeviceAuthorizationRevision } from '../../../../contexts/identities/domain/value-objects/DeviceAuthorizationRevision';
import { IdentityId } from '../../../../contexts/identities/domain/value-objects/IdentityId';

describe(DeviceAuthorizationCheckpoint.name, () => {
  const state = (
    identityId: string,
  ): Parameters<typeof DeviceAuthorizationCheckpoint.forIdentity>[1] => ({
    compromisedCredentials: [],
    epoch: DeviceAuthorizationEpoch.fromString('genesis'),
    identityId: IdentityId.fromString(identityId),
    revision: DeviceAuthorizationRevision.fromNumber(2),
  });

  it('exposes the checkpoint of the expected identity', () => {
    const identityId = IdentityId.fromString('identity');
    const checkpoint = DeviceAuthorizationCheckpoint.forIdentity(
      identityId,
      state('identity'),
    );

    expect(checkpoint.getIdentityId().isEqual(identityId)).toBe(true);
    expect(checkpoint.getEpoch().valueOf()).toBe('genesis');
    expect(checkpoint.getRevision().valueOf()).toBe(2);
  });

  it('rejects a checkpoint for another identity', () => {
    expect(() =>
      DeviceAuthorizationCheckpoint.forIdentity(
        IdentityId.fromString('identity'),
        state('other'),
      ),
    ).toThrow(DeviceAuthorizationIdentityMismatchError);
  });
});
