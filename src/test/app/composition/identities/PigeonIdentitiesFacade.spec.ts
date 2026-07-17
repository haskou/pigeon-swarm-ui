import { mock, mockDeep } from 'jest-mock-extended';

import type { IdentityUseCases } from '../../../../app/composition/identities/IdentityUseCases';
import type { IdentityMapper } from '../../../../contexts/identities/infrastructure/http/IdentityMapper';
import type { IdentityPresenceMapper } from '../../../../contexts/identities/infrastructure/http/IdentityPresenceMapper';
import type { PigeonIdentitiesGateway } from '../../../../contexts/identities/infrastructure/http/PigeonIdentitiesGateway';
import type { Session } from '../../../../shared/domain/pigeonResources.types';

import { PigeonIdentitiesFacade } from '../../../../app/composition/identities/PigeonIdentitiesFacade';
import { Identity } from '../../../../contexts/identities/domain/Identity';
import { IdentityAccessContexts } from '../../../../contexts/identities/infrastructure/http/IdentityAccessContexts';

describe(PigeonIdentitiesFacade.name, () => {
  it('hydrates and orders the workspace after the use case unlocks identity', async () => {
    const gateway = mock<PigeonIdentitiesGateway>();
    const contexts = new IdentityAccessContexts();
    const useCases = mockDeep<IdentityUseCases>();
    const session = {
      identity: { id: 'identity-a' },
    } as unknown as Session;
    const identity = Identity.fromPrimitives({
      createdAt: 100,
      id: 'identity-a',
      networkIds: [],
      profile: {
        banner: undefined,
        biography: undefined,
        handle: undefined,
        name: 'Ada',
        picture: undefined,
      },
    });

    contexts.register(session);
    useCases.login.login.mockResolvedValue(identity);
    gateway.hydrateSession.mockResolvedValue({
      conversations: [
        { id: 'older', latestMessageAt: 1, networkId: 'network-a' },
        { id: 'newer', latestMessageAt: 2, networkId: 'network-a' },
      ],
      session,
    });

    const result = await new PigeonIdentitiesFacade(
      gateway,
      contexts,
      mock<IdentityMapper>(),
      mock<IdentityPresenceMapper>(),
      useCases,
    ).login('identity-a', 'Correct-Horse-Battery-9!');

    expect(result.conversations.map(({ id }) => id)).toEqual([
      'newer',
      'older',
    ]);
    expect(gateway.hydrateSession).toHaveBeenCalledWith(session, undefined);
  });
});
