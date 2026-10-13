import { DeviceAuthorizationIdentityMismatchError } from '../../../../../contexts/identities/domain/errors/DeviceAuthorizationIdentityMismatchError';
import { IdentityId } from '../../../../../contexts/identities/domain/value-objects/IdentityId';
import { DeviceAuthorizationCheckpointMapper } from '../../../../../contexts/identities/infrastructure/http/DeviceAuthorizationCheckpointMapper';
import vectors from '../../../../fixtures/device-authorization-transition-vectors.json';

describe(DeviceAuthorizationCheckpointMapper.name, () => {
  it('maps the resource into validated value objects', () => {
    const identityId = IdentityId.fromString('identity');
    const checkpoint = DeviceAuthorizationCheckpointMapper.fromResource(
      { epoch: 'genesis', identityId: 'identity', revision: 2 },
      identityId,
    );

    expect(checkpoint.getIdentityId().isEqual(identityId)).toBe(true);
    expect(checkpoint.getEpoch().valueOf()).toBe('genesis');
    expect(checkpoint.getRevision().valueOf()).toBe(2);
  });

  it('rejects a resource for another identity', () => {
    expect(() =>
      DeviceAuthorizationCheckpointMapper.fromResource(
        { epoch: 'genesis', identityId: 'other', revision: 2 },
        IdentityId.fromString('identity'),
      ),
    ).toThrow(DeviceAuthorizationIdentityMismatchError);
  });

  it('maps the compromised credentials of the authorization', () => {
    const credential = vectors.keys.target.publicKeyPem;
    const checkpoint = DeviceAuthorizationCheckpointMapper.fromResource(
      {
        compromisedCredentials: [{ compromisedSince: 2, credential }],
        epoch: 'genesis',
        identityId: 'identity',
        revision: 4,
      },
      IdentityId.fromString('identity'),
    );

    expect(
      checkpoint.getCompromisedCredentials().map((entry) => ({
        compromisedSince: entry.compromisedSince.valueOf(),
        credential: entry.credential.valueOf(),
      })),
    ).toEqual([{ compromisedSince: 2, credential }]);
  });

  it('reads a resource without the field as carrying no compromised credentials', () => {
    const checkpoint = DeviceAuthorizationCheckpointMapper.fromResource(
      { epoch: 'genesis', identityId: 'identity', revision: 2 },
      IdentityId.fromString('identity'),
    );

    expect(checkpoint.getCompromisedCredentials()).toEqual([]);
  });
});
