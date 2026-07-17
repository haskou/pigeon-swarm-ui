import { mock } from 'jest-mock-extended';

import type { IdentityRepository } from '../../../../../contexts/identities/domain/repositories/IdentityRepository';

import { IdentityProfileUpdater } from '../../../../../contexts/identities/application/update-identity-profile/IdentityProfileUpdater';
import { UpdateIdentityProfileMessage } from '../../../../../contexts/identities/application/update-identity-profile/messages/UpdateIdentityProfileMessage';
import { Identity } from '../../../../../contexts/identities/domain/Identity';
import { IdentityNetworkId } from '../../../../../contexts/identities/domain/value-objects/IdentityNetworkId';

describe(IdentityProfileUpdater.name, () => {
  it('mutates the aggregate before persisting the identity', async () => {
    const repository = mock<IdentityRepository>();
    const identity = Identity.fromPrimitives({
      createdAt: 100,
      id: 'identity-a',
      networkIds: ['network-a'],
      profile: {
        banner: undefined,
        biography: undefined,
        handle: undefined,
        name: 'Ada',
        picture: undefined,
      },
    });

    repository.find.mockResolvedValue(identity);
    repository.update.mockResolvedValue(identity);

    await expect(
      new IdentityProfileUpdater(repository).update(
        new UpdateIdentityProfileMessage({
          actorIdentityId: 'identity-a',
          biography: 'Computing pioneer',
          handle: 'ada',
          name: 'Ada Lovelace',
          networkIds: ['network-a', 'network-b'],
          occurredAt: 200,
        }),
      ),
    ).resolves.toBe(identity);

    expect(
      identity.belongsToNetwork(IdentityNetworkId.fromString('network-b')),
    ).toBe(true);
    expect(identity.pullDomainEvents()).toHaveLength(1);
    expect(repository.update).toHaveBeenCalledWith(identity, expect.anything());
  });
});
