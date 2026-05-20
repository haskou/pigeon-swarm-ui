import type { IdentityResource } from '../../../../shared/domain/pigeonResources.types';

import { ProfileName } from '../profile/profileName';
import { IdentityNetworkId } from '../value-objects/identityNetworkId';
import { Identity } from './identity';

const identityResource = (
  overrides: Partial<IdentityResource> = {},
): IdentityResource => ({
  encryptedKeyPair: {
    encryptedPrivateKey: 'private',
    publicKey: 'public',
  },
  id: 'identity-a',
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
