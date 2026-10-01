import { DeviceAuthorizationCheckpoint } from '../../../../contexts/identities/domain/DeviceAuthorizationCheckpoint';
import { IdentityId } from '../../../../contexts/identities/domain/value-objects/IdentityId';

describe(DeviceAuthorizationCheckpoint.name, () => {
  it('exposes validated value objects', () => {
    const identityId = IdentityId.fromString('identity');
    const checkpoint = DeviceAuthorizationCheckpoint.fromResource(
      { epoch: 'genesis', identityId: 'identity', revision: 2 },
      identityId,
    );

    expect(checkpoint.getIdentityId().isEqual(identityId)).toBe(true);
    expect(checkpoint.getEpoch().valueOf()).toBe('genesis');
    expect(checkpoint.getRevision().valueOf()).toBe(2);
  });

  it('rejects a checkpoint for another identity', () => {
    expect(() =>
      DeviceAuthorizationCheckpoint.fromResource(
        { epoch: 'genesis', identityId: 'other', revision: 2 },
        IdentityId.fromString('identity'),
      ),
    ).toThrow('does not match');
  });
});
