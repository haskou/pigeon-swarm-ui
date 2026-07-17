import type { IdentityResource } from '../../../../../contexts/identities/infrastructure/http/resources/IdentityResource';

import { IdentityMapper } from '../../../../../contexts/identities/infrastructure/http/IdentityMapper';

function resource(): IdentityResource {
  return {
    encryptedKeyPair: {
      encryptedPrivateKey: 'encrypted-private-key',
      publicKey: 'public-key',
    },
    encryptedMasterKey: 'encrypted-master-key',
    id: 'identity-a',
    masterKeyDerivation: {
      algorithm: 'scrypt',
      N: 262_144,
      p: 1,
      r: 8,
      salt: 'salt',
      version: 1,
    },
    networks: ['network-a'],
    profile: {
      banner: 'banner-cid',
      biography: 'Computing pioneer',
      handle: 'ada',
      name: 'Ada',
      picture: 'picture-cid',
    },
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
