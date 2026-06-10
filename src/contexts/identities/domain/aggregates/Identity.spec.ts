import type { IdentityResource } from '../../../../shared/domain/pigeonResources.types';

import { ProfileName } from '../profile/ProfileName';
import { IdentityNetworkId } from '../value-objects/IdentityNetworkId';
import { Identity } from './Identity';

const identityResource = (
  overrides: Partial<IdentityResource> = {},
): IdentityResource => ({
  encryptedKeyPair: {
    encryptedPrivateKey: 'private',
    publicKey: 'public',
  },
  encryptedMasterKey: 'encrypted-master-key',
  id: 'identity-a',
  masterKeyDerivation: {
    algorithm: 'scrypt',
    N: 16_384,
    p: 5,
    r: 8,
    salt: 'master-salt',
    version: 1,
  },
  networks: ['network-a'],
  profile: { name: 'Ada' },
  signature: 'signature',
  timestamp: 100,
  version: 1,
  ...overrides,
});

describe('Identity', () => {
  it('keeps network membership behavior inside the aggregate', () => {
    const identity = Identity.fromResource(identityResource());
    const networkId = IdentityNetworkId.fromString('network-b');

    identity.joinNetwork(networkId);

    expect(identity.belongsToNetwork(networkId)).toBe(true);
    expect(identity.pullDomainEvents()).toHaveLength(1);
  });

  it('renames the profile through a ProfileName value object', () => {
    const identity = Identity.fromResource(identityResource());
    const name = new ProfileName('Grace');

    identity.rename(name);

    expect(identity.getProfile().getName().isEqual(name)).toBe(true);
    expect(identity.pullDomainEvents()).toHaveLength(1);
  });
});
