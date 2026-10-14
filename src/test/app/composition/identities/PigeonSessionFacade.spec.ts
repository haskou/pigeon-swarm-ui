import { mock } from 'jest-mock-extended';

import type { PigeonIdentitiesFacade } from '../../../../app/composition/identities/PigeonIdentitiesFacade';
import type { PigeonIdentitiesGateway } from '../../../../contexts/identities/infrastructure/http/PigeonIdentitiesGateway';
import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';

import { PigeonSessionFacade } from '../../../../app/composition/identities/PigeonSessionFacade';

describe(PigeonSessionFacade.name, () => {
  it('orders conversations when refreshing a session', async () => {
    const gateway = mock<PigeonIdentitiesGateway>();
    const identities = mock<PigeonIdentitiesFacade>();
    const session = {} as Session;

    gateway.refreshSession.mockResolvedValue({
      conversations: [
        {
          adminIds: [],
          id: 'older',
          latestMessageAt: 1,
          networkId: 'network-a',
          participantIds: ['identity-a'],
          type: 'one-to-one',
        },
        {
          adminIds: [],
          id: 'newer',
          latestMessageAt: 2,
          networkId: 'network-a',
          participantIds: ['identity-a'],
          type: 'one-to-one',
        },
      ],
      session,
    });

    const result = await new PigeonSessionFacade(gateway, identities).refresh(
      session,
    );

    expect(result.conversations.map(({ id }) => id)).toEqual([
      'newer',
      'older',
    ]);
  });
});
