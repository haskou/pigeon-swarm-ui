import { mock } from 'jest-mock-extended';

import type { IdentityPresenceRepository } from '../../../../../contexts/identities/domain/repositories/IdentityPresenceRepository';

import { IdentityPresenceFinder } from '../../../../../contexts/identities/application/find-identity-presence/IdentityPresenceFinder';
import { FindIdentityPresenceMessage } from '../../../../../contexts/identities/application/find-identity-presence/messages/FindIdentityPresenceMessage';
import { IdentityPresencesSearcher } from '../../../../../contexts/identities/application/search-identity-presences/IdentityPresencesSearcher';
import { SearchIdentityPresencesMessage } from '../../../../../contexts/identities/application/search-identity-presences/messages/SearchIdentityPresencesMessage';
import { IdentityPresenceUpdater } from '../../../../../contexts/identities/application/update-identity-presence/IdentityPresenceUpdater';
import { UpdateIdentityPresenceMessage } from '../../../../../contexts/identities/application/update-identity-presence/messages/UpdateIdentityPresenceMessage';
import { IdentityPresence } from '../../../../../contexts/identities/domain/IdentityPresence';

function presence(identityId = 'identity-a'): IdentityPresence {
  return IdentityPresence.fromPrimitives({
    identityId,
    lastActivityAt: undefined,
    lastHeartbeatAt: undefined,
    networkIds: [],
    status: 'available',
    updatedAt: 100,
  });
}

describe('identity presence use cases', () => {
  it('finds one identity presence', async () => {
    const repository = mock<IdentityPresenceRepository>();
    const result = presence();

    repository.find.mockResolvedValue(result);

    await expect(
      new IdentityPresenceFinder(repository).find(
        new FindIdentityPresenceMessage('identity-a', 'actor-a'),
      ),
    ).resolves.toBe(result);
  });

  it('searches identity presences', async () => {
    const repository = mock<IdentityPresenceRepository>();
    const result = [presence(), presence('identity-b')];

    repository.search.mockResolvedValue(result);

    await expect(
      new IdentityPresencesSearcher(repository).search(
        new SearchIdentityPresencesMessage(
          ['identity-a', 'identity-b'],
          'actor-a',
        ),
      ),
    ).resolves.toBe(result);
  });

  it('updates presence through the aggregate before persistence', async () => {
    const repository = mock<IdentityPresenceRepository>();
    const result = presence();

    repository.update.mockResolvedValue(result);

    await new IdentityPresenceUpdater(repository).update(
      new UpdateIdentityPresenceMessage('identity-a', 'away', 200),
    );

    const persistedPresence = repository.update.mock.calls[0]?.[0];

    expect(repository.find).not.toHaveBeenCalled();
    expect(persistedPresence?.pullDomainEvents()).toHaveLength(1);
    expect(repository.update).toHaveBeenCalledWith(
      persistedPresence,
      expect.anything(),
    );
  });
});
