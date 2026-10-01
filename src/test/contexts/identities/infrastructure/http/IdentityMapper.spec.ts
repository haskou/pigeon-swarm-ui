import type { IdentityResource } from '../../../../../contexts/identities/infrastructure/http/resources/IdentityResource';

import { IdentityMapper } from '../../../../../contexts/identities/infrastructure/http/IdentityMapper';

function resource(): IdentityResource {
  return {
    authorizationRevision: 0,
    deviceCredential: 'device-credential',
    deviceCredentialCommitment: 'device-credential-commitment',
    id: 'identity-a',
    networks: ['network-a'],
    profile: {
      banner: 'banner-cid',
      biography: 'Computing pioneer',
      handle: 'ada',
      name: 'Ada',
      picture: 'picture-cid',
    },
    recoveryAuthority: 'recovery-authority',
    signature: 'signature',
    timestamp: 100,
    version: 1,
  };
}

describe(IdentityMapper.name, () => {
  it('hydrates and serializes profile state without losing wire metadata', () => {
    const mapper = new IdentityMapper();
    const source = resource();
    const mapped = mapper.toResource(mapper.fromResource(source), source);

    expect(mapped).toEqual(source);
  });
});
