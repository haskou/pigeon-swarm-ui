import { DeviceAuthorizationCheckpoint } from '../../../../contexts/identities/domain/DeviceAuthorizationCheckpoint';
import { DeviceAuthorizationIdentityMismatchError } from '../../../../contexts/identities/domain/errors/DeviceAuthorizationIdentityMismatchError';
import { IdentityId } from '../../../../contexts/identities/domain/value-objects/IdentityId';
import vectors from '../../../fixtures/device-authorization-transition-vectors.json';

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
    ).toThrow(DeviceAuthorizationIdentityMismatchError);
  });

  it('exposes the compromised credentials of the authorization', () => {
    const identityId = IdentityId.fromString('identity');
    const credential = vectors.keys.target.publicKeyPem;
    const checkpoint = DeviceAuthorizationCheckpoint.fromResource(
      {
        compromisedCredentials: [{ compromisedSince: 2, credential }],
        epoch: 'genesis',
        identityId: 'identity',
        revision: 4,
      },
      identityId,
    );

    expect(
      checkpoint.getCompromisedCredentials().map((entry) => ({
        compromisedSince: entry.compromisedSince.valueOf(),
        credential: entry.credential.valueOf(),
      })),
    ).toEqual([{ compromisedSince: 2, credential }]);
  });

  it('reads an authorization without the field as carrying no compromised credentials', () => {
    const checkpoint = DeviceAuthorizationCheckpoint.fromResource(
      { epoch: 'genesis', identityId: 'identity', revision: 2 },
      IdentityId.fromString('identity'),
    );

    expect(checkpoint.getCompromisedCredentials()).toEqual([]);
  });
});
